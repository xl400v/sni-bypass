/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.0.8
 * Date: 19 May 2026
 */

const fs = require('fs');
const { spawn } = require('child_process');
const { createObjectCsvWriter } = require('csv-writer');
const csvParser = require('csv-parser');
const config = require('./config');

const { 
    DB_FILE, 
    XRAY_PATH, 
    TEMP_CONFIG_PATH, 
    CHECK_DELAY_MS 
} = config;

async function loadDatabase() {
    if (!fs.existsSync(DB_FILE)) return [];
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
    const writer = createObjectCsvWriter({ path: DB_FILE, header: config.CSV_HEADER });
    await writer.writeRecords(records);
}

function extractHostPort(subscription) {
    try {
        const urlPart = subscription.split('#')[0];
        const atIndex = urlPart.indexOf('@');
        const questionIndex = urlPart.indexOf('?');
        if (atIndex === -1 || questionIndex === -1) return 'unknown';
        return urlPart.substring(atIndex + 1, questionIndex);
    } catch (e) {
        return 'unknown';
    }
}

function parseVlessSubscription(sub) {
    try {
        const url = new URL(sub.split('#')[0]);
        return {
            uuid: url.username,
            host: url.hostname,
            port: parseInt(url.port) || 443,
            type: url.searchParams.get('type') || 'tcp',
            security: url.searchParams.get('security') || 'reality',
            sni: url.searchParams.get('sni') || url.hostname,
            pbk: url.searchParams.get('pbk'),
            fp: url.searchParams.get('fp') || 'chrome',
            flow: url.searchParams.get('flow') || '',
            sid: url.searchParams.get('sid') || ''
        };
    } catch (e) {
        return null;
    }
}

function createXrayConfig(parsed) {
    return {
        log: { loglevel: "none" },
        inbounds: [{ port: 1080, protocol: "socks", settings: { udp: true }, listen: "127.0.0.1" }],
        outbounds: [{
            protocol: "vless",
            settings: { vnext: [{ address: parsed.host, port: parsed.port, users: [{ id: parsed.uuid, encryption: "none", flow: parsed.flow }] }] },
            streamSettings: {
                network: parsed.type,
                security: parsed.security,
                realitySettings: {
                    serverName: parsed.sni,
                    fingerprint: parsed.fp,
                    shortId: parsed.sid,
                    publicKey: parsed.pbk || ""
                }
            }
        }]
    };
}

async function checkSiteThroughXray(subscription, site) {
    const parsed = parseVlessSubscription(subscription);
    if (!parsed) return { success: 0, latency: 0 };

    const cfg = createXrayConfig(parsed);
    fs.writeFileSync(TEMP_CONFIG_PATH, JSON.stringify(cfg, null, 2));

    return new Promise((resolve) => {
        const start = Date.now();
        const proc = spawn(XRAY_PATH, ['run', '-c', TEMP_CONFIG_PATH], { stdio: ['ignore', 'ignore', 'pipe'] });

        setTimeout(async () => {
            try {
                const { execSync } = require('child_process');
                const output = execSync(`curl -I -s --socks5 127.0.0.1:1080 --max-time 5 https://${site}`, { timeout: 6000 }).toString();
                const success = output.includes('HTTP/') || output.includes('200');
                const latency = Date.now() - start;
                proc.kill();
                resolve({ success: success ? 1 : 0, latency });
            } catch {
                proc.kill();
                resolve({ success: 0, latency: 0 });
            }
        }, 1800);
    });
}

async function verifyAccess() {
    console.log('🚀 Запуск проверки t.me и youtube.com...\n');

    let db = await loadDatabase();
    const today = new Date().toISOString().split('T')[0];

    const toCheck = db.filter(r => r.lastCheck === today && parseInt(r.rating) === 70);

    console.log(`Найдено записей для проверки: ${toCheck.length}\n`);

    for (const record of toCheck) {
        const hostPort = extractHostPort(record.subscription);
        console.log(`Проверка → ${record.country.padEnd(4)} | ${hostPort}`);

        // Проверяем оба сайта последовательно
        const tgResult = await checkSiteThroughXray(record.subscription, 't.me');
        const ytResult = await checkSiteThroughXray(record.subscription, 'youtube.com');

        // Обновляем базу
        if (tgResult.success) {
            record.tg = String(tgResult.latency);
            record.rating = String(parseInt(record.rating) + 10);
            console.log(`   ✅ t.me   — ${tgResult.latency} ms`);
        } else {
            record.tg = "0";
            console.log(`   ❌ t.me   — недоступен`);
        }

        if (ytResult.success) {
            record.yt = String(ytResult.latency);
            record.rating = String(parseInt(record.rating) + 10);
            console.log(`   ✅ youtube — ${ytResult.latency} ms`);
        } else {
            record.yt = "0";
            console.log(`   ❌ youtube — недоступен`);
        }

        await new Promise(r => setTimeout(r, CHECK_DELAY_MS));
    }

    await saveDatabase(db);

    if (fs.existsSync(TEMP_CONFIG_PATH)) fs.unlinkSync(TEMP_CONFIG_PATH);

    console.log(`\n✅ Проверка завершена.`);
}

verifyAccess().catch(err => console.error('💥 Ошибка:', err));

module.exports = { verifyAccess };
