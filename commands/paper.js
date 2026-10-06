const axios = require('axios');

module.exports = {
  name: "paper",
  alias: ["pastpaper", "exam", "pdfdl"],
  category: "download",
  desc: "Download past papers by link or subject search (pastpapers.wiki)",

  async execute({ sock, msg, from, args, prefix }) {
    try {
      const inputQuery = args.join(' ').trim();

      if (!inputQuery) {
        return await sock.sendMessage(from, { 
          text: `⚠️ *INVALID USAGE*\n\nSearch query එකක් හෝ Link එකක් ලබා දෙන්න.\n\n*Format:* \`${prefix || "."}paper <subject / grade / link>\`\n*Examples:*\n• \`${prefix || "."}paper 2023 grade 11 science sinhala\`\n• \`${prefix || "."}paper https://pastpapers.wiki/xxxxxx\`` 
        }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});

      let targetUrl = inputQuery;

      // 1. User දුන්නේ Search Query එකක් නම් pastpapers.wiki එකෙන් page link එක Auto-Search කර ගැනීම
      if (!inputQuery.includes('pastpapers.wiki')) {
        try {
          const searchEndpoint = `https://pastpapers.wiki/?s=${encodeURIComponent(inputQuery)}`;
          const searchRes = await axios.get(searchEndpoint, {
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
            }
          });

          const html = searchRes.data || "";
          
          // Regex මඟින් පළමු ලිපියේ URL එක අල්ලා ගැනීම
          const match = html.match(/<h2[^>]*class="[^"]*entry-title[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"/i) ||
                        html.match(/<a[^>]*href="(https:\/\/pastpapers\.wiki\/[^"]+\/)"[^>]*rel="bookmark"/i) ||
                        html.match(/href="(https:\/\/pastpapers\.wiki\/[a-z0-9\-]+\/)"/i);

          if (match && match[1]) {
            targetUrl = match[1];
          } else {
            await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
            return await sock.sendMessage(from, { 
              text: `❌ *NO PAPERS FOUND:*\n\n"${inputQuery}" නමින් past paper එකක් සොයාගත නොහැකි විය. කරුණාකර Grade එක හෝ Subject එක නිවැරදිව සඳහන් කරන්න.` 
            }, { quoted: msg });
          }
        } catch (searchErr) {
          console.error("[SEARCH ERROR]:", searchErr.message);
        }
      }

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // 2. Supun Downloader API එකෙන් Direct PDF Links ලබා ගැනීම
      const apiKey = "supun-tvo5olfxylo98b8l6b9lq174";
      const apiUrl = `https://supunofc.site/api/download/pastpapers/dl?url=${encodeURIComponent(targetUrl)}&apikey=${apiKey}`;

      const response = await axios.get(apiUrl, { timeout: 30000 });
      const resData = response.data;

      if (!resData?.success || !resData?.results) {
        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { 
          text: "❌ *EXTRACTION FAILED:* Past paper PDF download links extract කර ගැනීමට නොහැකි විය." 
        }, { quoted: msg });
      }

      const { title, thumbnail, total_pdfs, pdfLinks } = resData.results;

      if (!pdfLinks || !Array.isArray(pdfLinks) || pdfLinks.length === 0) {
        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { 
          text: "❌ *EMPTY PAPER:* මෙම ලිපියෙහි Downloadable PDF files කිසිවක් හමු නොවීය." 
        }, { quoted: msg });
      }

      // 3. Cyber Overview Card එක යැවීම
      const infoCard = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️️
╚══════════════════════╝

┌─〔 📚 *PAST PAPER CLUSTER* 〕
├─▸ 📝 *Title*  : ${title || "Past Paper"}
├─▸ 📦 *Files*  : ${total_pdfs || pdfLinks.length} PDF(s) Found
├─▸ 🌐 *Engine* : Auto Search & Stream
└───────────────────────

> ⚡ *Uploading PDF document(s), please wait...*

> 👑 *Developer:* DINIDU HESHAN
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🐦‍🔥*`;

      if (thumbnail) {
        await sock.sendMessage(from, {
          image: { url: thumbnail },
          caption: infoCard
        }, { quoted: msg }).catch(() => {});
      } else {
        await sock.sendMessage(from, { text: infoCard }, { quoted: msg }).catch(() => {});
      }

      // 4. සියලුම PDFs Document Files ලෙස යැවීම
      for (let i = 0; i < pdfLinks.length; i++) {
        const directPdfUrl = pdfLinks[i];
        
        const cleanTitle = (title || "Past_Paper")
          .replace(/[\\/*?:"<>|]/g, "")
          .slice(0, 60);

        const fileName = pdfLinks.length > 1 
          ? `${cleanTitle}_Part_${i + 1}.pdf` 
          : `${cleanTitle}.pdf`;

        await sock.sendMessage(from, {
          document: { url: directPdfUrl },
          mimetype: 'application/pdf',
          fileName: fileName,
          caption: `📄 *${fileName}*`
        }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});

    } catch (err) {
      console.error("[PAPER CMD ERROR]:", err.message);
      await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
      await sock.sendMessage(from, { 
        text: `❌ *DOWNLOAD FAILED:* ${err.message || "Network timeout / Server unreachable"}` 
      }, { quoted: msg });
    }
  }
};
