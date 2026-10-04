module.exports = {
  name: "ping",
  alias: ["p", "speed"],
  desc: "Check bot real response speed",
  async execute(sock, msg, args, from) {
    try {
      const start = Date.now();

      // 1. Reaction එකක් දැමීම (Error එකක් ආවත් crash නොවීමට catch කර ඇත)
      sock.sendMessage(from, { react: { text: "🚀", key: msg.key } }).catch(() => {});

      // 2. Real Latency ගණනය කිරීම
      const latency = Date.now() - start;

      // 3. Message එක Edit නොකර කෙලින්ම Send කිරීම (Crash වීම සම්පූර්ණයෙන්ම නතර වේ)
      const sent = await sock.sendMessage(from, {
        text: `*Pong \`${latency}ms\` 🔥*\n⚡ *DARK-DINU Speed Test*`
      }, { quoted: msg });

      // 4. Bot ගේ message එකට reaction එකක් දැමීම
      if (sent?.key) {
        sock.sendMessage(from, { react: { text: "⚡", key: sent.key } }).catch(() => {});
      }

    } catch (err) {
      console.error("Ping Safe Error:", err.message);
    }
  }
};
