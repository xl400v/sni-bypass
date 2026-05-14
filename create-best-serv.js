/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 1.4.4
 * Date: 14 May 2026
 * 
 * Модуль формирования best-serv.txt с системой приоритетов
 */

const fs = require('fs');

const header = `#profile-title: 🧢 Free Rnd Serv\n` +
               `#profile-update-interval: 4\n` +
               `#support-url: https://t.me/+cnBIozEwEzpkYzQy\n` +
               `#hide-settings: 0\n\n`;

async function createBestServFile(db, outputFile, today, timeForFooter) {
    if (!db || db.length === 0) {
        console.log('⚠️ База данных пуста. Файл best-serv.txt не создан.');
        return;
    }

    // 1. Создаём временную коллекцию с полем priority
    let tempList = db.map(record => ({
        ...record,
        priority: 3,                         // по умолчанию
        hostPort: `${record.host}:${record.port}`
    }));

    // 2. Присваиваем приоритеты
    let ruFound = false;

    for (const record of tempList) {
        const remarkLower = (record.subscription || '').toLowerCase();
        const hasVpnOrXhttp = /\b(vpn|xhttp)\b/i.test(remarkLower);

        if (record.country === 'RU') {
            if (!ruFound) {
                record.priority = 1;   // первая Россия — высший приоритет
                ruFound = true;
            } else {
                record.priority = 4;   // остальные Россия
            }
        } 
        else if (record.country !== 'EU') {
            record.priority = hasVpnOrXhttp ? 5 : 2;
        } 
        else {
            record.priority = hasVpnOrXhttp ? 5 : 3;
        }
    }

    // 3. Дедупликация по host:port
    const seen = new Set();
    const finalList = [];

    for (const record of tempList) {
        if (seen.has(record.hostPort)) {
            record.priority = 5;        // дубликаты получают низкий приоритет
            continue;
        }
        seen.add(record.hostPort);
        finalList.push(record);
    }

    // 4. Сортируем по возрастанию приоритета (1 — самый лучший)
    finalList.sort((a, b) => a.priority - b.priority);

    // 5. Берём первые 4 записи (проходим по отсортированному списку)
    const best = [];
    for (const record of finalList) {
        if (best.length >= 4) break;
        best.push(record);
    }

    // 6. Формируем содержимое файла
    let content = header;

    // Добавляем выбранные подписки
    best.forEach(record => {
        content += record.subscription + '\n';
    });

    // В конце файла — специальная строка
    content += `vless://1.1.1.1:443?type=tcp#Checked%20${today}T${timeForFooter.split(' ')[1]}%20%F0%9F%AA%83\n`;

    fs.writeFileSync(outputFile, content.trim());

    console.log(`📄 best-serv.txt создан (${best.length} серверов)`);
    console.log(`   Приоритеты: ${best.map(r => r.priority).join(', ')}`);
}

module.exports = { createBestServFile };