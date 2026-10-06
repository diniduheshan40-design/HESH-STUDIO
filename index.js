require('dotenv').config();
const fs = require('fs'), path = require('path'), mongoose = require('mongoose'), express = require('express');
const chalk = require('chalk'), pino = require('pino'), cors = require('cors'), NodeCache = require('node-cache');
const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, Browsers, delay } = require('@whiskeysockets/baileys');
const { useMongoAuthState, SessionModel } = require('./auth');

// 🛑 Console Spam Filter & Global Crash Handlers
const origLog = console.log;
console.log = (...args) => (typeof args[0] === 'string' && (args[0].includes('Closing session: SessionEntry') || args[0].includes('SessionEntry {'))) ? null : origLog(...args);
process.on('uncaughtException', err => console.error(chalk.red('[UNCAUGHT EXCEPTION]:'), err?.message || err));
process.on('unhandledRejection', r => console.error(chalk.red('[UNHANDLED REJECTION]:'), r?.message || r));

const app = express();
app.use(cors()); app.use(express.json()); app.use(express.urlencoded({ extended: true }));

const MONGO_URL = process.env.MONGODB_URL || process.env.MONGO_URI || "mongodb+srv://heshanxmd43_db_user:FEMEM3yjl69L0SuF@cluster0.b6nhi22.mongodb.net/?appName=Cluster0";
const PORT = process.env.PORT || 10000, BOT_TAG = "DARK-DINU", PREFIX = process.env.PREFIX || ".";

const activeBots = new Map(), commands = new Map();
global.activeSockets = activeBots;
const startingBots = new Map(), pendingPairRequests = new Map(), pairingLocks = new Map();
const msgRetryCounterCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Global Interactive Caches & Dev Setup
['ttCache', 'fbSessions', 'ytSessions', 'videoSessions', 'songSessions', 'menuSessions'].forEach(k => global[k] = global[k] || new Map());
global.devReactConfig = global.devReactConfig || { enabled: true, emoji: "👨🏻‍💻", disabledNumbers: new Set() };

const getCmdDir = () => {
    const p = path.join(__dirname, 'commands');
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    return p;
};

function loadCommands() {
    commands.clear();
    const dir = getCmdDir();
    try {
        fs.readdirSync(dir).filter(f => f.endsWith('.js')).forEach(file => {
            try {
                const fp = path.join(dir, file);
                delete require.cache[require.resolve(fp)];
                const cmd = require(fp);
                if (cmd?.name && typeof cmd.execute === 'function') {
                    commands.set(cmd.name.toLowerCase(), cmd);
                    if (Array.isArray(cmd.alias)) cmd.alias.forEach(a => commands.set(String(a).toLowerCase(), cmd));
                }
            } catch (e) { console.error(chalk.red(`[LOAD ERR ${file}]:`), e.message); }
        });
    } catch (e) { console.error(chalk.red('[DIR ERR]:'), e.message); }
}
loadCommands();

try {
    let debounce;
    fs.watch(getCmdDir(), (evt, fn) => {
        if (fn?.endsWith('.js')) { clearTimeout(debounce); debounce = setTimeout(loadCommands, 300); }
    });
} catch (_) {}

const getMsgText = m => {
    if (!m?.message) return '';
    let msg = m.message;
    ['ephemeralMessage', 'viewOnceMessageV2', 'viewOnceMessage', 'documentWithCaptionMessage'].forEach(k => { if (msg[k]) msg = msg[k].message; });
    return (msg.conversation || msg.extendedTextMessage?.text || msg.imageMessage?.caption || msg.videoMessage?.caption || msg.templateButtonReplyMessage?.selectedId || msg.buttonsResponseMessage?.selectedButtonId || msg.listResponseMessage?.singleSelectReply?.selectedRowId || '').trim();
};

const cleanNum = n => {
    let num = String(n || '').replace(/[^0-9]/g, '');
    return num.startsWith('0') ? '94' + num.slice(1) : num;
};

const closeSock = s => { try { s?.ev?.removeAllListeners(); s?.ws?.close(); } catch (_) {} };

