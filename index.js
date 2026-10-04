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
const commands = new Map();
const msgRetryCounterCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

/**
 * ⚡ Smart Command Loader & Watcher
 */
function getCommandDirectory() {
    const defaultPath = path.join(__dirname, 'commands');
    if (fs.existsSync(defaultPath)) return defaultPath;

    // Capital letter check (Linux file system support)
    const upperPath = path.join(__dirname, 'Commands');
    if (fs.existsSync(upperPath)) return upperPath;

    fs.mkdirSync(defaultPath, { recursive: true });
    return defaultPath;
}

function loadCommands() {
    commands.clear();
    const cmdDir = getCommandDirectory();
    console.log(chalk.cyan(`\n[${BOT_TAG}] Scanning directory: ${cmdDir}`));

    try {
        const files = fs.readdirSync(cmdDir);
        console.log(chalk.gray(`Found files in directory: ${JSON.stringify(files)}`));

        for (const file of files) {
            if (file.endsWith('.js')) {
                try {
                    const filePath = path.join(cmdDir, file);
                    delete require.cache[require.resolve(filePath)];
                    const cmd = require(filePath);

                    if (cmd && cmd.name && typeof cmd.execute === 'function') {
                        const mainName = cmd.name.toLowerCase();
                        commands.set(mainName, cmd);
                        console.log(chalk.green(`[LOADED CMD] => ${PREFIX}${mainName} (from ${file})`));

                        if (Array.isArray(cmd.alias)) {
                            cmd.alias.forEach(alias => {
                                commands.set(alias.toLowerCase(), cmd);
                                console.log(chalk.blue(`   [ALIAS] => ${PREFIX}${alias.toLowerCase()}`));
                            });
                        }
                    } else {
                        console.log(chalk.yellow(`[SKIPPED] ${file} (Missing name or execute function)`));
                    }
                } catch (loadErr) {
                    console.error(chalk.red(`[ERROR LOADING ${file}]:`), loadErr.message);
                }
            }
        }
    } catch (dirErr) {
        console.error(chalk.red(`[DIRECTORY ERROR]:`), dirErr.message);
    }
    console.log(chalk.red.bold(`[${BOT_TAG}] TOTAL COMMAND HANDLERS ACTIVE: ${commands.size}\n`));
}

// Initial Loading
loadCommands();

// Live File Watcher (Hot Reload)
try {
    const watchDir = getCommandDirectory();
    let reloadDebounce;
    fs.watch(watchDir, (eventType, filename) => {
        if (filename && filename.endsWith('.js')) {
            clearTimeout(reloadDebounce);
            reloadDebounce = setTimeout(() => {
                console.log(chalk.yellow(`[FILE MODIFIED] => ${filename}. Reloading modules...`));
                loadCommands();
            }, 300);
        }
    });
} catch (e) {
    console.log(chalk.gray("File watcher disabled or not supported."));
}

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

        // Command Execution Listener
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

                    // Commands Folder හරහා Execution
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

// Web Pair Code UI
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
            body { background: var(--bg); font-family: 'Rajdhani', sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; color: #fff; }
            .panel { width: 90%; max-width: 440px; background: var(--panel); border: 1px solid rgba(255, 0, 60, 0.25); border-radius: 12px; padding: 35px 25px; text-align: center; }
            .title { font-family: 'Orbitron', sans-serif; font-size: 26px; color: #fff; margin-bottom: 5px; }
            .field { margin: 15px 0; text-align: left; }
            label { display: block; font-size: 12px; color: var(--cyan); margin-bottom: 5px; }
            input { width: 100%; background: #000; border: 1px solid #222; border-radius: 6px; padding: 12px; color: #fff; outline: none; }
            .btn { width: 100%; padding: 14px; background: var(--primary); border: none; border-radius: 6px; color: #fff; font-family: 'Orbitron', sans-serif; font-weight: 700; cursor: pointer; margin-top: 10px; }
            #code-container { display: none; margin-top: 20px; background: #000; padding: 15px; border: 1px dashed var(--cyan); }
            .code-text { font-family: 'Orbitron', sans-serif; font-size: 28px; color: var(--cyan); cursor: pointer; }
        </style>
    </head>
    <body>
        <div class="panel">
            <h1 class="title">${BOT_TAG}</h1>
            <p style="color: #666; font-size: 13px;">MULTI-INSTANCE LINK SYSTEM</p>
            <div class="field">
                <label>Node Tag (Session ID)</label>
                <input type="text" id="botId" placeholder="e.g. dinu_1">
            </div>
            <div class="field">
                <label>WhatsApp Number</label>
                <input type="text" id="phone" placeholder="947xxxxxxxx">
            </div>
            <button class="btn" id="actionBtn" onclick="generateCode()">AUTHENTICATE</button>
            <div id="code-container">
                <div style="font-size: 11px; color: #888; margin-bottom: 5px;">TAP CODE TO COPY</div>
                <div class="code-text" id="codeOut" onclick="copyValue()">--------</div>
            </div>
        </div>
        <script>
            async function generateCode() {
                const phone = document.getElementById('phone').value.trim();
                let botId = document.getElementById('botId').value.trim() || 'node_' + Math.floor(1000 + Math.random() * 9000);
                if (!phone) return alert('Enter phone number!');
                document.getElementById('actionBtn').innerText = 'CONNECTING...';
                try {
                    const res = await fetch(\`/pair?number=\${encodeURIComponent(phone)}&botId=\${encodeURIComponent(botId)}\`);
                    const data = await res.json();
                    if (data.status && data.pairingCode) {
                        document.getElementById('codeOut').innerText = data.pairingCode;
                        document.getElementById('code-container').style.display = 'block';
                    } else {
                        alert(data.error || 'Failed');
                    }
                } catch {
                    alert('Error connecting.');
                } finally {
                    document.getElementById('actionBtn').innerText = 'AUTHENTICATE';
                }
            }
            function copyValue() {
                navigator.clipboard.writeText(document.getElementById('codeOut').innerText);
                alert('COPIED!');
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

// Database & Engine Boot
mongoose.connect(MONGO_URL)
    .then(async () => {
        console.log(chalk.red.bold(`[${BOT_TAG}] MONGODB CLUSTER AUTHENTICATED.`));
        await autoReconnectAllBots();
        app.listen(PORT, () => {
            console.log(chalk.cyan(`[${BOT_TAG}] SERVER OPERATIONAL ON PORT ${PORT}`));
        });
    })
    .catch((err) => console.error(chalk.red('FATAL DB ERROR:'), err));
