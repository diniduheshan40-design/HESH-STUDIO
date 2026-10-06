module.exports = {
  name: "mode",
  alias: ["setmode", "botmode"],
  category: "owner",
  description: "Switch bot operation mode (public / private / group)",

  async execute({ sock, msg, from, args, prefix }) {
    try {
      const senderJid = msg.key.fromMe 
        ? (sock.user?.id || "") 
        : (msg.key.participant || msg.participant || from || "");

      const cleanSender = String(senderJid).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
      const botNumber = (sock.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");

      const isDevOrOwner = msg.key.fromMe || cleanSender === "94719845166" || cleanSender === botNumber || senderJid.includes("94719845166");

      if (!isDevOrOwner) {
        return await sock.sendMessage(from, { 
          text: "⚠️ *ACCESS DENIED*\n\nThis command is restricted to Developer and Bot Owner only." 
        }, { quoted: msg });
      }

      global.botMode = global.botMode || "public";
      const targetMode = (args[0] || "").toLowerCase().trim();

      const validModes = ["public", "private", "privet", "group"];
      if (!validModes.includes(targetMode)) {
        return await sock.sendMessage(from, {
          text: `⚠️ *INVALID MODE*\n\nAvailable Options:\n• \`${prefix}mode public\` (Available for everyone)\n• \`${prefix}mode private\` (Owner / Developer only)\n• \`${prefix}mode group\` (Group chats only)\n\n*Current Mode:* \`${global.botMode.toUpperCase()}\``
        }, { quoted: msg });
      }

      global.botMode = targetMode === "privet" ? "private" : targetMode;

      const modeCard = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 ⚙️ *BOT MODE UPDATED* 〕
├─▸ 🛡️ *New Mode*   : ${global.botMode.toUpperCase()}
├─▸ 👤 *Changed By* : @${cleanSender}
├─▸ ⚡ *Status*     : Active & Applied
└───────────────────────

> 👑 *Developer:* DINIDU HESHAN
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🐦‍‍🔥*`;

      await sock.sendMessage(from, { 
        text: modeCard,
        mentions: [senderJid]
      }, { quoted: msg });

      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[MODE CMD ERROR]:", err.message);
    }
  }
};
