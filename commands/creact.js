// Sleep Helper
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Active queue flag (එකපාර loops කිහිපයක් run වී socket overload වීම වැළැක්වීමට)
let isCReactRunning = false;

module.exports = {
  name: "creact",
  alias: ["channelreact", "cr"],
  description: "Safe Multi-Bot WhatsApp Channel Post Reactor",

  async execute({ sock, msg, from, args, activeBots }) {
    try {
      // Argument Parsing: .creact <link>,<emoji1>,<emoji2>,...
      const fullText = args.join(" ").trim();
      if (!fullText || !fullText.includes(",")) {
        return await sock.sendMessage(from, {
          text: `⚠️ *භාවිතය:* \n.creact <channel_link>,<emoji1>,<emoji2>,...\n\n*උදාහරණයක්:* \n.creact https://whatsapp.com/channel/0029VaXXXXX/123,😚,🖤,✨,🥀`
        }, { quoted: msg });
      }

      const parts = fullText.split(",").map(p => p.trim()).filter(Boolean);
      const channelLink = parts[0];
      const emojis = parts.slice(1);

      if (emojis.length === 0) {
        return await sock.sendMessage(from, { text: "❌ කරුණාකර අවම වශයෙන් එක් Emoji එකක්වත් ලබා දෙන්න." }, { quoted: msg });
      }

      // Link Parsing (https://whatsapp.com/channel/CODE/POST_ID)
      const linkMatch = channelLink.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)(?:\/(\d+))?/);
      if (!linkMatch) {
        return await sock.sendMessage(from, { text: "❌ වැරදි Channel Link ආකෘතියක්!" }, { quoted: msg });
      }

      const channelCode = linkMatch[1];
      const postId = linkMatch[2];

      if (!postId) {
        return await sock.sendMessage(from, { text: "❌ Link එකේ Post ID එකක් නැත! Channel Post එකේ Share Link එකම ලබා දෙන්න." }, { quoted: msg });
      }

      if (isCReactRunning) {
        return await sock.sendMessage(from, { text: "⏳ දැනටමත් Reaction ක්‍රියාවලියක් ක්‍රියාත්මක වේ. සුළු වේලාවකින් නැවත උත්සාහ කරන්න." }, { quoted: msg });
      }

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // 1. Channel Metadata Fetch කර JID එක ලබා ගැනීම
      let channelJid = null;
      try {
        const metadata = await sock.newsletterMetadata("invite", channelCode);
        channelJid = metadata.id;
      } catch (e) {
        return await sock.sendMessage(from, { text: `❌ Channel එක සොයාගත නොහැකි විය: ${e.message}` }, { quoted: msg });
      }

      // Active bots එකතු කරගැනීම (Global store එකෙන් හෝ pass කරපු list එකෙන්)
      const botPool = (activeBots && activeBots.length > 0) ? activeBots : [sock];

      await sock.sendMessage(from, {
        text: `⚡ *C-REACT ENGINE INITIATED*\n\n📢 *Channel:* ${channelJid}\n🎯 *Post ID:* ${postId}\n🤖 *Active Bots:* ${botPool.length}\n✨ *Emojis:* ${emojis.join(" ")}\n\n_බොට්ස්ලාට බරක් නොවී තත්පර 3-5 අතර පරතරයකින් Reacts යැවීම ඇරඹුණා..._`
      }, { quoted: msg });

      // 2. Safe Background Runner (Main event loop එක block නොකරයි)
      (async () => {
        isCReactRunning = true;
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < botPool.length; i++) {
          const currentBot = botPool[i];
          const selectedEmoji = emojis[i % emojis.length];

          try {
            // Channel Reaction Key Protocol
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
            successCount++;
          } catch (err) {
            failCount++;
            console.error(`[C-REACT BOT ${i + 1} ERROR]:`, err.message);
          }

          // Safety Rate-Limit Delay (3.5s - 5s random delay)
          const safeDelayTime = Math.floor(Math.random() * 1500) + 3500;
          await delay(safeDelayTime);
        }

        isCReactRunning = false;

        // Completion Report
        await sock.sendMessage(from, {
          text: `✅ *C-REACT COMPLETED*\n\n🔥 *සාර්ථකයි:* ${successCount}\n⚠️️ *අසාර්ථකයි:* ${failCount}\n🎉 සියලු ක්‍රියාකාරකම් අවසන්!`
        }).catch(() => {});
      })();

    } catch (err) {
      isCReactRunning = false;
      console.error("[C-REACT MAIN ERROR]:", err);
      await sock.sendMessage(from, { text: `❌ C-React දෝෂයකි: ${err.message}` }, { quoted: msg });
    }
  }
};
