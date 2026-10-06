const axios = require('axios');

// සිංහල වචන pastpapers.wiki සයිට් එකට තේරෙන keywords බවට පත් කිරීම
function cleanQuery(text) {
  let q = text.toLowerCase()
    .replace(/සිංහල/g, 'sinhala')
    .replace(/විද්‍යාව/g, 'science')
    .replace(/ගණිතය/g, 'mathematics')
    .replace(/ඉංග්‍රීසි/g, 'english')
    .replace(/ඉතිහාසය/g, 'history')
    .replace(/පේපර්|පේපර්ස්/g, '')
    .trim();

  // Grade එකක් දී නැත්නම් default Grade 11 එකතු කිරීම
  if (!q.includes('grade') && !q.includes('al') && !q.includes('ol')) {
    q = `grade 11 ${q}`;
  }
  return q;
}

module.exports = {
  name: "paper",
  alias: ["pastpaper", "exam", "pdfdl"],
  category: "download",
  desc: "Smart Past Paper Search & PDF Downloader",

  async execute({ sock, msg, from, args, prefix }) {
    try {
      const rawInput = args.join(' ').trim();

      if (!rawInput) {
        return await sock.sendMessage(from, { 
          text: `⚠️ *INVALID USAGE*\n\nPlease provide subject & grade.\n\n*Format:* \`${prefix || "."}paper <subject / grade>\`\n*Examples:*\n• \`${prefix || "."}paper sinhala\`\n• \`${prefix || "."}paper grade 11 science\`\n• \`${prefix || "."}paper ict\`` 
        }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "🔍", key: msg.key } }).catch(() => {});

      let targetUrl = rawInput;

      // 1. Direct pastpapers.wiki link එකක් නොවේ නම් Auto-Search කිරීම
      if (!rawInput.startsWith('http://') && !rawInput.startsWith('https://')) {
        let searchQuery = cleanQuery(rawInput);

        const searchAndFindPost = async (queryTerm) => {
          const endpoint = `https://pastpapers.wiki/?s=${encodeURIComponent(queryTerm)}`;
          const res = await axios.get(endpoint, {
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });
          const html = res.data || "";

          // සැබෑ Single Article Links පමණක් තෝරා ගැනීම (Category/Tag මඟහැරීම)
          const matches = [...html.matchAll(/<h2[^>]*class="[^"]*entry-title[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"/gi)];
          for (const m of matches) {
            const url = m[1];
            if (
              url &&
              !url.includes('/category/') &&
              !url.includes('/tag/') &&
              !url.includes('/author/') &&
              url.includes('pastpapers.wiki')
            ) {
              return url;
            }
          }
          return null;
        };

        // පළමු සෙවීම
        let foundPost = await searchAndFindPost(searchQuery);

        // 2025 වැනි වසරවල් නොමැති නම් වසර ඉවත් කර පවතින අලුත්ම paper එකක් සෙවීම
        if (!foundPost && searchQuery.match(/202[5-9]/)) {
          const fallbackTerm = searchQuery.replace(/202[5-9]/g, '').trim();
          foundPost = await searchAndFindPost(fallbackTerm);
        }

        if (!foundPost) {
          await sock.sendMessage(from, { react: { text: "❌", key: msg.key } }).catch(() => {});
          return await sock.sendMessage(from, { 
            text: `❌ *NO PAPERS FOUND*\n\nCould not find available past papers for "${rawInput}".\n\n*Suggestion:* Try searching like \`${prefix || "."}paper grade 11 sinhala\` or \`${prefix || "."}paper grade 11 ict\`.` 
          }, { quoted: msg });
        }

        targetUrl = foundPost;
      }

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // 2. Supun Downloader API එක මඟින් PDF ලබා ගැනීම
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
          text: `❌ *NO DOWNLOADABLE PDF*\n\nThis specific paper archive page does not contain direct PDF files.` 
        }, { quoted: msg });
      }

      // 3. Cyber Overview Card
      const infoCard = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷
╚══════════════════════╝

┌─〔 📚 *PAST PAPER CLUSTER* 〕
├─▸ 📝 *Title*  : ${title || "Past Paper"}
├─▸ 📦 *Files*  : ${total_pdfs || pdfLinks.length} PDF Document(s)
├─▸ 🌐 *Source* : pastpapers.wiki
└───────────────────────

> ⚡ *Uploading PDF document(s), please wait...*

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

      // 4. සියලුම PDFs පිළිවෙළට WhatsApp Document ලෙස එවනු ලැබේ
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
        text: `❌ *DOWNLOAD FAILED:* ${err.message || "Network timeout"}` 
      }, { quoted: msg });
    }
  }
};
