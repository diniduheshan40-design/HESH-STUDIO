module.exports = {
  name: "getdp",
  alias: ["dp", "pfp", "getpfp"],
  category: "utility",
  description: "Download profile picture of current chat, user, or group in HD quality",

  async execute({ sock, msg, from, args, prefix }) {
    try {
      await sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});

      let targetJid = null;
      let targetType = "User";

      // 1. Quoted Message එකක Sender හඳුනාගැනීම
      const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant;
      
      // 2. Mention කර ඇති අය හඳුනාගැනීම
      const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

      // 3. Command එකෙන් අංකයක් ලබාදී තිබේදැයි බැලීම (උදා: .getdp 947xxxxxxxx)
      const inputNumber = args[0]?.replace(/[^0-9]/g, "");

      if (quotedParticipant) {
        targetJid = quotedParticipant;
        targetType = "User";
      } else if (mentionedJid) {
        targetJid = mentionedJid;
        targetType = "User";
      } else if (inputNumber && inputNumber.length >= 8) {
        targetJid = `${inputNumber}@s.whatsapp.net`;
        targetType = "User";
      } else if (from.endsWith("@g.us")) {
        // Group එකක් ඇතුළේ නෝමල් .getdp ගැහුවොත් Group DP එක ලබාගැනීම
        targetJid = from;
        targetType = "Group";
      } else if (from.endsWith("@s.whatsapp.net")) {
        // Inbox / Private Chat එකක නෝමල් .getdp ගැහුවොත් අදාළ පුද්ගලයාගේ DP එක ලබාගැනීම
        targetJid = from;
        targetType = "User";
      }

      if (!targetJid) {
        return await sock.sendMessage(from, {
          text: `⚠️ *භාවිතය:* චැට් එකේදී \`${prefix || "."}getdp\` හෝ මැසේජ් එකකට reply කර \`${prefix || "."}getdp\` ලෙස යවන්න.`
        }, { quoted: msg });
      }

      // WhatsApp Server එකෙන් High Definition (HD) Profile Picture URL එක ලබාගැනීම
      let dpUrl;
      try {
        dpUrl = await sock.profilePictureUrl(targetJid, 'image');
      } catch (err) {
        try {
          dpUrl = await sock.profilePictureUrl(targetJid);
        } catch (_) {
          dpUrl = null;
        }
      }

      if (!dpUrl) {
        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, {
          text: `❌ මෙම ${targetType === "Group" ? "Group එක සඳහා Icon එකක්" : "User සඳහා Profile Picture එකක්"} නොමැත හෝ එය Privacy Settings මඟින් සඟවා ඇත.`
        }, { quoted: msg });
      }

      const cleanNumber = targetJid.split("@")[0].split(":")[0];
      const captionText = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🖼️ *PROFILE PICTURE* 〕
├─▸ 👤 *Target*  : ${targetType === "Group" ? "Group Icon" : `+${cleanNumber}`}
├─▸ ⚡ *Quality* : High Definition (HD)
└───────────────────────

> 👑 *Developer:* DINIDU HESHAN
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🐦‍🔥*`;

      await sock.sendMessage(from, {
        image: { url: dpUrl },
        caption: captionText
      }, { quoted: msg });

      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[GETDP ERROR]:", err.message);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, {
        text: `❌ DP ලබාගැනීම අසාර්ථක විය: ${err.message}`
      }, { quoted: msg });
    }
  }
};
