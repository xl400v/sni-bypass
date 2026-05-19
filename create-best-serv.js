/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.0.7
 * Date: 19 May 2026
 */

const fs = require('fs');

const header = `#profile-title: 🧢 Free Rnd Serv\n` +
               `#profile-update-interval: 4\n` +
               `#support-url: https://t.me/+cnBIozEwEzpkYzQy\n` +
               `#hide-settings: 0\n\n`;

function extractHostPortFromSubscription(subscription) {
    try {
        const urlPart = subscription.split('#')[0];
        const atIndex = urlPart.indexOf('@');
        const questionIndex = urlPart.indexOf('?');
        if (atIndex === -1 || questionIndex === -1) return null;
        return urlPart.substring(atIndex + 1, questionIndex);
    } catch (e) {
        return null;
    }
}

async function createBestServFile(db, outputFile, today, timeForFooter) {
    if (!db || db.length === 0) return;

    // Сортируем по рейтингу (высокий → низкий)
    let sorted = [...db].sort((a, b) => parseInt(b.rating) - parseInt(a.rating));

    const seen = new Set();
    const finalList = [];

    for (const record of sorted) {
        const hp = extractHostPortFromSubscription(record.subscription);
        if (!hp || seen.has(hp)) continue;

        seen.add(hp);
        finalList.push(record);
    }

    // Приоритет RU — максимум 1 сервер
    const ruServer = finalList.find(r => r.country === 'RU');
    const otherServers = finalList.filter(r => r.country !== 'RU');

    let best = [];
    if (ruServer) best.push(ruServer);
    best = best.concat(otherServers.slice(0, 4 - best.length));

    let content = header;

    best.forEach(record => {
        content += record.subscription + '\n';
    });

    content += `vless://1.1.1.1:443?type=tcp#Checked%20${today}T${timeForFooter.split(' ')[1]}%20%F0%9F%AA%83\n`;

    fs.writeFileSync(outputFile, content.trim());
    console.log(`📄 ${outputFile} успешно создан (${best.length} серверов | RU: ${ruServer ? '1' : '0'})`);
}

module.exports = { createBestServFile };