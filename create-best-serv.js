/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 1.3.4
 * Date: 13 May 2026
 * 
 * Модуль формирования best-serv.txt с дедупликацией по quic + (host + port)
 */

const fs = require('fs');

const header = `#profile-title: 🧢 Free Rnd Serv\n` +
               `#profile-update-interval: 1\n` +
               `#support-url: https://t.me/+cnBIozEwEzpkYzQy\n` +
               `#hide-settings: 0\n\n`;

async function createBestServFile(db, outputFile, today, timeForFooter) {
    // Сортируем по рейтингу (высокий → низкий)
    const sorted = [...db].sort((a, b) => parseInt(b.rating) - parseInt(a.rating));

    const unique = [];
    const seen = new Set();

    for (const record of sorted) {
        if (!record.quic || !record.host || !record.port) continue;

        // Ключ для проверки дубликатов: quic ИЛИ (host + port)
        const key1 = `quic:${record.quic}`;
        const key2 = `hostport:${record.host}:${record.port}`;

        if (seen.has(key1) || seen.has(key2)) {
            continue; // пропускаем дубликат
        }

        seen.add(key1);
        seen.add(key2);
        unique.push(record);
    }

    // Приоритет России — поднимаем RU-сервера наверх
    const ruServers = unique.filter(r => r.country === 'RU');
    const otherServers = unique.filter(r => r.country !== 'RU');

    // Берём топ-4 с приоритетом RU
    const best = [...ruServers, ...otherServers].slice(0, 4);

    let content = header;

    best.forEach(record => {
        content += record.subscription + '\n';
    });

    // Последняя строка
    content += `vless://1.1.1.1:443?type=tcp#Checked%20${today}T${timeForFooter.split(' ')[1]}%20%F0%9F%AA%83\n`;

    fs.writeFileSync(outputFile, content.trim());
    console.log(`📄 Файл ${outputFile} создан (${best.length} уникальных серверов, RU в приоритете)`);
}

module.exports = { createBestServFile };