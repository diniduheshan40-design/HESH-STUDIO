const { downloadMediaMessage } = require("@whiskeysockets/baileys");

module.exports = {
  name: "setdp",
  alias: ["setpfp", "updatepfp"],
  category: "owner",
  description: "Update bot profile picture by replying to an image",

  async execute({ sock, msg, from, prefix }) {
    try {
      // 1. Owner & Developer Verification
      const senderJid = msg.key.fromMe 
        ? (sock.user?.id || "") 
        : (msg.key.participant || msg.participant || from || "");

      const cleanSender = String(senderJid).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
      const botNumber = (sock.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");
      
      const allowedNumbers = ["94719845166", "15947733680169", botNumber];
      const isOwner = msg.key.fromMe || allowedNumbers.includes(cleanSender);

      if (!isOwner) {
        return await sock.sendMessage(from, { 
          text: "⚠️ *ACCESS DENIED*\n\nThis command is restricted to the Bot Developer and Owner only." 
        }, { quoted: msg });
      }

      // 2. Identify Target Image Message
      const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      let targetPayload = null;

      if (quotedMsg?.imageMessage) {
        targetPayload = {
          message: {
            imageMessage: quotedMsg.imageMessage
          }
        };
      } else if (msg.message?.imageMessage) {
        targetPayload = msg;
      }

      if (!targetPayload) {
        return await sock.sendMessage(from, { 
          text: `📸 *කරුණාකර Profile Picture එකට දැමීමට අවශ්‍ය Photo එකකට Reply කර \`${prefix || "."}setdp\` ලෙස යවන්න.*` 
        }, { quoted: msg });
      }

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // 3. Download Image Media Buffer
      const buffer = await downloadMediaMessage(
        targetPayload,
        "buffer",
        {},
        {
          logger: undefined,
          reuploadRequest: sock.updateMediaMessage
        }
      );

      if (!buffer || buffer.length === 0) {
        throw new Error("Failed to download image buffer.");
      }

      // 4. Update WhatsApp Profile Picture
      const botJid = `${botNumber}@s.whatsapp.net`;
      await sock.updateProfilePicture(botJid, buffer);

      const successCard = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🖼️ *PROFILE UPDATED* 〕
├─▸ 👤 *Updated By:* @${cleanSender}
├─▸ 🤖 *Target Node:* +${botNumber}
├─▸ ⚡ *Status:* DP Applied Successfully
└───────────────────────

> 👑 *Developer:* Dinidu Heshan
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🐦‍🔥*`;

      await sock.sendMessage(from, {
        text: successCard,
        mentions: [senderJid]
      }, { quoted: msg });

      sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[SETDP ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, { 
        text: `❌ *DP UPDATE FAILED:* ${err.message || "An unexpected error occurred."}` 
      }, { quoted: msg });
    }
  }
};
