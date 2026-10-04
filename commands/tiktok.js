const axios = require('axios');

// Reply listener එක සඳහා session cache එකක් (Memory-safe)
global.ttCache = global.ttCache || new Map();

module.exports = {
  name: "tiktok",
  alias: ["tt", "tikdl", "ttdl"],
  description: "Download TikTok HD/SD videos and audio via interactive reply menu",

  async execute({ sock, msg, from, args }) {
    try {
      const url = args[0]?.trim();

      if (!url || (!url.includes("tiktok.com") && !url.includes("vt.tiktok.com"))) {
        return await sock.sendMessage(from, {
          text: `*⚠️ කරුණාකර නිවැරදි TikTok Link එකක් ඇතුළත් කරන්න!*\n\n*භාවිතය:* .tt <tiktok_url>\n*උදා:* .tt https://vm.tiktok.com/xxxxxx/`
        }, { quoted: msg });
      }

      sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // Chamindu API Endpoint Call
      const apiKey = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
      const apiUrl = `https://api.chamindu.site/api/v1/tiktok?url=${encodeURIComponent(url)}&api_key=${apiKey}`;

      const { data: res } = await axios.get(apiUrl, { timeout: 30000 });

      if (!res.status || !res.data) {
        throw new Error("TikTok data extraction failed. Please try again.");
      }

      const d = res.data;
      const downloads = d.downloads;

      // Menu Text Card
      const caption = 
`╔══════════════════════╗
   🕷️ *𝐃𝘼𝙍𝙆 𝐃𝙄𝙉𝙐 𝙏𝙄𝙆𝙏𝙊𝙆* 🕷️
╚══════════════════════╝

📌 *Title:* ${d.title || "No Title"}
👤 *Creator:* @${d.author?.unique_id || "Unknown"} (${d.author?.nickname || "N/A"})
⏱️ *Duration:* ${d.duration || 0}s
👁️ *Views:* ${(d.stats?.views || 0).toLocaleString()}  |  ❤️ *Likes:* ${(d.stats?.likes || 0).toLocaleString()}

┌──────────────────────┐
   *REPLY WITH YOUR CHOICE:*
   
  🥀 *1*  ➟  *HD Video (No Watermark)*
  🥀 *2*  ➟  *SD Video (Fast / Lightweight)*
  🥀 *3*  ➟  *Audio Voice Note (PTT)*
└──────────────────────┘

> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐁𝐎𝐓 ✨*`;

      // Cover image එක සමඟ Menu එක යැවීම
      const coverUrl = d.origin_cover || d.cover;
      const sentMsg = await sock.sendMessage(from, {
        image: { url: coverUrl },
        caption: caption
      }, { quoted: msg });

      // Reply එක capture කිරීමට download links memory cache එකට දැමීම (TTL: 5 Minutes)
      const messageId = sentMsg.key.id;
      global.ttCache.set(messageId, {
        hd: downloads.no_watermark_hd || downloads.no_watermark,
        sd: downloads.no_watermark_sd || downloads.no_watermark,
        audio: downloads.audio || d.music_info?.play_url,
        title: d.title || "DARK-DINU TikTok"
      });

      // 5 min පසු cache auto clear කිරීම
      setTimeout(() => {
        global.ttCache.delete(messageId);
      }, 5 * 60 * 1000);

      sock.sendMessage(from, { react: { text: "🎬", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[TIKTOK ERROR]:", err.message);
      sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, {
        text: `❌ Video එක ලබා ගැනීමට නොහැකි විය: ${err.message}`
      }, { quoted: msg });
    }
  }
};
