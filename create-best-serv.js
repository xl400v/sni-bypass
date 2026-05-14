/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 1.4.2
 * Date: 14 May 2026
 * 
 * Модуль формирования best-serv.txt с приоритетом России и дедупликацией по host:port
 */

const fs = require('fs');

const header = `#profile-title: 🧢 Free Rnd Serv\n` +
               `#profile-update-interval: 4\n` +
               `#support-url: https://t.me/+cnBIozEwEzpkYzQy\n` +
               `#hide-settings: 0\n\n`;

async function createBestServFile(db, outputFile, today, timeForFooter) {
    // Сортируем всю базу по рейтингу (высокий рейтинг сначала)
    const sorted = [...db].sort((a, b) => parseInt(b.rating) - parseInt(a.rating));

    const unique = [];
    const seenHostPort = new Set();

    for (const record of sorted) {
        const hostPortKey = `hostport:${record.host}:${record.port}`;

        // Дедупликация только по host:port
        if (seenHostPort.has(hostPortKey)) {
            continue;
        }

        seenHostPort.add(hostPortKey);
        unique.push(record);
    }

    // === Формирование финального списка топ-4 ===

    // 1. Лучшая запись России (если есть)
    const ruServer = unique.find(r => r.country === 'RU');

    // 2. Все остальные записи (кроме России)
    const otherServers = unique.filter(r => r.country !== 'RU');

    let best = [];

    if (ruServer) {
        best.push(ruServer);
    }

    // Добавляем остальные страны, пока не наберём 4
    for (const server of otherServers) {
        if (best.length >= 4) break;
        best.push(server);
    }

    // Если всё ещё меньше 4 — добираем из оставшихся (включая низкоприоритетные)
    if (best.length < 4) {
        const remaining = unique.filter(r => !best.some(b => b.host === r.host && b.port === r.port));
        best = best.concat(remaining.slice(0, 4 - best.length));
    }

    // Ограничиваем ровно 4 записями
    best = best.slice(0, 4);

    // Формируем содержимое файла
    let content = header;

    best.forEach(record => {
        content += record.subscription + '\n';
    });

    // Последняя строка
    content += `vless://1.1.1.1:443?type=tcp#Checked%20${today}T${timeForFooter.split(' ')[1]}%20%F0%9F%AA%83\n`;

    fs.writeFileSync(outputFile, content.trim());
    
    console.log(`📄 best-serv.txt создан (${best.length} серверов | RU: ${ruServer ? '1' : '0'})`);
}

module.exports = { createBestServFile };