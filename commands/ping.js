module.exports = {
  name: "ping",
  alias: ["p", "speed"],
  description: "Check bot response speed",

  async execute({ sock, msg, from }) {
    try {
      // 1. Command එකට 🥀 react
      sock.sendMessage(from, {
        react: { text: "🥀", key: msg.key }
      }).catch(() => {});

      const start = Date.now();

      // 2. Initial Status
      const sent = await sock.sendMessage(
        from,
        { text: "⚡ *Pinging...*" },
        { quoted: msg }
      );

      const latency = Date.now() - start;

      // 3. Edit Message (තනි පේලියෙන්)
      await sock.sendMessage(from, {
        text: `🎭 *Pong •* \`${latency}ms\` 📍 🖤 *DARK-DINU*`,
        edit: sent.key
      });

      // 4. Edit message එකට 🖤 react
      await sock.sendMessage(from, {
        react: { text: "🖤", key: sent.key }
      }).catch(() => {});

    } catch (error) {
      console.error("[PING ERROR]:", error);
    }
  }
};
