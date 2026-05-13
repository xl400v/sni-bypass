/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 0.1.0
 * Date: 13 May 2026
 * 
 * Скрипт проверки работоспособности VPN-серверов
 */

const fs = require('fs');
const net = require('net');
const { performance } = require('perf_hooks');
const fetch = require('node-fetch');
const { createObjectCsvWriter } = require('csv-writer');
const csvParser = require('csv-parser');
const FTP = require('ftp');

// ====================== КОНФИГУРАЦИЯ ======================
const SUBSCRIPTIONS_URL = 'https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/refs/heads/main/Vless-Reality-White-Lists-Rus-Mobile.txt';

const DB_FILE = 'servers-db.csv';
const OUTPUT_FILE = 'best-serv.txt';

const FTP_CONFIG = {
    host: 'host',
    port: 21,
    user: 'user',
    password: 'pass'
};

const PING_THRESHOLD = 3000;

// ====================== УТИЛИТЫ ======================

/** Простой TCP-ping */
async function tcpPing(host, port = 443, timeout = PING_THRESHOLD) {
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

/** Извлечение quic из строки подписки */
function extractQuic(line) {
    const match = line.match(/(?<=\/)[^\/@]+(?=@)/);
    return match ? match[0] : null;
}

/** Парсинг одной строки подписки */
function parseSubscription(line) {
    try {
        if (!line || line.startsWith('#')) return null;

        const urlPart = line.split('#')[0];
        const url = new URL(urlPart);

        const protocol = url.protocol.replace(':', '').toUpperCase();
        const host = url.hostname;
        const port = parseInt(url.port) || 443;

        const type = url.searchParams.get('type') || '';
        const security = url.searchParams.get('security') || '';
        const sni = url.searchParams.get('sni') || host;

        let protoType = '';
        if (protocol === 'VLESS' && security === 'reality') {
            if (type === 'tcp') protoType = 'VLESS+TCP+REALITY';
            else if (type === 'xhttp') protoType = 'VLESS+XHTTP+REALITY';
        } else if (protocol === 'HYSTERIA2' && security === 'tls') {
            protoType = 'HYSTERIA2+TLS';
        }

        if (!protoType || sni.toLowerCase().includes('max.ru')) return null;

        const remark = line.split('#').pop() || '';
        const countryMatch = remark.match(/🇦🇹|🇫🇮|🇫🇷|🇩🇪|🇷🇺|🇺🇸/);
        const country = countryMatch ? { '🇦🇹':'AT','🇫🇮':'FI','🇫🇷':'FR','🇩🇪':'DE','🇷🇺':'RU','🇺🇸':'US' }[countryMatch[0]] || 'XX' : 'XX';

        return {
            subscription: line.trim(),
            host,
            port,
            protocol: protoType,
            country,
            cidr: remark.includes('CIDR') ? 1 : 0,
            tg: (remark.toLowerCase().includes('tg') ? 1 : 0),
            yt: (remark.toLowerCase().includes('youtube') || remark.toLowerCase().includes('yt') ? 1 : 0),
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
        const csvWriter = createObjectCsvWriter({
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
        await csvWriter.writeRecords([]);
        return [];
    }

    return new Promise((resolve, reject) => {
        const records = [];
        fs.createReadStream(DB_FILE)
            .pipe(csvParser())
            .on('data', (data) => records.push(data))
            .on('end', () => resolve(records))
            .on('error', reject);
    });
}

async function saveDatabase(records) {
    const csvWriter = createObjectCsvWriter({
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
    await csvWriter.writeRecords(records);
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
        console.error('❌ Нет доступа к файлу подписок. Проверьте интернет.');
        process.exit(1);
    }

    const lines = text.split('\n');
    const subscriptions = lines.map(parseSubscription).filter(Boolean);

    console.log(`✅ Отфильтровано подходящих серверов: ${subscriptions.length}`);

    let db = await loadDatabase();
    const dbMap = new Map(db.map(record => [record.quic, record]));

    let newCount = 0;
    let updatedCount = 0;
    let checkedCount = 0;

    const today = new Date().toISOString().split('T')[0];

    for (const sub of subscriptions) {
        if (!sub.quic) continue;
        checkedCount++;

        const localPing = await tcpPing(sub.host, sub.port, PING_THRESHOLD*2);

        if (!dbMap.has(sub.quic)) {
            // 6.1 — Новая запись (только если пинг хороший)
            if (localPing > 0 && localPing < PING_THRESHOLD*2) {
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
                console.log(`✅ Новая запись добавлена → ${sub.host} (${localPing}ms)`);
            }
            continue;
        }

        // 6.2 и 6.3 — Существующая запись
        const record = dbMap.get(sub.quic);
        record.lastCheck = today;

        if (localPing === -1 || localPing > PING_THRESHOLD) {
            record.rating = String(Math.max(0, parseInt(record.rating) - 1));
            updatedCount++;
            console.log(`📉 Рейтинг снижен → ${sub.host} (пинг: ${localPing}ms)`);
        }

        // Удаляем, если рейтинг упал ниже 0
        if (parseInt(record.rating) < 0) {
            dbMap.delete(sub.quic);
            console.log(`🗑 Запись удалена (рейтинг < 0) → ${sub.host}`);
        }
    }

    db = Array.from(dbMap.values());
    await saveDatabase(db);

    console.log(`\n📊 Итоги:`);
    console.log(`   Проверено: ${checkedCount}`);
    console.log(`   Новых: ${newCount}`);
    console.log(`   Обновлено: ${updatedCount}`);

    // ====================== ВЫБОР ЛУЧШИХ 4 ======================
    const best = db
        .sort((a, b) => parseInt(b.rating) - parseInt(a.rating) || new Date(b.lastCheck) - new Date(a.lastCheck))
        .slice(0, 4);

    let outputContent = '#profile-update-interval: 4\n#profile-title: Happ for telegram\n\n';
    best.forEach(rec => outputContent += rec.subscription + '\n');

    fs.writeFileSync(OUTPUT_FILE, outputContent.trim());
    console.log(`\n📄 Файл ${OUTPUT_FILE} создан (${best.length} подписок)`);

    // ====================== FTP ЗАГРУЗКА (node-ftp) ======================
    if (best.length > 0) {
        console.log('📤 Загрузка файла на FTP...');

        const client = new FTP();

        client.on('ready', () => {
            client.put(OUTPUT_FILE, `/${FTP_CONFIG.host}/happ.su/${OUTPUT_FILE}`, (err) => {
                if (err) {
                    console.error('❌ Ошибка загрузки на FTP:', err);
                } else {
                    console.log('✅ Файл успешно загружен на FTP');
                }
                client.end();
            });
        });

        client.on('error', (err) => {
            console.error('❌ FTP ошибка:', err);
        });

        client.connect(FTP_CONFIG);
    }
}

main().catch(err => {
    console.error('💥 Критическая ошибка:', err);
});
