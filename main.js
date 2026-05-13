/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 1.3.2
 * Date: 13 May 2026
 * 
 * Главный скрипт проверки VPN-серверов с улучшенным определением страны
 */

const fs = require('fs');
const net = require('net');
const { performance } = require('perf_hooks');
const fetch = require('node-fetch');
const { createObjectCsvWriter } = require('csv-writer');
const csvParser = require('csv-parser');

const PING_THRESHOLD = 3000;
const CONCURRENCY = 4;
const MAX_PING_TIME_SECONDS = 10;        // ← Изменено на 10 секунд

const SUBSCRIPTIONS_URL = 'https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/refs/heads/main/Vless-Reality-White-Lists-Rus-Mobile.txt';
const DB_FILE = 'servers-db.csv';
const OUTPUT_FILE = 'best-serv.txt';

const FTP_CONFIG = {
    host: 'name.org',
    port: 21,
    user: 'acc',
    password: 'pass'
};

// ====================== УТИЛИТЫ ======================

async function tcpPing(host, port = 443, timeout = PING_THRESHOLD * 2) {
    return new Promise((resolve) => {
        const start = performance.now();
        const socket = net.createConnection({ host, port }, () => {
            const latency = Math.round(performance.now() - start);
            socket.destroy();
            resolve(latency);
        });

        socket.setTimeout(timeout, () => { socket.destroy(); resolve(-1); });
        socket.on('error', () => resolve(-1));
    });
}

async function pingAll(subscriptions) {
    const startTime = performance.now();
    const results = [];
    let isTimeoutReached = false;
    const queue = [...subscriptions];

    const workers = Array.from({ length: CONCURRENCY }, async () => {
        while (queue.length > 0 && !isTimeoutReached) {
            const sub = queue.shift();
            if (!sub) break;

            const ping = await tcpPing(sub.host, sub.port);
            results.push({ ...sub, localPing: ping });

            if (MAX_PING_TIME_SECONDS > 0) {
                const elapsed = (performance.now() - startTime) / 1000;
                if (elapsed > MAX_PING_TIME_SECONDS) {
                    isTimeoutReached = true;
                    console.log(`⏰ Лимит времени пинга (${MAX_PING_TIME_SECONDS} сек) достигнут. Прерываем оставшиеся проверки.`);
                }
            }
        }
    });

    await Promise.all(workers);
    const totalTime = (performance.now() - startTime).toFixed(0);

    console.log(`⚡ Параллельный пинг завершён за ${totalTime} мс (${CONCURRENCY} потоков)`);
    return { results, totalTime };
}

function extractQuic(line) {
    const match = line.match(/(?<=\/)[^\/@]+(?=@)/);
    return match ? match[0] : null;
}

/** Улучшенное определение страны через RegExp + точные encoded флаги */
function getCountry(remark) {
    const flagMap = {
        '%F0%9F%87%A9%F0%9F%87%AA': 'DE',   // Germany
        '%F0%9F%87%B7%F0%9F%87%BA': 'RU',   // Russia (исправлено)
        '%F0%9F%87%B1%F0%9F%87%B9': 'LT',   // Lithuania
        '%F0%9F%87%B3%F0%9F%87%B1': 'NL',   // Netherlands
        '%F0%9F%87%B5%F0%9F%87%B1': 'PL',   // Poland
        '%F0%9F%87%B1%F0%9F%87%BB': 'LV',   // Latvia
        '%F0%9F%87%B0%F0%9F%87%B7': 'KR',   // South Korea
    };

    // 1. Проверка по точному encoded флагу
    for (const [encoded, code] of Object.entries(flagMap)) {
        if (remark.includes(encoded)) return code;
    }

    // 2. Регулярные выражения как запасной вариант
    if (/🇩🇪|Germany/i.test(remark)) return 'DE';
    if (/🇷🇺|Russia/i.test(remark)) return 'RU';
    if (/🇱🇹|Lithuania/i.test(remark)) return 'LT';
    if (/🇳🇱|Netherlands|The Netherlands/i.test(remark)) return 'NL';
    if (/🇵🇱|Poland/i.test(remark)) return 'PL';
    if (/🇱🇻|Latvia/i.test(remark)) return 'LV';
    if (/🇰🇷|Korea/i.test(remark)) return 'KR';

    return 'EU';   // Если ничего не найдено
}

function parseSubscription(line) {
    try {
        if (!line || line.startsWith('#')) return null;

        const urlPart = line.split('#')[0];
        const url = new URL(urlPart);

        const protocolRaw = url.protocol.replace(':', '').toUpperCase();
        const host = url.hostname;
        const port = parseInt(url.port) || 443;
        const type = url.searchParams.get('type') || '';
        const security = url.searchParams.get('security') || '';
        const sni = url.searchParams.get('sni') || host;

        let protoType = '';
        if (protocolRaw === 'HYSTERIA2') {
            protoType = 'HYSTERIA2+TLS';
        } else if (protocolRaw === 'VLESS' && security === 'reality') {
            if (type === 'tcp') protoType = 'VLESS+TCP+REALITY';
            else if (type === 'xhttp') protoType = 'VLESS+XHTTP+REALITY';
        }

        if (!protoType || sni.toLowerCase().includes('max.ru')) return null;

        const remark = line.split('#').pop() || '';
        const encodedRemark = encodeURIComponent(remark);   // для поиска encoded флагов

        return {
            subscription: line.trim(),
            host,
            port,
            protocol: protoType,
            country: getCountry(encodedRemark),
            cidr: remark.includes('CIDR') ? 1 : 0,
            tg: remark.toLowerCase().includes('tg') ? 1 : 0,
            yt: (remark.toLowerCase().includes('youtube') || remark.toLowerCase().includes('yt')) ? 1 : 0,
            quic: extractQuic(line)
        };
    } catch (e) {
        return null;
    }
}

