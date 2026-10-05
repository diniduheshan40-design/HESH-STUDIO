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

// Local Image Buffer Loader (Zero Lag / Direct File Read with URL fallback)
function getMenuBanner() {
  try {
    const rootPath = path.join(process.cwd(), 'logo.jpg');
    if (fs.existsSync(rootPath)) return fs.readFileSync(rootPath);

    const assetPath = path.join(process.cwd(), 'assets', 'logo.jpg');
    if (fs.existsSync(assetPath)) return fs.readFileSync(assetPath);
  } catch (_) {}
  // Default URL banner if local file not found
  return { url: "https://files.catbox.moe/k315x4.jpg" };
}

module.exports = {
  name: "menu",
  alias: ["help", "list", "panel", "m"],
  description: "Cyber Card Themed Interactive Category Menu",

  async execute({ sock, msg, from, prefix, commands, activeBotsCount }) {
    try {
      sock.sendMessage(from, { react: { text: "📜", key: msg.key } }).catch(() => {});

      const uptimeSec = process.uptime();
      const hours = Math.floor(uptimeSec / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      const secs = Math.floor(uptimeSec % 60);

      const pref = prefix || config.PREFIX || ".";
      const totalCmds = commands?.size || 0;

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
├─▸ 📦 *Modules* : ${totalCmds} Loaded
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

      const bannerData = getMenuBanner();

      const sentMsg = await sock.sendMessage(from, {
        image: bannerData,
        caption: mainText
      }, { quoted: msg });

      // Session Tracking (Valid for 5 Minutes)
      const menuId = sentMsg?.key?.id;
      if (menuId) {
        global.menuTracker.set(menuId, {
          chat: from,
          pref: pref,
          banner: bannerData,
          time: Date.now()
        });

        setTimeout(() => {
          if (global.menuTracker) global.menuTracker.delete(menuId);
        }, 5 * 60 * 1000);
      }

      // Register Internal Socket Listener (One-time Hook)
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

              // 1. GENERAL & INFO
              if (replyChoice === '1') {
                reactIcon = "⚡";
                subText = 
`╔══════════════════════╗
   ⚡ ɢᴇɴᴇʀᴀʟ & ɪɴғᴏ ⚡
╚══════════════════════╝

┌─〔 📂 *MODULE LIST* 〕
├─▸ 📌 *${p}ping*    : Check bot latency & response
├─▸ 📌 *${p}menu*    : Display system dashboard
├─▸ 📌 *${p}alive*   : Server & connection health
├─▸ 📌 *${p}status*  : Cluster nodes & uptime metrics
└───────────────────────

${config.FOOTER}`;
              } 
              // 2. MEDIA DOWNLOADER
              else if (replyChoice === '2') {
                reactIcon = "📥";
                subText = 
`╔══════════════════════╗
   📥 ᴍᴇᴅɪᴀ ᴅᴏᴡɴʟᴏᴀᴅ 📥
╚══════════════════════╝

┌─〔 📂 *MODULE LIST* 〕
├─▸ 📌 *${p}song* <query>    : YouTube MP3 / Document / Voice
├─▸ 📌 *${p}video* <query>   : YouTube Multi-Quality MP4
├─▸ 📌 *${p}fb* <url>        : Facebook HD / SD / MP3
├─▸ 📌 *${p}tiktok* <url>    : TikTok HD / SD / Audio
├─▸ 📌 *${p}insta* <url>     : Instagram Reels & Photos
├─▸ 📌 *${p}vv* (reply)      : Unlock ViewOnce media
└───────────────────────

${config.FOOTER}`;
              } 
              // 3. STEALTH & UTILITY
              else if (replyChoice === '3') {
                reactIcon = "👁️";
                subText = 
`╔══════════════════════╗
   👁️ sᴛᴇᴀʟᴛʜ & ᴜᴛɪʟɪᴛʏ 👁️
╚══════════════════════╝

┌─〔 📂 *MODULE LIST* 〕
├─▸ 📌 *${p}vv*     : Decrypt ViewOnce photos & videos
├─▸ 📌 *${p}jid*    : Retrieve user & chat JID
├─▸ 📌 *${p}tourl*  : Convert media into cloud link
├─▸ 📌 *${p}dreact* : Developer auto-reaction toggle
└───────────────────────

${config.FOOTER}`;
              } 
              // 4. SYSTEM & OWNER
              else if (replyChoice === '4') {
                reactIcon = "💻";
                subText = 
`╔══════════════════════╗
   💻 sʏsᴛᴇᴍ & ᴏᴡɴᴇʀ 💻
╚══════════════════════╝

┌─〔 📂 *MODULE LIST* 〕
├─▸ 📌 *${p}system*  : Host RAM, CPU & instance health
├─▸ 📌 *${p}bots*    : Connected active bot nodes count
├─▸ 📌 *${p}restart* : Reboot current session container
└───────────────────────

${config.FOOTER}`;
              } 
              // 5. FULL COMMAND LIST
              else if (replyChoice === '5') {
                reactIcon = "📜";
                subText = 
`╔══════════════════════╗
   📜 ғᴜʟʟ ᴄᴏᴍᴍᴀɴᴅ ʟɪsᴛ 📜
╚══════════════════════╝

┌─〔 📂 *INDEX LIST* 〕
├─▸ ${p}ping • ${p}menu • ${p}alive • ${p}status
├─▸ ${p}song • ${p}video • ${p}fb • ${p}tiktok • ${p}insta
├─▸ ${p}vv • ${p}jid • ${p}tourl • ${p}dreact
├─▸ ${p}system • ${p}bots • ${p}restart
└───────────────────────

${config.FOOTER}`;
              }

              if (subText) {
                sock.sendMessage(currentChat, { react: { text: reactIcon, key: inMsg.key } }).catch(() => {});

                await sock.sendMessage(currentChat, {
                  image: sessionData.banner,
                  caption: subText
                }, { quoted: inMsg });
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
