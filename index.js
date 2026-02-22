// =============================
// IMPORTS
// =============================
const makeWASocket = require("@whiskeysockets/baileys").default
const { useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const { Boom } = require("@hapi/boom")
const express = require("express")
const axios = require("axios")

// =============================
// CONFIG
// =============================
const PHONE_NUMBER = "59175324655" // ? TU NUMERO
const PORT = process.env.PORT || 3000
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || null

// =============================
// INICIAR BOT
// =============================
async function startBot() {

  const { state, saveCreds } = await useMultiFileAuthState("auth")

  const sock = makeWASocket({
    auth: state,
    browser: ["Bot", "Chrome", "1.0"]
  })

  sock.ev.on("creds.update", saveCreds)

  // =============================
  // LOGIN SIN QR (CODIGO)
  // =============================
  if (!sock.authState.creds.registered) {
    try {
      const code = await sock.requestPairingCode(PHONE_NUMBER)

      console.log("=================================")
      console.log("CODIGO DE VINCULACION:", code)
      console.log("=================================")

    } catch (err) {
      console.log("Esperando reconexion para generar codigo...")
    }
  }

  // =============================
  // CONEXION
  // =============================
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update

    if (connection === "open") {
      console.log("BOT CONECTADO ?")
    }

    if (connection === "close") {
      const shouldReconnect =
        (lastDisconnect?.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut

      if (shouldReconnect) {
        console.log("Reconectando...")
        setTimeout(startBot, 5000)
      } else {
        console.log("Sesion cerrada manualmente")
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
          text: `?? Bienvenido @${user.split("@")[0]}`,
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
        text: `?? @${sender.split("@")[0]} no se permiten enlaces`,
        mentions: [sender]
      })
      return
    }

    if (!isAdmin) return

    // =============================
    // COMANDOS
    // =============================
    if (text === "!comandos") {
      await sock.sendMessage(from, {
        text:
`?? BOT DEL GRUPO

!eliminar
!cerrar
!abrir
!todos
!futbol`
      })
    }

    if (text === "!cerrar") {
      await sock.groupSettingUpdate(from, "announcement")
      await sock.sendMessage(from, { text: "?? Grupo cerrado" })
    }

    if (text === "!abrir") {
      await sock.groupSettingUpdate(from, "not_announcement")
      await sock.sendMessage(from, { text: "?? Grupo abierto" })
    }

    if (text === "!todos") {
      const members = metadata.participants.map(p => p.id)
      await sock.sendMessage(from, {
        text: "?? Atención todos",
        mentions: members
      })
    }

    if (text === "!futbol") {
      const userGoals = Math.floor(Math.random() * 5)
      const botGoals = Math.floor(Math.random() * 5)

      let result = "?? Empate"
      if (userGoals > botGoals) result = "?? Ganaste"
      if (userGoals < botGoals) result = "?? Perdiste"

      await sock.sendMessage(from, {
        text:
`? Partido

Tú ${userGoals} - ${botGoals} Bot

${result}`
      })
    }
  })
}

startBot()

// =============================
// SERVIDOR WEB
// =============================
const app = express()

app.get("/", (req, res) => {
  res.send("Bot activo ?")
})

app.listen(PORT, () => {
  console.log("Servidor web puerto " + PORT)
})

// =============================
// ANTI SLEEP 24/7
// =============================
if (RENDER_URL) {
  setInterval(async () => {
    try {
      await axios.get(RENDER_URL)
      console.log("Ping anti-sleep")
    } catch {}
  }, 5 * 60 * 1000)
}