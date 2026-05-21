/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.2.2
 * Date: 21 May 2026
 */

const fs = require('fs');
const fetch = require('node-fetch');
const { createObjectCsvWriter } = require('csv-writer');
const csvParser = require('csv-parser');
const config = require('./config');

const { 
    DEFAULT_SUBSCRIPTIONS_URL,
    DB_FILE, 
    OUTPUT_FILE, 
    FTP_CONFIG,
    COUNTRY_FLAGS,
    INITIAL_RATING,
    CSV_HEADER
} = config;

function extractQuic(line) {
    const match = line.match(/(?<=\/)[^\/@]+(?=@)/);
    return match ? match[0] : null;
}

function getCountry(remark) {
    if (!remark) return 'EU';
    for (const [encodedFlag, code] of Object.entries(COUNTRY_FLAGS)) {
        if (remark.includes(encodedFlag)) return code;
    }
    return 'EU';
}

function parseSubscription(line) {
    try {
        if (!line || line.startsWith('#')) return null;

        const urlPart = line.split('#')[0];
        const url = new URL(urlPart);

        const protocolRaw = url.protocol.replace(':', '').toUpperCase();
        const type = url.searchParams.get('type') || '';
        const security = url.searchParams.get('security') || '';
        const sni = url.searchParams.get('sni') || url.hostname;

        let protoType = '';
        if (protocolRaw === 'HYSTERIA2') protoType = 'HYSTERIA2+TLS';
        else if (protocolRaw === 'VLESS' && security === 'reality') {
            if (type === 'tcp') protoType = 'VLESS+TCP+REALITY';
            else if (type === 'xhttp') protoType = 'VLESS+XHTTP+REALITY';
        }

        if (!protoType || sni.toLowerCase().includes('max.ru')) return null;

        const remark = line.split('#').pop() || '';

        return {
            subscription: line.trim(),
            protocol: protoType,
            country: getCountry(remark),
            quic: extractQuic(line)
        };
    } catch (e) {
        return null;
    }
}

// ====================== DATABASE ======================

async function loadDatabase() {
    if (!fs.existsSync(DB_FILE)) {
        const writer = createObjectCsvWriter({ path: DB_FILE, header: CSV_HEADER });
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
        if (parseInt(b.rating) !== parseInt(a.rating)) return parseInt(b.rating) - parseInt(a.rating);
        return parseInt(a.vkvideo || 9999) - parseInt(b.vkvideo || 9999);
    });

    const writer = createObjectCsvWriter({ path: DB_FILE, header: CSV_HEADER });
    await writer.writeRecords(records);
}

// ====================== MAIN ======================

async function main() {
    const args = process.argv.slice(2);
    const verifyMode = args.includes('--verify') || args.includes('-c');
    const customUrl = args.find(arg => arg.startsWith('http'));

    const url = customUrl || DEFAULT_SUBSCRIPTIONS_URL;

    console.log(`🚀 Запуск обработки серверов...`);
    console.log(`   Источник: ${url}`);

    let text;
    try {
        const res = await fetch(url);
        text = await res.text();
    } catch (e) {
        console.error('❌ Нет доступа к файлу подписок.');
        process.exit(1);
    }

    const newSubscriptions = text.split('\n').map(parseSubscription).filter(Boolean);
    console.log(`✅ Отфильтровано серверов из источника: ${newSubscriptions.length}`);

    let db = await loadDatabase();
    const dbMap = new Map(db.map(record => [record.quic, record])); // ключ — quic

    let newCount = 0, updatedCount = 0;
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    for (const sub of newSubscriptions) {
        if (!sub.quic) continue;

        const existing = dbMap.get(sub.quic);

        if (existing) {
            // Обновляем данные из источника, сохраняем rating и результаты проверок
            existing.lastCheck = today;
            existing.subscription = sub.subscription;
            existing.protocol = sub.protocol;
            existing.country = sub.country;
            updatedCount++;
        } else {
            // Новая запись
            dbMap.set(sub.quic, {
                lastCheck: today,
                rating: String(INITIAL_RATING),
                protocol: sub.protocol,
                country: sub.country,
                tg: "0",
                vkvideo: "0",
                yt: "0",
                quic: sub.quic,
                subscription: sub.subscription
            });
            newCount++;
        }
    }

    db = Array.from(dbMap.values());
    await saveDatabase(db);

    console.log(`\n📊 Итоги обработки:`);
    console.log(`   Новых: ${newCount}`);
    console.log(`   Обновлено: ${updatedCount}`);
    console.log(`   Всего в базе: ${db.length}`);

    if (verifyMode) {
        try {
            const { verifyAccess } = require('./verify-access.js');
            await verifyAccess(db, today);
        } catch (e) {
            console.error('❌ Ошибка при выполнении проверки:', e.message);
        }
    }

    try {
        const { createBestServFile } = require('./create-best-serv.js');
        await createBestServFile(db, OUTPUT_FILE, today);

        if (fs.existsSync(OUTPUT_FILE)) {
            console.log('📤 Загрузка на FTP...');
            const { uploadToFTP } = require('./ftp-upload.js');
            await uploadToFTP(OUTPUT_FILE, FTP_CONFIG);

            await fs.promises.unlink(OUTPUT_FILE);
            console.log(`🗑 Файл ${OUTPUT_FILE} удалён`);
        }
    } catch (err) {
        console.error('❌ Ошибка при создании best-serv или загрузке:', err.message);
    }
}

main().catch(err => console.error('💥 Ошибка:', err));
