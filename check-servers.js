/** Код создан в ассистенте GROK3 */
const fs = require('fs');
const net = require('net');
const { performance } = require('perf_hooks');
const fetch = require('node-fetch');
const { createObjectCsvWriter } = require('csv-writer');
const csvParser = require('csv-parser');
const FTPClient = require('ftp-client');

// ====================== КОНФИГУРАЦИЯ ======================

const SUBSCRIPTIONS_URL = 'https://raw.githubusercontent.com/igareck/vpn-configs-for-russia/refs/heads/main/Vless-Reality-White-Lists-Rus-Mobile.txt';

const PINGOUT = 3000;
const DB_FILE = 'servers-db.csv';
const OUTPUT_FILE = 'best-serv.txt';

const FTP_CONFIG = {
    host: 'host',
    port: 21,
    user: 'user',
    password: 'pass'
};

// ====================== УТИЛИТЫ ======================

/** Простой TCP-ping (время до установления соединения) */
async function tcpPing(host, port = 443, timeout = PINGOUT) {
    return new Promise((resolve) => {
        const start = performance.now();
        const socket = net.createConnection({ host, port }, () => {
            const latency = Math.round(performance.now() - start);
            socket.destroy();
            resolve(latency);
        });

        socket.setTimeout(timeout, () => {
            socket.destroy();
            resolve(-1); // таймаут = недоступен
        });

        socket.on('error', () => {
            resolve(-1);
        });
    });
}

/** Парсинг одной строки подписки */
function parseSubscription(line) {
    try {
        if (!line || line.startsWith('#')) return null;

        const quic = line.match(/(?<=\/)[^\/@]+(?=@)/); // не может быть пустым
        const url = new URL(line.split('#')[0]); // отрезаем комментарий

        const protocol = url.protocol.replace(':', '').toUpperCase();
        const host = url.hostname;
        const port = parseInt(url.port) || (protocol === 'VLESS' ? 443 : 443);

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

        if (!protoType) return null;

        // Исключаем SNI=MAX.RU (регистронезависимо)
        if (sni.toLowerCase().includes('max.ru')) return null;

        // Определяем флаги из названия
        const remark = line.split('#').pop() || '';
        const isCIDR = remark.includes('CIDR') ? 1 : 0;
        const isTG = remark.toLowerCase().includes('tg') || false;
        const isYT = remark.toLowerCase().includes('youtube') || remark.toLowerCase().includes('yt') || false;

        // Страна (alpha-2) — грубо из эмодзи или названия
        const countryMatch = remark.match(/🇦🇹|🇫🇮|🇫🇷|🇩🇪|🇷🇺|🇺🇸/);
        let country = 'XX';
        if (countryMatch) {
            const map = { '🇦🇹': 'AT', '🇫🇮': 'FI', '🇫🇷': 'FR', '🇩🇪': 'DE', '🇷🇺': 'RU', '🇺🇸': 'US' };
            country = map[countryMatch[0]] || 'XX';
        }

        return {
            subscription: line.trim(),
            host,
            port,
            protocol: protoType,
            sni,
            quic: quic,
            country,
            cidr: isCIDR,
            tg: isTG ? 1 : 0,
            yt: isYT ? 1 : 0
        };
    } catch (e) {
        return null;
    }
}

/** Загрузка и фильтрация подписок */
async function loadAndFilterSubscriptions() {
    let text;
    try {
        const res = await fetch(SUBSCRIPTIONS_URL);
        if (!res.ok) throw new Error('Network error');
        text = await res.text();
    } catch (err) {
        console.error('❌ Нет доступа к файлу подписок. Проверьте интернет.');
        process.exit(1);
    }

    const lines = text.split('\n');
    const filtered = [];

    for (const line of lines) {
        // Парсинг одной строки подписки
        const parsed = parseSubscription(line);
        if (parsed) filtered.push(parsed);
    }

    console.log(`✅ Загружено и отфильтровано ${filtered.length} подходящих серверов (VLESS + REALITY / HYSTERIA2 + TLS)`);
    return filtered;
}

