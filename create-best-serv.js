/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.0.0
 * Date: 14 May 2026
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
    if (!db || db.length === 0) {
        console.log('⚠️ База данных пуста.');
        return;
    }

    let tempList = db.map(record => ({
        ...record,
        priority: 3
    }));

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

    const seen = new Set();
    const finalList = [];

    for (const record of tempList) {
        const hostPort = extractHostPortFromSubscription(record.subscription);
        if (!hostPort) continue;

        if (seen.has(hostPort)) {
            record.priority = 5;
            continue;
        }

        seen.add(hostPort);
        finalList.push(record);
    }

    finalList.sort((a, b) => a.priority - b.priority);

    const best = finalList.slice(0, 4);

    let content = header;

    best.forEach(record => {
        content += record.subscription + '\n';
    });

    content += `vless://1.1.1.1:443?type=tcp#Checked%20${today}T${timeForFooter.split(' ')[1]}%20%F0%9F%AA%83\n`;

    fs.writeFileSync(outputFile, content.trim());

    console.log(`📄 best-serv.txt успешно создан (${best.length} серверов)`);
}

module.exports = { createBestServFile };