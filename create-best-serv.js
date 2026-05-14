/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 1.4.0
 * Date: 13 May 2026
 */

const fs = require('fs');

const header = `#profile-title: 🧢 Free Rnd Serv\n` +
               `#profile-update-interval: 4\n` +     // Изменено по требованию
               `#support-url: https://t.me/+cnBIozEwEzpkYzQy\n` +
               `#hide-settings: 0\n\n`;

async function createBestServFile(db, outputFile, today, timeForFooter) {
    const sorted = [...db].sort((a, b) => parseInt(b.rating) - parseInt(a.rating));

    const unique = [];
    const seen = new Set();

    for (const record of sorted) {
        const remark = record.subscription || '';

        // Исключаем записи с "vpn" и "xhttp" (низкий приоритет)
        if (/\b(vpn|xhttp)\b/i.test(remark)) continue;

        const keyQuic = `quic:${record.quic}`;
        const keyHostPort = `hostport:${record.hostPort}`;

        if (seen.has(keyQuic) || seen.has(keyHostPort)) {
            continue; // дедупликация
        }

        seen.add(keyQuic);
        seen.add(keyHostPort);
        unique.push(record);
    }

    // Приоритет: максимум 1 сервер из России
    const ruServer = unique.find(r => r.country === 'RU');
    const nonRuServers = unique.filter(r => r.country !== 'RU');

    let best = [];
    if (ruServer) best.push(ruServer);
    best = best.concat(nonRuServers.slice(0, 3)); // добираем до 4

    let content = header;

    best.forEach(record => {
        content += record.subscription + '\n';
    });

    // Последняя строка
    content += `vless://1.1.1.1:443?type=tcp#Checked%20${today}T${timeForFooter.split(' ')[1]}%20%F0%9F%AA%83\n`;

    fs.writeFileSync(outputFile, content.trim());
    console.log(`📄 best-serv.txt создан (${best.length} серверов, 1 RU в приоритете)`);
}

module.exports = { createBestServFile };