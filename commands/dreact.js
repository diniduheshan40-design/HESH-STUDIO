global.devReactConfig = global.devReactConfig || {
  enabled: true,
  emoji: "👨🏻‍💻", // 🛑 කහ පාට නැති, කොණ්ඩය කළු Light Skin Tone Technologist Emoji
  disabledNumbers: new Set()
};

module.exports = {
  name: "dreact",
  alias: ["devreact", "dautoreact"],
  description: "Toggle developer auto-reaction across all active bot chats",

  async execute({ sock, msg, from, args }) {
    try {
      const senderJid = msg.key.fromMe 
        ? (sock.user?.id || "") 
        : (msg.key.participant || msg.participant || from || "");

      const cleanSender = String(senderJid).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
      const devNumbers = ["94719845166", "15947733680169"];
      const isDeveloper = devNumbers.some(num => cleanSender.includes(num)) || senderJid.includes("15947733680169");

      if (!isDeveloper && !msg.key.fromMe) {
        return await sock.sendMessage(from, { text: "⛔ මෙම විධානය Developer හට පමණි!" }, { quoted: msg });
      }

      const fullText = args.join(" ").trim();
      const parts = fullText.split(",").map(p => p.trim());
      const action = parts[0]?.toLowerCase();
      const targetNumber = parts[1] ? parts[1].replace(/[^0-9]/g, "") : null;

      // .dreact off,9471xxxxxxx
      if (action === "off" && targetNumber) {
        global.devReactConfig.disabledNumbers.add(targetNumber);
        return await sock.sendMessage(from, {
          text: `🛑 *DEV REACT OFF*\n\n🎯 *Target:* +${targetNumber}\nAuto reaction අක්‍රිය කරන ලදී.`
        }, { quoted: msg });
      }

      // .dreact on,9471xxxxxxx
      if (action === "on" && targetNumber) {
        global.devReactConfig.disabledNumbers.delete(targetNumber);
        return await sock.sendMessage(from, {
          text: `✅ *DEV REACT RESTORED*\n\n🎯 *Target:* +${targetNumber}\nAuto reaction නැවත ක්‍රියාත්මකයි.`
        }, { quoted: msg });
      }

      // .dreact off
      if (action === "off") {
        global.devReactConfig.enabled = false;
        return await sock.sendMessage(from, { text: "🛑 Developer Auto React අක්‍‍‍රිය කරන ලදී." }, { quoted: msg });
      }

      // .dreact on
      if (action === "on") {
        global.devReactConfig.enabled = true;
        return await sock.sendMessage(from, { text: "✅ Developer Auto React සක්‍රිය කරන ලදී." }, { quoted: msg });
      }

      // Guide
      await sock.sendMessage(from, {
        text: `⚡ *DEV REACT MANAGER* 👨🏻‍💻\n\n• *Status:* ${global.devReactConfig.enabled ? "ACTIVE 🟢" : "DISABLED 🔴"}\n• *Current Emoji:* ${global.devReactConfig.emoji}\n\n*භාවිතය:*\n• .dreact on\n• .dreact off\n• .dreact off,9471xxxxxxx\n• .dreact on,9471xxxxxxx`
      }, { quoted: msg });

    } catch (e) {
      await sock.sendMessage(from, { text: `❌ දෝෂයකි: ${e.message}` }, { quoted: msg });
    }
  }
};
