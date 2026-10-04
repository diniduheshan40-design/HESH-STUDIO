const axios = require('axios');
const FormData = require('form-data');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
  name: "url",
  alias: ["tourl", "geturl", "upload", "catbox"],
  description: "Convert Image, Video, Audio, Voice note, Sticker, or Document into a direct URL",

  async execute({ sock, msg, from }) {
    try {
      const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      let targetMessage = quoted || msg.message;

      // Unpack ViewOnce if wrapped
      if (targetMessage?.viewOnceMessageV2?.message) {
        targetMessage = targetMessage.viewOnceMessageV2.message;
      } else if (targetMessage?.viewOnceMessage?.message) {
        targetMessage = targetMessage.viewOnceMessage.message;
      }

      // Media Type & Extension Detect කිරීම
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

      // Baileys media downloader හරහා Buffer එක download කරගැනීම
      const fakeMsg = { message: targetMessage };
      const buffer = await downloadMediaMessage(fakeMsg, 'buffer', {});

      if (!buffer || buffer.length === 0) {
        sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { text: "❌ Media එක download කිරීමට නොහැකි විය." }, { quoted: msg });
      }

      // Catbox API එකට upload කිරීම (Free, Direct Link & High Speed)
      const filename = `dark_dinu_${Date.now()}${fileExt}`;
      const form = new FormData();
      form.append('reqtype', 'fileupload');
      form.append('fileToUpload', buffer, { filename });

      const response = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: {
          ...form.getHeaders()
        },
        timeout: 90000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      const mediaUrl = response.data?.trim();

      if (!mediaUrl || !mediaUrl.startsWith('http')) {
        throw new Error('Upload failed from host server.');
      }

      const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
      const resultText = 
`⚡ *DARK-DINU MEDIA TO URL* ⚡

🔗 *Direct URL:* 
${mediaUrl}

📁 *Type:* ${mediaLabel}
📦 *Size:* ${sizeMB} MB
🖤 *Status:* PERMANENT PUBLIC LINK`;

      await sock.sendMessage(from, { text: resultText }, { quoted: msg });
      sock.sendMessage(from, { react: { text: "🔗", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error('[URL CMD ERROR]:', err.message);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, {
        text: `❌ URL එක සාදා ගැනීමට නොහැකි විය: ${err.message}`
      }, { quoted: msg });
    }
  }
};
