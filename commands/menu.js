const { proto, generateWAMessageFromContent, prepareWAMessageMedia } = require("@whiskeysockets/baileys");

module.exports = {
  name: "menu",
  alias: ["panel", "help", "commands"],
  desc: "Interactive Swipeable Carousel Menu",

  async execute({ sock, msg, from, prefix }) {
    try {
      await sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});

      const botPrefix = prefix || ".";

      // 1. Cards සඳහා Banner Images Buffer/Media Prepare කිරීම
      const groupImg = await prepareWAMessageMedia(
        { image: { url: "https://files.catbox.moe/k315x4.jpg" } },
        { upload: sock.waUploadToServer }
      );

      const downloadImg = await prepareWAMessageMedia(
        { image: { url: "https://files.catbox.moe/k315x4.jpg" } },
        { upload: sock.waUploadToServer }
      );

      const settingsImg = await prepareWAMessageMedia(
        { image: { url: "https://files.catbox.moe/k315x4.jpg" } },
        { upload: sock.waUploadToServer }
      );

      // 2. Carousel Cards සැකසීම
      const cards = [
        // CARD 1: GROUP MENU
        {
          header: {
            title: "👥 GROUP MENU",
            hasMediaAttachment: true,
            imageMessage: groupImg.imageMessage
          },
          body: {
            text: `• ${botPrefix}add\n• ${botPrefix}kick\n• ${botPrefix}promote\n• ${botPrefix}demote\n• ${botPrefix}hidetag\n• ${botPrefix}tagall\n• ${botPrefix}mute\n• ${botPrefix}unmute\n• ${botPrefix}antilink\n• ${botPrefix}groupinfo`
          },
          footer: { text: "DARK-DINU // GROUP SYSTEM" },
          nativeFlowMessage: {
            buttons: [
              {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                  display_text: "⚡ Group Action",
                  id: `${botPrefix}groupinfo`
                })
              }
            ]
          }
        },

        // CARD 2: MEDIA DOWNLOADER
        {
          header: {
            title: "📥 MEDIA DOWNLOADER",
            hasMediaAttachment: true,
            imageMessage: downloadImg.imageMessage
          },
          body: {
            text: `• ${botPrefix}song <name>\n• ${botPrefix}video <name>\n• ${botPrefix}fb <url>\n• ${botPrefix}tiktok <url>\n• ${botPrefix}insta <url>\n• ${botPrefix}ytmp3 <url>\n• ${botPrefix}ytmp4 <url>\n• ${botPrefix}vv (ViewOnce)`
          },
          footer: { text: "DARK-DINU // MEDIA CLUSTER" },
          nativeFlowMessage: {
            buttons: [
              {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                  display_text: "🎵 Get Music",
                  id: `${botPrefix}song`
                })
              }
            ]
          }
        },

        // CARD 3: SETTINGS & OWNER
        {
          header: {
            title: "⚙️ SETTINGS & CORE",
            hasMediaAttachment: true,
            imageMessage: settingsImg.imageMessage
          },
          body: {
            text: `• ${botPrefix}status\n• ${botPrefix}ping\n• ${botPrefix}bots\n• ${botPrefix}dreact on/off\n• ${botPrefix}antidelete\n• ${botPrefix}mode public/private\n• ${botPrefix}restart`
          },
          footer: { text: "DARK-DINU // SECURITY" },
          nativeFlowMessage: {
            buttons: [
              {
                name: "quick_reply",
                buttonParamsJson: JSON.stringify({
                  display_text: "👑 Owner Info",
                  id: `${botPrefix}owner`
                })
              }
            ]
          }
        }
      ];

      // 3. Carousel Message Wrapper එක ගොඩනැගීම
      const messageContent = proto.Message.fromObject({
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              header: {
                title: "╔══════════════════════╗\n   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️\n╚══════════════════════╝",
                subtitle: "MULTI-DEVICE CLUSTER",
                hasMediaAttachment: false
              },
              body: {
                text: `┌─〔 ⚙️ *SYSTEM DASHBOARD* 〕\n├─▸ 👑 *Developer:* DINIDU HESHAN\n├─▸ ⚡ *Prefix:* [ ${botPrefix} ]\n├─▸ 🟢 *Status:* Operational\n└───────────────────────\n\n👉 *Swipe the cards below to explore menus.*`
              },
              footer: {
                text: "𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 ✨"
              },
              carouselMessage: {
                cards: cards
              }
            }
          }
        }
      });

      // 4. Relay Protocol හරහා Message එක යැවීම
      const waMsg = generateWAMessageFromContent(from, messageContent, {
        userJid: sock.user.id,
        quoted: msg
      });

      await sock.relayMessage(from, waMsg.message, { messageId: waMsg.key.id });

    } catch (err) {
      console.error("[CAROUSEL MENU ERROR]:", err);
      // Fallback text menu (Carousel support නැති client වලට)
      await sock.sendMessage(from, {
        text: `❌ Carousel menu render error: ${err.message}`
      }, { quoted: msg });
    }
  }
};
