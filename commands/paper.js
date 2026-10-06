const axios = require('axios');

module.exports = {
  name: "paper",
  alias: ["pastpaper", "exam", "pdfdl"],
  category: "download",
  desc: "Smart Past Paper Search & PDF Downloader",

  async execute({ sock, msg, from, args, prefix }) {
    try {
      const inputQuery = args.join(' ').trim();

      if (!inputQuery) {
        return await sock.sendMessage(from, { 
          text: `⚠️ *INVALID USAGE*\n\nPlease provide a search query or a valid link.\n\n*Format:* \`${prefix || "."}paper <grade / subject / year / link>\`\n*Examples:*\n• \`${prefix || "."}paper 2023 grade 11 science sinhala\`\n• \`${prefix || "."}paper 2024 al ict paper\`` 
        }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});

      let targetUrl = inputQuery;

      // 1. User ලින්ක් එකක් නොදුන් විට Smart Target Resolver එක ක්‍රියාත්මක වීම
      if (!inputQuery.startsWith('http://') && !inputQuery.startsWith('https://')) {
        try {
          const searchUrl = `https://pastpapers.wiki/?s=${encodeURIComponent(inputQuery)}`;
          const searchRes = await axios.get(searchUrl, {
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });

          const html = searchRes.data || "";

          // Archive / Category / Tag පිටු මඟහැර සැබෑ Single Article Post URL එකක් පමණක් සොයා ගැනීම
          const urlMatches = [...html.matchAll(/<h2[^>]*class="[^"]*entry-title[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"/gi)];
          let validPostUrl = null;

          for (const m of urlMatches) {
            const foundUrl = m[1];
            if (
              foundUrl &&
              !foundUrl.includes('/category/') &&
              !foundUrl.includes('/tag/') &&
              !foundUrl.includes('/author/') &&
              foundUrl.includes('pastpapers.wiki')
            ) {
              validPostUrl = foundUrl;
              break;
            }
          }

          // Regex Method 2: සාමාන්‍ය post links scan කිරීම
          if (!validPostUrl) {
            const fallbackMatches = [...html.matchAll(/href="(https:\/\/pastpapers\.wiki\/[a-zA-Z0-9\-]+\/)"/gi)];
            for (const fm of fallbackMatches) {
              const u = fm[1];
              if (!u.includes('/category/') && !u.includes('/tag/') && u.split('/').length >= 4) {
                validPostUrl = u;
                break;
              }
            }
          }

          if (!validPostUrl) {
            await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
            return await sock.sendMessage(from, { 
              text: `❌ *NO PAPERS FOUND*\n\nCould not find any past paper for "${inputQuery}".\n*Tip:* Try adding Grade & Year (e.g. \`${prefix || "."}paper grade 11 ict 2023\`).` 
            }, { quoted: msg });
          }

          targetUrl = validPostUrl;
        } catch (searchErr) {
          console.error("[SEARCH ERROR]:", searchErr.message);
        }
      }

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // 2. Supun Downloader API එක මඟින් PDF Links ලබා ගැනීම
      const apiKey = "supun-tvo5olfxylo98b8l6b9lq174";
      const apiUrl = `https://supunofc.site/api/download/pastpapers/dl?url=${encodeURIComponent(targetUrl)}&apikey=${apiKey}`;

      const response = await axios.get(apiUrl, { timeout: 35000 });
      const resData = response.data;

      if (!resData?.success || !resData?.results) {
        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { 
          text: `❌ *FETCH FAILED*\n\nUnable to extract paper from:\n${targetUrl}` 
        }, { quoted: msg });
      }

      const { title, thumbnail, total_pdfs, pdfLinks } = resData.results;

      if (!pdfLinks || !Array.isArray(pdfLinks) || pdfLinks.length === 0) {
        await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, { 
          text: "❌ *EMPTY PAPER ARCHIVE*\n\nNo downloadable PDF files exist on this specific page." 
        }, { quoted: msg });
      }

      // 3. Status Overview Card
      const infoCard = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️️
╚══════════════════════╝

┌─〔 📚 *PAST PAPER ENGINE* 〕
├─▸ 📝 *Title*  : ${title || "Past Paper"}
├─▸ 📦 *Files*  : ${total_pdfs || pdfLinks.length} PDF Document(s)
├─▸ 🌐 *Target* : ${targetUrl.slice(0, 45)}...
└───────────────────────

> ⚡ *Sending PDF file(s), please wait...*

> 👑 *Developer:* DINIDU HESHAN
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🐦‍🔥*`;

      if (thumbnail) {
        await sock.sendMessage(from, {
          image: { url: thumbnail },
          caption: infoCard
        }, { quoted: msg }).catch(() => {
          sock.sendMessage(from, { text: infoCard }, { quoted: msg });
        });
      } else {
        await sock.sendMessage(from, { text: infoCard }, { quoted: msg });
      }

      // 4. සියලුම PDFs පිළිවෙළට WhatsApp Documents ලෙස Dispatch කිරීම
      for (let i = 0; i < pdfLinks.length; i++) {
        const directPdfUrl = pdfLinks[i];
        
        const cleanTitle = (title || "Past_Paper")
          .replace(/[\/\\?%*:|"<>]/g, '')
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
