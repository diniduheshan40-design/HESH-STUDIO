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
                    const hasQuoted = Boolean(msg.message?.extendedTextMessage?.contextInfo?.quotedMessage);

                    let command = '';
                    let args = [];

                    if (body.startsWith(PREFIX)) {
                        const [cmdName, ...restArgs] = body.slice(PREFIX.length).trim().split(/ +/);
                        command = cmdName.toLowerCase();
                        args = restArgs;
                    } else if (emojiAliases.includes(body.trim()) && hasQuoted) {
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

// ================= Premium Cyber Dark Web UI =================

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
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet">
        <style>
            :root {
                --primary: #ff0044;
                --primary-glow: rgba(255, 0, 68, 0.45);
                --cyan: #00f0ff;
                --cyan-glow: rgba(0, 240, 255, 0.35);
                --bg: #030307;
                --card-bg: rgba(10, 11, 20, 0.75);
                --border-color: rgba(255, 0, 68, 0.28);
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                background: radial-gradient(circle at 50% 20%, #150918 0%, var(--bg) 80%);
                font-family: 'Rajdhani', sans-serif;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #fff;
                padding: 20px;
                position: relative;
                overflow-x: hidden;
            }
            body::before {
                content: "";
                position: absolute;
                width: 320px;
                height: 320px;
                background: radial-gradient(circle, var(--primary-glow) 0%, transparent 70%);
                top: 10%;
                left: 15%;
                filter: blur(80px);
                z-index: 0;
                pointer-events: none;
            }
            body::after {
                content: "";
                position: absolute;
                width: 300px;
                height: 300px;
                background: radial-gradient(circle, var(--cyan-glow) 0%, transparent 70%);
                bottom: 15%;
                right: 15%;
                filter: blur(80px);
                z-index: 0;
                pointer-events: none;
            }
            .panel {
                position: relative;
                z-index: 1;
                width: 100%;
                max-width: 450px;
                background: var(--card-bg);
                backdrop-filter: blur(25px);
                -webkit-backdrop-filter: blur(25px);
                border: 1px solid var(--border-color);
                border-radius: 20px;
                padding: 40px 30px;
                text-align: center;
                box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 40px rgba(255, 0, 68, 0.15);
                transition: transform 0.3s ease;
            }
            .badge-live {
                display: inline-flex;
                align-items: center;
                gap: 7px;
                background: rgba(0, 240, 255, 0.08);
                border: 1px solid rgba(0, 240, 255, 0.3);
                border-radius: 30px;
                padding: 4px 14px;
                font-size: 11px;
                color: var(--cyan);
                letter-spacing: 2px;
                margin-bottom: 15px;
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
                50% { opacity: 0.4; transform: scale(0.75); }
            }
            .title {
                font-family: 'Orbitron', sans-serif;
                font-size: 32px;
                font-weight: 900;
                letter-spacing: 2px;
                background: linear-gradient(135deg, #fff 30%, var(--primary) 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 5px;
            }
            .sub-title {
                color: #888ba8;
                font-size: 13px;
                letter-spacing: 1.5px;
                margin-bottom: 25px;
            }
            .field {
                margin: 18px 0;
                text-align: left;
            }
            label {
                display: block;
                font-size: 12px;
                color: var(--cyan);
                letter-spacing: 1px;
                margin-bottom: 7px;
                font-weight: 600;
            }
            input {
                width: 100%;
                background: rgba(0, 0, 0, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.09);
                border-radius: 10px;
                padding: 14px 16px;
                color: #fff;
                outline: none;
                font-size: 16px;
                font-family: 'Rajdhani', sans-serif;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            input:focus {
                border-color: var(--primary);
                box-shadow: 0 0 15px var(--primary-glow);
                background: rgba(0, 0, 0, 0.85);
            }
            .btn {
                position: relative;
                width: 100%;
                padding: 16px;
                background: linear-gradient(135deg, var(--primary) 0%, #a8002d 100%);
                border: none;
                border-radius: 10px;
                color: #fff;
                font-family: 'Orbitron', sans-serif;
                font-weight: 700;
                cursor: pointer;
                margin-top: 15px;
                font-size: 14px;
                letter-spacing: 2px;
                box-shadow: 0 8px 25px var(--primary-glow);
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
            }
            .btn:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 12px 30px rgba(255, 0, 68, 0.65);
            }
            .btn:disabled {
                background: #191a26;
                color: #555870;
                box-shadow: none;
                cursor: not-allowed;
            }
            .spinner {
                display: none;
                width: 20px;
                height: 20px;
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
                background: rgba(0, 240, 255, 0.04);
                padding: 20px;
                border: 1px dashed rgba(0, 240, 255, 0.4);
                border-radius: 12px;
                animation: fadeIn 0.4s ease-out;
            }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(8px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .code-text {
                font-family: 'Orbitron', sans-serif;
                font-size: 32px;
                font-weight: 900;
                color: var(--cyan);
                letter-spacing: 8px;
                margin: 10px 0;
                text-shadow: 0 0 15px var(--cyan-glow);
                cursor: pointer;
                user-select: all;
            }
            .copy-badge {
                display: inline-block;
                font-size: 11px;
                color: #2ed573;
                background: rgba(46, 213, 115, 0.1);
                border: 1px solid rgba(46, 213, 115, 0.3);
                padding: 3px 10px;
                border-radius: 20px;
                margin-bottom: 8px;
                letter-spacing: 1px;
            }
            .toast {
                position: fixed;
                bottom: 25px;
                left: 50%;
                transform: translateX(-50%) translateY(100px);
                background: rgba(13, 15, 25, 0.95);
                border: 1px solid var(--cyan);
                box-shadow: 0 0 20px var(--cyan-glow);
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
            <p class="sub-title">MULTI-INSTANCE SECURE RELAY</p>

            <div class="field">
                <label>NODE TAG (SESSION ID)</label>
                <input type="text" id="botId" placeholder="e.g. dinu_node1">
            </div>

            <div class="field">
                <label>WHATSAPP NUMBER</label>
                <input type="text" id="phone" placeholder="947xxxxxxxx">
            </div>

            <button class="btn" id="actionBtn" onclick="generateCode()">
                <div class="spinner" id="spinner"></div>
                <span id="btnText">GET PAIRING CODE</span>
            </button>

            <div id="code-container">
                <div class="copy-badge" id="autoCopyNotice">⚡ AUTO-COPIED TO CLIPBOARD</div>
                <div class="code-text" id="codeOut" onclick="copyValue()">--------</div>
                <div style="font-size: 12px; color: #888ba8; margin-top: 5px;">
                    WhatsApp > Linked Devices > Link with phone number
                </div>
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
                const botIdInput = document.getElementById('botId');
                const btn = document.getElementById('actionBtn');
                const btnText = document.getElementById('btnText');
                const spinner = document.getElementById('spinner');
                const container = document.getElementById('code-container');
                const codeOut = document.getElementById('codeOut');

                let phone = phoneInput.value.trim().replace(/[^0-9]/g, '');
                let botId = botIdInput.value.trim() || 'node_' + Math.floor(1000 + Math.random() * 9000);

                if (!phone) {
                    showToast('⚠️ කරුණාකර WhatsApp අංකය ඇතුළත් කරන්න!');
                    return;
                }

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

                        // Auto-copy to clipboard
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            navigator.clipboard.writeText(data.pairingCode).then(() => {
                                showToast('🔥 Code copied to clipboard: ' + data.pairingCode);
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
