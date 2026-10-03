module.exports = {
    name: 'alive',
    category: 'general',
    description: 'Check if bot is online',
    execute: async ({ sock, msg, from, activeBotsCount }) => {
        const text = `*👋 DARK-DINU MD Multi-Bot is Online!*\n\n` +
                     `⚡ *Database:* MongoDB\n` +
                     `⚙️ *Prefix:* .\n` +
                     `🤖 *Active Bots Running:* ${activeBotsCount}`;
                     
        await sock.sendMessage(from, { text }, { quoted: msg });
    }
};
