const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// Global Store for Channels to Auto-React
global.autoChannelReactors = global.autoChannelReactors || new Map();
let isAutoListenerSet = false;

module.exports = {
  name: "creact2",
  alias: ["autoreactchannel", "cr2"],
  description: "Auto react to newly posted messages in a channel continuously",

  async execute({ sock, msg, from, args, activeBots }) {
    try {
      const fullText = args.join(" ").trim();
      if (!fullText || !fullText.includes(",")) {
        return await sock.sendMessage(from, {
          text: `⚠️ *භාවිතය:*\n• *On කිරීමට:* .creact2 <channel_link>,<emoji1>,<emoji2>...\n• *Off කිරීමට:* .creact2 <channel_link>,offreact\n\n*උදාහරණයක්:*\n.creact2 https://whatsapp.com/channel/0029VaXXXXX,🥀,✨,🖤,😚`
        }, { quoted: msg });
      }

      const parts = fullText.split(",").map(p => p.trim()).filter(Boolean);
      const channelLink = parts[0];
      const actionOrEmoji = parts[1];

      // Extract Channel Code
      const linkMatch = channelLink.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)/);
      if (!linkMatch || !linkMatch[1]) {
        return await sock.sendMessage(from, { text: "❌ වැරදි Channel Link එකක්!" }, { quoted: msg });
      }

      const channelCode = linkMatch[1];

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

      // Fetch Channel JID
      let channelJid = null;
      try {
        const metadata = await sock.newsletterMetadata("invite", channelCode);
        channelJid = metadata.id;
      } catch (e) {
        return await sock.sendMessage(from, { text: `❌ Channel එක සොයාගත නොහැකි විය: ${e.message}` }, { quoted: msg });
      }

      // OFF Logic
      if (actionOrEmoji.toLowerCase() === "offreact") {
        if (global.autoChannelReactors.has(channelJid)) {
          global.autoChannelReactors.delete(channelJid);
          return await sock.sendMessage(from, { 
            text: `🛑 *Auto-React Stopped!*\n\n📢 *Channel:* ${channelJid}\nමෙම Channel එක සඳහා auto reaction සාර්ථකව අක්‍රිය කරන ලදී.` 
          }, { quoted: msg });
        } else {
          return await sock.sendMessage(from, { text: "⚠️ මෙම Channel එක සඳහා Auto-React දැනටමත් ක්‍රියාත්මකව නැත." }, { quoted: msg });
        }
      }

      // ON Logic
      const emojis = parts.slice(1);
      if (emojis.length === 0) {
        return await sock.sendMessage(from, { text: "❌ කරුණාකර අවම වශයෙන් එක emoji එකක්වත් ඇතුළත් කරන්න." }, { quoted: msg });
      }

      // Save to global tracking memory
      global.autoChannelReactors.set(channelJid, {
        emojis: emojis,
        addedBy: from
      });

      // Hook Upsert Listener for Newsletters once
      if (!isAutoListenerSet) {
        isAutoListenerSet = true;

        sock.ev.on("messages.upsert", async (mUpdate) => {
          try {
            if (!mUpdate.messages || mUpdate.type !== "notify") return;

            for (const chMsg of mUpdate.messages) {
              const remoteJid = chMsg.key.remoteJid;

              // Check if message is from a tracked Newsletter/Channel
              if (remoteJid && global.autoChannelReactors.has(remoteJid)) {
                const configData = global.autoChannelReactors.get(remoteJid);
                const postId = chMsg.key.server_id || chMsg.message?.extendedTextMessage?.contextInfo?.stanzaId;

                if (!postId) continue;

                const botPool = (activeBots && activeBots.length > 0) ? activeBots : [sock];

                // Background safe loop for the new post
                (async () => {
                  for (let i = 0; i < botPool.length; i++) {
                    const currentBot = botPool[i];
                    const selectedEmoji = configData.emojis[i % configData.emojis.length];

                    try {
                      await currentBot.sendMessage(remoteJid, {
                        react: {
                          text: selectedEmoji,
                          key: {
                            remoteJid: remoteJid,
                            server_id: postId,
                            fromMe: false
                          }
                        }
                      });
                    } catch (_) {}

                    // Safe 4 - 5s Delay between bots
                    await delay(4000 + Math.floor(Math.random() * 1000));
                  }
                })();
              }
            }
          } catch (_) {}
        });
      }

      await sock.sendMessage(from, {
        text: `✅ *AUTO-REACT ACTIVATED*\n\n📢 *Channel:* ${channelJid}\n✨ *Emojis:*${emojis.join(" ")}\n🤖 *Target Bots:* ${activeBots?.length || 1}\n\n_මෙහි අලුතින් වැටෙන සෑම පෝස්ට් එකකටම සියලුම bots ලාගෙන් තත්පර 4-5 ක පරතරයකින් ස්වයංක්‍රීයව React වැටෙනු ඇත._\n\n*Off කිරීමට:* \`.creact2 ${channelLink},offreact\``
      }, { quoted: msg });

    } catch (err) {
      await sock.sendMessage(from, { text: `❌ දෝෂයකි: ${err.message}` }, { quoted: msg });
    }
  }
};
