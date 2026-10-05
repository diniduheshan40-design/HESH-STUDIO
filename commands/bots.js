const path = require("path");

// Auth file එකෙන් SessionModel එක safe ලෙස import කිරීම
let SessionModel;
try {
  const authModule = require(path.join(process.cwd(), "auth"));
  SessionModel = authModule.SessionModel;
} catch (_) {}

module.exports = {
  name: "bots",
  alias: ["botlist", "activebots", "allbots"],
  category: "developer",
  description: "View all active, disconnected bots & system metrics (Developer Only)",

  async execute({ sock, msg, from, activeBots, activeBotsMap }) {
    const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });

    // 1. Strict Developer Verification (Phone number & LID check)
    const sender = msg.key.participant || msg.key.remoteJid || "";
    const senderClean = String(sender).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");

    const isDeveloper = Boolean(
      senderClean === "94719845166" ||
      senderClean === "15947733680169" ||
      sender.includes("94719845166") ||
      sender.includes("15947733680169")
    );

    if (!isDeveloper) {
      return await reply("⛔ මෙම Command එක භාවිතා කළ හැක්කේ Developer ට පමණි!");
    }

    try {
      await sock.sendMessage(from, { react: { text: "📊", key: msg.key } }).catch(() => {});

      // 2. Server Runtime Calculation
      const uptimeSec = Math.floor(process.uptime());
      const days = Math.floor(uptimeSec / 86400);
      const hours = Math.floor((uptimeSec % 86400) / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = uptimeSec % 60;
      const runtimeFormatted = `${days > 0 ? days + "d " : ""}${hours}h ${minutes}m ${seconds}s`;

      // 3. RAM Usage
      const ramUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);

      // 4. Database Total Bots Count
      let totalSessions = 0;
      if (SessionModel) {
        try {
          const sessions = await SessionModel.distinct("sessionId");
          totalSessions = sessions.length;
        } catch (_) {
          totalSessions = await SessionModel.countDocuments({}).catch(() => 0);
        }
      }

      // 5. Active Sockets Pool
      const botPool = activeBots || (global.activeSockets ? Array.from(global.activeSockets.values()) : [sock]);
      const activeCount = botPool.length;
      const disconnectedCount = Math.max(0, totalSessions - activeCount);

      // 6. Active Bot Phone Numbers Format කිරීම
      let activeListText = "";
      if (activeCount > 0) {
        botPool.forEach((s, index) => {
          const botNum = (s.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");
          const name = s.user?.name ? `(${s.user.name})` : "";
          activeListText += `│  ${index + 1}. 🟢 +${botNum || "Active Node"} ${name}\n`;
        });
      } else {
        activeListText = "│  _No active bots currently._\n";
      }

      const reportMessage = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 👑 *DEVELOPER CONTROL* 〕
├─▸ 🤖 *System:* MULTI-DEVICE CLUSTER
├─▸ ⏳ *Runtime:* ${runtimeFormatted}
├─▸ 📟 *RAM Usage:* ${ramUsed} MB
└───────────────────────

┌─〔 📊 *BOT STATISTICS* 〕
├─▸ 📁 *Registered:* ${totalSessions}
├─▸ 🟢 *Online:* ${activeCount}
├─▸ 🔴 *Disconnected:* ${disconnectedCount}
└───────────────────────

┌─〔 📱 *ACTIVE NODES* 〕
${activeListText}└───────────────────────

> 👑 *Developer:* DINIDU HESHAN
> ⚡ *Status:* Operational 24/7`;

      await sock.sendMessage(from, { text: reportMessage }, { quoted: msg });
      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (error) {
      console.error("Bots command error:", error.message);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await reply(`❌ Data ලබා ගැනීමේදී දෝෂයක් මතු විය: ${error.message}`);
    }
  }
};
