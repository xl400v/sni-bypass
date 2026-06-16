/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.4.6
 * Date: 16 June 2026
 */

const fs = require('fs');
const fetch = require('node-fetch');
const { loadDatabase, saveDatabase, extractHostPort } = require('./db-utils');
const config = require('./config');

const { 
    OUTPUT_FILE, 
    FTP_CONFIG,
    INITIAL_RATING,
    DEFAULT_SUBSCRIPTIONS_URL,
    COUNTRY_FLAGS,
    CSV_HEADER
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

/** Основная функция парсинга (объединённая и улучшенная) */
function parseSubscription(line) {
    try {
        if (!line || line.startsWith('#')) return null;

        const urlPart = line.split('#')[0];
        const url = new URL(urlPart);

        const fragment = url.searchParams.get('fm') || '';
        const protocolRaw = url.protocol.replace(':', '').toUpperCase();
        const type = url.searchParams.get('type') || '';
        const security = url.searchParams.get('security') || '';
        const sni = url.searchParams.get('sni') || '';

        let protoType = '';
        if (protocolRaw === 'HYSTERIA2') protoType = 'HYSTERIA2+TLS';
        else if (protocolRaw === 'VLESS' && security === 'reality') {
            if (type === 'xhttp') protoType = 'VLESS+XHTTP+REALITY';
            else if (type === 'grpc') protoType = 'VLESS+GRPC+REALITY';
            else protoType = 'VLESS+TCP+REALITY';
        }

        if (!protoType || fragment || sni.toLowerCase().includes('max.ru')) return null;

        const remark = line.split('#').pop() || '';

        return {
            subscription: line.trim(),
            hostPort: `${url.hostname}:${parseInt(url.port) || 443}`,
            quic: extractQuic(line),
            protocol: protoType,
            country: getCountry(remark)
        };
    } catch (err) {
        return null;
    }
}

// ====================== MAIN ======================

async function main() {
    const args = process.argv.slice(2);
    const verifyMode = args.includes('-c');
    const fullVerifyMode = args.includes('--verify') || args.includes('-v');
    const customUrl = args.find(arg => arg.startsWith('http'));

    const url = customUrl || DEFAULT_SUBSCRIPTIONS_URL;

    console.log(`🚀 Запуск обработки серверов...`);
    console.log(`   Источник: ${url}`);

    let text;
    try {
        const res = await fetch(url);
        text = await res.text();
    } catch (err) {
        console.error('❌ Нет доступа к файлу подписок.');
        process.exit(1);
    }

    const newSubscriptions = text.split('\n').map(parseSubscription).filter(Boolean);
    console.log(`✅ Отфильтровано серверов из источника: ${newSubscriptions.length}`);

    let newCount = 0, updatedCount = 0;
    let db = await loadDatabase();
    const today = new Date().toISOString().split('T')[0];
    const dbMap = new Map(
        db.map(record => [extractHostPort(record.subscription), record])
    );

    for (const sub of newSubscriptions) {
        if (!sub.quic) continue;

        let gkToKeep = 0, tgToKeep = 0, ytToKeep = 0;
        let ratingToKeep = parseInt(INITIAL_RATING, 10);
        // Проверка дедубликации
        let existing = [...dbMap.values()].find(r => {
            const hp = extractHostPort(r.subscription);
            return hp === sub.hostPort || r.quic === sub.quic
        });

        if (existing) {
            ratingToKeep = existing.rating;
            gkToKeep = existing.grok;
            tgToKeep = existing.telegram;
            ytToKeep = existing.youtube;
            if (existing.quic !== sub.quic) {
                ratingToKeep = Math.floor(INITIAL_RATING / 3 * 2);
                
        //       console.log("   🧲", sub.quic.padEnd(36), sub.hostPort);
            }
            updatedCount++;
        } else {
            const quics = newSubscriptions.filter(i => i.quic === sub.quic);
            if (quics.length > 1) ratingToKeep = Math.floor(INITIAL_RATING / 3 * 2);
            
        //    console.log(`   ${quics.length} `, sub.quic.padEnd(36), sub.hostPort);
            newCount++;
        }

        const record = {
            lastCheck: existing ? existing.lastCheck : today,
            rating: ratingToKeep,
            protocol: sub.protocol,
            country: sub.country,
            grok: gkToKeep || 0,
            telegram: tgToKeep || 0,
            youtube: ytToKeep || 0,
            quic: sub.quic,
            subscription: sub.subscription
        };

        dbMap.set(sub.hostPort, record);
    }

    db = Array.from(dbMap.values());
    await saveDatabase(db);

    console.log(`\n📊 Итоги обработки:`);
    console.log(`   Найдено:         ${updatedCount}`);
    console.log(`   Добавлено новых: ${newCount}`);
    console.log(`   Всего в базе:    ${db.length}`);

    if (verifyMode || fullVerifyMode) {
        if (fullVerifyMode) fullVerifyMode === true;
        try {
            const { verifyAccess } = require('./verify-access.js');
            console.log(`🚀 Запуск проверки ${CSV_HEADER.find(item => item.id === 'tg').url}...\n`);
            await verifyAccess(db, today, fullVerifyMode);
        } catch (err) {
            console.error('❌ Ошибка при выполнении проверки:\n', err);
        }
    }

    // Создание best-serv и FTP (без изменений)
    try {
        const { createBestServFile } = require('./create-best-serv.js');
        await createBestServFile(db, OUTPUT_FILE, today);

        if (fs.existsSync(OUTPUT_FILE)) {
            console.log('📤 Загрузка на FTP...');
            const { uploadToFTP } = require('./ftp-upload.js');
            await uploadToFTP(OUTPUT_FILE, FTP_CONFIG);
            await fs.promises.unlink(OUTPUT_FILE);
            console.log(` 🗑 Файл ${OUTPUT_FILE} удалён`);
        }
    } catch (err) {
        console.error('❌ Ошибка при создании best-serv или загрузке по ftp:\n', err);
    }
}

main().catch(err => console.error('💥 Ошибка main.js:\n', err));
