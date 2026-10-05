const axios = require("axios");

if (!global.videoSessions) {
  global.videoSessions = new Map();
}

module.exports = {
  name: "video",
  alias: ["ytv", "ytvideo", "ytmp4"],
  category: "download",
  desc: "Download YouTube video by link or name (1080p, 720p, 480p, 360p)",

  async execute({ sock, msg, from, args, prefix }) {
    try {
      const text = args.join(" ").trim();

      if (!text) {
        return await sock.sendMessage(from, { 
          text: `⚠️️ *කරුණාකර වීඩියෝවේ නම හෝ YouTube Link එකක් ලබාදෙන්න!*\n\n*භාවිතය:*\n• \`${prefix || "."}video Alan Walker Faded\`\n• \`${prefix || "."}video https://youtu.be/xxxxxx\`` 
        }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});

      let targetUrl = text;
      const isYtLink = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/.test(text);

      // 1. නමක් (Search Query) දුන්නොත් YouTube එකෙන් Link එක Search කර ගැනීම
      if (!isYtLink) {
        try {
          const searchRes = await axios.get(`https://weeb-api.vercel.app/ytsearch?query=${encodeURIComponent(text)}`, { timeout: 15000 });
          const firstResult = searchRes.data?.[0] || searchRes.data?.results?.[0];
          
          if (firstResult && firstResult.url) {
            targetUrl = firstResult.url;
          } else {
            const fbSearch = await axios.get(`https://api.siputzx.my.id/api/s/youtube?query=${encodeURIComponent(text)}`, { timeout: 15000 });
            const fbResult = fbSearch.data?.data?.[0];
            if (fbResult && fbResult.url) {
              targetUrl = fbResult.url;
            }
          }
        } catch (searchErr) {
          console.error("[YT SEARCH ERR]:", searchErr.message);
        }
      }

      // 2. Metadata / Thumbnail ලබා ගැනීම
      const apiKey = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
      const apiUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(targetUrl)}&quality=360p&format=mp4&api_key=${apiKey}`;

      const res = await axios.get(apiUrl, { timeout: 30000 });
      const resData = res.data;

      if (!resData || (!resData.status && !resData.success)) {
        throw new Error("වීඩියෝවේ තොරතුරු සොයාගත නොහැකි විය. වෙනත් නමක් හෝ Link එකක් උත්සාහ කරන්න.");
      }

      const item = resData.data || resData;
      const title = item.title || "YouTube Video";
      const thumbnail = item.thumbnail || "https://files.catbox.moe/k315x4.jpg";

      // Dark-Dinu Quality Selection Menu Card
      const videoCard = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🎬 *YOUTUBE DOWNLOADER* 〕
├─▸ 📌 *Title:* ${title.slice(0, 48)}...
├─▸ 🌐 *Platform:* YouTube Video
└───────────────────────

*බාගත කිරීමට අවශ්‍ය අංකය Reply කරන්න:*

┌─▸ [1] 🌟 *1080p (Full HD)*
├─▸ [2] 🎬 *720p (HD Video)*
├─▸ [3] 📱 *480p (Standard SD)*
└─▸ [4] ⚡ *360p (Data Saver)*

> 👑 *Developer:* DINIDU HESHAN
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🐦‍🔥*`;

      const sentMsg = await sock.sendMessage(from, {
        image: { url: thumbnail },
        caption: videoCard
      }, { quoted: msg });

      // Session එක Memory එකේ Store කිරීම
      if (sentMsg?.key?.id) {
        global.videoSessions.set(sentMsg.key.id, {
          url: targetUrl,
          title,
          apiKey
        });

        // විනාඩි 10 කට පසු Session එක ඉවත් කිරීම
        setTimeout(() => {
          if (global.videoSessions && global.videoSessions.has(sentMsg.key.id)) {
            global.videoSessions.delete(sentMsg.key.id);
          }
        }, 10 * 60 * 1000);
      }

      await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[YOUTUBE VIDEO ERROR]:", err.message);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, { 
        text: `❌ වීඩියෝව ලබාගත නොහැකි විය: ${err.message || "Network Error"}` 
      }, { quoted: msg });
    }
  }
};
