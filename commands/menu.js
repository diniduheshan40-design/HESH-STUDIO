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
    // 1. Root directory එකේ logo.jpg තියෙනවද බැලීම
    const rootPath = path.join(process.cwd(), 'logo.jpg');
    if (fs.existsSync(rootPath)) return fs.readFileSync(rootPath);

    // 2. Assets folder එක ඇතුළේ logo.jpg තියෙනවද බැලීම
    const assetPath = path.join(process.cwd(), 'assets', 'logo.jpg');
    if (fs.existsSync(assetPath)) return fs.readFileSync(assetPath);
  } catch (_) {}
  return null;
}

module.exports = {
  name: "menu",
  alias: ["help", "list", "panel"],
  description: "All-in-One Interactive Category Menu with Local Logo",

  async execute({ sock, msg, from, prefix, commands, activeBotsCount }) {
    try {
      sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

      const uptimeSec = process.uptime();
      const hours = Math.floor(uptimeSec / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      const secs = Math.floor(uptimeSec % 60);

      const pref = prefix || config.PREFIX || ".";

      // Main Menu UI
      const mainText = 
`╔══════════════════════╗
   🕷️ *${config.BOT_NAME} SYSTEM MENU* 🕷️
╚══════════════════════╝

👤 *Owner:* ${config.OWNER_NAME}
⚡ *Prefix:* [ ${pref} ]
🌐 *Active Nodes:* ${activeBotsCount || 1}
⏳ *Uptime:* ${hours}h ${mins}m ${secs}s
📦 *Total Modules:* ${commands?.size || 0}

┌──────────────────────┐
   *REPLY WITH NUMBER:*

  🥀 *1*  ➟  *Main & General Cmds*
  🥀 *2*  ➟  *Media & Downloader Cmds*
  🥀 *3*  ➟  *Stealth & Utility Cmds*
  🥀 *4*  ➟  *Owner & System Control*
  🥀 *5*  ➟  *All Commands (Full View)*
└──────────────────────┘

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
   ⚡ *GENERAL COMMANDS* ⚡
╚══════════════════════╝

• *${p}ping* - Check bot latency
• *${p}menu* - Open main panel
• *${p}alive* - System health check

${config.FOOTER}`;
              } else if (replyChoice === '2') {
                reactIcon = "📥";
                subText = 
`╔══════════════════════╗
   📥 *MEDIA DOWNLOADERS* 📥
╚══════════════════════╝

• *${p}tiktok* <url> - TikTok HD/SD/Voice Downloader
• *${p}tt* <url> - TikTok short alias
• *${p}url* - Convert media to direct link
• *${p}tourl* - URL upload alias

${config.FOOTER}`;
              } else if (replyChoice === '3') {
                reactIcon = "👁️";
                subText = 
`╔══════════════════════╗
   👁️ *STEALTH & UTILITIES* 👁️
╚══════════════════════╝

• *${p}vv* - Anti-ViewOnce (Save 1-time view media)
• *${p}jid* - Get Chat/User JID & LID
• *${p}read* - Mark quoted msg as read (Blue tick)

${config.FOOTER}`;
              } else if (replyChoice === '4') {
                reactIcon = "💻";
                subText = 
`╔══════════════════════╗
   💻 *SYSTEM & OWNER* 💻
╚══════════════════════╝

• *${p}system* - RAM & Active node stats
• *${p}msg* <num>,<txt> - Node direct transmission
• *${p}mgspro* - Cross-bot relay sender

${config.FOOTER}`;
              } else if (replyChoice === '5') {
                reactIcon = "📜";
                subText = 
`╔══════════════════════╗
   📜 *ALL ACTIVE MODULES* 📜
╚══════════════════════╝

• *${p}ping*  • *${p}menu*  • *${p}alive*
• *${p}tiktok*  • *${p}url*  • *${p}vv*
• *${p}jid*  • *${p}read*  • *${p}system*
• *${p}msg*  • *${p}mgspro*

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
