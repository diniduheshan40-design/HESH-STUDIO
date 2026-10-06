require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const express = require('express');
const chalk = require('chalk');
const pino = require('pino');
const cors = require('cors');
const NodeCache = require('node-cache');
const {
    default: makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    Browsers,
    delay
} = require('@whiskeysockets/baileys');
const { useMongoAuthState, SessionModel } = require('./auth');
const doctor = require('./doctor');

// Global Crash Handlers
process.on('uncaughtException', (err) => {
    console.error(chalk.red('[UNCAUGHT EXCEPTION]:'), err.message || err);
});
process.on('unhandledRejection', (reason) => {
    console.error(chalk.red('[UNHANDLED REJECTION]:'), reason?.message || reason);
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const MONGO_URL = process.env.MONGODB_URL || "mongodb+srv://heshanxmd43_db_user:FEMEM3yjl69L0SuF@cluster0.b6nhi22.mongodb.net/?appName=Cluster0";
const PORT = process.env.PORT || 10000;
const BOT_TAG = "DARK-DINU";
const PREFIX = process.env.PREFIX || ".";

const activeBots = new Map();
global.activeSockets = activeBots;
const commands = new Map();
const msgRetryCounterCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Global Interactive Download & Menu Sessions
global.ttCache = global.ttCache || new Map();
global.fbSessions = global.fbSessions || new Map();
global.ytSessions = global.ytSessions || new Map();
global.videoSessions = global.videoSessions || new Map();
global.songSessions = global.songSessions || new Map();
global.menuSessions = global.menuSessions || new Map();

// Global Bot Mode (public / private / group)
global.botMode = global.botMode || "public";

// Global Anti-Delete In-Memory Store
global.antiDeleteConfig = global.antiDeleteConfig || { enabled: true };
const messageMemoryStore = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

// Global Developer Auto-React Setup
global.devReactConfig = global.devReactConfig || {
    enabled: true,
    emoji: "👨🏻‍💻",
    disabledNumbers: new Set()
};

function getCommandDirectory() {
    const defaultPath = path.join(__dirname, 'commands');
    if (fs.existsSync(defaultPath)) return defaultPath;
    const upperPath = path.join(__dirname, 'Commands');
    if (fs.existsSync(upperPath)) return upperPath;
    fs.mkdirSync(defaultPath, { recursive: true });
    return defaultPath;
}

function loadCommands() {
    commands.clear();
    const cmdDir = getCommandDirectory();
    try {
        const files = fs.readdirSync(cmdDir);
        for (const file of files) {
            if (file.endsWith('.js')) {
                try {
                    const filePath = path.join(cmdDir, file);
                    delete require.cache[require.resolve(filePath)];
                    const cmd = require(filePath);
                    if (cmd && cmd.name && typeof cmd.execute === 'function') {
                        const mainName = cmd.name.toLowerCase();
                        commands.set(mainName, cmd);
                        if (Array.isArray(cmd.alias)) {
                            cmd.alias.forEach(alias => commands.set(alias.toLowerCase(), cmd));
                        }
                    }
                } catch (loadErr) {
                    console.error(chalk.red(`[ERROR LOADING ${file}]:`), loadErr.message);
                }
            }
        }
    } catch (dirErr) {
        console.error(chalk.red(`[DIRECTORY ERROR]:`), dirErr.message);
    }
}
loadCommands();

try {
    const watchDir = getCommandDirectory();
    let reloadDebounce;
    fs.watch(watchDir, (eventType, filename) => {
        if (filename && filename.endsWith('.js')) {
            clearTimeout(reloadDebounce);
            reloadDebounce = setTimeout(() => {
                loadCommands();
            }, 300);
        }
    });
} catch (_) {}

function getMessageText(msg) {
    if (!msg || !msg.message) return '';
    let m = msg.message;
    if (m.ephemeralMessage) m = m.ephemeralMessage.message;
    if (m.viewOnceMessageV2) m = m.viewOnceMessageV2.message;
    if (m.viewOnceMessage) m = m.viewOnceMessage.message;
    if (m.documentWithCaptionMessage) m = m.documentWithCaptionMessage.message;

    return (
        m.conversation ||
        m.extendedTextMessage?.text ||
        m.imageMessage?.caption ||
        m.videoMessage?.caption ||
        m.templateButtonReplyMessage?.selectedId ||
        m.buttonsResponseMessage?.selectedButtonId ||
        m.listResponseMessage?.singleSelectReply?.selectedRowId ||
        m.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
        ''
    ).trim();
}

/**
 * Single Bot Instance Engine
 */
async function startSingleBot(sessionId, phoneNumber = null, res = null) {
    let responded = false;
    const sendResponse = (status, data) => {
        if (!responded && res && !res.headersSent) {
            responded = true;
            return res.json({ status, ...data });
        }
    };

    try {
        if (phoneNumber) {
            await SessionModel.deleteMany({ sessionId }).catch(() => {});
        }

        const { state, saveCreds, clearSession } = await useMongoAuthState(sessionId);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'fatal' }),
            printQRInTerminal: false,
            browser: Browsers.ubuntu('Chrome'),
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })),
            },
            msgRetryCounterCache,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            getMessage: async () => undefined,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 25000
        });

        if (!sock.authState.creds.registered && phoneNumber) {
            let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
            if (cleanNumber.startsWith('0')) cleanNumber = '94' + cleanNumber.slice(1);

            setTimeout(async () => {
                try {
                    console.log(chalk.cyan(`[${BOT_TAG}] Requesting Pairing Code for: ${cleanNumber}`));
                    const code = await sock.requestPairingCode(cleanNumber);
                    console.log(chalk.green(`[${BOT_TAG}] Code Generated Successfully: ${code}`));
                    sendResponse(true, { sessionId, pairingCode: code });
                } catch (err) {
                    console.error(chalk.red(`[PAIRING ERROR]:`), err.message);
                    sendResponse(false, { error: err.message || 'Failed to request pairing code' });
                }
            }, 3000);

            setTimeout(() => {
                sendResponse(false, { error: 'Request timed out. Please try again.' });
            }, 30000);
        }

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, isNewLogin } = update;

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log(chalk.red(`[${BOT_TAG}] [${sessionId}] Closed (Status: ${statusCode})`));

                try {
                    sock.ev.removeAllListeners();
                    sock.ws?.close();
                } catch (_) {}

                if (shouldReconnect) {
                    console.log(chalk.yellow(`[${BOT_TAG}] Reconnecting [${sessionId}] in 5s...`));
                    setTimeout(() => {
                        startSingleBot(sessionId).catch(() => {});
                    }, 5000);
                } else {
                    console.log(chalk.red(`[${BOT_TAG}] Session Logged Out [${sessionId}]`));
                    await clearSession();
                    activeBots.delete(sessionId);
                }
            } else if (connection === 'open') {
                console.log(chalk.black.bgRed.bold(` [${BOT_TAG}] NODE [${sessionId}] LINKED & ACTIVE `));
                activeBots.set(sessionId, sock);

                if (isNewLogin) {
                    setTimeout(async () => {
                        try {
                            const botNumber = (sock.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");
                            const botJid = `${botNumber}@s.whatsapp.net`;
                            const devJid = "94719845166@s.whatsapp.net";

                            const ownerCard = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🟢 *NODE CONNECTED SUCCESSFULLY* 〕
├─▸ 🤖 *Node Tag*  : ${sessionId}
├─▸ 📱 *Bot Number*: +${botNumber}
├─▸ ⚡ *Engine*    : Multi-Device v2.1
├─▸ 🔐 *Prefix*    : [ ${PREFIX} ]
└───────────────────────

┌─〔 📌 *GETTING STARTED* 〕
├─▸ Type *${PREFIX}menu* to open dashboard.
├─▸ Type *${PREFIX}bots* for metrics.
├─▸ 24/7 Cloud Cluster is Active.
└───────────────────────

> 👑 *Developer:* Dinidu Heshan
> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐂𝐎𝐑𝐄 🐦‍🔥*`;

                            await sock.sendMessage(botJid, {
                                image: { url: "https://files.catbox.moe/k315x4.jpg" },
                                caption: ownerCard
                            }).catch(() => {
                                sock.sendMessage(botJid, { text: ownerCard }).catch(() => {});
                            });

                            const devAlert = 
`⚡ *[NEW NODE REGISTERED]* ⚡

🤖 *Node:* \`${sessionId}\`
📱 *Number:* +${botNumber}
🟢 *Action:* First-Time Pair Complete
🕒 *Time:* ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo' })}`;

                            if (botNumber !== "94719845166") {
                                await sock.sendMessage(devJid, { text: devAlert }).catch(() => {});
                            }
                        } catch (notifyErr) {
                            console.error("[FIRST-TIME NOTIFY ERR]:", notifyErr.message);
                        }
                    }, 4000);
                }
            }
        });

        // 🛑 ANTI-DELETE LISTENER (Detect Revoked Messages)
        sock.ev.on('messages.update', async (mUpdates) => {
            try {
                if (!global.antiDeleteConfig?.enabled) return;

                for (const update of mUpdates) {
                    if (update.update?.messageStubType === 68 || update.update?.message === null) {
                        const targetId = update.key.id;
                        const cachedMsg = messageMemoryStore.get(targetId);

                        if (!cachedMsg || !cachedMsg.message) continue;

                        const chatJid = update.key.remoteJid;
                        const deletedBy = update.key.participant || update.participant || chatJid;
                        const cleanDeleter = String(deletedBy).split("@")[0].split(":")[0];
                        const timeString = new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo' });

                        const noticeCard = 
`╔══════════════════════╗
   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️
╚══════════════════════╝

┌─〔 🗑️ *DELETED MESSAGE DETECTED* 〕
├─▸ 👤 *Deleted By* : @${cleanDeleter}
├─▸ 🕒 *Time*       : ${timeString}
├─▸ 📍 *Location*   : ${chatJid.endsWith("@g.us") ? "Group Chat" : "Private Chat"}
└───────────────────────

> ⚠️ *Intercepted deleted message content attached below:*`;

                        await sock.sendMessage(chatJid, {
                            text: noticeCard,
                            mentions: [deletedBy]
                        });

                        await sock.copyNForward(chatJid, cachedMsg, false).catch(async () => {
                            const msgContent = cachedMsg.message;
                            if (msgContent.conversation || msgContent.extendedTextMessage?.text) {
                                const textBody = msgContent.conversation || msgContent.extendedTextMessage?.text;
                                await sock.sendMessage(chatJid, { text: `💬 *Message Content:* ${textBody}` });
                            }
                        });

                        messageMemoryStore.del(targetId);
                    }
                }
            } catch (delErr) {
                console.error("[ANTI-DELETE ENGINE ERR]:", delErr.message);
            }
        });

        sock.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                if (!chatUpdate.messages || chatUpdate.type !== 'notify') return;

                for (const msg of chatUpdate.messages) {
                    if (!msg.message) continue;

                    // 1. In-Memory Cache for Anti-Delete
                    if (msg.key?.id) {
                        messageMemoryStore.set(msg.key.id, msg);
                    }

                    // 2. Ghost Loop Blockers
                    if (msg.message?.protocolMessage || msg.message?.editedMessage || msg.message?.reactionMessage) {
                        continue;
                    }

                    const from = msg.key.remoteJid;
                    const isFromMe = Boolean(msg.key.fromMe);

                    // Identity & Sender Resolution
                    const botId = sock.user?.id || "";
                    const botNumber = botId.split(":")[0].replace(/[^0-9]/g, "");

                    let senderJid = isFromMe 
                        ? `${botNumber}@s.whatsapp.net` 
                        : (msg.key.participant || msg.participant || from || "");

                    const cleanSender = String(senderJid).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
                    const isDev = cleanSender === "94719845166" || cleanSender === "15947733680169" || senderJid.includes("94719845166");
                    const isOwner = isFromMe || cleanSender === botNumber || isDev;

                    // DEVELOPER AUTO-REACT
                    if (global.devReactConfig && global.devReactConfig.enabled) {
                        if (isDev && !isFromMe && !global.devReactConfig.disabledNumbers.has(cleanSender)) {
                            sock.sendMessage(from, {
                                react: {
                                    text: global.devReactConfig.emoji,
                                    key: msg.key
                                }
                            }).catch(() => {});
                        }
                    }

                    // AUTO STATUS SEEN & REACT
                    if (from === 'status@broadcast') {
                        if (isFromMe) continue;
                        try {
                            await sock.readMessages([msg.key]);
                            const sender = msg.key.participant || msg.participant;

                            if (sender) {
                                const emojis = ['🖤', '🥀', '⚡', '✨', '🔥', '🤍'];
                                const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

                                setTimeout(async () => {
                                    try {
                                        await sock.sendMessage('status@broadcast', {
                                            react: {
                                                text: randomEmoji,
                                                key: {
                                                    remoteJid: 'status@broadcast',
                                                    id: msg.key.id,
                                                    participant: sender,
                                                    fromMe: false
                                                }
                                            }
                                        }, {
                                            statusJidList: [sender]
                                        });
                                    } catch (_) {}
                                }, 2000);
                            }
                        } catch (_) {}
                        continue;
                    }

                    const body = getMessageText(msg);
                    if (!body) continue;

                    const quotedContext = msg.message?.extendedTextMessage?.contextInfo;
                    const quotedId = quotedContext?.stanzaId;
                    const userReply = body.trim();

                    // ==========================================
                    // 🎵 SONG INTERACTIVE REPLY HANDLER
                    // ==========================================
                    if (quotedId && global.songSessions && global.songSessions.has(quotedId)) {
                        const songData = global.songSessions.get(quotedId);

                        if (['1', '2', '3'].includes(userReply)) {
                            sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

                            try {
                                const axios = require("axios");
                                const apiKey = "chama_api_ec9848130d1aea209f08fb85e0b4720f";
                                const apiUrl = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(songData.url)}&quality=360p&format=mp3&api_key=${apiKey}`;

                                const res = await axios.get(apiUrl, { timeout: 45000 });
                                const dlData = res.data?.data || res.data;
                                const dlUrl = dlData?.download_url || dlData?.audio || dlData?.url;

                                if (!dlUrl) {
                                    return await sock.sendMessage(from, { text: "❌ Audio Download Link not found." }, { quoted: msg });
                                }

                                if (userReply === '1') {
                                    await sock.sendMessage(from, {
                                        audio: { url: dlUrl },
                                        mimetype: "audio/mp4",
                                        fileName: `${songData.title.slice(0, 30)}.mp3`,
                                        ptt: false
                                    }, { quoted: msg });
                                } else if (userReply === '2') {
                                    await sock.sendMessage(from, {
                                        document: { url: dlUrl },
                                        mimetype: "audio/mpeg",
                                        fileName: `${songData.title.slice(0, 30)}.mp3`
                                    }, { quoted: msg });
                                } else if (userReply === '3') {
                                    await sock.sendMessage(from, {
                                        audio: { url: dlUrl },
                                        mimetype: "audio/ogg; codecs=opus",
                                        ptt: true
                                    }, { quoted: msg });
                                }

                                sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
                                return;

                            } catch (e) {
                                return await sock.sendMessage(from, { text: `❌ Download Failed: ${e.message}` }, { quoted: msg });
                            }
                        }
                    }

                    // ==========================================
                    // 📜 MENU PANEL INTERACTIVE HANDLER
                    // ==========================================
                    if (quotedId && global.menuSessions && global.menuSessions.has(quotedId)) {
                        const menuActions = {
                            "1": "general",
                            "2": "media",
                            "3": "stealth",
                            "4": "owner",
                            "5": "all"
                        };

                        if (menuActions[userReply]) {
                            const selectedCategory = menuActions[userReply];
                            const menuCmd = commands.get("menu");
                            if (menuCmd && typeof menuCmd.execute === "function") {
                                await menuCmd.execute({
                                    sock,
                                    msg,
                                    from,
                                    args: [selectedCategory],
                                    body: `${PREFIX}menu ${selectedCategory}`,
                                    prefix: PREFIX,
                                    sessionId,
                                    commands,
                                    activeBots: Array.from(activeBots.values()),
                                    activeBotsMap: activeBots,
                                    activeBotsCount: activeBots.size
                                });
                                return;
                            }
                        }
                    }

                    // ==========================================
                    // 🎵 TIKTOK INTERACTIVE REPLY DOWNLOADER
                    // ==========================================
                    if (quotedId && global.ttCache && global.ttCache.has(quotedId)) {
                        const ttData = global.ttCache.get(quotedId);

                        if (userReply === '1') {
                            sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});
                            await sock.sendMessage(from, {
                                video: { url: ttData.hd },
                                caption: `*🎬 DARK-DINU TIKTOK HD*\n📌 *Title:* ${ttData.title}\n\n> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐁𝐎𝐓 ✨*`
                            }, { quoted: msg });
                            return;
                        } else if (userReply === '2') {
                            sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});
                            await sock.sendMessage(from, {
                                video: { url: ttData.sd },
                                caption: `*🎬 DARK-DINU TIKTOK SD*\n📌 *Title:* ${ttData.title}\n\n> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐁𝐎𝐓 ✨*`
                            }, { quoted: msg });
                            return;
                        } else if (userReply === '3') {
                            sock.sendMessage(from, { react: { text: "🎙️", key: msg.key } }).catch(() => {});
                            await sock.sendMessage(from, {
                                audio: { url: ttData.audio },
                                mimetype: 'audio/mp4',
                                ptt: true
                            }, { quoted: msg });
                            return;
                        }
                    }

                    // ==========================================
                    // 🎬 FACEBOOK INTERACTIVE REPLY DOWNLOADER
                    // ==========================================
                    if (quotedId && global.fbSessions && global.fbSessions.has(quotedId)) {
                        const fbData = global.fbSessions.get(quotedId);

                        if (userReply === '1') {
                            const dlUrl = fbData.hd || fbData.sd;
                            if (!dlUrl) return await sock.sendMessage(from, { text: "❌ HD Video not available." }, { quoted: msg });
                            sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});
                            await sock.sendMessage(from, {
                                video: { url: dlUrl },
                                caption: `*🎬 DARK-DINU FB HD*\n📌 *Title:* ${fbData.title}\n\n> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐁𝐎𝐓 ✨*`
                            }, { quoted: msg });
                            return;
                        } else if (userReply === '2') {
                            const dlUrl = fbData.sd || fbData.hd;
                            if (!dlUrl) return await sock.sendMessage(from, { text: "❌ SD Video not available." }, { quoted: msg });
                            sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});
                            await sock.sendMessage(from, {
                                video: { url: dlUrl },
                                caption: `*🎬 DARK-DINU FB SD*\n📌 *Title:* ${fbData.title}\n\n> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐁𝐎𝐓 ✨*`
                            }, { quoted: msg });
                            return;
                        } else if (userReply === '3') {
                            const dlUrl = fbData.audio || fbData.sd || fbData.hd;
                            if (!dlUrl) return await sock.sendMessage(from, { text: "❌ Audio not available." }, { quoted: msg });
                            sock.sendMessage(from, { react: { text: "🎙️", key: msg.key } }).catch(() => {});
                            await sock.sendMessage(from, {
                                audio: { url: dlUrl },
                                mimetype: 'audio/mp4',
                                fileName: `${fbData.title.slice(0, 30)}.mp3`,
                                ptt: false
                            }, { quoted: msg });
                            return;
                        }
                    }

                    // ==========================================
                    // 🎥 YOUTUBE INTERACTIVE REPLY DOWNLOADER
                    // ==========================================
                    if (quotedId && global.ytSessions && global.ytSessions.has(quotedId)) {
                        const ytData = global.ytSessions.get(quotedId);

                        if (userReply === '1') {
                            const dlUrl = ytData.video_360 || ytData.video || ytData.url;
                            if (!dlUrl) return await sock.sendMessage(from, { text: "❌ 360p video not found." }, { quoted: msg });
                            sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});
                            await sock.sendMessage(from, {
                                video: { url: dlUrl },
                                caption: `*🎬 ${ytData.title}*\n\n📐 *Quality:* 360p Standard\n⏱️ *Duration:* ${ytData.duration || "N/A"}\n\n> *𝐃𝙍𝕶 𝑫𝐈𝙉𝙐 𝐘𝐎𝐔𝐓𝐔𝐁𝐄 ✨*`
                            }, { quoted: msg });
                            return;
                        } else if (userReply === '2') {
                            const dlUrl = ytData.video_720 || ytData.video_hd || ytData.video || ytData.url;
                            if (!dlUrl) return await sock.sendMessage(from, { text: "❌ 720p HD video not found." }, { quoted: msg });
                            sock.sendMessage(from, { react: { text: "⚡", key: msg.key } }).catch(() => {});
                            await sock.sendMessage(from, {
                                video: { url: dlUrl },
                                caption: `*🎬 ${ytData.title}*\n\n📐 *Quality:* 720p HD\n⏱️ *Duration:* ${ytData.duration || "N/A"}\n\n> *𝐃𝙍𝕶 𝑫𝐈𝙉𝙐 𝐘𝐎𝐔𝐓𝐔𝐁𝐄 ✨*`
                            }, { quoted: msg });
                            return;
                        } else if (userReply === '3') {
                            const dlUrl = ytData.video_1080 || ytData.video_720 || ytData.video;
                            if (!dlUrl) return await sock.sendMessage(from, { text: "❌ 1080p FHD video not found." }, { quoted: msg });
                            sock.sendMessage(from, { react: { text: "🔥", key: msg.key } }).catch(() => {});
                            await sock.sendMessage(from, {
                                video: { url: dlUrl },
                                caption: `*🎬 ${ytData.title}*\n\n📐 *Quality:* 1080p Full HD\n⏱️ *Duration:* ${ytData.duration || "N/A"}\n\n> *𝐃𝙍𝕶 𝑫𝐈𝙉𝙐 𝐘𝐎𝐔𝐓𝐔𝐁𝐄 ✨*`
                            }, { quoted: msg });
                            return;
                        } else if (userReply === '4') {
                            const dlUrl = ytData.audio;
                            if (!dlUrl) return await sock.sendMessage(from, { text: "❌ Audio not available." }, { quoted: msg });
                            sock.sendMessage(from, { react: { text: "🎶", key: msg.key } }).catch(() => {});
                            await sock.sendMessage(from, {
                                audio: { url: dlUrl },
                                mimetype: "audio/mp4",
                                fileName: `${ytData.title.slice(0, 30)}.mp3`,
                                ptt: false
                            }, { quoted: msg });
                            return;
                        } else if (userReply === '5') {
                            const dlUrl = ytData.audio || ytData.video;
                            if (!dlUrl) return await sock.sendMessage(from, { text: "❌ Document file not available." }, { quoted: msg });
                            sock.sendMessage(from, { react: { text: "📁", key: msg.key } }).catch(() => {});
                            await sock.sendMessage(from, {
                                document: { url: dlUrl },
                                mimetype: "audio/mpeg",
                                fileName: `${ytData.title.slice(0, 40)}.mp3`
                            }, { quoted: msg });
                            return;
                        }
                    }

                    // ==========================================
                    // 🎬 YOUTUBE VIDEO QUALITY SESSIONS HANDLER
                    // ==========================================
                    if (quotedId && global.videoSessions && global.videoSessions.has(quotedId)) {
                        const vSession = global.videoSessions.get(quotedId);
                        const qualityMap = {
                            "1": "1080p",
                            "2": "720p",
                            "3": "480p",
                            "4": "360p"
                        };

                        if (qualityMap[userReply]) {
                            const selectedQuality = qualityMap[userReply];
                            sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});

                            try {
                                const axios = require("axios");
                                const dlApi = `https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(vSession.url)}&quality=${selectedQuality}&format=mp4&api_key=${vSession.apiKey || "chama_api_ec9848130d1aea209f08fb85e0b4720f"}`;
                                
                                const fetchRes = await axios.get(dlApi, { timeout: 45000 });
                                const dlData = fetchRes.data?.data || fetchRes.data;
                                const downloadUrl = dlData?.download_url || dlData?.url || dlData?.video;

                                if (!downloadUrl) {
                                    return await sock.sendMessage(from, { 
                                        text: `❌ ${selectedQuality} සඳහා Download Link එකක් ලබාගත නොහැකි විය.` 
                                    }, { quoted: msg });
                                }

                                await sock.sendMessage(from, {
                                    video: { url: downloadUrl },
                                    caption: `*🎬 DARK-DINU YOUTUBE VIDEO*\n📌 *Title:* ${vSession.title}\n📐 *Quality:* ${selectedQuality}\n\n> *𝐃𝙍𝕶 𝑫𝙄𝙉𝙐 𝐁𝐎𝐓 ✨*`
                                }, { quoted: msg });

                                sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
                                return;

                            } catch (dlErr) {
                                console.error("[YT QUALITY DL ERR]:", dlErr.message);
                                return await sock.sendMessage(from, { 
                                    text: `❌ Download කිරීම අසාර්ථක විය: ${dlErr.message}` 
                                }, { quoted: msg });
                            }
                        }
                    }

                    // ==========================================
                    // ⚙️ COMMAND & EMOJI ALIAS ROUTER
                    // ==========================================
                    const emojiAliases = ["🥺", "🤪", "😚", "😁", "🎭", "😂", "🥵", "🙏", "😓", "🫣", "😭", "😘", "❤️️", "👍"];
                    const hasQuoted = Boolean(msg.message?.extendedTextMessage?.contextInfo?.quotedMessage);

                    let command = '';
                    let args = [];

                    if (body.startsWith(PREFIX)) {
                        const cleanBody = body.slice(PREFIX.length).trim();
                        const parts = cleanBody.split(/ +/);
                        command = (parts[0] || "").toLowerCase();
                        args = parts.slice(1);
                    } else if (emojiAliases.includes(body.trim()) && hasQuoted) {
                        command = body.trim();
                        args = [];
                    } else {
                        continue;
                    }

                    // 🛑 BOT MODE ENFORCEMENT
                    // Mode is bypassed for Owner & Developer
                    if (!isOwner) {
                        const currentMode = global.botMode || "public";
                        if (currentMode === "private") {
                            continue; // Private mode: regular users are ignored
                        }
                        if (currentMode === "group" && !from.endsWith("@g.us")) {
                            continue; // Group mode: private chats are ignored
                        }
                    }

                    if (command && commands.has(command)) {
                        try {
                            const cmdModule = commands.get(command);
                            console.log(chalk.magenta(`[RUNNING CMD] => ${command} from ${from} | Sender: ${cleanSender} | Mode: ${global.botMode}`));
                            
                            await cmdModule.execute({
                                sock,
                                msg,
                                from,
                                args,
                                body,
                                prefix: PREFIX,
                                sessionId,
                                commands,
                                activeBots: Array.from(activeBots.values()),
                                activeBotsMap: activeBots,
                                activeBotsCount: activeBots.size
                            });
                        } catch (err) {
                            // 🚑 AUTO-REPAIR & HEALING TRIGGER
                            await doctor.handleCommandError({
                                error: err,
                                commandName: command,
                                sock,
                                from,
                                msg
                            });
                        }
                    }
                }
            } catch (err) {
                console.error(chalk.red(`[MSG ERR]:`), err);
            }
        });

        return sock;
    } catch (e) {
        console.error(chalk.red(`Execution Error:`), e);
        sendResponse(false, { error: e.message });
    }
}

async function autoReconnectAllBots() {
    try {
        const sessions = await SessionModel.distinct('sessionId');
        console.log(chalk.cyan(`[${BOT_TAG}] Found ${sessions.length} sessions to bootstrap.`));
        for (const id of sessions) {
            startSingleBot(id);
            await delay(2500);
        }
    } catch (err) {
        console.error(chalk.red('Boot Error:'), err);
    }
}

// ================= Ultra-Clean Minimalist Cyber UI =================

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${BOT_TAG} // SYSTEM ACCESS</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;800;900&family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet">
        <style>
            :root {
                --primary: #ff0044;
                --primary-glow: rgba(255, 0, 68, 0.4);
                --cyan: #00f0ff;
                --cyan-glow: rgba(0, 240, 255, 0.3);
                --bg: #030307;
                --card-bg: rgba(12, 13, 22, 0.78);
                --border: rgba(255, 0, 68, 0.25);
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                background: radial-gradient(circle at 50% 15%, #18091a 0%, var(--bg) 85%);
                font-family: 'Rajdhani', sans-serif;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #fff;
                padding: 20px;
                position: relative;
                overflow: hidden;
            }
            body::before {
                content: "";
                position: absolute;
                width: 380px;
                height: 380px;
                background: radial-gradient(circle, var(--primary-glow) 0%, transparent 70%);
                top: 5%;
                left: 10%;
                filter: blur(90px);
                z-index: 0;
            }
            body::after {
                content: "";
                position: absolute;
                width: 380px;
                height: 380px;
                background: radial-gradient(circle, var(--cyan-glow) 0%, transparent 70%);
                bottom: 5%;
                right: 10%;
                filter: blur(90px);
                z-index: 0;
            }
            .panel {
                position: relative;
                z-index: 1;
                width: 100%;
                max-width: 420px;
                background: var(--card-bg);
                backdrop-filter: blur(28px);
                -webkit-backdrop-filter: blur(28px);
                border: 1px solid var(--border);
                border-radius: 24px;
                padding: 45px 32px 35px;
                text-align: center;
                box-shadow: 0 25px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(255, 0, 68, 0.12);
            }
            .badge-live {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: rgba(0, 240, 255, 0.06);
                border: 1px solid rgba(0, 240, 255, 0.25);
                border-radius: 30px;
                padding: 5px 15px;
                font-size: 11px;
                color: var(--cyan);
                letter-spacing: 2px;
                margin-bottom: 20px;
                font-family: 'Orbitron', sans-serif;
            }
            .badge-dot {
                width: 7px;
                height: 7px;
                background: var(--cyan);
                border-radius: 50%;
                box-shadow: 0 0 10px var(--cyan);
                animation: pulse 1.5s infinite;
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.3; transform: scale(0.7); }
            }
            .title {
                font-family: 'Orbitron', sans-serif;
                font-size: 32px;
                font-weight: 900;
                letter-spacing: 3px;
                background: linear-gradient(135deg, #ffffff 40%, var(--primary) 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 6px;
            }
            .sub-title {
                color: #8c8fa8;
                font-size: 13px;
                letter-spacing: 1.5px;
                margin-bottom: 30px;
                text-transform: uppercase;
            }
            .field {
                margin: 22px 0 15px;
                text-align: left;
            }
            label {
                display: block;
                font-size: 12px;
                color: var(--cyan);
                letter-spacing: 1.2px;
                margin-bottom: 9px;
                font-weight: 700;
                text-transform: uppercase;
            }
            .input-wrapper {
                position: relative;
            }
            input {
                width: 100%;
                background: rgba(4, 5, 10, 0.7);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-radius: 12px;
                padding: 16px 18px;
                color: #fff;
                outline: none;
                font-size: 17px;
                font-family: 'Rajdhani', sans-serif;
                letter-spacing: 1px;
                transition: all 0.3s ease;
            }
            input:focus {
                border-color: var(--primary);
                box-shadow: 0 0 18px var(--primary-glow);
                background: rgba(4, 5, 10, 0.9);
            }
            input::placeholder {
                color: #494c63;
                font-size: 15px;
            }
            .btn {
                position: relative;
                width: 100%;
                padding: 16px;
                background: linear-gradient(135deg, var(--primary) 0%, #aa0030 100%);
                border: none;
                border-radius: 12px;
                color: #fff;
                font-family: 'Orbitron', sans-serif;
                font-weight: 800;
                cursor: pointer;
                margin-top: 15px;
                font-size: 14px;
                letter-spacing: 2px;
                box-shadow: 0 8px 25px var(--primary-glow);
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 12px;
            }
            .btn:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 12px 30px rgba(255, 0, 68, 0.65);
            }
            .btn:disabled {
                background: #141520;
                color: #4b4e63;
                box-shadow: none;
                cursor: not-allowed;
            }
            .spinner {
                display: none;
                width: 22px;
                height: 22px;
                border: 3px solid rgba(255, 255, 255, 0.25);
                border-radius: 50%;
                border-top-color: #fff;
                animation: spin 0.8s linear infinite;
            }
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            #code-container {
                display: none;
                margin-top: 25px;
                background: rgba(0, 240, 255, 0.03);
                padding: 20px 15px;
                border: 1px dashed rgba(0, 240, 255, 0.35);
                border-radius: 14px;
                animation: fadeIn 0.4s ease-out;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .copy-badge {
                display: inline-block;
                font-size: 11px;
                color: #2ed573;
                background: rgba(46, 213, 115, 0.1);
                border: 1px solid rgba(46, 213, 115, 0.3);
                padding: 4px 12px;
                border-radius: 20px;
                margin-bottom: 8px;
                letter-spacing: 1px;
                font-weight: 700;
            }
            .code-text {
                font-family: 'Orbitron', sans-serif;
                font-size: 32px;
                font-weight: 900;
                color: var(--cyan);
                letter-spacing: 8px;
                margin: 10px 0;
                text-shadow: 0 0 18px var(--cyan-glow);
                cursor: pointer;
                user-select: all;
            }
            .code-guide {
                font-size: 12px;
                color: #7b7e99;
                margin-top: 6px;
            }
            .toast {
                position: fixed;
                bottom: 25px;
                left: 50%;
                transform: translateX(-50%) translateY(100px);
                background: rgba(13, 15, 25, 0.95);
                border: 1px solid var(--cyan);
                box-shadow: 0 0 25px var(--cyan-glow);
                color: #fff;
                padding: 12px 24px;
                border-radius: 30px;
                font-size: 13px;
                letter-spacing: 1px;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                z-index: 100;
                pointer-events: none;
            }
            .toast.show {
                transform: translateX(-50%) translateY(0);
            }
        </style>
    </head>
    <body>
        <div class="panel">
            <div class="badge-live">
                <span class="badge-dot"></span>
                <span>SYSTEM ONLINE</span>
            </div>
            <h1 class="title">${BOT_TAG}</h1>
            <p class="sub-title">FAST WHATSAPP LINK ACCESS</p>

            <div class="field">
                <label>WHATSAPP NUMBER</label>
                <div class="input-wrapper">
                    <input type="text" id="phone" placeholder="947xxxxxxxx" autocomplete="off">
                </div>
            </div>

            <button class="btn" id="actionBtn" onclick="generateCode()">
                <div class="spinner" id="spinner"></div>
                <span id="btnText">GET PAIRING CODE</span>
            </button>

            <div id="code-container">
                <div class="copy-badge" id="autoCopyNotice">⚡ AUTO-COPIED TO CLIPBOARD</div>
                <div class="code-text" id="codeOut" onclick="copyValue()">--------</div>
                <p class="code-guide">WhatsApp > Linked Devices > Link with phone number</p>
            </div>
        </div>

        <div class="toast" id="toast">
            <span>✨</span>
            <span id="toastMsg">Code copied to clipboard!</span>
        </div>

        <script>
            function showToast(msg) {
                const toast = document.getElementById('toast');
                document.getElementById('toastMsg').innerText = msg;
                toast.classList.add('show');
                setTimeout(() => {
                    toast.classList.remove('show');
                }, 3000);
            }

            async function generateCode() {
                const phoneInput = document.getElementById('phone');
                const btn = document.getElementById('actionBtn');
                const btnText = document.getElementById('btnText');
                const spinner = document.getElementById('spinner');
                const container = document.getElementById('code-container');
                const codeOut = document.getElementById('codeOut');

                let phone = phoneInput.value.trim().replace(/[^0-9]/g, '');

                if (!phone) {
                    showToast('⚠️ කරුණාකර WhatsApp අංකය ඇතුළත් කරන්න!');
                    return;
                }

                let botId = 'node_' + Math.floor(1000 + Math.random() * 9000);

                btn.disabled = true;
                btnText.innerText = 'GENERATING CODE...';
                spinner.style.display = 'block';
                container.style.display = 'none';

                try {
                    const res = await fetch(\`/pair?number=\${encodeURIComponent(phone)}&botId=\${encodeURIComponent(botId)}\`);
                    const data = await res.json();

                    if (data.status && data.pairingCode) {
                        codeOut.innerText = data.pairingCode;
                        container.style.display = 'block';

                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(data.pairingCode).then(() => {
                                showToast('🔥 Code auto-copied: ' + data.pairingCode);
                            }).catch(() => {});
                        }
                    } else {
                        showToast(data.error || 'Failed to generate code.');
                    }
                } catch {
                    showToast('❌ Server error! Please try again.');
                } finally {
                    btn.disabled = false;
                    btnText.innerText = 'GET PAIRING CODE';
                    spinner.style.display = 'none';
                }
            }

            function copyValue() {
                const text = document.getElementById('codeOut').innerText;
                if (!text || text.includes('-')) return;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(() => {
                        showToast('COPIED: ' + text);
                    });
                }
            }
        </script>
    </body>
    </html>
    `);
});

app.get('/pair', async (req, res) => {
    const { number, botId } = req.query;
    if (!number) return res.status(400).json({ status: false, message: 'Invalid number' });
    const sessionId = botId || `bot_${Date.now()}`;
    await startSingleBot(sessionId, number, res);
});

app.get('/status', (req, res) => {
    res.json({
        engine: BOT_TAG,
        activeCount: activeBots.size,
        currentMode: global.botMode,
        nodes: Array.from(activeBots.keys()),
        loadedCommands: Array.from(commands.keys())
    });
});

// Port Listen & DB Boot
app.listen(PORT, () => {
    console.log(chalk.cyan(`[${BOT_TAG}] SERVER OPERATIONAL ON PORT ${PORT}`));
});

mongoose.connect(MONGO_URL)
    .then(async () => {
        console.log(chalk.red.bold(`[${BOT_TAG}] MONGODB CLUSTER AUTHENTICATED.`));
        await autoReconnectAllBots();
    })
    .catch((err) => console.error(chalk.red('FATAL DB ERROR:'), err));