// ====================== РАБОТА С БАЗОЙ ======================

/** Создание базы данных */
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

    return new Promise((resolve) => {
        const records = [];
        fs.createReadStream(DB_FILE)
            .pipe(csvParser())
            .on('data', (data) => records.push(data))
            .on('end', () => resolve(records));
    });
}
 /** Заполение базы данных */
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
        ],
        append: false
    });
    await csvWriter.writeRecords(records);
}

// ====================== ОСНОВНАЯ ЛОГИКА ======================

async function main() {
    console.log('🚀 Запуск проверки серверов...\n');

    // Загрузка и фильтрация подписок
    const subscriptions = await loadAndFilterSubscriptions();

    // Создание базы данных
    let db = await loadDatabase();
    const dbMap = new Map(db.map(record => [record.quic, record]));

    let newCount = 0, updatedCount = 0, checkedCount = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const sub of subscriptions) {
        checkedCount++;

        // Простой TCP-ping (время до установления соединения)
        const localPing = await tcpPing(sub.host, sub.port, PINGOUT);

        // 6.1 — новая запись
        if (!dbMap.has(sub.quic)) {
            if (localPing < PINGOUT) {
                dbMap.set(sub.quic, {
                    lastCheck: today,
                    rating: 90,
                    protocol: sub.protocol,
                    country: sub.country,
                    cidr: sub.cidr,
                    tg: sub.tg,
                    yt: sub.yt,
                    quic: sub.quic,
                    subscription: sub.subscription
                });
                newCount++;
                console.log(`✅ Новая запись: ${sub.host} (${localPing}ms)`);
            }
            continue;
        }

        // 6.2 — обновление существующей
        const record = dbMap.get(sub.quic);
        record.lastCheck = today;

        if (localPing === -1) {
            record.rating = Math.max(0, parseInt(record.rating) - 1);
            updatedCount++;
        } else {
            // можно добавить логику повышения рейтинга, если хочешь
        }

        // 6.3 — удаление при низком рейтинге
        if (parseInt(record.rating) < 0) {
            dbMap.delete(sub.quic);
            console.log(`🗑 Удалена запись: ${sub.host} (рейтинг < 0)`);
        }
    }

    db = Array.from(dbMap.values());
    // Заполение базы данных
    await saveDatabase(db);

    console.log(`\n📊 Итоги проверки:`);
    console.log(`   Проверено серверов: ${checkedCount}`);
    console.log(`   Новых записей: ${newCount}`);
    console.log(`   Обновлено записей: ${updatedCount}`);

    // ====================== ВЫБОР ЛУЧШИХ 4 ======================
    const best = db
        .sort((a, b) => {
            const ratingDiff = parseInt(b.rating) - parseInt(a.rating);
            if (ratingDiff !== 0) return ratingDiff;
            return new Date(b.lastCheck) - new Date(a.lastCheck);
        })
        .slice(0, 4);

    // Создаём выходной файл
    let outputContent = '#profile-update-interval: 4\n#profile-title: Happ for telegram\n\n'; // как требовалось
    best.forEach(record => {
        outputContent += record.subscription + '\n';
    });

    fs.writeFileSync(OUTPUT_FILE, outputContent.trim());
    console.log(`\n📄 Создан файл ${OUTPUT_FILE} с ${best.length} лучшими подписками.`);

    // ====================== FTP ЗАГРУЗКА ======================
    if (best.length > 0) {
        console.log('📤 Отправка файла на FTP...');
        const client = new FTPClient(FTP_CONFIG, {
            logging: 'basic'
        });
        ////console.log('Доступные методы:', Object.keys(FTPClient.prototype));
        
        client.connect(() => {
            client.upload([OUTPUT_FILE], `/${FTP_CONFIG.host}/happ.su/`, {
                overwrite: 'true'
            }, (result) => {
                if (result) {
                    console.log('✅ Файл успешно загружен на FTP');
                } else {
                    console.error('❌ Ошибка при загрузке на FTP');
                }
        ////        client.disconnect();
            });
        });
    }
}

main().catch(console.error);
