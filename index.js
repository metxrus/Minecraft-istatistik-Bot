/**
 * Minecraft Sunucu Durum Botu
 * Rivoles Development tarafından paylaşılan Discord botu
 */

const { Client, GatewayIntentBits, EmbedBuilder, ActivityType, AttachmentBuilder } = require('discord.js');
const util = require('minecraft-server-util');
const config = require('./config.json');
const chalk = require('chalk');
const { createCanvas } = require('canvas');
const { Chart } = require('chart.js/auto');

// Discord istemcisini başlat
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
    ]
});

// Sunucu durum mesajlarını ve aralıklarını sakla
const statusMessages = new Map();
const updateIntervals = new Map();
const playerHistory = new Map(); // Oyuncu sayısı geçmişini sakla

// Konsol loglama
const log = {
    info: (msg) => console.log(chalk.blue('ℹ️ [BİLGİ]'), msg),
    success: (msg) => console.log(chalk.green('✅ [BAŞARILI]'), msg),
    error: (msg) => console.log(chalk.red('❌ [HATA]'), msg),
    warn: (msg) => console.log(chalk.yellow('⚠️ [UYARI]'), msg)
};

// Oyuncu geçmişini başlat
function initializePlayerHistory(serverId) {
    if (!playerHistory.has(serverId)) {
        playerHistory.set(serverId, []);
    }
}

// Oyuncu geçmişini güncelle
function updatePlayerHistory(serverId, playerCount, maxHistory = 24) {
    const history = playerHistory.get(serverId) || [];
    const currentTime = Date.now();
    
    if (history.length === 0 || 
        (currentTime - history[history.length - 1].timestamp) >= 3600000) { // 1 saat
        history.push({
            timestamp: currentTime,
            count: playerCount
        });

        if (history.length > maxHistory) {
            history.shift(); // En eski kaydı kaldır
        }

        playerHistory.set(serverId, history);
    } else {
        history[history.length - 1].count = playerCount;
        playerHistory.set(serverId, history);
    }
}

// Oyuncu sayısı grafiği oluştur
async function generatePlayerChart(serverId, color = '#3498db') {
    const history = playerHistory.get(serverId) || [];
    if (history.length < 2) return null;

    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#2F3136';
    ctx.fillRect(0, 0, width, height);

    const labels = history.map(entry => {
        const date = new Date(entry.timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });

    const data = history.map(entry => entry.count);

    new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Oyuncu Sayısı',
                data,
                borderColor: color,
                backgroundColor: color + '33',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: false,
            animation: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#FFFFFF',
                        font: {
                            size: 14
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Oyuncu Sayısı Geçmişi',
                    color: '#FFFFFF',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#666666',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#FFFFFF',
                        font: {
                            size: 12
                        },
                        padding: 10
                    }
                },
                x: {
                    grid: {
                        color: '#666666',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#FFFFFF',
                        font: {
                            size: 12
                        },
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            layout: {
                padding: 20
            }
        }
    });

    return canvas.toBuffer('image/png');
}

// Bot hazır olduğunda
client.once('ready', () => {
    log.success(`Bot giriş yaptı: ${client.user.tag}`);
    
    const presence = config.bot.presence;
    client.user.setPresence({
        status: presence.status,
        activities: presence.activities.map(activity => ({
            name: activity.name,
            type: ActivityType[activity.type]
        }))
    });

    initializeStatusUpdates();
});

async function checkServerStatus(ip, port = 25565) {
    try {
        const result = await util.status(ip, port);
        return {
            online: true,
            players: result.players.online,
            maxPlayers: result.players.max,
            version: result.version.name,
            description: result.motd.clean,
            ping: result.roundTripLatency
        };
    } catch (error) {
        log.error(`Sunucu durumu kontrol edilemedi: ${ip}:${port} - ${error.message}`);
        return {
            online: false,
            error: error.message
        };
    }
}

