/**
 * Minecraft Sunucu Durum Botu 
 * Rivoles Development tarafından paylaşılan Discord botu
 */

const { REST, Routes } = require('discord.js');
const config = require('./config.json');

const commands = [
    {
        name: 'durum',
        description: 'Bir Minecraft sunucusunun mevcut durumunu öğrenin',
        options: [
            {
                name: 'sunucu',
                description: 'Durumunu kontrol etmek istediğiniz sunucunun adı',
                type: 3, // STRING
                required: true,
                choices: config.minecraft.servers.map(server => ({
                    name: server.name,
                    value: server.name
                }))
            }
        ],
    }
];

const rest = new REST({ version: '10' }).setToken(config.bot.token);

(async () => {
    try {
        console.log('Uygulama (/) komutlarını yenilemeye başladım.');

        await rest.put(
            Routes.applicationCommands(config.bot.clientId),
            { body: commands },
        );

        console.log('Uygulama (/) komutları başarıyla yenilendi.');
    } catch (error) {
        console.error(error);
    }
})();