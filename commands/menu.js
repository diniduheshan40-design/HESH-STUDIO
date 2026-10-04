const fs = require('fs');
const path = require('path');

// Safe Config Fallback
let config = {
  BOT_NAME: "DARK-DINU",
  OWNER_NAME: "DINIDU HESHAN",
  PREFIX: ".",
  FOOTER: "> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐁𝐎𝐓 ✨*"
};

try {
  const loadedConfig = require(path.join(process.cwd(), 'config'));
  config = { ...config, ...loadedConfig };
} catch (_) {}

// Active Sessions Store
global.menuTracker = global.menuTracker || new Map();
let isMenuHooked = false;

// Local Image Buffer Loader (Zero Network Lag / Direct File Read)
function getLocalLogo() {
  try {
    const rootPath = path.join(process.cwd(), 'logo.jpg');
    if (fs.existsSync(rootPath)) return fs.readFileSync(rootPath);

    const assetPath = path.join(process.cwd(), 'assets', 'logo.jpg');
    if (fs.existsSync(assetPath)) return fs.readFileSync(assetPath);
  } catch (_) {}
  return null;
}

module.exports = {
  name: "menu",
  alias: ["help", "list", "panel"],
  description: "Cyber Card Themed Interactive Category Menu",

  async execute({ sock, msg, from, prefix, commands, activeBotsCount }) {
    try {
      sock.sendMessage(from, { react: { text: "📜", key: msg.key } }).catch(() => {});

      const uptimeSec = process.uptime();
      const hours = Math.floor(uptimeSec / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      const secs = Math.floor(uptimeSec % 60);

      const pref = prefix || config.PREFIX || ".";

      // Main Menu UI (Cyber Card Theme)
      const mainText = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 ⚙️ *SYSTEM STATUS* 〕
├─▸ 👤 *Dev*     : ${config.OWNER_NAME}
├─▸ ⚡ *Prefix*  : [ ${pref} ]
├─▸ 🌐 *Nodes*   : ${activeBotsCount || 1} Online
├─▸ ⏳ *Uptime*  : ${hours}h ${mins}m ${secs}s
├─▸ 📦 *Modules* : ${commands?.size || 0} Loaded
└───────────────────────

┌─〔 🥀 *COMMAND PANELS* 〕
├─▸ [ 𝟏 ] ❯ ɢᴇɴᴇʀᴀʟ & ɪɴғᴏ
├─▸ [ 𝟐 ] ❯ ᴍᴇᴅɪᴀ ᴅᴏᴡɴʟᴏᴀᴅ
├─▸ [ 𝟑 ] ❯ sᴛᴇᴀʟᴛʜ & ᴜᴛɪʟɪᴛʏ
├─▸ [ 𝟒 ] ❯ sʏsᴛᴇᴍ & ᴏᴡɴᴇʀ
├─▸ [ 𝟓 ] ❯ ғᴜʟʟ ᴄᴏᴍᴍᴀɴᴅ ʟɪsᴛ
└───────────────────────

> 💬 *Reply with number (1-5) to access*

${config.FOOTER}`;

      const imgBuffer = getLocalLogo();

      let sentMsg;
      if (imgBuffer) {
        sentMsg = await sock.sendMessage(from, {
          image: imgBuffer,
          caption: mainText
        }, { quoted: msg });
      } else {
        sentMsg = await sock.sendMessage(from, {
          text: mainText
        }, { quoted: msg });
      }

      // Session Tracking (Valid for 5 Mins)
      const menuId = sentMsg.key.id;
      global.menuTracker.set(menuId, {
        chat: from,
        pref: pref,
        img: imgBuffer,
        time: Date.now()
      });

      setTimeout(() => {
        global.menuTracker.delete(menuId);
      }, 5 * 60 * 1000);

      // Register Internal Socket Listener
      if (!isMenuHooked) {
        isMenuHooked = true;

        sock.ev.on('messages.upsert', async (mUpdate) => {
          try {
            if (!mUpdate.messages || mUpdate.type !== 'notify') return;

            for (const inMsg of mUpdate.messages) {
              if (!inMsg.message) continue;

              const targetQuotedId = inMsg.message?.extendedTextMessage?.contextInfo?.stanzaId;
              if (!targetQuotedId || !global.menuTracker.has(targetQuotedId)) continue;

              const currentChat = inMsg.key.remoteJid;
              const sessionData = global.menuTracker.get(targetQuotedId);

              if (sessionData.chat !== currentChat) continue;

              const replyChoice = (
                inMsg.message?.conversation ||
                inMsg.message?.extendedTextMessage?.text ||
                ''
              ).trim();

              const p = sessionData.pref;
              let subText = "";
              let reactIcon = "";

              if (replyChoice === '1') {
                reactIcon = "⚡";
                subText = 
`╔══════════════════════╗
   ⚡ ɢᴇɴᴇʀᴀʟ & ɪɴғᴏ ⚡
╚══════════════════════╝

┌─〔 📂 *MODULE LIST* 〕
├─▸ 📌 *${p}ping*  : Check bot latency & response
├─▸ 📌 *${p}menu*  : Display system command list
├─▸ 📌 *${p}alive* : Check server & connection state
└───────────────────────

${config.FOOTER}`;
              } else if (replyChoice === '2') {
                reactIcon = "📥";
                subText = 
`╔══════════════════════╗
   📥 ᴍᴇᴅɪᴀ ᴅᴏᴡɴʟᴏᴀᴅ 📥
╚══════════════════════╝

┌─〔 📂 *MODULE LIST* 〕
├─▸ 📌 *${p}tiktok* <url> : TikTok HD / SD / MP3
├─▸ 📌 *${p}tt* <url>     : TikTok quick shortcut
├─▸ 📌 *${p}url*          : Upload media & get direct link
├─▸ 📌 *${p}tourl*        : Media upload alias
└───────────────────────

${config.FOOTER}`;
              } else if (replyChoice === '3') {
                reactIcon = "👁️";
                subText = 
`╔══════════════════════╗
   👁️ sᴛᴇᴀʟᴛʜ & ᴜᴛɪʟɪᴛʏ 👁️
╚══════════════════════╝

┌─〔 📂 *MODULE LIST* 〕
├─▸ 📌 *${p}vv*   : Decrypt view-once media
├─▸ 📌 *${p}jid*  : Retrieve user & chat JID
├─▸ 📌 *${p}read* : Mark quoted message as read
└───────────────────────

${config.FOOTER}`;
              } else if (replyChoice === '4') {
                reactIcon = "💻";
                subText = 
`╔══════════════════════╗
   💻 sʏsᴛᴇᴍ & ᴏᴡɴᴇʀ 💻
╚══════════════════════╝

┌─〔 📂 *MODULE LIST* 〕
├─▸ 📌 *${p}system* : RAM, CPU & instance health
├─▸ 📌 *${p}msg*    : Direct phone transmitter
├─▸ 📌 *${p}mgspro* : Multi-node broadcast relay
└───────────────────────

${config.FOOTER}`;
              } else if (replyChoice === '5') {
                reactIcon = "📜";
                subText = 
`╔══════════════════════╗
   📜 ғᴜʟʟ ᴄᴏᴍᴍᴀɴᴅ ʟɪsᴛ 📜
╚══════════════════════╝

┌─〔 📂 *INDEX LIST* 〕
├─▸ ${p}ping • ${p}menu • ${p}alive
├─▸ ${p}tiktok • ${p}tt • ${p}url • ${p}tourl
├─▸ ${p}vv • ${p}jid • ${p}read
├─▸ ${p}system • ${p}msg • ${p}mgspro
└───────────────────────

${config.FOOTER}`;
              }

              if (subText) {
                sock.sendMessage(currentChat, { react: { text: reactIcon, key: inMsg.key } }).catch(() => {});

                if (sessionData.img) {
                  await sock.sendMessage(currentChat, {
                    image: sessionData.img,
                    caption: subText
                  }, { quoted: inMsg });
                } else {
                  await sock.sendMessage(currentChat, {
                    text: subText
                  }, { quoted: inMsg });
                }
              }
            }
          } catch (listenerError) {
            console.error("[MENU LISTENER ERROR]:", listenerError.message);
          }
        });
      }

    } catch (err) {
      console.error("[MENU EXECUTION ERROR]:", err);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, { text: `❌ Menu Error: ${err.message}` }, { quoted: msg });
    }
  }
};
