module.exports = {
  name: "ping",
  alias: ["p", "speed"],

  async execute({ sock, msg, from }) {
    try {
      // 1. User එවපු command එකට 🥀 react කිරීම
      sock.sendMessage(from, {
        react: { text: "🥀", key: msg.key }
      }).catch(() => {});

      const start = Date.now();

      // 2. Initial Message එක (තනි පේලියෙන්)
      const sent = await sock.sendMessage(
        from,
        { text: "⚡ *Pinging...*" },
        { quoted: msg }
      );

      const latency = Date.now() - start;

      // 3. Sent message එක edit කරලා තනි පේලියෙන් result එක දැමීම
      await sock.sendMessage(from, {
        text: `🎭 *Pong •* \`${latency}ms\` 📍 🖤 *DARK-DINU*`,
        edit: sent.key
      });

      // 4. Edit වුණු message එකට 🖤 react කිරීම
      await sock.sendMessage(from, {
        react: { text: "🖤", key: sent.key }
      }).catch(() => {});

    } catch (error) {
      console.error("[PING ERROR]:", error.message);
    }
  }
};
