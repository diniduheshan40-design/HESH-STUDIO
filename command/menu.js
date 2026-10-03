module.exports = {
    name: 'menu',
    category: 'general',
    description: 'List all commands',
    execute: async ({ sock, msg, from, commands }) => {
        let menuText = `╭━━━〔 *DARK-DINU MENU* 〕━━━╮\n┃\n`;
        
        commands.forEach((cmd) => {
            menuText += `┃ 🔹 .${cmd.name} - ${cmd.description || ''}\n`;
        });

        menuText += `┃\n╰━━━━━━━━━━━━━━━━━━━━╯`;

        await sock.sendMessage(from, { text: menuText }, { quoted: msg });
    }
};
