/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.2.3
 * Date: 21 May 2026
 */

const fs = require('fs');

const header = `#profile-title: 🧢 Free Rnd Serv\n` +
               `#profile-update-interval: 4\n` +
               `#support-url: https://t.me/+cnBIozEwEzpkYzQy\n` +
               `#hide-settings: 0\n\n`;

function extractHostPortFromSubscription(subscription) {
    try {
        const urlPart = subscription.split('#')[0];
        // Ищем @host:port? где host — буквы/цифры/точки, port — цифры
        const match = urlPart.match(/@([a-zA-Z0-9.-]+:\d+)/);
        return match[1];
    } catch (e) {
        return null;
    }
}

async function createBestServFile(db, outputFile, today) {
    if (!db || db.length === 0) {
        console.log('⚠️ Нет данных для создания best-serv.txt');
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
        const hp = extractHostPortFromSubscription(record.subscription);
        if (!hp || seen.has(hp)) continue;
        seen.add(hp);
        finalList.push(record);
    }

    finalList.sort((a, b) => a.priority - b.priority);

    const best = finalList.slice(0, 4);

    const timeForFooter = new Date().toISOString().slice(0, 16).replace('T', ' ');
    let content = header;
    best.forEach(r => content += r.subscription + '\n');
    content += `vless://1.1.1.1:443?type=tcp#Checked%20${today}T${timeForFooter.split(' ')[1]}%20%F0%9F%AA%83\n`;

    fs.writeFileSync(outputFile, content.trim());
    console.log(`📄 ${outputFile} успешно создан (${best.length} серверов)`);
}

module.exports = { createBestServFile };
