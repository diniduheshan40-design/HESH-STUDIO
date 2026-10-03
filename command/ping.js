module.exports = {
    name: 'ping',
    category: 'general',
    description: 'Check bot response speed',
    execute: async ({ sock, msg, from, sessionId }) => {
        const start = Date.now();
        const latency = Date.now() - start;
        
        await sock.sendMessage(from, { 
            text: `*Pong!* 🏓\n⚡ *Latency:* ${latency}ms\n🤖 *Bot:* DARK-DINU\n🆔 *Session:* ${sessionId}` 
        }, { quoted: msg });
    }
};

