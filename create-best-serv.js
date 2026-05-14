/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 1.4.5
 * Date: 14 May 2026
 */

const fs = require('fs');

const header = `#profile-title: 🧢 Free Rnd Serv\n` +
               `#profile-update-interval: 4\n` +
               `#support-url: https://t.me/+cnBIozEwEzpkYzQy\n` +
               `#hide-settings: 0\n\n`;

/** Извлекает host:port из строки subscription (между @ и ?) */
function extractHostPortFromSubscription(subscription) {
    try {
        const urlPart = subscription.split('#')[0];
        const atIndex = urlPart.indexOf('@');
        const questionIndex = urlPart.indexOf('?');

        if (atIndex === -1 || questionIndex === -1) return null;

        const hostPortStr = urlPart.substring(atIndex + 1, questionIndex);
        return hostPortStr;                    // например: "109.73.199.211:443"
    } catch (e) {
        return null;
    }
}

async function createBestServFile(db, outputFile, today, timeForFooter) {
    if (!db || db.length === 0) {
        console.log('⚠️ База данных пуста.');
        return;
    }

    console.log('\n🔍 === НАЧАЛО ФОРМИРОВАНИЯ best-serv.txt ===');

    let tempList = db.map(record => ({
        ...record,
        priority: 3
    }));

    // Присваиваем приоритеты
    let ruFound = false;

    console.log('\n📋 Присвоение приоритетов:');
    for (const record of tempList) {
        const remarkLower = (record.subscription || '').toLowerCase();
        const hasVpnOrXhttp = /\b(vpn|xhttp)\b/i.test(remarkLower);

        if (record.country === 'RU') {
            if (!ruFound) {
                record.priority = 1;
                ruFound = true;
                console.log(`   [1] RU (первый)     → ${record.subscription.substring(0, 60)}...`);
            } else {
                record.priority = 4;
                console.log(`   [4] RU (последующий)→ ${record.subscription.substring(0, 60)}...`);
            }
        } 
        else if (record.country !== 'EU') {
            record.priority = hasVpnOrXhttp ? 5 : 2;
            console.log(`   [${record.priority}] ${record.country} ${hasVpnOrXhttp ? '(vpn/xhttp)' : ''} → ${record.subscription.substring(0, 60)}...`);
        } 
        else {
            record.priority = hasVpnOrXhttp ? 5 : 3;
            console.log(`   [${record.priority}] EU ${hasVpnOrXhttp ? '(vpn/xhttp)' : ''}     → ${record.subscription.substring(0, 60)}...`);
        }
    }

    // Дедупликация по host:port, извлечённому из subscription
    const seen = new Set();
    const finalList = [];

    console.log('\n🔄 Дедупликация по host:port (из subscription):');
    for (const record of tempList) {
        const hostPort = extractHostPortFromSubscription(record.subscription);

        if (!hostPort) {
            console.log(`   [?] Не удалось извлечь host:port → пропуск`);
            continue;
        }

        if (seen.has(hostPort)) {
            record.priority = 5;
            console.log(`   [5] Дубликат пропущен → ${hostPort}`);
            continue;
        }

        seen.add(hostPort);
        finalList.push(record);
        console.log(`   [✓] Добавлен → ${hostPort} (приоритет ${record.priority})`);
    }

    // Сортируем по возрастанию приоритета
    finalList.sort((a, b) => a.priority - b.priority);

    console.log('\n📊 Отсортированный список по приоритету:');
    finalList.forEach((r, i) => {
        const hp = extractHostPortFromSubscription(r.subscription) || '???';
        console.log(`   ${i+1}. Приоритет ${r.priority} | ${r.country} | ${hp}`);
    });

    // Берём первые 4 записи
    const best = [];
    console.log('\n✅ Выбранные серверы для выгрузки в best-serv.txt:');

    for (const record of finalList) {
        if (best.length >= 4) break;
        best.push(record);
        const hp = extractHostPortFromSubscription(record.subscription) || '???';
        console.log(`   → [Приоритет ${record.priority}] ${record.country} | ${hp}`);
    }

    // Формируем файл
    let content = header;

    best.forEach(record => {
        content += record.subscription + '\n';
    });

    content += `vless://1.1.1.1:443?type=tcp#Checked%20${today}T${timeForFooter.split(' ')[1]}%20%F0%9F%AA%83\n`;

    fs.writeFileSync(outputFile, content.trim());

    console.log(`\n🎉 Файл ${outputFile} успешно создан (${best.length} серверов)\n`);
}

module.exports = { createBestServFile };