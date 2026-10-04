module.exports = {
  name: "ping",
  alias: ["p", "speed"],

  async execute({ sock, msg, from }) {
    try {
      // 1. Initial 🥀 Reaction එක (Parallel run වෙනවා non-blocking විදියට)
      sock.sendMessage(from, {
        react: { text: "🥀", key: msg.key }
      }).catch(() => {});

      const start = Date.now();

      // 2. Initial Status Text Message
      const sent = await sock.sendMessage(
        from,
        { text: "⚡ *Pinging Dark Engine...*" },
        { quoted: msg }
      );

      // Latency calculate කිරීම
      const latency = Date.now() - start;

      // 3. Sent Message එක Fast Edit කිරීම
      await sock.sendMessage(from, {
        text: `🎭 *Pong •* \`${latency}ms\` 📍\n🖤 *DARK-DINU SPEED*`,
        edit: sent.key
      });

      // 4. Edit කරපු message එකට 🖤 Reaction
      await sock.sendMessage(from, {
        react: { text: "🖤", key: sent.key }
      }).catch(() => {});

    } catch (error) {
      console.error("[PING ERROR]:", error.message);
    }
  }
};
