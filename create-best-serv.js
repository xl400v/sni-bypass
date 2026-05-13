/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 1.3.1
 * Date: 13 May 2026
 */

const fs = require('fs');

const header = `#profile-title: 🧢 Free Rnd Serv\n` +
               `#profile-update-interval: 1\n` +
               `#support-url: https://t.me/+cnBIozEwEzpkYzQy\n` +
               `#hide-settings: 0\n\n`;

async function createBestServFile(db, outputFile, today, timeForFooter) {
    // Разделяем российские и остальные
    const ruServers = db.filter(r => r.country === 'RU')
                        .sort((a, b) => parseInt(b.rating) - parseInt(a.rating));

    const otherServers = db.filter(r => r.country !== 'RU')
                           .sort((a, b) => parseInt(b.rating) - parseInt(a.rating));

    // Сначала все RU, потом остальные — всего топ-4
    const best = [...ruServers, ...otherServers].slice(0, 4);

    let content = header;

    best.forEach(record => {
        content += record.subscription + '\n';
    });

    // Последняя строка по новому формату
    content += `vless://1.1.1.1:443?type=tcp#Checked%20${today}T${timeForFooter.split(' ')[1]}%20%F0%9F%AA%83\n`;

    fs.writeFileSync(outputFile, content.trim());
    console.log(`📄 Файл ${outputFile} создан (${best.length} серверов, RU в приоритете)`);
}

module.exports = { createBestServFile };