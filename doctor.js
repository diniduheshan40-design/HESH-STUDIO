const chalk = require('chalk');

class BotDoctor {
    constructor() {
        this.errorCount = 0;
        this.lastReset = Date.now();
        this.healThreshold = 3; // මිනිත්තුවක් ඇතුළත error 3 කට වඩා ආවොත් auto-heal වෙනවා
    }

    /**
     * Runtime එකේදී Command එකක් Fail වුණොත් Auto-Fix කරන Function එක
     */
    async handleCommandError({ error, commandName, sock, from, msg }) {
        this.errorCount++;
        console.error(chalk.red.bold(`[DOCTOR 🚑] Error caught in [${commandName}]:`), error.message || error);

        try {
            // 1. Thread Deadlock Break: අදාළ Socket React එකෙන් Release කිරීම
            if (sock && from && msg?.key) {
                await sock.sendMessage(from, { react: { text: "⚠️", key: msg.key } }).catch(() => {});
                
                // Safe English User Notice (Bot Freeze වීම නවත්වයි)
                await sock.sendMessage(from, {
                    text: `⚠️ *SYSTEM HEALING TRIGGERED*\n\nCommand: \`${commandName}\` faced a temporary runtime delay. Auto-repaired & socket released.`
                }, { quoted: msg }).catch(() => {});
            }

            // 2. Deadlock Cache Cleaning (Hang වූ Interactive Buffers Clear කිරීම)
            if (global.songSessions) global.songSessions.clear();
            if (global.ttCache) global.ttCache.clear();
            if (global.fbSessions) global.fbSessions.clear();
            if (global.videoSessions) global.videoSessions.clear();
            if (global.menuSessions) global.menuSessions.clear();

            // 3. Developer Emergency Alert (ඔයාගේ Inbox එකට විතරක් විස්තර එවයි)
            const devJid = "94719845166@s.whatsapp.net";
            if (sock) {
                const report = 
`🚑 *[DARK-DINU AUTO-HEAL REPORT]* 🚑

📌 *Failing Command:* \`${commandName}\`
❌ *Error Trace:* \`${error.message || error}\`
🛠️ *Fix Applied:* Session cache purge & Socket thread unlocked.
🕒 *Time:* ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Colombo' })}`;

                await sock.sendMessage(devJid, { text: report }).catch(() => {});
            }

            // 4. Repeated Errors ආවොත් Garbage Collection & Memory Flush කිරීම
            if (this.errorCount >= this.healThreshold) {
                this.deepMemoryFlush();
            }

        } catch (innerErr) {
            console.error(chalk.bgRed('[DOCTOR REPAIR FAILED]:'), innerErr.message);
        }
    }

    /**
     * Memory Spikes සහ Ghost Loops සුද්ද කිරීම
     */
    deepMemoryFlush() {
        console.log(chalk.yellow.bold('[DOCTOR 🚑] Performing Deep Memory Flush...'));
        this.errorCount = 0;
        this.lastReset = Date.now();

        // Node.js Buffer & Cache Flush
        if (global.gc) {
            global.gc();
        }
    }
}

module.exports = new BotDoctor();
