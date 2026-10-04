module.exports = {
  name: "msg",
  alias: ["mgs", "send", "dm"],
  description: "Send direct message to any number via bot",

  async execute({ sock, msg, from, args }) {
    try {
      const fullText = args.join(" ").trim();

      // Format එක වැරදි නම් guide එකක් පෙන්වීම
      if (!fullText || !fullText.includes(",")) {
        return await sock.sendMessage(from, {
          text: `*⚠️ වැරදි Format එකක්!*\n\n*භාවිතා කරන ආකාරය:*\n.msg <number>,<message>\n\n*උදාහරණ:*\n.msg 94719845166, මොකද කරන්නේ?`
        }, { quoted: msg });
      }

      // React to command
      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // Number එක සහ Text එක වෙන් කර ගැනීම
      const [rawNumber, ...msgParts] = fullText.split(",");
      const targetText = msgParts.join(",").trim();

      // Number එකෙන් අනවශ්‍ය symbols (+, -, spaces) ඉවත් කිරීම
      let cleanNumber = rawNumber.replace(/[^0-9]/g, "");

      if (cleanNumber.startsWith("0")) {
        cleanNumber = "94" + cleanNumber.slice(1);
      }

      if (!targetText) {
        return await sock.sendMessage(from, {
          text: "⚠️ කරුණාකර යැවීමට අවශ්‍ය පණිවිඩය ඇතුළත් කරන්න."
        }, { quoted: msg });
      }

      const targetJid = `${cleanNumber}@s.whatsapp.net`;

      // අදාළ අංකයට Bot හරහා Message එක යැවීම
      await sock.sendMessage(targetJid, {
        text: targetText
      });

      // සාර්ථකව Send වූ බවට User ට Status Confirm කිරීම
      await sock.sendMessage(from, {
        text: `*✅ Message Sent Successfully!*\n\n📱 *To:* +${cleanNumber}\n💬 *Message:* ${targetText}\n🖤 *DARK-DINU*`
      }, { quoted: msg });

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (error) {
      console.error("[MSG SEND ERROR]:", error);
      await sock.sendMessage(from, {
        text: `❌ පණිවිඩය යැවීමට නොහැකි විය. (Number එක WhatsApp එකේ නැති විය හැක)`
      }, { quoted: msg });
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
    }
  }
};
