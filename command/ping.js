module.exports = {
  name: "ping",
  alias: ["p", "speed"],
  desc: "Check bot real response speed",
  async execute({ sock, msg, from, sessionId }) {
    try {
      // 1. User ගේ message එකට 🚀 React එක දැමීම
      await sock.sendMessage(from, { react: { text: "🚀", key: msg.key } });

      const start = Date.now();

      // 2. තාවකාලික Pinging message එක යැවීම
      const sent = await sock.sendMessage(
        from,
        { text: "⚡ *Pinging...*" },
        { quoted: msg }
      );

      // 3. Real Latency ගණනය කිරීම
      const latency = Date.now() - start;

      // 4. යැවූ message එක Edit කර ප්‍රතිඵලය පෙන්වීම
      await sock.sendMessage(from, {
        text: `*Pong \`${latency}ms\` 🔥*\n🤖 *Bot:* DARK-DINU\n🆔 *Session:* ${sessionId || "Main"}`,
        edit: sent.key
      });

      // 5. Bot ගේ Edit වූ message එකට ⚡ React එක දැමීම
      if (sent?.key) {
        await sock.sendMessage(from, { react: { text: "⚡", key: sent.key } });
      }
    } catch (err) {
      console.error("Ping Error:", err.message);
    }
  }
};
