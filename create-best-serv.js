/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 1.3.0
 * Date: 13 May 2026
 * 
 * Модуль формирования файла best-serv.txt
 */

const fs = require('fs');

const header = `#profile-title: 🧢 Free Rnd Serv\n` +
               `#profile-update-interval: 1\n` +
               `#support-url: https://t.me/+cnBIozEwEzpkYzQy\n` +
               `#hide-settings: 0\n\n`;

async function createBestServFile(db, outputFile, today, timeForFooter) {
    // Берём топ-4
    const best = db
        .sort((a, b) => parseInt(b.rating) - parseInt(a.rating))
        .slice(0, 4);

    let content = header;

    best.forEach(record => {
        content += record.subscription + '\n';
    });

    // Последняя строка
    content += `vless://null@1.1.1.1:443?type=tcp&security=none#%F0%9F%AA%83+Checked+${today}T${timeForFooter.split(' ')[1]}\n`;

    fs.writeFileSync(outputFile, content.trim());
    console.log(`📄 Файл ${outputFile} создан (${best.length} лучших серверов)`);
}

module.exports = { createBestServFile };