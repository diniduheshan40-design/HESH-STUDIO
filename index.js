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

// Render Server Crash Guard (428 Connection Closed / Unhandled Rejection Fix)
process.on('uncaughtException', (err) => {
    console.error(chalk.red('[GLOBAL UNCAUGHT EXCEPTION]:'), err.message || err);
});

process.on('unhandledRejection', (reason) => {
    console.error(chalk.red('[GLOBAL UNHANDLED REJECTION]:'), reason?.message || reason);
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
const commands = new Map();
const msgRetryCounterCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * Commands loader with alias mapping
 */
function loadCommands() {
    commands.clear();
    const cmdDir = path.join(__dirname, 'commands');
    if (!fs.existsSync(cmdDir)) {
        fs.mkdirSync(cmdDir, { recursive: true });
    }

    const files = fs.readdirSync(cmdDir).filter(f => f.endsWith('.js'));
    for (const file of files) {
        try {
            const filePath = path.join(cmdDir, file);
            delete require.cache[require.resolve(filePath)];
            const cmd = require(filePath);

            if (cmd.name && typeof cmd.execute === 'function') {
                commands.set(cmd.name.toLowerCase(), cmd);

                if (Array.isArray(cmd.alias)) {
                    cmd.alias.forEach(alias => {
                        commands.set(alias.toLowerCase(), cmd);
                    });
                }
            }
        } catch (e) {
            console.error(chalk.red(`[FAIL] ${file}:${e.message}`));
        }
    }
    console.log(chalk.red.bold(`\n[${BOT_TAG}] CORE SYSTEMS LOADED:${commands.size} COMMAND HANDLERS\n`));
}
loadCommands();

/**
 * WhatsApp message wrapper unpacker
 */
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
        const { state, saveCreds, clearSession } = await useMongoAuthState(sessionId);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: Browsers.macOS('Desktop'),
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
            },
            msgRetryCounterCache,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            markOnlineOnConnect: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000
        });

        // Pairing Code Request Handler
        if (!sock.authState.creds.registered && phoneNumber) {
            const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(cleanNumber);
                    sendResponse(true, { sessionId, pairingCode: code });
                } catch (err) {
                    sendResponse(false, { error: err.message || 'Pairing error' });
                }
            }, 2500);

            setTimeout(() => {
                sendResponse(false, { error: 'Request timeout. Try again.' });
            }, 30000);
        }

        sock.ev.on('creds.update', saveCreds);

        // Connection Management & Safe Auto-Reconnect
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                console.log(chalk.red(`[${BOT_TAG}] [${sessionId}] Closed (Status:${statusCode})`));

                try {
                    sock.ev.removeAllListeners();
                    sock.ws?.close();
                } catch (_) {}

                if (shouldReconnect) {
                    console.log(chalk.yellow(`[${BOT_TAG}] Reconnecting [${sessionId}] in 5s...`));
                    setTimeout(() => {
                        startSingleBot(sessionId).catch(e => console.error("Reconnect err:", e.message));
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

        // Fast Message Upsert Listener
        sock.ev.on('messages.upsert', async (chatUpdate) => {
            try {
                if (!chatUpdate.messages || chatUpdate.type !== 'notify') return;

                for (const msg of chatUpdate.messages) {
                    if (!msg.message) continue;
                    const from = msg.key.remoteJid;
                    if (from === 'status@broadcast') continue;

                    const body = getMessageText(msg);
                    if (!body || !body.startsWith(PREFIX)) continue;

                    const [cmdName, ...args] = body.slice(PREFIX.length).trim().split(/ +/);
                    const command = cmdName.toLowerCase();

                    // Registered Commands Trigger
                    if (commands.has(command)) {
                        const cmdModule = commands.get(command);
                        await cmdModule.execute({
                            sock,
                            msg,
                            from,
                            args,
                            body,
                            sessionId,
                            commands,
                            activeBotsCount: activeBots.size
                        });
                        continue;
                    }

                    // Native Fallbacks (Folder load නොවුණත් run වන commands)
                    switch (command) {
                        case 'ping':
                        case 'p':
                        case 'speed': {
                            const start = Date.now();
                            await sock.sendMessage(from, { 
                                text: `⚡ *DARK-DINU SPEED:*\n🔥 Latency: \`${Date.now() - start}ms\`\n🖤 Active Nodes: \`${activeBots.size}\`` 
                            }, { quoted: msg });
                            break;
                        }

                        case 'alive': {
                            await sock.sendMessage(from, { 
                                text: `*⚡ DARK-DINU V2 ONLINE ⚡*\n\n` +
                                      `🕶️ *Engine:* High-Speed Node Cache\n` +
                                      `🗄️ *Database:* MongoDB Cloud\n` +
                                      `⚙️ *Prefix:* [ ${PREFIX} ]\n` +
                                      `⚡ *Uptime Status:* 100% Zero Lag`
                            }, { quoted: msg });
                            break;
                        }

                        case 'menu': {
                            let text = `┌───⊷ *DARK-DINU V2* ⊶\n`;
                            text += `│ ✦ Prefix: [ ${PREFIX} ]\n`;
                            text += `│ ✦ Nodes: ${activeBots.size}\n`;
                            text += `└───⊷\n\n`;
                            text += `┌───⊷ *CORE* ⊶\n`;
                            text += `│ ⚡ ${PREFIX}ping\n`;
                            text += `│ ⚡ ${PREFIX}alive\n`;
                            text += `│ ⚡ ${PREFIX}menu\n`;
                            commands.forEach((c) => {
                                if (!['ping', 'alive', 'menu', 'p', 'speed'].includes(c.name)) {
                                    text += `│ ⚡ ${PREFIX}${c.name}\n`;
                                }
                            });
                            text += `└───⊷\n\n*DARK-DINU SYSTEM ENGINE*`;
                            await sock.sendMessage(from, { text }, { quoted: msg });
                            break;
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

/**
 * Bootstrap existing DB sessions
 */
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

// ================= Cyber Dark Interface =================

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
            :root {
                --primary: #ff003c;
                --cyan: #00f0ff;
                --bg: #050508;
                --panel: rgba(13, 14, 23, 0.85);
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
                background: var(--bg);
                font-family: 'Rajdhani', sans-serif;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                color: #fff;
                background-image: 
                    radial-gradient(circle at 10% 20%, rgba(255, 0, 60, 0.12) 0%, transparent 40%),
                    radial-gradient(circle at 90% 80%, rgba(0, 240, 255, 0.08) 0%, transparent 40%);
            }
            .panel {
                width: 90%;
                max-width: 440px;
                background: var(--panel);
                border: 1px solid rgba(255, 0, 60, 0.25);
                box-shadow: 0 0 40px rgba(255, 0, 60, 0.15), inset 0 0 15px rgba(255, 0, 60, 0.05);
                border-radius: 12px;
                padding: 35px 25px;
                backdrop-filter: blur(16px);
                position: relative;
            }
            .panel::before {
                content: '';
                position: absolute;
                top: 0; left: 10%; right: 10%;
                height: 2px;
                background: linear-gradient(90deg, transparent, var(--primary), transparent);
            }
            .header {
                text-align: center;
                margin-bottom: 25px;
            }
            .title {
                font-family: 'Orbitron', sans-serif;
                font-size: 26px;
                font-weight: 900;
                letter-spacing: 3px;
                color: #fff;
                text-shadow: 0 0 10px rgba(255, 0, 60, 0.7);
            }
            .subtitle {
                font-size: 13px;
                color: #8a8d9e;
                letter-spacing: 2px;
                margin-top: 5px;
            }
            .field {
                margin-bottom: 18px;
            }
            label {
                display: block;
                font-size: 12px;
                letter-spacing: 1px;
                color: var(--cyan);
                margin-bottom: 6px;
                text-transform: uppercase;
            }
            input {
                width: 100%;
                background: rgba(0, 0, 0, 0.6);
                border: 1px solid #1f2333;
                border-radius: 6px;
                padding: 12px 14px;
                color: #fff;
                font-size: 15px;
                font-family: inherit;
                outline: none;
                transition: border 0.3s;
            }
            input:focus {
                border-color: var(--primary);
                box-shadow: 0 0 10px rgba(255, 0, 60, 0.3);
            }
            .btn {
                width: 100%;
                padding: 14px;
                background: var(--primary);
                border: none;
                border-radius: 6px;
                color: #fff;
                font-family: 'Orbitron', sans-serif;
                font-size: 14px;
                font-weight: 700;
                letter-spacing: 2px;
                cursor: pointer;
                transition: 0.3s;
                text-shadow: 0 0 5px #000;
                margin-top: 10px;
            }
            .btn:hover {
                background: #d60032;
                box-shadow: 0 0 20px rgba(255, 0, 60, 0.5);
            }
            .btn:disabled {
                background: #333;
                cursor: not-allowed;
            }
            #code-container {
                display: none;
                margin-top: 25px;
                background: rgba(0, 0, 0, 0.7);
                border: 1px dashed var(--cyan);
                border-radius: 6px;
                padding: 15px;
                text-align: center;
            }
            .code-text {
                font-family: 'Orbitron', sans-serif;
                font-size: 30px;
                letter-spacing: 6px;
                color: var(--cyan);
                text-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
                cursor: pointer;
                padding: 5px 0;
            }
            .nodes-count {
                position: absolute;
                top: 12px;
                right: 15px;
                font-size: 11px;
                color: var(--primary);
                letter-spacing: 1px;
            }
        </style>
    </head>
    <body>
        <div class="panel">
            <span class="nodes-count">NODES: ${activeBots.size}</span>
            <div class="header">
                <h1 class="title">${BOT_TAG}</h1>
                <p class="subtitle">MULTI-INSTANCE SYSTEM INTERFACE</p>
            </div>

            <div class="field">
                <label>Node Tag (Bot Session ID)</label>
                <input type="text" id="botId" placeholder="e.g. dinu_matrix">
            </div>

            <div class="field">
                <label>Target Number (with Country Code)</label>
                <input type="text" id="phone" placeholder="947xxxxxxxx">
            </div>

            <button class="btn" id="actionBtn" onclick="generateCode()">AUTHENTICATE</button>

            <div id="code-container">
                <div style="font-size: 11px; color: #8a8d9e; margin-bottom: 5px;">TAP CODE TO COPY</div>
                <div class="code-text" id="codeOut" onclick="copyValue()">--------</div>
                <div style="font-size: 12px; color: #555; margin-top: 5px;">Enter in Linked Devices</div>
            </div>
        </div>

        <script>
            async function generateCode() {
                const phone = document.getElementById('phone').value.trim();
                let botId = document.getElementById('botId').value.trim();
                const btn = document.getElementById('actionBtn');
                const container = document.getElementById('code-container');
                const codeOut = document.getElementById('codeOut');

                if (!phone) return alert('Enter a valid phone number!');
                if (!botId) botId = 'node_' + Math.floor(1000 + Math.random() * 9000);

                btn.innerText = 'INITIALIZING LINK...';
                btn.disabled = true;
                container.style.display = 'none';

                try {
                    const res = await fetch(\`/pair?number=\${encodeURIComponent(phone)}&botId=\${encodeURIComponent(botId)}\`);
                    const data = await res.json();

                    if (data.status && data.pairingCode) {
                        codeOut.innerText = data.pairingCode;
                        container.style.display = 'block';
                    } else {
                        alert(data.error || 'Connection failed.');
                    }
                } catch {
                    alert('System offline or server error.');
                } finally {
                    btn.innerText = 'AUTHENTICATE';
                    btn.disabled = false;
                }
            }

            function copyValue() {
                const text = document.getElementById('codeOut').innerText;
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
        nodes: Array.from(activeBots.keys())
    });
});

// Database & Server Startup
mongoose.connect(MONGO_URL)
    .then(async () => {
        console.log(chalk.red.bold(`[${BOT_TAG}] MONGODB CLUSTER AUTHENTICATED.`));
        await autoReconnectAllBots();
        app.listen(PORT, () => {
            console.log(chalk.cyan(`[${BOT_TAG}] SERVER OPERATIONAL ON PORT ${PORT}`));
        });
    })
    .catch((err) => console.error(chalk.red('FATAL DB ERROR:'), err));
