const axios = require("axios");

module.exports = {
  name: "instagram",
  alias: ["insta", "ig", "igdl", "reel"],
  category: "download",
  desc: "Download Instagram Reels, Videos, and Photos",

  async execute({ sock, msg, from, args, prefix }) {
    try {
      const url = args[0]?.trim();

      if (!url) {
        return await sock.sendMessage(from, { 
          text: `⚠️ *කරුණාකර Instagram Link එකක් ලබාදෙන්න!*\n\n*භාවිතය:* \`${prefix || "."}insta <link>\`\n*උදා:* \`${prefix || "."}insta https://www.instagram.com/reel/xxxxxx/\`` 
        }, { quoted: msg });
      }

      if (!url.includes("instagram.com")) {
        return await sock.sendMessage(from, { 
          text: "❌ කරුණාකර නිවැරදි Instagram Link එකක් ඇතුළත් කරන්න." 
        }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      const apiKey = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
      const apiUrl = `https://api.chamindu.site/api/v1/media/instagram?url=${encodeURIComponent(url)}&api_key=${apiKey}`;

      const res = await axios.get(apiUrl, { timeout: 35000 });
      const resData = res.data;

      // 1. Private හෝ Inaccessible Links Check කිරීම
      if (resData?.data?.status === "inaccessible_or_private" || resData?.message?.includes("Could not resolve")) {
        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { 
          text: "❌ මෙම Post එක Private ගිණුමක එකක් හෝ ලබාගත නොහැකි Link එකකි. Public Post එකක Link එකක් ලබාදෙන්න." 
        }, { quoted: msg });
      }

      if (!resData || (!resData.status && !resData.success)) {
        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { 
          text: "❌ මාධ්‍යය සොයාගත නොහැකි විය. Link එක නිවැරදිදැයි පරීක්ෂා කරන්න." 
        }, { quoted: msg });
      }

      const mediaData = resData.data || resData.result || resData;

      const caption = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 📸 *INSTAGRAM DOWNLOADER* 〕
├─▸ ⚡ *Status*  : High Quality Fetched
├─▸ 🎯 *Engine*  : Ultra Stream Relay
└───────────────────────

> 👑 *Developer:* DINIDU HESHAN
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🐦‍🔥*`;

      // 2. Data Parse කිරීම (Arrays & Single Objects)
      let mediaList = [];
      if (Array.isArray(mediaData)) {
        mediaList = mediaData;
      } else if (Array.isArray(mediaData.downloads)) {
        mediaList = mediaData.downloads;
      } else if (Array.isArray(mediaData.media)) {
        mediaList = mediaData.media;
      } else if (typeof mediaData === "object") {
        mediaList = [mediaData];
      }

      let sentMedia = false;

      for (const item of mediaList) {
        const downloadUrl = item.url || item.download_url || item.link || (typeof item === "string" ? item : null);
        const isVideo = item.type === "video" || item.type === "mp4" || (downloadUrl && downloadUrl.includes(".mp4"));

        if (downloadUrl && typeof downloadUrl === "string" && downloadUrl.startsWith("http")) {
          if (isVideo) {
            await sock.sendMessage(from, {
              video: { url: downloadUrl },
              caption: caption,
              mimetype: "video/mp4"
            }, { quoted: msg });
          } else {
            await sock.sendMessage(from, {
              image: { url: downloadUrl },
              caption: caption
            }, { quoted: msg });
          }
          sentMedia = true;
          break;
        }
      }

      if (!sentMedia) {
        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { 
          text: "❌ මෙම Link එකෙන් Media එක බාගත කිරීමට නොහැකි විය." 
        }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[INSTAGRAM ERROR]:", err.message);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, { 
        text: `❌ Instagram බාගත කිරීම අසාර්ථක විය: ${err.message || "Network Error"}` 
      }, { quoted: msg });
    }
  }
};
