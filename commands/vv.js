const { downloadMediaMessage } = require("@whiskeysockets/baileys");

module.exports = {
  name: "vv",
  alias: [
    "save", 
    "viewonce", 
    "anti-viewonce",
    "🥺", "🤪", "😚", "😁", "🎭", "😂", "🥵", "🙏", "😓", "🫣", "😭", "😘", "❤️", "👍"
  ],
  description: "Retrieve View-Once photo, video or voice note",

  async execute({ sock, msg, from }) {
    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

      // View-Once V1 / V2 / Extension Wrapper Parsing
      const viewOnce = 
        quoted?.viewOnceMessageV2?.message || 
        quoted?.viewOnceMessage?.message || 
        quoted?.viewOnceMessageV2Extension?.message ||
        quoted;

      if (!viewOnce) {
        return await sock.sendMessage(from, {
          text: "⚠️ View-Once (1-time view) media එකකට reply කර command එක හෝ emoji එක එවන්න."
        }, { quoted: msg });
      }

      // Check Media Types: Image, Video, or Audio (Voice Note)
      const isImage = Boolean(viewOnce.imageMessage);
      const isVideo = Boolean(viewOnce.videoMessage);
      const isAudio = Boolean(viewOnce.audioMessage);

      if (!isImage && !isVideo && !isAudio) {
        return await sock.sendMessage(from, { 
          text: "❌ මෙහි View-Once Photo, Video හෝ Voice Note එකක් සොයාගත නොහැකි විය." 
        }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // Download Media Buffer
      const targetPayload = { message: viewOnce };
      const buffer = await downloadMediaMessage(targetPayload, "buffer", {});

      const defaultCaption = "> *🔓 𝐃𝐀𝐑𝐊-𝐃𝐈𝐍𝐔 𝐀𝐍𝐓𝐈-𝐕𝐈𝐄𝐖𝐎𝐍𝐂𝐄*";

      if (isImage) {
        const caption = viewOnce.imageMessage?.caption 
          ? `${viewOnce.imageMessage.caption}\n\n${defaultCaption}` 
          : defaultCaption;

        await sock.sendMessage(from, {
          image: buffer,
          caption: caption
        }, { quoted: msg });

      } else if (isVideo) {
        const caption = viewOnce.videoMessage?.caption 
          ? `${viewOnce.videoMessage.caption}\n\n${defaultCaption}` 
          : defaultCaption;

        await sock.sendMessage(from, {
          video: buffer,
          caption: caption
        }, { quoted: msg });

      } else if (isAudio) {
        // Voice Note (PTT Playable Audio)
        await sock.sendMessage(from, {
          audio: buffer,
          mimetype: "audio/ogg; codecs=opus",
          ptt: true
        }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "🔓", key: msg.key } }).catch(() => {});

    } catch (e) {
      console.error("[VV ERROR]:", e);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, { text: `❌ View-Once media එක බාගත කිරීමට නොහැකි විය: ${e.message}` }, { quoted: msg });
    }
  }
};