async function startSingleBot(sessionId, phoneNumber = null, res = null) {
    let responded = false, rTimer = null;
    const sendRes = (status, data) => {
        if (!responded && res && !res.headersSent) {
            responded = true;
            if (rTimer) clearTimeout(rTimer);
            return res.json({ status, ...data });
        }
    };

    if (!phoneNumber && startingBots.has(sessionId)) return startingBots.get(sessionId);
    if (phoneNumber && (startingBots.has(sessionId) || pendingPairRequests.has(sessionId))) return sendRes(false, { error: "Bot is already pairing. Wait for the code." });

    const p = (async () => {
        let sock = null, clearSession = async () => {}, isPaired = false;
        try {
            if (phoneNumber) await SessionModel.deleteMany({ sessionId }).catch(() => {});
            const { state, saveCreds, clearSession: cs } = await useMongoAuthState(sessionId);
            clearSession = cs;
            const { version } = await fetchLatestBaileysVersion();

            sock = makeWASocket({
                version, logger: pino({ level: 'fatal' }), printQRInTerminal: false,
                browser: Browsers.macOS('Desktop'),
                auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })) },
                msgRetryCounterCache, generateHighQualityLinkPreview: true, syncFullHistory: false,
                markOnlineOnConnect: true, getMessage: async () => undefined
            });

            sock.ev.on('creds.update', saveCreds);

            if (phoneNumber) {
                rTimer = setTimeout(() => {
                    if (!responded) { sendRes(false, { error: "Pairing timed out." }); pendingPairRequests.delete(sessionId); }
                }, 60000);
                pendingPairRequests.set(sessionId, { number: phoneNumber, at: Date.now() });
            }

            sock.ev.on('connection.update', async ({ connection, lastDisconnect, isNewLogin, qr }) => {
                if (phoneNumber && !isPaired && !sock.authState.creds.registered && qr) {
                    isPaired = true;
                    try {
                        const num = cleanNum(phoneNumber);
                        if (num.length < 10) throw new Error("Invalid phone number.");
                        if (pairingLocks.has(sessionId)) return;
                        pairingLocks.set(sessionId, true);
                        try {
                            const code = await sock.requestPairingCode(num);
                            console.log(chalk.green(`[${BOT_TAG}] Pair Code: ${code}`));
                            sendRes(true, { sessionId, pairingCode: code });
                        } finally { pairingLocks.delete(sessionId); }
                    } catch (e) {
                        pairingLocks.delete(sessionId); pendingPairRequests.delete(sessionId);
                        sendRes(false, { error: e.message || 'Pairing failed' }); closeSock(sock);
                    }
                }

                if (connection === 'close') {
                    const code = lastDisconnect?.error?.output?.statusCode;
                    const loggedOut = code === DisconnectReason.loggedOut;
                    console.log(chalk.red(`[${BOT_TAG}] [${sessionId}] Closed (${code})`));

                    if (phoneNumber && !sock.authState.creds.registered && !responded) {
                        pendingPairRequests.delete(sessionId); pairingLocks.delete(sessionId);
                        sendRes(false, { error: `Closed before pairing (${code})` });
                    }

                    closeSock(sock); activeBots.delete(sessionId); startingBots.delete(sessionId); pairingLocks.delete(sessionId);

                    if (loggedOut) { await clearSession().catch(() => {}); pendingPairRequests.delete(sessionId); }
                    else if (sock.authState?.creds?.registered || !phoneNumber) {
                        setTimeout(() => startSingleBot(sessionId).catch(() => {}), 3000);
                    }
                }

                if (connection === 'open') {
                    pendingPairRequests.delete(sessionId); pairingLocks.delete(sessionId); startingBots.delete(sessionId);
                    activeBots.set(sessionId, sock);
                    console.log(chalk.black.bgRed.bold(` [${BOT_TAG}] NODE [${sessionId}] LINKED & ACTIVE `));

                    if (isNewLogin) {
                        setTimeout(async () => {
                            const bNum = (sock.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");
                            if (!bNum) return;
                            const card = `╔══════════════════════╗\n   🕷️ 𝐃 𝐀 𝐑 𝐊 - 𝐃 𝐈 𝐍 𝐔 🕷️️\n╚══════════════════════╝\n\n┌─〔 🟢 *CONNECTED* 〕\n├─▸ 🤖 Node: ${sessionId}\n├─▸ 📱 Bot: +${bNum}\n├─▸ 🔐 Prefix: [ ${PREFIX} ]\n└───────────────────────\n\n> 👑 *Dev:* Dinidu Heshan`;
                            await sock.sendMessage(`${bNum}@s.whatsapp.net`, { image: { url: "https://files.catbox.moe/k315x4.jpg" }, caption: card }).catch(() => {});
                        }, 4000);
                    }
                }
            });

            // Message Listeners & Router
            sock.ev.on('messages.upsert', async ({ messages, type }) => {
                if (!messages || type !== 'notify') return;
                for (const msg of messages) {
                    if (!msg.message || msg.message?.protocolMessage || msg.message?.reactionMessage) continue;
                    const from = msg.key.remoteJid, isFromMe = Boolean(msg.key.fromMe);
                    const botNum = (sock.user?.id || "").split(":")[0].replace(/[^0-9]/g, "");
                    const senderJid = isFromMe ? `${botNum}@s.whatsapp.net` : (msg.key.participant || msg.participant || from || "");
                    const cleanSender = String(senderJid).split("@")[0].split(":")[0].replace(/[^0-9]/g, "");
                    const isDev = cleanSender === "94719845166" || cleanSender === "15947733680169";

                    if (global.devReactConfig.enabled && isDev && !isFromMe && !global.devReactConfig.disabledNumbers.has(cleanSender)) {
                        sock.sendMessage(from, { react: { text: global.devReactConfig.emoji, key: msg.key } }).catch(() => {});
                    }

                    if (from === 'status@broadcast') {
                        if (isFromMe) continue;
                        try {
                            await sock.readMessages([msg.key]);
                            const s = msg.key.participant || msg.participant;
                            if (s) {
                                const emojis = ['🖤', '🥀', '⚡', '✨', '🔥', '🤍'];
                                setTimeout(() => sock.sendMessage('status@broadcast', { react: { text: emojis[Math.floor(Math.random() * emojis.length)], key: { remoteJid: 'status@broadcast', id: msg.key.id, participant: s, fromMe: false } } }, { statusJidList: [s] }).catch(() => {}), 2000);
                            }
                        } catch (_) {}
                        continue;
                    }

                    const body = getMsgText(msg);
                    if (!body) continue;
                    const qId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
                    const reply = body.trim();

                    // 🎵 Interactive Song Reply
                    if (qId && global.songSessions.has(qId) && ['1', '2', '3'].includes(reply)) {
                        const sData = global.songSessions.get(qId);
                        sock.sendMessage(from, { react: { text: "⏳", key: msg.key } }).catch(() => {});
                        try {
                            const res = await require("axios").get(`https://api.chamindu.site/api/v1/youtube/download?url=${encodeURIComponent(sData.url)}&quality=360p&format=mp3&api_key=chama_api_ec9848130d1aea209f08fb85e0b4720f`, { timeout: 45000 });
                            const dl = res.data?.data?.download_url || res.data?.download_url || res.data?.audio || res.data?.url;
                            if (!dl) return sock.sendMessage(from, { text: "❌ Audio Link Not Found." }, { quoted: msg });
                            if (reply === '1') await sock.sendMessage(from, { audio: { url: dl }, mimetype: "audio/mp4", fileName: `${sData.title.slice(0, 30)}.mp3`, ptt: false }, { quoted: msg });
                            else if (reply === '2') await sock.sendMessage(from, { document: { url: dl }, mimetype: "audio/mpeg", fileName: `${sData.title.slice(0, 30)}.mp3` }, { quoted: msg });
                            else if (reply === '3') await sock.sendMessage(from, { audio: { url: dl }, mimetype: "audio/ogg; codecs=opus", ptt: true }, { quoted: msg });
                            sock.sendMessage(from, { react: { text: "✅", key: msg.key } }).catch(() => {});
                        } catch (e) { sock.sendMessage(from, { text: `❌ DL Error: ${e.message}` }, { quoted: msg }); }
                        continue;
                    }

                    // 🎬 Interactive FB Reply
                    if (qId && global.fbSessions.has(qId) && ['1', '2', '3'].includes(reply)) {
                        const fb = global.fbSessions.get(qId);
                        const vUrl = reply === '1' ? (fb.hd || fb.sd) : (fb.sd || fb.hd);
                        if (['1', '2'].includes(reply)) {
                            if (!vUrl) return sock.sendMessage(from, { text: "❌ Video not available." }, { quoted: msg });
                            await sock.sendMessage(from, { video: { url: vUrl }, caption: `*🎬 DARK-DINU FB ${reply === '1' ? 'HD' : 'SD'}*\n📌 ${fb.title}` }, { quoted: msg });
                        } else {
                            const aUrl = fb.audio || fb.sd || fb.hd;
                            await sock.sendMessage(from, { audio: { url: aUrl }, mimetype: 'audio/mp4', fileName: `${fb.title.slice(0, 30)}.mp3` }, { quoted: msg });
                        }
                        continue;
                    }

                    // 🎥 Interactive YT Reply
                    if (qId && global.ytSessions.has(qId) && ['1', '2', '3', '4', '5'].includes(reply)) {
                        const yt = global.ytSessions.get(qId);
                        const dl = reply === '1' ? (yt.video_360 || yt.video) : reply === '2' ? (yt.video_720 || yt.video_hd) : reply === '3' ? (yt.video_1080 || yt.video_720) : (yt.audio || yt.video);
                        if (!dl) return sock.sendMessage(from, { text: "❌ Stream unavailable." }, { quoted: msg });
                        if (['1', '2', '3'].includes(reply)) await sock.sendMessage(from, { video: { url: dl }, caption: `*🎬 ${yt.title}*` }, { quoted: msg });
                        else if (reply === '4') await sock.sendMessage(from, { audio: { url: dl }, mimetype: "audio/mp4", fileName: `${yt.title.slice(0, 30)}.mp3` }, { quoted: msg });
                        else await sock.sendMessage(from, { document: { url: dl }, mimetype: "audio/mpeg", fileName: `${yt.title.slice(0, 40)}.mp3` }, { quoted: msg });
                        continue;
                    }

                    // 📜 Interactive Menu Reply
                    if (qId && global.menuSessions.has(qId)) {
                        const acts = { "1": "general", "2": "media", "3": "stealth", "4": "owner", "5": "all" };
                        if (acts[reply] && commands.has("menu")) {
                            await commands.get("menu").execute({ sock, msg, from, args: [acts[reply]], body: `${PREFIX}menu ${acts[reply]}`, prefix: PREFIX, sessionId, commands, activeBots: Array.from(activeBots.values()), activeBotsMap: activeBots });
                            continue;
                        }
                    }

                    // Command Dispatcher
                    if (body.startsWith(PREFIX)) {
                        const parts = body.slice(PREFIX.length).trim().split(/ +/);
                        const cmdName = (parts[0] || "").toLowerCase();
                        const args = parts.slice(1);
                        if (commands.has(cmdName)) {
                            try {
                                console.log(chalk.magenta(`[RUN] => ${cmdName} from ${cleanSender}`));
                                await commands.get(cmdName).execute({ sock, msg, from, args, body, prefix: PREFIX, sessionId, commands, activeBots: Array.from(activeBots.values()), activeBotsMap: activeBots });
                            } catch (err) { console.error(chalk.red(`[CMD ERR ${cmdName}]:`), err); }
                        }
                    }
                }
            });

            return sock;
        } catch (e) {
            pendingPairRequests.delete(sessionId); pairingLocks.delete(sessionId);
            sendRes(false, { error: e.message || 'Startup failed' });
            if (sock) closeSock(sock);
            throw e;
        } finally { startingBots.delete(sessionId); }
    })();

    startingBots.set(sessionId, p);
    try { return await p; } finally { startingBots.delete(sessionId); }
}

