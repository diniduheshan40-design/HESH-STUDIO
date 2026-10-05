module.exports = {
  name: "tagall",
  alias: ["everyone", "all"],
  category: "group",
  desc: "Tag all members in the group",

  async execute({ sock, msg, from, args, prefix }) {
    try {
      // 1. Group Validation
      if (!from.endsWith("@g.us")) {
        return await sock.sendMessage(from, { 
          text: "⚠️ *ACCESS DENIED*\n\nThis command can only be used inside groups." 
        }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "📢", key: msg.key } }).catch(() => {});

      // 2. Fetch Group Participants
      const groupMetadata = await sock.groupMetadata(from);
      const participants = groupMetadata?.participants || [];

      if (!participants.length) {
        return await sock.sendMessage(from, { 
          text: "⚠️ *ERROR:* Failed to retrieve group member list." 
        }, { quoted: msg });
      }

      // 3. Custom Announcement Content
      const customMessage = args.join(" ").trim() || "Attention Everyone!";

      let tagText = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 📢 *GROUP ANNOUNCEMENT* 〕
├─▸ 👥 *Total Members:* ${participants.length}
├─▸ 💬 *Notice:* ${customMessage}
└───────────────────────

┌─〔 👥 *MENTIONED MEMBERS* 〕\n`;

      const mentions = [];

      for (let i = 0; i < participants.length; i++) {
        const memberId = participants[i].id;
        const number = memberId.split("@")[0].split(":")[0];
        tagText += `├─▸ [${i + 1}] @${number}\n`;
        mentions.push(memberId);
      }

      tagText += 
`└───────────────────────

> 👑 *Developer:* DINIDU HESHAN
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🐦‍🔥*`;

      // 4. Send Announcement Message
      await sock.sendMessage(
        from,
        {
          text: tagText,
          mentions: mentions
        },
        { quoted: msg }
      );

      await sock.sendMessage(from, { react: { text: "🦟", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[TAGALL COMMAND ERROR]:", err.message);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, { 
        text: `❌ *TAGALL FAILED:* ${err.message || "An unexpected error occurred."}` 
      }, { quoted: msg });
    }
  }
};