// ====================== РАБОТА С БАЗОЙ ======================

async function loadDatabase() {
    if (!fs.existsSync(DB_FILE)) {
        const writer = createObjectCsvWriter({
            path: DB_FILE,
            header: [
                { id: 'lastCheck', title: 'lastCheck' },
                { id: 'rating', title: 'rating' },
                { id: 'protocol', title: 'protocol' },
                { id: 'country', title: 'country' },
                { id: 'cidr', title: 'cidr' },
                { id: 'tg', title: 'tg' },
                { id: 'yt', title: 'yt' },
                { id: 'quic', title: 'quic' },
                { id: 'subscription', title: 'subscription' }
            ]
        });
        await writer.writeRecords([]);
        return [];
    }

    return new Promise((resolve, reject) => {
        const records = [];
        fs.createReadStream(DB_FILE)
            .pipe(csvParser())
            .on('data', data => records.push(data))
            .on('end', () => resolve(records))
            .on('error', reject);
    });
}

async function saveDatabase(records) {
    records.sort((a, b) => {
        if (a.lastCheck !== b.lastCheck) return b.lastCheck.localeCompare(a.lastCheck);
        return parseInt(b.rating) - parseInt(a.rating);
    });

    const writer = createObjectCsvWriter({
        path: DB_FILE,
        header: [
            { id: 'lastCheck', title: 'lastCheck' },
            { id: 'rating', title: 'rating' },
            { id: 'protocol', title: 'protocol' },
            { id: 'country', title: 'country' },
            { id: 'cidr', title: 'cidr' },
            { id: 'tg', title: 'tg' },
            { id: 'yt', title: 'yt' },
            { id: 'quic', title: 'quic' },
            { id: 'subscription', title: 'subscription' }
        ]
    });
    await writer.writeRecords(records);
}

// ====================== ОСНОВНАЯ ЛОГИКА ======================

async function main() {
    console.log('🚀 Запуск проверки серверов...\n');

    let text;
    try {
        const res = await fetch(SUBSCRIPTIONS_URL);
        text = await res.text();
    } catch {
        console.error('❌ Нет доступа к файлу подписок.');
        process.exit(1);
    }

    const subscriptions = text.split('\n').map(parseSubscription).filter(Boolean);
    console.log(`✅ Отфильтровано серверов: ${subscriptions.length}`);

    const { results: pingResults, totalTime } = await pingAll(subscriptions);

    let db = await loadDatabase();
    const dbMap = new Map(db.map(r => [r.quic, r]));

    let newCount = 0, updatedCount = 0, checkedCount = 0;

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const timeForFooter = now.toISOString().slice(0, 16).replace('T', ' ');

    for (const sub of pingResults) {
        if (!sub.quic) continue;
        checkedCount++;

        const localPing = sub.localPing;

        if (!dbMap.has(sub.quic)) {
            if (localPing > 0 && localPing < PING_THRESHOLD * 3) {
                dbMap.set(sub.quic, {
                    lastCheck: today,
                    rating: "90",
                    protocol: sub.protocol,
                    country: sub.country,
                    cidr: sub.cidr,
                    tg: sub.tg,
                    yt: sub.yt,
                    quic: sub.quic,
                    subscription: sub.subscription
                });
                newCount++;
            }
            continue;
        }

        const record = dbMap.get(sub.quic);

        if (localPing > 0) record.lastCheck = today;

        if (localPing === -1) {
            record.rating = String(Math.max(0, parseInt(record.rating) - 2));
            updatedCount++;
        } else if (localPing > PING_THRESHOLD) {
            record.rating = String(Math.max(0, parseInt(record.rating) - 1));
            updatedCount++;
        }
    }

    db = Array.from(dbMap.values());
    await saveDatabase(db);

    console.log(`\n📊 Итоги проверки:`);
    console.log(`   Проверено серверов: ${checkedCount}`);
    console.log(`   Новых записей: ${newCount}`);
    console.log(`   Обновлено записей: ${updatedCount}`);
    console.log(`   Время параллельного пинга: ${totalTime} мс`);

    const { createBestServFile } = require('./create-best-serv.js');
    await createBestServFile(db, OUTPUT_FILE, today, timeForFooter);

    if (fs.existsSync(OUTPUT_FILE)) {
        console.log('📤 Загрузка на FTP...');
        const { uploadToFTP } = require('./ftp-upload.js');
        await uploadToFTP(OUTPUT_FILE, FTP_CONFIG);

        fs.unlinkSync(OUTPUT_FILE);
        console.log(`🗑 Файл ${OUTPUT_FILE} удалён`);
    }
}

main().catch(err => console.error('💥 Критическая ошибка:', err));