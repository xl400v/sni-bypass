/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.3.0
 * Date: 22 May 2026
 */

const fs = require('fs');
const { extractHostPort } = require('./db-utils');

const header = `#profile-title: 🧢 Free Rnd Serv\n` +
               `#profile-update-interval: 4\n` +
               `#support-url: https://t.me/+cnBIozEwEzpkYzQy\n` +
               `#hide-settings: 0\n\n`;

async function createBestServFile(db, outputFile, today) {
    if (!db || db.length === 0) {
        console.log('⚠️  Нет данных для создания best-serv.txt');
        return;
    }

    // Создаём временный массив с priority (не сохраняется в базу!)
    let tempList = db.map(record => ({ ...record, priority: 3 }));

    let ruFound = false;

    for (const record of tempList) {
        const remarkLower = (record.subscription || '').toLowerCase();
        const hasLow = /\b(hysteria|vpn|xhttp)\b/i.test(remarkLower);

        // Приоритет на основе tg (основной показатель качества)
        if (record.country === 'RU' && !hasLow) {
            record.priority = ruFound ? 4 : 1;
        }
        else if (record.country === 'EU') {
            record.priority = hasLow ? 5 : 3;
        }
        if (parseInt(record.yt || 0) > 0) record.priority--;
        if (parseInt(record.tg || 0) > 0) record.priority--;
        // Гарантируем, что priority > 0
        if (record.priority < 1) record.priority = 1;

        if (!ruFound && record.priority === 1) ruFound = true;
    }

    // Дедубликация по host:port
    const seen = new Set();
    const finalList = [];

    for (const record of tempList) {
        const hp = extractHostPort(record.subscription);
        if (!hp || seen.has(hp)) continue;
        seen.add(hp);
        finalList.push(record);
    }

    finalList.sort((a, b) => a.priority - b.priority);

    const best = finalList.slice(0, 7);

    const timeForFooter = new Date().toISOString().slice(0, 16).replace('T', ' ');
    let content = header;
    best.forEach(r => content += r.subscription + '\n');
    content += `vless://1.1.1.1:443?type=tcp#`;
    content += best.length > 0 ? `Checked%20%F0%9F%9B%A1%EF%B8%8F` : `No found%20%E2%9A%94%EF%B8%8F`;
    content += `%20${today}T${timeForFooter.split(' ')[1]}\n`;

    fs.writeFileSync(outputFile, content.trim());
    if (best.length > 0 ) {
        console.log(`\n🛡️  ${outputFile} успешно создан (${best.length} серверов)`);
    } else {
        console.log(`\n⚔️  Список серверов пустой. И база серверов пустая!`);
    }
}

module.exports = { createBestServFile };
