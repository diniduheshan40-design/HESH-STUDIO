const axios = require('axios');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: "url",
  alias: ["tourl", "geturl", "upload", "catbox"],
  description: "Convert Image, Video, Audio, Voice note, Sticker, or Document into a direct URL",

  async execute({ sock, msg, from }) {
    try {
      const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
      const quoted = contextInfo?.quotedMessage;

      // Extract raw target message
      let targetMessage = quoted || msg.message;
      let targetRaw = quoted ? { message: quoted } : msg;

      // Unpack View-Once if wrapped
      if (targetMessage?.viewOnceMessageV2?.message) {
        targetMessage = targetMessage.viewOnceMessageV2.message;
        targetRaw = { message: targetMessage };
      } else if (targetMessage?.viewOnceMessage?.message) {
        targetMessage = targetMessage.viewOnceMessage.message;
        targetRaw = { message: targetMessage };
      }

      // Media Type & Extension Detection
      let fileExt = '';
      let mediaLabel = '';

      if (targetMessage.imageMessage) {
        fileExt = '.jpg';
        mediaLabel = 'IMAGE';
      } else if (targetMessage.videoMessage) {
        fileExt = '.mp4';
        mediaLabel = 'VIDEO';
      } else if (targetMessage.audioMessage) {
        fileExt = targetMessage.audioMessage.ptt ? '.opus' : '.mp3';
        mediaLabel = targetMessage.audioMessage.ptt ? 'VOICE NOTE (PTT)' : 'AUDIO';
      } else if (targetMessage.stickerMessage) {
        fileExt = '.webp';
        mediaLabel = 'STICKER';
      } else if (targetMessage.documentMessage) {
        const docName = targetMessage.documentMessage.fileName || 'file';
        const parts = docName.split('.');
        fileExt = parts.length > 1 ? `.${parts.pop()}` : '.bin';
        mediaLabel = 'DOCUMENT';
      } else {
        return await sock.sendMessage(from, {
          text: `⚠️ *භාවිතා කරන ආකාරය:*\n\nImage, Video, Voice note, Audio, Sticker හෝ Document එකකට reply කර *.url* ලෙස type කරන්න.`
        }, { quoted: msg });
      }

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // Download Buffer via Baileys Native Method
      const buffer = await downloadMediaMessage(
        targetRaw,
        'buffer',
        {},
        {
          logger: undefined,
          reuploadRequest: sock.updateMediaMessage
        }
      );

      if (!buffer || buffer.length === 0) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { text: "❌ Media එක download කර ගැනීමට නොහැකි විය. කරුණාකර නැවත උත්සාහ කරන්න." }, { quoted: msg });
      }

      // Build Multi-Part Form Data
      const filename = `dark_dinu_${Date.now()}${fileExt}`;
      const form = new FormData();
      form.append('reqtype', 'fileupload');
      form.append('fileToUpload', buffer, {
        filename,
        contentType: targetMessage.documentMessage?.mimetype || 'application/octet-stream'
      });

      // Upload to Catbox MOE
      const response = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: {
          ...form.getHeaders()
        },
        timeout: 90000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });

      const mediaUrl = typeof response.data === 'string' ? response.data.trim() : null;

      if (!mediaUrl || !mediaUrl.startsWith('http')) {
        throw new Error('Host API return invalid URL response.');
      }

      const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
      const resultText = 
`⚡ *DARK-DINU URL ENGINE* ⚡

🔗 *Direct URL:* 
${mediaUrl}

📁 *Type:* ${mediaLabel}
📦 *Size:* ${sizeMB} MB
🖤 *Status:* PERMANENT LINK`;

      await sock.sendMessage(from, { text: resultText }, { quoted: msg });
      sock.sendMessage(from, { react: { text: "🔗", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('[URL CMD ERROR]:', err);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, {
        text: `❌ URL එක සෑදීමට නොහැකි විය: ${err.message || 'Unknown Network Error'}`
      }, { quoted: msg });
    }
  }
};
