const path = require('path');

// Safe Config Fallback
let config = {
  BOT_NAME: "DARK-DINU",
  OWNER_NAME: "DINIDU HESHAN",
  PREFIX: ".",
  LOGO_URL: "https://files.catbox.moe/ubar7g.jpg",
  FOOTER: "> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐁𝐎𝐓 ✨*"
};

try {
  const loadedConfig = require(path.join(process.cwd(), 'config'));
  config = { ...config, ...loadedConfig };
} catch (_) {}

// Active Sessions Store
global.menuTracker = global.menuTracker || new Map();
let isMenuHooked = false;

module.exports = {
  name: "menu",
  alias: ["help", "list", "panel"],
  description: "All-in-One Interactive Category Menu",

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

      // Send Menu with Logo
      const sentMsg = await sock.sendMessage(from, {
        image: { url: config.LOGO_URL },
        caption: mainText
      }, { quoted: msg });

      // Session Tracking (Valid for 5 Mins)
      const menuId = sentMsg.key.id;
      global.menuTracker.set(menuId, {
        chat: from,
        pref: pref,
        time: Date.now()
      });

      setTimeout(() => {
        global.menuTracker.delete(menuId);
      }, 5 * 60 * 1000);

      // Register Internal Socket Listener Once
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
   👁️ *STEALTH & UTILITIES* 👁️️
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

              // Deliver Sub-Menu with Logo and Reaction
              if (subText) {
                sock.sendMessage(currentChat, { react: { text: reactIcon, key: inMsg.key } }).catch(() => {});

                await sock.sendMessage(currentChat, {
                  image: { url: config.LOGO_URL },
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
