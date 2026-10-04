const delay = (ms) => new Promise((res) => setTimeout(res, ms));

module.exports = {
  name: "creact",
  alias: ["cr"],
  description: "React to a single channel post using ALL active bot sessions",

  async execute({ sock, msg, from, args }) {
    try {
      const fullText = args.join(" ").trim();
      if (!fullText || !fullText.includes(",")) {
        return await sock.sendMessage(from, {
          text: `⚠️ *භාවිතය:*\n.creact <channel_post_link>,<emoji1>,<emoji2>...\n\n*උදාහරණ:* \n.creact https://whatsapp.com/channel/0029VaXXXXX/123,😚,🖤,✨,🥀`
        }, { quoted: msg });
      }

      const parts = fullText.split(",").map(p => p.trim()).filter(Boolean);
      const postLink = parts[0];
      const emojis = parts.slice(1);

      if (emojis.length === 0) {
        return await sock.sendMessage(from, { text: "❌ කරුණාකර අවම වශයෙන් එක emoji එකක්වත් දෙන්න." }, { quoted: msg });
      }

      // Link Parsing (Channel Invite Code + Server Post ID)
      const linkMatch = postLink.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)(?:\/(\d+))/);
      if (!linkMatch || !linkMatch[1] || !linkMatch[2]) {
        return await sock.sendMessage(from, { 
          text: "❌ වැරදි Channel Post Link එකක්! Channel එකේ post එක 'Share' කරලා එන Link එකම ලබා දෙන්න (අගට post number එකක් තියෙන්න ඕනේ)." 
        }, { quoted: msg });
      }

      const channelCode = linkMatch[1];
      const postId = linkMatch[2];

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // 1. Channel JID එක ලබා ගැනීම
      let channelJid = null;
      try {
        const metadata = await sock.newsletterMetadata("invite", channelCode);
        channelJid = metadata.id;
      } catch (e) {
        return await sock.sendMessage(from, { text: `❌ Channel එක සොයාගත නොහැකි විය: ${e.message}` }, { quoted: msg });
      }

      // 2. දැනට Active සියලුම Bot Sockets ලබා ගැනීම
      let botList = [];
      if (global.activeSockets && global.activeSockets.size > 0) {
        botList = Array.from(global.activeSockets.values());
      } else {
        botList = [sock];
      }

      await sock.sendMessage(from, {
        text: `⚡ *C-REACT ENGINE STARTED*\n\n📢 *Target Channel:* ${channelJid}\n🎯 *Post ID:* ${postId}\n🤖 *Total Active Nodes:* ${botList.length}\n✨ *Emojis:*${emojis.join(" ")}\n\n_බොට්ස්ලාට බරක් නොවී තත්පර 4-5 ක පරතරයකින් reactions යැවීම පසුබිමින් ඇරඹුණා..._`
      }, { quoted: msg });

      // 3. Background Safe Worker Loop
      (async () => {
        let success = 0;
        let fail = 0;

        for (let i = 0; i < botList.length; i++) {
          const currentBot = botList[i];
          const selectedEmoji = emojis[i % emojis.length];

          try {
            // Channel Reaction Key Protocol
            await currentBot.sendMessage(channelJid, {
              react: {
                text: selectedEmoji,
                key: {
                  remoteJid: channelJid,
                  server_id: postId.toString(),
                  fromMe: false
                }
              }
            });
            success++;
          } catch (err) {
            fail++;
            console.error(`[C-REACT BOT ${i + 1} ERROR]:`, err.message);
          }

          // Delay between bots (4 to 5 seconds)
          await delay(4000 + Math.floor(Math.random() * 1000));
        }

        await sock.sendMessage(from, {
          text: `✅ *C-REACT සම්පූර්ණයි!*\n\n🎯 *Post ID:* ${postId}\n🔥 *සාර්ථකයි:* ${success}\n⚠ *අසාර්ථකයි:* ${fail}\n🎉 සියලුම Nodes මඟින් Reacts යවා අවසන්!`
        }).catch(() => {});
      })();

    } catch (err) {
      await sock.sendMessage(from, { text: `❌ C-React දෝෂයකි: ${err.message}` }, { quoted: msg });
    }
  }
};
