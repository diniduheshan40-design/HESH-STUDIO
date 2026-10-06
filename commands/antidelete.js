module.exports = {
  name: "antidelete",
  alias: ["antidel", "preventdelete"],
  category: "owner",
  description: "Toggle Anti-Delete feature on/off",

  async execute({ sock, msg, from, args, prefix }) {
    try {
      const senderJid = msg.key.fromMe 
        ? (sock.user?.id || "") 
        : (msg.key.participant || msg.participant || from || "");

      const cleanSender = String(senderJid).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
      const botNumber = (sock.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");
      
      const isOwner = msg.key.fromMe || cleanSender === "94719845166" || cleanSender === botNumber;
      if (!isOwner) {
        return await sock.sendMessage(from, { 
          text: "⚠️ *ACCESS DENIED*\n\nThis command is restricted to Bot Owner / Developer only." 
        }, { quoted: msg });
      }

      global.antiDeleteConfig = global.antiDeleteConfig || { enabled: true, sendToChat: true };

      const opt = (args[0] || "").toLowerCase();

      if (opt === "on") {
        global.antiDeleteConfig.enabled = true;
      } else if (opt === "off") {
        global.antiDeleteConfig.enabled = false;
      } else {
        global.antiDeleteConfig.enabled = !global.antiDeleteConfig.enabled;
      }

      const status = global.antiDeleteConfig.enabled ? "🟢 ENABLED (ACTIVE)" : "🔴 DISABLED (INACTIVE)";

      const card = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🛡️ *ANTI-DELETE SYSTEM* 〕
├─▸ ⚙️ *Status*  : ${status}
├─▸ 🎯 *Mode*    : Auto Catch & Forward
├─▸ 💬 *Command* : \`${prefix || "."}antidelete on/off\`
└───────────────────────

> 👑 *Developer:* DINIDU HESHAN
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🐦‍🔥*`;

      await sock.sendMessage(from, { text: card }, { quoted: msg });
      await sock.sendMessage(from, { 
        react: { text: global.antiDeleteConfig.enabled ? "🛡️️" : "⚪", key: msg.key } 
      }).catch(() => {});

    } catch (err) {
      console.error("[ANTIDELETE CMD ERR]:", err.message);
    }
  }
};
