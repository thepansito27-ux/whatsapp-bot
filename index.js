// =============================
// 🔥 BORRAR SESIÓN (SOLO UNA VEZ)
// =============================
const fs = require("fs")

if (fs.existsSync("./auth")) {
  fs.rmSync("./auth", { recursive: true, force: true })
  console.log("Sesión eliminada")
}
// =============================
// IMPORTS
// =============================
const makeWASocket = require("@whiskeysockets/baileys").default
const { useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const { Boom } = require("@hapi/boom")
const QRCode = require("qrcode")
const express = require("express")

// =============================
// INICIAR BOT
// =============================
async function startBot() {

  const { state, saveCreds } = await useMultiFileAuthState("auth")

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  })

  sock.ev.on("creds.update", saveCreds)

  // =============================
  // QR + CONEXION
  // =============================
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      await QRCode.toFile("qr.png", qr)
      console.log("QR guardado como qr.png")
    }

    if (connection === "open") {
      console.log("BOT CONECTADO ✅")
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut

      if (shouldReconnect) {
        console.log("Reconectando...")
        startBot()
      } else {
        console.log("Sesión cerrada")
      }
    }
  })

  // =============================
  // BIENVENIDA
  // =============================
  sock.ev.on("group-participants.update", async (update) => {
    const { id, participants, action } = update

    if (action === "add") {
      for (let user of participants) {
        await sock.sendMessage(id, {
          text: `👋 Bienvenido @${user.split("@")[0]} al grupo`,
          mentions: [user]
        })
      }
    }
  })

  // =============================
  // MENSAJES
  // =============================
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message) return

    // SOPORTE MENSAJES EFIMEROS
    const message = msg.message?.ephemeralMessage?.message || msg.message

    const text = (
      message?.conversation ||
      message?.extendedTextMessage?.text ||
      ""
    ).toLowerCase().trim()

    if (!text) return

    console.log("MENSAJE:", text)

    const from = msg.key.remoteJid
    const sender = msg.key.participant || msg.key.remoteJid

    if (!from.endsWith("@g.us")) return

    const metadata = await sock.groupMetadata(from)
    const admins = metadata.participants
      .filter(p => p.admin)
      .map(p => p.id)

    const isAdmin = admins.includes(sender)

    // =============================
    // ANTI LINKS
    // =============================
    if (text.includes("http") && !isAdmin) {
      await sock.sendMessage(from, { delete: msg.key })
      await sock.sendMessage(from, {
        text: `🚫 @${sender.split("@")[0]} no se permiten enlaces`,
        mentions: [sender]
      })
      return
    }

    // SOLO ADMINS USAN COMANDOS
    if (!isAdmin) return

    // =============================
    // MENU
    // =============================
    if (text === "!comandos") {
      await sock.sendMessage(from, {
        text:
`🤖 BOT DEL GRUPO

📌 Moderación:
!eliminar (responde mensaje)
!cerrar
!abrir
!todos

⚽ Juegos:
!futbol`
      })
    }

    // =============================
    // ELIMINAR
    // =============================
    if (text === "!eliminar") {
      const replied =
        message?.extendedTextMessage?.contextInfo?.participant

      if (!replied) {
        await sock.sendMessage(from, {
          text: "Responde al mensaje del usuario que quieres eliminar"
        })
        return
      }

      await sock.groupParticipantsUpdate(from, [replied], "remove")
    }

    // =============================
    // CERRAR
    // =============================
    if (text === "!cerrar") {
      await sock.groupSettingUpdate(from, "announcement")
      await sock.sendMessage(from, { text: "🔒 Grupo cerrado" })
    }

    // =============================
    // ABRIR
    // =============================
    if (text === "!abrir") {
      await sock.groupSettingUpdate(from, "not_announcement")
      await sock.sendMessage(from, { text: "🔓 Grupo abierto" })
    }

    // =============================
    // TODOS
    // =============================
    if (text === "!todos") {
      const members = metadata.participants.map(p => p.id)
      await sock.sendMessage(from, {
        text: "📢 Atención todos",
        mentions: members
      })
    }

    // =============================
    // FUTBOL
    // =============================
    if (text === "!futbol") {
      const userGoals = Math.floor(Math.random() * 5)
      const botGoals = Math.floor(Math.random() * 5)

      let result = "🤝 Empate"
      if (userGoals > botGoals) result = "🏆 Ganaste"
      if (userGoals < botGoals) result = "😢 Perdiste"

      await sock.sendMessage(from, {
        text:
`⚽ Partido

Tú ${userGoals} - ${botGoals} Bot

${result}`
      })
    }
  })
}

startBot()

// =============================
// SERVIDOR WEB (RENDER)
// =============================
const app = express()

app.use(express.static(__dirname))

app.get("/", (req, res) => {
  res.send("Bot activo ✅")
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log("Servidor web en puerto " + PORT)
})

