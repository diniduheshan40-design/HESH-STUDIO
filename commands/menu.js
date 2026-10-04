const config = require('../config');

// Interactive Menu Session Cache (Memory-safe)
global.menuCache = global.menuCache || new Map();

module.exports = {
  name: "menu",
  alias: ["help", "list", "panel"],
  description: "Display DARK-DINU interactive command categories",

  async execute({ sock, msg, from, prefix, commands, activeBotsCount }) {
    try {
      sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

      const uptimeSec = process.uptime();
      const hours = Math.floor(uptimeSec / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      const secs = Math.floor(uptimeSec % 60);

      const mainText = 
`╔══════════════════════╗
   🕷️ *${config.BOT_NAME} SYSTEM MENU* 🕷️
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

      // Menu Image එක සහ Card එක යැවීම
      const sentMsg = await sock.sendMessage(from, {
        image: { url: config.LOGO_URL },
        caption: mainText
      }, { quoted: msg });

      // Menu Cache එකට ID එක Save කිරීම (5 Mins Valid)
      const menuMsgId = sentMsg.key.id;
      global.menuCache.set(menuMsgId, { from, time: Date.now() });

      setTimeout(() => {
        global.menuCache.delete(menuMsgId);
      }, 5 * 60 * 1000);

    } catch (err) {
      console.error("[MENU ERROR]:", err.message);
      await sock.sendMessage(from, { text: `❌ Menu Error: ${err.message}` }, { quoted: msg });
    }
  }
};
