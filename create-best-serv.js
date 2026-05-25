/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.3.1
 * Date: 25 May 2026
 */

const fs = require('fs');
const { extractHostPort } = require('./db-utils');

const header = `#profile-title: 🧢 Free Rnd Serv\n` +
               `#profile-update-interval: 4\n` +
               `#support-url: https://t.me/+cnBIozEwEzpkYzQy\n` +
               `#hide-settings: 0\n\n`;

function processRemark(subscription, record) {
    let remark = subscription.split('#')[1] || 'Unknown';

    // Добавляем иконки
    let icons = [];
    if (parseInt(record.tg || 0) > 0) icons.push('📰');
    if (parseInt(record.vkvideo || 0) > 0) icons.push('📽️');
    if (parseInt(record.yt || 0) > 0) icons.push('📺');
    if (icons.length > 0) {
        remark += ' ' + icons.join(' ');
    }

    // Замена CIDR-подстрок
    remark = remark.replace(/\[\*?CIDR\]|\[\*?CIDR\]\s*([A-Z]{2})/g, '💡');

    // Подсчёт флагов
    const flagMatches = remark.match(/%F0%9F%87%[A-Z0-9]{2}/g) || [];
    if (flagMatches.length > 3) {
        remark = remark.replace(/%F0%9F%87%[A-Z0-9]{2}%F0%9F%87%[A-Z0-9]{2}/g, '');
        remark = '%F0%9F%87%AA%F0%9F%87%BA ' + remark.trim(); // EU flag
    }

    // Замена пробелов и +
    remark = remark.replace(/(\+| )/g, '%20');

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
        const hasLow = /\b(hysteria|vpn|xhttp)\b/i.test(remarkLower);

        // Приоритет на основе tg (основной показатель качества)
        if (record.country === 'RU' && !hasLow) {
            record.priority = ruFound ? 4 : 1;
        } else if (record.country === 'EU') {
            record.priority = hasLow ? 5 : 3;
        }
        
        if (parseInt(record.tg || 0) > 0) record.priority--;
        if (parseInt(record.yt || 0) > 0) record.priority--;
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
    const best = finalList.slice(0, 6);
    // Специальная последняя строка с fm-параметром
    const fmParam = '&fm=7B%22settings%22%3A%7B%22tg%22%3A%22Newspaper%22%2C%22vk%22%3A%22Projector%22%2C%22yt%22%3A%22Television%22%7D';


    const timeForFooter = new Date().toISOString().slice(0, 16).replace('T', ' ');
    let content = header;

    best.forEach(r => {
        const processedSub = processRemark(r.subscription, r);
        content += processedSub + '\n';
    });

    content += `vless://1.1.1.1:443?type=tcp${fmParam}#`;
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
