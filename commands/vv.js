const { downloadMediaMessage } = require("@whiskeysockets/baileys");

module.exports = {
  name: "vv",
  alias: ["viewonce", "anti-viewonce"],
  description: "Retrieve View-Once photo or video",

  async execute({ sock, msg, from }) {
    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const viewOnce = quoted?.viewOnceMessageV2?.message || quoted?.viewOnceMessage?.message;

      if (!viewOnce) {
        return await sock.sendMessage(from, {
          text: "⚠️ View-Once (1-time view) photo හෝ video එකකට reply කර `.vv` ගසන්න."
        }, { quoted: msg });
      }

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const mediaType = viewOnce.imageMessage ? "image" : viewOnce.videoMessage ? "video" : null;
      if (!mediaType) {
        return await sock.sendMessage(from, { text: "❌ හඳුනා නොගත් media වර්ගයකි." }, { quoted: msg });
      }

      // Media download කිරීම
      const fakeMsg = { message: viewOnce };
      const buffer = await downloadMediaMessage(fakeMsg, "buffer", {});

      const caption = viewOnce[mediaType + "Message"]?.caption || "🖤 *DARK-DINU ANTI-VIEWONCE*";

      if (mediaType === "image") {
        await sock.sendMessage(from, { image: buffer, caption }, { quoted: msg });
      } else {
        await sock.sendMessage(from, { video: buffer, caption }, { quoted: msg });
      }

      sock.sendMessage(from, { react: { text: "🔓", key: msg.key } }).catch(() => {});
    } catch (e) {
      console.error("[VV ERROR]:", e);
      await sock.sendMessage(from, { text: "❌ View-Once media එක ලබා ගැනීමට නොහැකි විය." }, { quoted: msg });
    }
  }
};
