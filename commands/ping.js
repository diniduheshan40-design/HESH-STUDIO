module.exports = {
  name: "ping",
  alias: ["p", "speed"],
  description: "Ultra fast ping",

  async execute({ sock, msg, from }) {
    const start = Date.now();

    // 1. Initial React එක non-blocking විදියට යැවීම
    sock.sendMessage(from, { react: { text: "🥀", key: msg.key } }).catch(() => {});

    // 2. Initial Message එක යැවීම
    const sent = await sock.sendMessage(from, { text: "⚡" }, { quoted: msg });
    if (!sent?.key) return;

    const latency = Date.now() - start;

    // 3. Ultra Fast Edit (Compact Format)
    await sock.sendMessage(from, {
      text: `*🎭 pong .\`${latency} ms\` ✨*`,
      edit: sent.key
    });

    // 4. Final React එක
    sock.sendMessage(from, { react: { text: "🖤", key: sent.key } }).catch(() => {});
  }
};
