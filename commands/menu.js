const config = require('../config');

// Interactive Session Tracking
global.activeMenuSessions = global.activeMenuSessions || new Map();
let isListenerRegistered = false;

module.exports = {
  name: "menu",
  alias: ["help", "list", "panel"],
  description: "Interactive category menu with automated sub-menu image dispatch",

  async execute({ sock, msg, from, prefix, commands, activeBotsCount }) {
    try {
      // 1. First Trigger React
      sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

      const uptimeSec = process.uptime();
      const hours = Math.floor(uptimeSec / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      const secs = Math.floor(uptimeSec % 60);

      // Main Menu Layout
      const mainText = 
`╔══════════════════════╗
   🕷️ *${config.BOT_NAME} SYSTEM MENU* 🕷️️
╚══════════════════════╝

👤 *Owner:* ${config.OWNER_NAME}
⚡ *Prefix:* [ ${prefix} ]
🌐 *Active Nodes:* ${activeBotsCount || 1}
⏳ *Uptime:* ${hours}h ${mins}m ${secs}s
📦 *Total Modules:* ${commands.size}

┌──────────────────────┐
   *REPLY WITH NUMBER:*

  🥀 *1*  ➟  *Main & General Cmds*
  🥀 *2*  ➟  *Media & Downloader Cmds*
  🥀 *3*  ➟  *Stealth & Utility Cmds*
  🥀 *4*  ➟  *Owner & System Control*
  🥀 *5*  ➟  *All Commands (Full View)*
└──────────────────────┘

${config.FOOTER}`;

      // Send Main Menu with Image
      const sentMsg = await sock.sendMessage(from, {
        image: { url: config.LOGO_URL },
        caption: mainText
      }, { quoted: msg });

      // Cache the message ID
      const menuMsgId = sentMsg.key.id;
      global.activeMenuSessions.set(menuMsgId, {
        targetChat: from,
        createdAt: Date.now()
      });

      // Expire session in 5 minutes
      setTimeout(() => {
        global.activeMenuSessions.delete(menuMsgId);
      }, 5 * 60 * 1000);

      // Register Internal Socket Listener (Runs Once inside Command)
      if (!isListenerRegistered) {
        isListenerRegistered = true;

        sock.ev.on('messages.upsert', async (chatUpdate) => {
          try {
            if (!chatUpdate.messages || chatUpdate.type !== 'notify') return;

            for (const incoming of chatUpdate.messages) {
              if (!incoming.message) continue;

              const quotedId = incoming.message?.extendedTextMessage?.contextInfo?.stanzaId;
              if (!quotedId || !global.activeMenuSessions.has(quotedId)) continue;

              const chatJid = incoming.key.remoteJid;
              const session = global.activeMenuSessions.get(quotedId);

              // Match original chat
              if (session.targetChat !== chatJid) continue;

              const userReply = (
                incoming.message?.conversation ||
                incoming.message?.extendedTextMessage?.text ||
                ''
              ).trim();

              let categoryText = "";
              let reactIcon = "";

              if (userReply === '1') {
                reactIcon = "⚡";
                categoryText = 
`╔══════════════════════╗
   ⚡ *GENERAL COMMANDS* ⚡
╚══════════════════════╝

• *${prefix}ping* - Check bot latency
• *${prefix}menu* - Open command categories
• *${prefix}alive* - Check system online status

${config.FOOTER}`;
              } else if (userReply === '2') {
                reactIcon = "📥";
                categoryText = 
`╔══════════════════════╗
   📥 *MEDIA DOWNLOADERS* 📥
╚══════════════════════╝

• *${prefix}tiktok* <url> - Download TikTok (HD/SD/Voice)
• *${prefix}tt* <url> - TikTok short alias
• *${prefix}url* - Convert replied media to public URL
• *${prefix}tourl* - URL generator alias

${config.FOOTER}`;
              } else if (userReply === '3') {
                reactIcon = "👁️";
                categoryText = 
`╔══════════════════════╗
   👁️ *STEALTH & UTILITIES* 👁️
╚══════════════════════╝

• *${prefix}vv* - Anti-ViewOnce (Save 1-time view media)
• *${prefix}jid* - Inspect User / Group JID & LID
• *${prefix}read* - Mark quoted message as read (Blue tick)

${config.FOOTER}`;
              } else if (userReply === '4') {
                reactIcon = "💻";
                categoryText = 
`╔══════════════════════╗
   💻 *SYSTEM & OWNER* 💻
╚══════════════════════╝

• *${prefix}system* - RAM, Node Count, Core metrics
• *${prefix}node* - Server runtime dashboard
• *${prefix}msg* <num>,<txt> - Node direct message dispatcher

${config.FOOTER}`;
              } else if (userReply === '5') {
                reactIcon = "📜";
                categoryText = 
`╔══════════════════════╗
   📜 *ALL ACTIVE COMMANDS* 📜
╚══════════════════════╝

• *${prefix}ping*  • *${prefix}menu*  • *${prefix}alive*
• *${prefix}tt*    • *${prefix}url*   • *${prefix}vv*
• *${prefix}jid*   • *${prefix}read*  • *${prefix}system*
• *${prefix}msg*

${config.FOOTER}`;
              }

              // Send Sub-Category with Logo and React
              if (categoryText) {
                sock.sendMessage(chatJid, { react: { text: reactIcon, key: incoming.key } }).catch(() => {});
                
                await sock.sendMessage(chatJid, {
                  image: { url: config.LOGO_URL },
                  caption: categoryText
                }, { quoted: incoming });
              }
            }
          } catch (listenerErr) {
            console.error("[MENU INTERNAL LISTENER ERR]:", listenerErr.message);
          }
        });
      }

    } catch (err) {
      console.error("[MENU ERROR]:", err.message);
      await sock.sendMessage(from, { text: `❌ Menu Error: ${err.message}` }, { quoted: msg });
    }
  }
};
