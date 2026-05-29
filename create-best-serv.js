/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.4.3
 * Date: 29 May 2026
 */

const fs = require('fs');
const { extractHostPort } = require('./db-utils');

const header = `#profile-title: 🧢 Free Rnd Serv\n` +
               `#profile-update-interval: 4\n` +
               `#support-url: https://t.me/+cnBIozEwEzpkYzQy\n` +
               `#hide-settings: 0\n\n`;

function processRemark(subscription, record) {
    let remark = subscription.split('#')[1] || String(9000 + Math.floor(Math.random() * 1000));

    // Удаляем всё после [CIDR] или [*CIDR], включая пробелы и последующий текст
    remark = remark.replace(/(%5B|\[)(%2A|\*)?CIDR(%5D|\])(%20|\+|\s).*$/g, '%5B%2ACIDR%5D');
    // Подсчёт флагов
    const flagMatches = remark.match(/%F0%9F%87%[A-Z0-9]{2}/g) || [];
    if (flagMatches.length > 3) {
        remark = remark.replace(/%F0%9F%87%[A-Z0-9]{2}%F0%9F%87%[A-Z0-9]{2}/g, '');
        remark = '%F0%9F%87%AA%F0%9F%87%BA%20' + remark.trim(); // EU flag
    }

    // Добавляем иконки
    let icons = [];
    if (parseInt(record.grok || 0) > 0) icons.push('📜');
    if (parseInt(record.telegram || 0) > 0) icons.push('📰');
    if (parseInt(record.youtube || 0) > 0) icons.push('📺');
    if (icons.length > 0) {
        remark += ' ' + icons.join(' ');
    }

    return subscription.split('#')[0] + '#' + remark;
}

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
        const hasLow = /\b(grpc|hysteria|vpn|xhttp)\b/i.test(remarkLower);

        // Приоритет 1 — только для ПЕРВОГО подходящего RU сервера
        if (record.country === 'RU' && !hasLow) {
            record.priority = ruFound ? 5 : 2;
            if (!ruFound) ruFound = true;
        } else if (record.country === 'EU') {
            record.priority = hasLow ? 5 : 4;
        }
        
        if (parseInt(record.telegram) > 0) {
            record.priority--;
            if (parseInt(record.youtube) > 0) record.priority--;
        }
        // Гарантируем, что priority > 0
        if (record.priority < 1) record.priority = 1;
    }

    // Дедубликация по host:port
    const seen = new Set();
    const finalList = [];

    for (const record of tempList) {
        const hp = extractHostPort(record.subscription);
        if (!hp || seen.has(hp)) continue;
        seen.add(hp);
        if (parseInt(record.telegram) + parseInt(record.youtube) > 0) finalList.push(record);
    }

    let content = header;
    finalList
        .sort((a, b) => a.priority - b.priority)
        .forEach(r => content += processRemark(r.subscription, r) + '\n');
    
    const best = finalList.slice(0, 7);
    const timeForFooter = new Date().toISOString().slice(0, 16).replace('T', ' ');
    // Специальная последняя строка с fm-параметром
    const fmParam = 'fm=%7B%22tcp%22%3A%5B%7B%22type%22%3A%22grok%20-%20%F0%9F%93%9C%2C%20tg%20-%20%F0%9F%93%B0%2C%20youtube%20-%20%F0%9F%93%BA%22%7D%5D%7D&';

    content += `vless://1.1.1.1:443?${fmParam}type=tcp#`;
    content += best.length > 0 ? `Checked%20%F0%9F%9B%A1%EF%B8%8F` : `No found%20%E2%9A%94%EF%B8%8F`;
    content += `%20${today}T${timeForFooter.split(' ')[1]}\n`;

    fs.writeFileSync(outputFile, content.trim());
    if (best.length > 0 ) {
        console.log(`\n🛡️  ${outputFile} успешно создано серверов: ${best.length}`);
    } else {
        console.log(`\n⚔️  Список серверов пустой. И база серверов пустая!`);
    }
}

module.exports = { createBestServFile };
