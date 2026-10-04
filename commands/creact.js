const delay = (ms) => new Promise((res) => setTimeout(res, ms));

module.exports = {
  name: "creact",
  alias: ["postreact", "cr"],
  description: "React to a single channel post using all active bots safely",

  async execute({ sock, msg, from, args, activeBots }) {
    try {
      const fullText = args.join(" ").trim();
      if (!fullText || !fullText.includes(",")) {
        return await sock.sendMessage(from, {
          text: `⚠️ *භාවිතය:*\n.creact <post_link>,<emoji1>,<emoji2>...\n\n*උදාහරණයක්:*\n.creact https://whatsapp.com/channel/0029VaXXXXX/123,😚,🖤,✨,🥀`
        }, { quoted: msg });
      }

      const parts = fullText.split(",").map(p => p.trim()).filter(Boolean);
      const postLink = parts[0];
      const emojis = parts.slice(1);

      if (emojis.length === 0) {
        return await sock.sendMessage(from, { text: "❌ අවම වශයෙන් එක emoji එකක්වත් දෙන්න." }, { quoted: msg });
      }

      // Extract Channel Code and Server Post ID
      const linkMatch = postLink.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)(?:\/(\d+))/);
      if (!linkMatch || !linkMatch[1] || !linkMatch[2]) {
        return await sock.sendMessage(from, { 
          text: "❌ වැරදි Link ආකෘතියක්! අනිවාර්යයෙන් Channel Post එකේ Share Link එකම ලබා දෙන්න (අගට post ID එකක් සහිතව)." 
        }, { quoted: msg });
      }

      const channelCode = linkMatch[1];
      const postId = linkMatch[2];

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // Fetch Channel JID
      let channelJid = null;
      try {
        const metadata = await sock.newsletterMetadata("invite", channelCode);
        channelJid = metadata.id;
      } catch (e) {
        return await sock.sendMessage(from, { text: `❌ Channel metadata සොයාගත නොහැකි විය: ${e.message}` }, { quoted: msg });
      }

      const botPool = (activeBots && activeBots.length > 0) ? activeBots : [sock];

      await sock.sendMessage(from, {
        text: `⚡ *C-REACT (SINGLE POST)*\n\n🎯 *Post ID:* ${postId}\n🤖 *Active Bots:* ${botPool.length}\n✨ *Emojis:*${emojis.join(" ")}\n\n_බොට්ස්ලා කිසිවෙකුට බරක් නොවී තත්පර 4-5 ක පරතරයකින් Reacts යැවීම ආරම්භ විය..._`
      }, { quoted: msg });

      // Background Worker to avoid blocking
      (async () => {
        let success = 0;
        let fail = 0;

        for (let i = 0; i < botPool.length; i++) {
          const currentBot = botPool[i];
          const selectedEmoji = emojis[i % emojis.length];

          try {
            await currentBot.sendMessage(channelJid, {
              react: {
                text: selectedEmoji,
                key: {
                  remoteJid: channelJid,
                  server_id: postId,
                  fromMe: false
                }
              }
            });
            success++;
          } catch (err) {
            fail++;
          }

          // Safe 4 - 5s Delay
          await delay(4000 + Math.floor(Math.random() * 1000));
        }

        await sock.sendMessage(from, {
          text: `✅ *C-REACT අවසන්!*\n\n🎯 *Post ID:* ${postId}\n🔥 *සාර්ථකයි:* ${success}\n⚠ *අසාර්ථකයි:* ${fail}`
        }).catch(() => {});
      })();

    } catch (err) {
      await sock.sendMessage(from, { text: `❌ දෝෂයකි: ${err.message}` }, { quoted: msg });
    }
  }
};
