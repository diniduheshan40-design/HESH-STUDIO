const delay = (ms) => new Promise((res) => setTimeout(res, ms));

global.autoChannelReactors = global.autoChannelReactors || new Map();
let isAutoListenerSet = false;

module.exports = {
  name: "creact2",
  alias: ["cr2"],
  description: "Auto react to newly posted messages in a channel continuously using all bots",

  async execute({ sock, msg, from, args }) {
    try {
      const fullText = args.join(" ").trim();
      if (!fullText || !fullText.includes(",")) {
        return await sock.sendMessage(from, {
          text: `⚠️ *භාවිතය:*\n• *Active කිරීමට:* .creact2 <channel_link>,<emoji1>,<emoji2>...\n• *Stop කිරීමට:* .creact2 <channel_link>,offreact\n\n*උදාහරණ:*\n.creact2 https://whatsapp.com/channel/0029VaXXXXX,🥀,✨,🖤,😚`
        }, { quoted: msg });
      }

      const parts = fullText.split(",").map(p => p.trim()).filter(Boolean);
      const channelLink = parts[0];
      const actionOrEmoji = parts[1];

      const linkMatch = channelLink.match(/whatsapp\.com\/channel\/([a-zA-Z0-9]+)/);
      if (!linkMatch || !linkMatch[1]) {
        return await sock.sendMessage(from, { text: "❌ වැරදි Channel Link එකක්!" }, { quoted: msg });
      }

      const channelCode = linkMatch[1];

      await sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

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
            text: `🛑 *Auto-React Stopped!*\n\n📢 Channel: ${channelJid}\nස්වයංක්‍රීය Reaction ක්‍රියාවලිය සාර්ථකව නවතා දමන ලදී.` 
          }, { quoted: msg });
        } else {
          return await sock.sendMessage(from, { text: "⚠️ මෙම Channel එක සඳහා Auto-React සක්‍රිය කර නැත." }, { quoted: msg });
        }
      }

      // ON Logic
      const emojis = parts.slice(1);
      if (emojis.length === 0) {
        return await sock.sendMessage(from, { text: "❌ කරුණාකර අවම වශයෙන් එක් emoji එකක්වත් දෙන්න." }, { quoted: msg });
      }

      global.autoChannelReactors.set(channelJid, { emojis });

      // Channel Message Listener (Run once globally)
      if (!isAutoListenerSet) {
        isAutoListenerSet = true;

        sock.ev.on("messages.upsert", async (mUpdate) => {
          try {
            if (!mUpdate.messages || mUpdate.type !== "notify") return;

            for (const chMsg of mUpdate.messages) {
              const remoteJid = chMsg.key?.remoteJid;

              if (remoteJid && global.autoChannelReactors.has(remoteJid)) {
                const configData = global.autoChannelReactors.get(remoteJid);
                const postId = chMsg.key?.server_id || chMsg.message?.extendedTextMessage?.contextInfo?.stanzaId;

                if (!postId) continue;

                let botList = [];
                if (global.activeSockets && global.activeSockets.size > 0) {
                  botList = Array.from(global.activeSockets.values());
                } else {
                  botList = [sock];
                }

                // All Bots Reaction Sequence
                (async () => {
                  for (let i = 0; i < botList.length; i++) {
                    const currentBot = botList[i];
                    const selectedEmoji = configData.emojis[i % configData.emojis.length];

                    try {
                      await currentBot.sendMessage(remoteJid, {
                        react: {
                          text: selectedEmoji,
                          key: {
                            remoteJid: remoteJid,
                            server_id: postId.toString(),
                            fromMe: false
                          }
                        }
                      });
                    } catch (_) {}

                    await delay(4000 + Math.floor(Math.random() * 1000));
                  }
                })();
              }
            }
          } catch (_) {}
        });
      }

      const activeNodesCount = global.activeSockets ? global.activeSockets.size : 1;

      await sock.sendMessage(from, {
        text: `✅ *AUTO-REACT ACTIVE*\n\n📢 *Channel:* ${channelJid}\n🤖 *Active Nodes:* ${activeNodesCount}\n✨ *Emojis:*${emojis.join(" ")}\n\n_මෙම Channel එකට වැටෙන ඕනෑම අලුත් පෝස්ට් එකකට තත්පර 4-5 ක පරතරයකින් සියලුම active bots ලාගෙන් Auto Reacts වැටේ._\n\n*Off කිරීමට:* \`.creact2 ${channelLink},offreact\``
      }, { quoted: msg });

    } catch (err) {
      await sock.sendMessage(from, { text: `❌ දෝෂයකි: ${err.message}` }, { quoted: msg });
    }
  }
};
