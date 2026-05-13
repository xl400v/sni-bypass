/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 1.1.0
 * Date: 13 May 2026
 * 
 * Главный скрипт проверки VPN-серверов
 */

const fs = require('fs');
const net = require('net');
const { performance } = require('perf_hooks');
const fetch = require('node-fetch');
const { createObjectCsvWriter } = require('csv-writer');
const csvParser = require('csv-parser');

// ====================== КОНФИГУРАЦИЯ ======================
const SUBSCRIPTIONS_URL = 'https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/refs/heads/main/Vless-Reality-White-Lists-Rus-Mobile.txt';

const DB_FILE = 'servers-db.csv';
const OUTPUT_FILE = 'best-serv.txt';

const PING_THRESHOLD = 3000;

const FTP_CONFIG = {
    host: 'host',
    port: 21,
    user: 'user',
    password: 'pass'
};

// ====================== УТИЛИТЫ ======================

/** TCP Ping */
async function tcpPing(host, port = 443, timeout = PING_THRESHOLD * 2) {
    return new Promise((resolve) => {
        const start = performance.now();
        const socket = net.createConnection({ host, port }, () => {
            const latency = Math.round(performance.now() - start);
            socket.destroy();
            resolve(latency);
        });

        socket.setTimeout(timeout, () => {
            socket.destroy();
            resolve(-1);
        });

        socket.on('error', () => resolve(-1));
    });
}

/** Извлечение quic */
function extractQuic(line) {
    const match = line.match(/(?<=\/)[^\/@]+(?=@)/);
    return match ? match[0] : null;
}

/** Парсинг подписки */
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
            if (type === 'tcp') protoType = 'VLESS+REALITY';
            else if (type === 'xhttp') protoType = 'VLESS+XHTTP+REALITY';
        }

        if (!protoType || sni.toLowerCase().includes('max.ru')) return null;

        const remark = line.split('#').pop() || '';
        const countryMatch = remark.match(/🇦🇹|🇫🇮|🇫🇷|🇩🇪|🇷🇺|🇺🇸/);
        const countryMap = { '🇦🇹':'AT', '🇫🇮':'FI', '🇫🇷':'FR', '🇩🇪':'DE', '🇷🇺':'RU', '🇺🇸':'US' };
        const country = countryMatch ? countryMap[countryMatch[0]] || 'XX' : 'XX';

        return {
            subscription: line.trim(),
            host,
            port,
            protocol: protoType,
            country,
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
        console.log('📁 Создаём новую базу данных...');
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
        if (!res.ok) throw new Error();
        text = await res.text();
    } catch {
        console.error('❌ Нет доступа к файлу подписок.');
        process.exit(1);
    }

    const lines = text.split('\n');
    const subscriptions = lines.map(parseSubscription).filter(Boolean);

    console.log(`✅ Отфильтровано серверов: ${subscriptions.length}`);

    let db = await loadDatabase();
    const dbMap = new Map(db.map(r => [r.quic, r]));

    let newCount = 0;
    let updatedCount = 0;
    let checkedCount = 0;

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentDateStr = `${day}/${month} ${hours}:${minutes}`;
    const today = new Date().toISOString().split('T')[0];
    for (const sub of subscriptions) {
        if (!sub.quic) continue;
        checkedCount++;

        const localPing = await tcpPing(sub.host, sub.port, PING_THRESHOLD * 2);

        if (!dbMap.has(sub.quic)) {
            // Новая запись
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

        // Обновление существующей записи
        const record = dbMap.get(sub.quic);

        if (localPing > 0) {
            record.lastCheck = today;        // обновляем дату только при успешном пинге
        }

        if (localPing === -1 || localPing > PING_THRESHOLD) {
            record.rating = String(Math.max(0, parseInt(record.rating) - 1));
            updatedCount++;
        }

        if (parseInt(record.rating) < 0) {
            dbMap.delete(sub.quic);
        }
    }

    db = Array.from(dbMap.values());
    await saveDatabase(db);

    console.log(`\n📊 Итоги проверки:`);
    console.log(`   Проверено: ${checkedCount}`);
    console.log(`   Новых: ${newCount}`);
    console.log(`   Обновлено: ${updatedCount}`);

    // ====================== Формирование best-serv.txt ======================
    const best = db
        .sort((a, b) => parseInt(b.rating) - parseInt(a.rating) || 
                       new Date(b.lastCheck.split(' ')[0].split('/').reverse().join('-') + ' ' + b.lastCheck.split(' ')[1]) - 
                       new Date(a.lastCheck.split(' ')[0].split('/').reverse().join('-') + ' ' + a.lastCheck.split(' ')[1]))
        .slice(0, 4);

    const header = `#profile-title: 🧢 TPL Free ${currentDateStr}\n` +
                   `#profile-update-interval: 1\n` +
                   `#support-url: https://t.me/+cnBIozEwEzpkYzQy\n` +
                   `#hide-settings: 0\n\n`;

    let outputContent = header;
    best.forEach(rec => outputContent += rec.subscription + '\n');

    fs.writeFileSync(OUTPUT_FILE, outputContent.trim());
    console.log(`\n📄 Файл ${OUTPUT_FILE} успешно создан (${best.length} подписок)`);

    // ====================== Запуск FTP загрузки ======================
    if (best.length > 0) {
        console.log('📤 Запуск загрузки на FTP...');
        const { uploadToFTP } = require('./ftp-upload.js');
        await uploadToFTP(OUTPUT_FILE, FTP_CONFIG);
    } else {
        console.log('⚠️ Нет серверов для загрузки на FTP.');
    }
}

main().catch(err => console.error('💥 Ошибка:', err));
