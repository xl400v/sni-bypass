/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.2.4
 * Date: 21 May 2026
 */

const fs = require('fs');
const fetch = require('node-fetch');
const { loadDatabase, saveDatabase, extractHostPort } = require('./db-utils');
const config = require('./config');

const { 
    DEFAULT_SUBSCRIPTIONS_URL,
    OUTPUT_FILE, 
    FTP_CONFIG,
    COUNTRY_FLAGS,
    INITIAL_RATING
} = config;

function extractQuic(line) {
    const match = line.match(/(?<=\/\/)[^/@]+(?=@)/);
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
        const sni = url.searchParams.get('sni') || '';

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
            host: `${host}:${port}`,
            protocol: protoType,
            country: getCountry(remark),
            quic: extractQuic(line)
        };
    } catch (e) {
        return null;
    }
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
    const dbMap = new Map(); // ключ = host:port

    // Заполняем карту существующими записями
    db.forEach(record => {
        const hp = extractHostPort(record.subscription);
        if (hp) dbMap.set(hp, record);
    });

    let newCount = 0, updatedCount = 0;
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    for (const sub of newSubscriptions) {
        if (!sub.quic) continue;
        
        let ratingToKeep = String(INITIAL_RATING);
        const existing = dbMap.get(sub.host);

        if (existing) {
            // Сначала проверяем по host:port, затем по quic (как требовалось)
            ratingToKeep = existing.rating;
            updatedCount++;
        } else {
            newCount++;
        }

        const record = {
            lastCheck: today,
            rating: ratingToKeep,
            protocol: sub.protocol,
            country: sub.country,
            tg: "0",
            vkvideo: "0",
            yt: "0",
            quic: dbMap.get(sub.host) ? existing.quic : sub.quic,
            subscription: sub.subscription
        };

        dbMap.set(sub.host, record);
    }

    db = Array.from(dbMap.values());
    await saveDatabase(db);

    console.log(`\n📊 Итоги обработки:`);
    console.log(`   Новых: ${newCount}`);
    console.log(`   Обновлено (рейтинг сохранён): ${updatedCount}`);
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
