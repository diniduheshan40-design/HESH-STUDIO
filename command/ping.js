module.exports = {
  name: "ping",
  alias: ["p", "speed"],

  async execute(sock, msg, args, from) {
    try {
      // Command එකට 🥀 react
      await sock.sendMessage(from, {
        react: {
          text: "🥀",
          key: msg.key
        }
      });

      const start = Date.now();

      // Initial message
      const sent = await sock.sendMessage(
        from,
        { text: "✨ Pinging..." },
        { quoted: msg }
      );

      const latency = Date.now() - start;

      // Same message එක edit කරලා final result
      await sock.sendMessage(from, {
        text: `🎭 Pong • ${latency}ms 📍`,
        edit: sent.key
      });

      // Ping message එකට 🖤 react
      await sock.sendMessage(from, {
        react: {
          text: "🖤",
          key: sent.key
        }
      });

    } catch (error) {
      console.error("Ping Error:", error.message);
    }
  }
};
