const axios = require("axios");

// Active download sessions store
if (!global.fbSessions) global.fbSessions = new Map();

module.exports = {
  name: "facebook",
  alias: ["fb", "fbdl"],
  category: "download",
  desc: "Download Facebook videos in HD, SD or Audio",

  async execute({ sock, msg, from, args, prefix }) {
    try {
      const rawUrl = args.find((arg) => arg.startsWith("http://") || arg.startsWith("https://"));

      if (!rawUrl || (!rawUrl.includes("facebook.com") && !rawUrl.includes("fb.watch"))) {
        return await sock.sendMessage(
          from,
          { 
            text: `⚠️ *කරුණාකර නිවැරදි Facebook Link එකක් ලබාදෙන්න!*\n\n*භාවිතය:* \`${prefix || "."}fb <link>\`\n*උදා:* \`${prefix || "."}fb https://fb.watch/xxxxxx/\`` 
          },
          { quoted: msg }
        );
      }

      await sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});

      const apiUrl = `https://api.chamindu.site/api/v1/facebook?url=${encodeURIComponent(rawUrl)}&api_key=chama_api_ec9848130d1aea209f08fb85e0b4720f`;
      const response = await axios.get(apiUrl, { timeout: 25000 });
      const res = response.data;

      const data = res?.data || res?.result || {};
      const title = data.title || "Facebook Video";
      const thumb = data.thumbnail || data.thumb || "https://files.catbox.moe/k315x4.jpg";
      const hdUrl = data.hd || data.video_hd || data.downloads?.hd || null;
      const sdUrl = data.sd || data.video_sd || data.downloads?.sd || data.url || null;
      const audioUrl = data.audio || data.downloads?.audio || null;

      if (!hdUrl && !sdUrl) {
        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(
          from,
          { text: "❌ මෙම වීඩියෝව ලබා ගැනීමට නොහැකි විය. (Private හෝ Restricted Post එකක් විය හැක)" },
          { quoted: msg }
        );
      }

      const cardUI = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🎬 *FACEBOOK DOWNLOADER* 〕
├─▸ 📌 *Title:* ${title.slice(0, 45)}...
├─▸ 🌐 *Platform:* Facebook Video
└───────────────────────

*බාගත කිරීමට අදාළ අංකය Reply කරන්න:*

┌─▸ 1️⃣ *HD Video* ${hdUrl ? "🟢" : "🔴"}
├─▸ 2️⃣ *SD Video* ${sdUrl ? "🟢" : "🔴"}
└─▸ 3️⃣ *Audio (MP3)* ${(audioUrl || sdUrl) ? "🟢" : "🔴"}

> 👑 *Developer:* DINIDU HESHAN
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🐦‍🔥*`;

      const sentMsg = await sock.sendMessage(
        from,
        {
          image: { url: thumb },
          caption: cardUI
        },
        { quoted: msg }
      );

      // Store in memory map
      global.fbSessions.set(sentMsg.key.id, {
        title,
        hd: hdUrl,
        sd: sdUrl,
        audio: audioUrl
      });

      // Clear memory after 5 minutes
      setTimeout(() => {
        if (global.fbSessions) global.fbSessions.delete(sentMsg.key.id);
      }, 5 * 60 * 1000);

      await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[FB CMD ERROR]:", err.message);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(
        from,
        { text: `❌ Facebook බාගත කිරීම අසාර්ථක විය: ${err.message || "Network Error"}` },
        { quoted: msg }
      );
    }
  }
};
