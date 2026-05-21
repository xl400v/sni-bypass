/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.1.5
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
    CSV_HEADER,
    CHECK_SITES
} = config;

// ====================== УТИЛИТЫ ======================

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
        const host = url.hostname;
        const port = parseInt(url.port) || 443;
        const type = url.searchParams.get('type') || '';
        const security = url.searchParams.get('security') || '';
        const sni = url.searchParams.get('sni') || host;

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
            host,
            port,
            protocol: protoType,
            country: getCountry(remark),
            cidr: remark.includes('CIDR') ? 1 : 0,
            tg: 0,
            vkvideo: 0,
            yt: 0,
            quic: extractQuic(line)
        };
    } catch (e) {
        return null;
    }
}

// ====================== БАЗА ======================

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
        return parseInt(b.rating) - parseInt(a.rating);
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

    const subscriptions = text.split('\n').map(parseSubscription).filter(Boolean);
    console.log(`✅ Отфильтровано серверов: ${subscriptions.length}`);

    let db = await loadDatabase();
    const dbMap = new Map(db.map(r => [r.quic, r]));

    let newCount = 0, updatedCount = 0;

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    for (const sub of subscriptions) {
        if (!sub.quic) continue;

        if (!dbMap.has(sub.quic)) {
            dbMap.set(sub.quic, {
                lastCheck: today,
                rating: String(INITIAL_RATING),
                protocol: sub.protocol,
                country: sub.country,
                cidr: sub.cidr,
                tg: 0,
                vkvideo: 0,
                yt: 0,
                quic: sub.quic,
                subscription: sub.subscription
            });
            newCount++;
        } else {
            const existing = dbMap.get(sub.quic);
            existing.lastCheck = today;
            // Обнуляем результаты проверок при обновлении
            existing.tg = "0";
            existing.vkvideo = "0";
            existing.yt = "0";
            updatedCount++;
        }
    }

    db = Array.from(dbMap.values());
    await saveDatabase(db);

    console.log(`\n📊 Итоги обработки:`);
    console.log(`   Новых: ${newCount}`);
    console.log(`   Обновлено: ${updatedCount}`);

    if (verifyMode) {
        try {
            const { verifyAccess } = require('./verify-access.js');
            await verifyAccess(db, today);   // вызываем как модуль (без standalone-режима)
        } catch (e) {
            console.error('❌ Ошибка при выполнении проверки:', e.message);
        }
    }

    try {
        const { createBestServFile } = require('./create-best-serv.js');
        await createBestServFile(db, OUTPUT_FILE, today);

        // ... (FTP часть без изменений)
        try {
            await fs.promises.access(OUTPUT_FILE);
            console.log('📤 Загрузка на FTP...');
            const { uploadToFTP } = require('./ftp-upload.js');
            await uploadToFTP(OUTPUT_FILE, FTP_CONFIG);

            await fs.promises.unlink(OUTPUT_FILE);
            console.log(`🗑 Файл ${OUTPUT_FILE} удалён`);
        } catch (e) {
            if (e.code === 'ENOENT') {
                console.warn(`⚠️ Файл ${OUTPUT_FILE} не найден`);
            }
        }
    } catch (err) {
        console.error('❌ Ошибка при создании best-serv или загрузке:', err.message);
    }
}

main().catch(err => console.error('💥 Ошибка:', err));
