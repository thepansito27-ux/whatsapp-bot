const fs = require("fs")

if (fs.existsSync("./auth")) {
  fs.rmSync("./auth", { recursive: true, force: true })
}
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const { Boom } = require("@hapi/boom")
const qrcode = require("qrcode-terminal")

async function startBot() {

  const { state, saveCreds } = await useMultiFileAuthState("auth")

  const sock = makeWASocket({
    auth: state
  })

  sock.ev.on("creds.update", saveCreds)

  // ==============================
  // QR Y CONEXIÓN
  // ==============================
  const QRCode = require('qrcode')
const fs = require('fs')

sock.ev.on('connection.update', async (update) => {
  const { qr } = update

  if (qr) {
    await QRCode.toFile('qr.png', qr)
    console.log('QR guardado como qr.png')
  }
})
  // ==============================
  // BIENVENIDA
  // ==============================
  sock.ev.on("group-participants.update", async (update) => {
    const { id, participants, action } = update

    if (action === "add") {
      for (let user of participants) {
        await sock.sendMessage(id, {
          text: `?? Bienvenido @${user.split("@")[0]} al grupo!`,
          mentions: [user]
        })
      }
    }
  })

  // ==============================
  // MENSAJES
  // ==============================
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0]
    if (!msg.message) return

    const from = msg.key.remoteJid
    if (!from.endsWith("@g.us")) return

    const sender = msg.key.participant
    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text

    if (!text) return

    const metadata = await sock.groupMetadata(from)
    const admins = metadata.participants
      .filter(p => p.admin !== null)
      .map(p => p.id)

    const isAdmin = admins.includes(sender)

    // ==============================
    // ANTI LINKS
    // ==============================
    if (text.includes("http") && !isAdmin) {
      await sock.sendMessage(from, { delete: msg.key })
      await sock.sendMessage(from, {
        text: `?? @${sender.split("@")[0]} no se permiten enlaces`,
        mentions: [sender]
      })
      return
    }

    // SOLO ADMINS COMANDOS
    if (!isAdmin) return

    // ==============================
    // MENU
    // ==============================
    if (text === "!comandos") {
      await sock.sendMessage(from, {
        text:
`?? BOT DEL GRUPO

?? Moderación:
!eliminar (responde mensaje)
!cerrar
!abrir
!todos

? Juegos:
!futbol`
      })
    }

    // ==============================
    // ELIMINAR USUARIO
    // ==============================
    if (text === "!eliminar") {
      const replied =
        msg.message.extendedTextMessage?.contextInfo?.participant

      if (!replied) {
        await sock.sendMessage(from, {
          text: "Responde al mensaje del usuario que quieres eliminar"
        })
        return
      }

      await sock.groupParticipantsUpdate(from, [replied], "remove")
    }

    // ==============================
    // CERRAR GRUPO
    // ==============================
    if (text === "!cerrar") {
      await sock.groupSettingUpdate(from, "announcement")
      await sock.sendMessage(from, { text: "?? Grupo cerrado" })
    }

    // ==============================
    // ABRIR GRUPO
    // ==============================
    if (text === "!abrir") {
      await sock.groupSettingUpdate(from, "not_announcement")
      await sock.sendMessage(from, { text: "?? Grupo abierto" })
    }

    // ==============================
    // MENCIONAR TODOS
    // ==============================
    if (text === "!todos") {
      const members = metadata.participants.map(p => p.id)
      await sock.sendMessage(from, {
        text: "?? Atención todos!",
        mentions: members
      })
    }

    // ==============================
    // JUEGO FUTBOL
    // ==============================
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
// SERVIDOR WEB PARA VER QR
// =============================
const express = require('express')
const app = express()

app.use(express.static(__dirname))

app.get('/', (req, res) => {
  res.send('Bot activo ✅')
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log('Servidor web listo en puerto ' + PORT)
})

