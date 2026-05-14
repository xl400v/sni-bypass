/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 1.4.1
 * Date: 14 May 2026
 */

const fs = require('fs');

const header = `#profile-title: 🧢 Free Rnd Serv\n` +
               `#profile-update-interval: 4\n` +
               `#support-url: https://t.me/+cnBIozEwEzpkYzQy\n` +
               `#hide-settings: 0\n\n`;

async function createBestServFile(db, outputFile, today, timeForFooter) {
    const sorted = [...db].sort((a, b) => parseInt(b.rating) - parseInt(a.rating));

    const unique = [];
    const seen = new Set();

    for (const record of sorted) {
        const keyQuic = `quic:${record.quic}`;
        const keyHostPort = `hostport:${record.hostPort}`;

        if (seen.has(keyQuic) || seen.has(keyHostPort)) {
            continue;
        }

        seen.add(keyQuic);
        seen.add(keyHostPort);
        unique.push(record);
    }

    // Разделяем на группы
    const ruServers = unique.filter(r => r.country === 'RU' && !r.hasLowPriority);
    const normalServers = unique.filter(r => r.country !== 'RU' && !r.hasLowPriority);
    const lowPriorityServers = unique.filter(r => r.hasLowPriority);

    // Формируем финальный список топ-4
    let best = [];

    // Максимум 1 сервер из России
    if (ruServers.length > 0) {
        best.push(ruServers[0]);
    }

    // Добавляем обычные серверы
    best = best.concat(normalServers);

    // Если ещё не набрали 4 — добавляем низкоприоритетные
    if (best.length < 4) {
        best = best.concat(lowPriorityServers);
    }

    // Оставляем только 4
    best = best.slice(0, 4);

    let content = header;

    best.forEach(record => {
        content += record.subscription + '\n';
    });

    // Последняя строка
    content += `vless://1.1.1.1:443?type=tcp#Checked%20${today}T${timeForFooter.split(' ')[1]}%20%F0%9F%AA%83\n`;

    fs.writeFileSync(outputFile, content.trim());
    console.log(`📄 best-serv.txt создан (${best.length} серверов | 1 RU + остальные)`);
}

module.exports = { createBestServFile };