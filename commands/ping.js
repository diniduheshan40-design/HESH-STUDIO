module.exports = {
  name: "ping",
  alias: ["p", "speed"],
  category: "general",
  description: "Ultra fast precision latency tester",

  async execute({ sock, msg, from }) {
    try {
      // 🛑 Edit වූ පණිවිඩ සහ Protocol messages වලින් නැවත ping loop වීම වැළැක්වීම
      if (msg.message?.protocolMessage || msg.message?.editedMessage) return;

      const startTime = performance.now();

      // 1. Initial Quick Reaction (Non-blocking)
      sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

      // 2. Base Ping Tracker Message යැවීම
      const sentMsg = await sock.sendMessage(from, { text: "⚡ _Pinging Server..._" }, { quoted: msg });
      if (!sentMsg?.key) return;

      // 3. නිවැරදිම Precision Latency එක ගණනය කිරීම (Milliseconds)
      const latency = Math.round(performance.now() - startTime);

      // 4. Ultra Fast Live Edit
      await sock.sendMessage(from, {
        text: `*🎭 pong . \`${latency} ms\` ✨*`,
        edit: sentMsg.key
      });

      // 5. Final Reaction
      sock.sendMessage(from, { react: { text: "🖤", key: sentMsg.key } }).catch(() => {});

    } catch (err) {
      console.error("[PING ERROR]:", err.message);
    }
  }
};
