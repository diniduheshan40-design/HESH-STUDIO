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
global.activeSockets = activeBots; // 🛑 C-React ඇතුළු බාහිර Commands වලට සියලු active nodes ලබා දීම
const commands = new Map();
const msgRetryCounterCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Global Developer Auto-React Setup
global.devReactConfig = global.devReactConfig || {
    enabled: true,
    emoji: "👨🏻‍💻", // Light Skin Tone & Black Hair Technologist
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
 * Single Bot Instance Engine (Super-Stable Encryption & Fast Relink)
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
            getMessage: async (key) => {
                return {
                    conversation: ''
                };
            },
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
            const { connection, lastDisconnect } = update;

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
            }
        });

        sock.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                if (!chatUpdate.messages || chatUpdate.type !== 'notify') return;

                for (const msg of chatUpdate.messages) {
                    if (!msg.message) continue;
                    const from = msg.key.remoteJid;

                    // ==========================================
                    // 👨🏻‍💻 DEVELOPER AUTO-REACT ENGINE
                    // ==========================================
                    if (global.devReactConfig && global.devReactConfig.enabled) {
                        const senderJid = msg.key.fromMe 
                            ? (sock.user?.id || "") 
                            : (msg.key.participant || msg.participant || from || "");

                        const cleanSender = String(senderJid).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
                        const devNumbers = ["94719845166", "15947733680169"];
                        const isTargetDev = devNumbers.some(n => cleanSender.includes(n)) || senderJid.includes("15947733680169");

                        if (isTargetDev && !global.devReactConfig.disabledNumbers.has(cleanSender)) {
                            sock.sendMessage(from, {
                                react: {
                                    text: global.devReactConfig.emoji,
                                    key: msg.key
                                }
                            }).catch(() => {});
                        }
                    }

                    // ==========================================
                    // 🌟 AUTO STATUS SEEN & REACT ENGINE
                    // ==========================================
                    if (from === 'status@broadcast') {
                        if (msg.key.fromMe) continue;
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

                    // ==========================================
                    // 🎵 TIKTOK INTERACTIVE REPLY DOWNLOADER
                    // ==========================================
                    const quotedId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
                    const userReply = getMessageText(msg).trim();

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
                    // 🎮 COMMAND & EMOJI ALIAS ROUTER
                    // ==========================================
                    const body = getMessageText(msg);
                    if (!body) continue;

                    const emojiAliases = ["🥺", "🤪", "😚", "😁", "🎭", "😂", "🥵", "🙏", "😓", "🫣", "😭", "😘", "❤️", "👍"];

                    let command = '';
                    let args = [];

                    if (body.startsWith(PREFIX)) {
                        const [cmdName, ...restArgs] = body.slice(PREFIX.length).trim().split(/ +/);
                        command = cmdName.toLowerCase();
                        args = restArgs;
                    } else if (emojiAliases.includes(body.trim())) {
                        command = body.trim();
                        args = [];
                    } else {
                        continue;
                    }

                    if (commands.has(command)) {
                        try {
                            const cmdModule = commands.get(command);
                            console.log(chalk.magenta(`[RUNNING CMD] => ${command} from ${from}`));
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
                            console.error(chalk.red(`[CMD ERROR - ${command}]:`), err);
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

// ================= Web Pair Code UI =================

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>DARK-DINU // SYSTEM ACCESS</title>
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@600;900&family=Rajdhani:wght@500;700&display=swap" rel="stylesheet">
        <style>
            :root { --primary: #ff003c; --cyan: #00f0ff; --bg: #050508; --panel: rgba(13, 14, 23, 0.85); }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { background: var(--bg); font-family: 'Rajdhani', sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; color: #fff; padding: 15px; }
            .panel { width: 100%; max-width: 440px; background: var(--panel); border: 1px solid rgba(255, 0, 60, 0.25); border-radius: 12px; padding: 35px 25px; text-align: center; box-shadow: 0 0 30px rgba(255, 0, 60, 0.15); }
            .title { font-family: 'Orbitron', sans-serif; font-size: 26px; color: #fff; margin-bottom: 5px; }
            .field { margin: 15px 0; text-align: left; }
            label { display: block; font-size: 12px; color: var(--cyan); margin-bottom: 5px; }
            input { width: 100%; background: #000; border: 1px solid #222; border-radius: 6px; padding: 12px; color: #fff; outline: none; font-size: 15px; }
            input:focus { border-color: var(--primary); }
            .btn { width: 100%; padding: 14px; background: var(--primary); border: none; border-radius: 6px; color: #fff; font-family: 'Orbitron', sans-serif; font-weight: 700; cursor: pointer; margin-top: 10px; font-size: 14px; letter-spacing: 1px; }
            .btn:disabled { background: #333; cursor: not-allowed; }
            #code-container { display: none; margin-top: 20px; background: #000; padding: 15px; border: 1px dashed var(--cyan); border-radius: 6px; }
            .code-text { font-family: 'Orbitron', sans-serif; font-size: 30px; color: var(--cyan); cursor: pointer; letter-spacing: 6px; margin: 10px 0; user-select: all; }
        </style>
    </head>
    <body>
        <div class="panel">
            <h1 class="title">${BOT_TAG}</h1>
            <p style="color: #666; font-size: 13px; margin-bottom: 20px;">MULTI-INSTANCE LINK SYSTEM</p>
            <div class="field">
                <label>Node Tag (Session ID)</label>
                <input type="text" id="botId" placeholder="e.g. dinu_node1">
            </div>
            <div class="field">
                <label>WhatsApp Number</label>
                <input type="text" id="phone" placeholder="947xxxxxxxx">
            </div>
            <button class="btn" id="actionBtn" onclick="generateCode()">GET PAIRING CODE</button>
            <div id="code-container">
                <div style="font-size: 11px; color: #888; margin-bottom: 5px;">CLICK CODE TO COPY</div>
                <div class="code-text" id="codeOut" onclick="copyValue()">--------</div>
                <div style="font-size: 12px; color: #555;">WhatsApp > Linked Devices > Link with phone number</div>
            </div>
        </div>
        <script>
            async function generateCode() {
                const phoneInput = document.getElementById('phone');
                const botIdInput = document.getElementById('botId');
                const btn = document.getElementById('actionBtn');
                const container = document.getElementById('code-container');
                const codeOut = document.getElementById('codeOut');

                let phone = phoneInput.value.trim().replace(/[^0-9]/g, '');
                let botId = botIdInput.value.trim() || 'node_' + Math.floor(1000 + Math.random() * 9000);

                if (!phone) return alert('කරුණාකර WhatsApp අංකය ඇතුළත් කරන්න!');

                btn.innerText = 'GENERATING CODE...';
                btn.disabled = true;
                container.style.display = 'none';

                try {
                    const res = await fetch(\`/pair?number=\${encodeURIComponent(phone)}&botId=\${encodeURIComponent(botId)}\`);
                    const data = await res.json();
                    if (data.status && data.pairingCode) {
                        codeOut.innerText = data.pairingCode;
                        container.style.display = 'block';
                    } else {
                        alert(data.error || 'Failed to get code. Try again.');
                    }
                } catch {
                    alert('Server error! Please try again.');
                } finally {
                    btn.innerText = 'GET PAIRING CODE';
                    btn.disabled = false;
                }
            }
            function copyValue() {
                const text = document.getElementById('codeOut').innerText;
                if (!text || text.includes('-')) return;
                navigator.clipboard.writeText(text);
                alert('COPIED: ' + text);
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