async function autoReconnectAllBots() {
    try {
        const list = await SessionModel.distinct('sessionId');
        console.log(chalk.cyan(`[${BOT_TAG}] Bootstrapping ${list.length} node(s)...`));
        for (const id of list) {
            try { await startSingleBot(id); } catch (e) { console.error(chalk.red(`Node [${id}] fail:`), e.message); }
            await delay(3500);
        }
    } catch (e) { console.error(chalk.red('Boot Error:'), e); }
}

// ================= Compact Cyber Web UI =================
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${BOT_TAG} // ACCESS</title><link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@600;700&display=swap" rel="stylesheet"><style>:root{--p:#ff0044;--c:#00f0ff;--bg:#030307}*{box-sizing:border-box;margin:0;padding:0}body{background:radial-gradient(circle at 50% 15%,#18091a 0%,var(--bg) 85%);font-family:'Rajdhani',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff;padding:20px}.panel{width:100%;max-width:400px;background:rgba(12,13,22,.85);backdrop-filter:blur(25px);border:1px solid rgba(255,0,68,.3);border-radius:20px;padding:35px 25px;text-align:center;box-shadow:0 0 30px rgba(255,0,68,.2)}.title{font-family:'Orbitron',sans-serif;font-size:28px;color:var(--p);margin-bottom:6px}.sub{color:#8c8fa8;font-size:12px;letter-spacing:1px;margin-bottom:25px}input{width:100%;background:#090a12;border:1px solid #333;border-radius:10px;padding:14px;color:#fff;font-size:16px;outline:none;margin-bottom:15px;transition:.3s}input:focus{border-color:var(--p)}.btn{width:100%;padding:14px;background:linear-gradient(135deg,var(--p),#aa0030);border:none;border-radius:10px;color:#fff;font-family:'Orbitron';font-weight:700;cursor:pointer;letter-spacing:1px;transition:.3s}.btn:disabled{opacity:.6}#box{display:none;margin-top:20px;background:rgba(0,240,255,.05);border:1px dashed var(--c);border-radius:12px;padding:15px}.code{font-family:'Orbitron';font-size:30px;color:var(--c);letter-spacing:6px;cursor:pointer;margin:5px 0}</style></head><body><div class="panel"><h1 class="title">${BOT_TAG}</h1><p class="sub">WHATSAPP LINK PORTAL</p><input type="text" id="phone" placeholder="947xxxxxxxx" autocomplete="off"><button class="btn" id="btn" onclick="gen()">GET PAIRING CODE</button><div id="box"><div style="font-size:11px;color:#2ed573;font-weight:bold;">⚡ CLICK CODE TO COPY</div><div class="code" id="code" onclick="copy()">--------</div><p style="font-size:11px;color:#8c8fa8">WhatsApp > Linked Devices > Link with phone number</p></div></div><script>async function gen(){const p=document.getElementById('phone').value.trim().replace(/[^0-9]/g,'');if(!p)return alert('Number එක ඇතුළත් කරන්න!');const btn=document.getElementById('btn');btn.disabled=true;btn.innerText='GENERATING...';try{const r=await fetch('/pair?number='+encodeURIComponent(p)+'&botId=node_'+Math.floor(1000+Math.random()*9000));const d=await r.json();if(d.status&&d.pairingCode){document.getElementById('code').innerText=d.pairingCode;document.getElementById('box').style.display='block';if(navigator.clipboard)navigator.clipboard.writeText(d.pairingCode);}else alert(d.error||'Failed');}catch(e){alert('Server error!');}finally{btn.disabled=false;btn.innerText='GET PAIRING CODE';}}function copy(){const t=document.getElementById('code').innerText;if(t&&!t.includes('-')&&navigator.clipboard){navigator.clipboard.writeText(t);alert('Copied: '+t);}}</script></body></html>`);
});

app.get('/pair', async (req, res) => {
    const num = cleanNum(req.query.number);
    if (!num || num.length < 10) return res.status(400).json({ status: false, error: 'Invalid number' });
    const sId = req.query.botId || `bot_${Date.now()}`;
    await startSingleBot(sId, num, res);
});

app.get('/status', (req, res) => res.json({ engine: BOT_TAG, active: activeBots.size, nodes: Array.from(activeBots.keys()), commands: Array.from(commands.keys()) }));
app.get('/health', (req, res) => res.json({ status: true, db: mongoose.connection.readyState === 1 ? "connected" : "disconnected", active: activeBots.size }));

app.listen(PORT, () => console.log(chalk.cyan(`[${BOT_TAG}] SERVER OPERATIONAL ON PORT ${PORT}`)));

mongoose.set('strictQuery', false);
mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 30000, connectTimeoutMS: 30000, maxPoolSize: 10, socketTimeoutMS: 45000, family: 4 })
    .then(async () => {
        console.log(chalk.green.bold(`[${BOT_TAG}] MONGODB AUTHENTICATED.`));
        await autoReconnectAllBots();
    })
    .catch(err => console.error(chalk.red('FATAL DB ERROR:'), err.message));
