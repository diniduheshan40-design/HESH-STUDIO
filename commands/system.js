const os = require("os");

module.exports = {
  name: "system",
  alias: ["node", "ram", "uptime"],
  description: "Check system resources and active bot instances",

  async execute({ sock, msg, from, activeBotsCount, sessionId }) {
    try {
      const uptimeSec = process.uptime();
      const hours = Math.floor(uptimeSec / 3600);
      const mins = Math.floor((uptimeSec % 3600) / 60);
      const secs = Math.floor(uptimeSec % 60);

      const usedMem = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
      const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);

      const dashboard = 
`⚡ *DARK-DINU CORE ENGINE* ⚡

🤖 *Active Node:* \`${sessionId}\`
🌐 *Total Connected Nodes:* \`${activeBotsCount || 1}\`
⏳ *Uptime:* \`${hours}h ${mins}m ${secs}s\`
🧠 *Memory Usage:* \`${usedMem} MB\`
🖥️ *Total Host RAM:* \`${totalMem} GB\`
🖤 *Status:* \`OPTIMAL\``;

      await sock.sendMessage(from, { text: dashboard }, { quoted: msg });
      sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});
    } catch (e) {
      console.error("[SYSTEM ERROR]:", e);
    }
  }
};
