/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 1.4.3
 * Date: 14 May 2026
 */

const fs = require('fs');

const header = `#profile-title: 🧢 Free Rnd Serv\n` +
               `#profile-update-interval: 4\n` +
               `#support-url: https://t.me/+cnBIozEwEzpkYzQy\n` +
               `#hide-settings: 0\n\n`;

async function createBestServFile(db, outputFile, today, timeForFooter) {
    if (!db || db.length === 0) {
        console.log('⚠️ База данных пуста.');
        return;
    }

    // Создаём временную коллекцию с полем priority
    let tempList = db.map(record => ({
        ...record,
        priority: 3,                         // по умолчанию
        hostPort: `${record.host}:${record.port}`
    }));

    // Присваиваем приоритеты
    let ruFound = false;

    for (const record of tempList) {
        const remarkLower = (record.subscription || '').toLowerCase();
        const hasVpnOrXhttp = /\b(vpn|xhttp)\b/i.test(remarkLower);

        if (record.country === 'RU') {
            if (!ruFound) {
                record.priority = 1;
                ruFound = true;
            } else {
                record.priority = 4;
            }
        } 
        else if (record.country !== 'EU') {
            record.priority = hasVpnOrXhttp ? 5 : 2;
        } 
        else {
            record.priority = hasVpnOrXhttp ? 5 : 3;
        }
    }

    // Дедупликация по host:port
    const seen = new Set();
    const finalList = [];

    for (const record of tempList) {
        if (seen.has(record.hostPort)) {
            record.priority = 5;   // дубликаты получают низкий приоритет
            continue;
        }
        seen.add(record.hostPort);
        finalList.push(record);
    }

    // Сортируем по возрастанию приоритета (1 — лучший)
    finalList.sort((a, b) => a.priority - b.priority);

    // Берём первые 4 записи
    const best = finalList.slice(0, 4);

    // Формируем файл
    let content = header;

    best.forEach(record => {
        content += record.subscription + '\n';
    });

    content += `vless://1.1.1.1:443?type=tcp#Checked%20${today}T${timeForFooter.split(' ')[1]}%20%F0%9F%AA%83\n`;

    fs.writeFileSync(outputFile, content.trim());

    console.log(`📄 best-serv.txt создан (${best.length} серверов)`);
    console.log(`   Приоритеты выбранных серверов: ${best.map(r => r.priority).join(', ')}`);
}

module.exports = { createBestServFile };