async function updateServerStatus(serverConfig) {
    const channel = await client.channels.fetch(serverConfig.channelId).catch(() => null);
    if (!channel) {
        log.error(`Kanal bulunamadı: ${serverConfig.channelId} (${serverConfig.name})`);
        return;
    }

    const status = await checkServerStatus(serverConfig.ip, serverConfig.port);
    
    if (status.online) {
        initializePlayerHistory(serverConfig.channelId);
        updatePlayerHistory(serverConfig.channelId, status.players, serverConfig.display.chart.historyHours);
    }

    const embed = new EmbedBuilder()
        .setTitle(config.embed.title)
        .setColor(status.online ? config.embed.colors.online : config.embed.colors.offline)
        .setTimestamp();

    if (serverConfig.display.type === 'banner' && serverConfig.display.banner.enabled) {
        embed.setImage(serverConfig.display.banner.url);
    }

    embed.addFields(
        { name: '📡 Sunucu', value: `${serverConfig.name} (${serverConfig.ip}:${serverConfig.port})`, inline: true },
        { name: '🔌 Durum', value: status.online ? '✅ Çevrimiçi' : '❌ Çevrimdışı', inline: true }
    );

    if (status.online) {
        embed.addFields(
            { name: '👥 Oyuncular', value: `${status.players}/${status.maxPlayers}`, inline: true },
            { name: '🏷️ Sürüm', value: status.version, inline: true },
            { name: '📊 Ping', value: `${status.ping}ms`, inline: true },
            { name: '📝 MOTD', value: status.description || 'Açıklama yok' }
        );

        if (serverConfig.display.showNextUpdate) {
            const nextUpdate = Math.floor((Date.now() + serverConfig.updateInterval) / 1000);
            embed.addFields({
                name: '⏱️ Sonraki Güncelleme',
                value: `<t:${nextUpdate}:R>`,
                inline: true
            });
        }
    } else {
        embed.addFields(
            { name: '❌ Hata', value: status.error || 'Sunucuya bağlanılamadı' }
        );
    }

    embed.setFooter(config.embed.footer);

    const files = [];
    
    if (serverConfig.display.type === 'chart' && serverConfig.display.chart.enabled && status.online) {
        try {
            const chartBuffer = await generatePlayerChart(
                serverConfig.channelId,
                serverConfig.display.chart.color
            );
            if (chartBuffer) {
                const attachment = new AttachmentBuilder(chartBuffer, { name: 'player-chart.png' });
                files.push(attachment);
                embed.setImage('attachment://player-chart.png');
            }
        } catch (error) {
            log.error(`Grafik oluşturulamadı: ${error.message}`);
        }
    }

    const existingMessage = statusMessages.get(serverConfig.channelId);
    try {
        if (existingMessage) {
            await existingMessage.edit({ embeds: [embed], files });
        } else {
            const message = await channel.send({ embeds: [embed], files });
            statusMessages.set(serverConfig.channelId, message);
        }
        log.info(`Durum güncellendi: ${serverConfig.name}`);
    } catch (error) {
        log.error(`Durum mesajı güncellenemedi: ${serverConfig.name} - ${error.message}`);
    }
}

function initializeStatusUpdates() {
    for (const interval of updateIntervals.values()) {
        clearInterval(interval);
    }
    updateIntervals.clear();

    for (const server of config.minecraft.servers) {
        updateServerStatus(server);
        
        const interval = setInterval(() => updateServerStatus(server), server.updateInterval);
        updateIntervals.set(server.channelId, interval);
        
        log.info(`Durum güncellemeleri başlatıldı: ${server.name} (${server.ip}:${server.port})`);
    }
}

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'status') {
        const serverName = interaction.options.getString('server');
        const server = config.minecraft.servers.find(s => s.name.toLowerCase() === serverName.toLowerCase());
        
        if (!server) {
            await interaction.reply({
                content: `Sunucu "${serverName}" yapılandırmada bulunamadı!`,
                ephemeral: true
            });
            return;
        }

        const status = await checkServerStatus(server.ip, server.port);
        const embed = new EmbedBuilder()
            .setTitle(`${server.name} Durumu`)
            .setColor(status.online ? config.embed.colors.online : config.embed.colors.offline)
            .setTimestamp()
            .setFooter(config.embed.footer);

        if (status.online) {
            embed.addFields(
                { name: '🔌 Durum', value: '✅ Çevrimiçi', inline: true },
                { name: '👥 Oyuncular', value: `${status.players}/${status.maxPlayers}`, inline: true },
                { name: '📊 Ping', value: `${status.ping}ms`, inline: true },
                { name: '🏷️ Sürüm', value: status.version }
            );

            if (server.display.showNextUpdate) {
                const nextUpdate = Math.floor((Date.now() + server.updateInterval) / 1000);
                embed.addFields({
                    name: '⏱️ Sonraki Güncelleme',
                    value: `<t:${nextUpdate}:R>`,
                    inline: true
                });
            }
        } else {
            embed.addFields(
                { name: '🔌 Durum', value: '❌ Çevrimdışı', inline: true },
                { name: '❌ Hata', value: status.error || 'Sunucuya bağlanılamadı' }
            );
        }

        const files = [];
        if (server.display.type === 'chart' && server.display.chart.enabled && status.online) {
            try {
                const chartBuffer = await generatePlayerChart(
                    server.channelId,
                    server.display.chart.color
                );
                if (chartBuffer) {
                    const attachment = new AttachmentBuilder(chartBuffer, { name: 'player-chart.png' });
                    files.push(attachment);
                    embed.setImage('attachment://player-chart.png');
                }
            } catch (error) {
                log.error(`Grafik oluşturulamadı: ${error.message}`);
            }
        } else if (server.display.type === 'banner' && server.display.banner.enabled) {
            embed.setImage(server.display.banner.url);
        }

        await interaction.reply({
            embeds: [embed],
            files,
            ephemeral: true
        });
    }
});

client.login(config.bot.token);