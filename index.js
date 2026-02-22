// =============================
// IMPORTS
// =============================
const makeWASocket = require("@whiskeysockets/baileys").default
const { useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const { Boom } = require("@hapi/boom")
const express = require("express")

// =============================
// INICIAR BOT
// =============================
async function startBot() {

  const { state, saveCreds } = await useMultiFileAuthState("auth")

  const sock = makeWASocket({
    auth: state
  })

  sock.ev.on("creds.update", saveCreds)

  // =============================
  // LOGIN CON CODIGO (SIN QR)
  // =============================
  if (!sock.authState.creds.registered) {

    const phoneNumber = "59175324655" // 👈 CAMBIA POR TU NUMERO REAL

    const code = await sock.requestPairingCode(phoneNumber)
    console.log("=================================")
    console.log("CODIGO DE VINCULACION:", code)
    console.log("=================================")
  }

  // =============================
  // CONEXION
  // =============================
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update

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
        console.log("Sesion cerrada")
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
          text: `👋 Bienvenido @${user.split("@")[0]}`,
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

    if (!isAdmin) return

    // =============================
    // MENU
    // =============================
    if (text === "!comandos") {
      await sock.sendMessage(from, {
        text:
`🤖 BOT DEL GRUPO

📌 Moderación:
!eliminar
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
          text: "Responde al mensaje del usuario"
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
// SERVIDOR WEB (OBLIGATORIO EN RENDER)
// =============================
const app = express()

app.get("/", (req, res) => {
  res.send("Bot activo ✅")
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log("Servidor web puerto " + PORT)
})

