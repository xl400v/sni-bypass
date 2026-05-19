/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.0.2
 * Date: 14 May 2026
 * 
 * Проверка доступности t.me и youtube.com через Xray-core
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
    TEST_TIMEOUT_MS, 
    CHECK_DELAY_MS 
} = config;

// ====================== УТИЛИТЫ ======================

async function loadDatabase() {
    if (!fs.existsSync(DB_FILE)) {
        console.log('❌ Файл базы данных не найден.');
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
    console.log(`✅ База данных обновлена (${records.length} записей)`);
}

function parseVlessSubscription(subscription) {
    try {
        const urlPart = subscription.split('#')[0];
        const url = new URL(urlPart);

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
        console.error('❌ Ошибка парсинга subscription:', e.message);
        return null;
    }
}

function createXrayConfig(parsed) {
    return {
        log: { loglevel: "none" },
        inbounds: [{
            port: 1080,
            protocol: "socks",
            settings: { udp: true },
            listen: "127.0.0.1"
        }],
        outbounds: [{
            protocol: "vless",
            settings: {
                vnext: [{
                    address: parsed.host,
                    port: parsed.port,
                    users: [{
                        id: parsed.uuid,
                        encryption: "none",
                        flow: parsed.flow
                    }]
                }]
            },
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
    if (!parsed) return 0;

    const xrayConfig = createXrayConfig(parsed);
    fs.writeFileSync(TEMP_CONFIG_PATH, JSON.stringify(xrayConfig, null, 2));

    return new Promise((resolve) => {
        console.log(`   → Запуск Xray для ${site}...`);

        const xrayProcess = spawn(XRAY_PATH, ['run', '-c', TEMP_CONFIG_PATH], {
            stdio: ['ignore', 'ignore', 'pipe']
        });

        const timeout = setTimeout(() => {
            xrayProcess.kill();
            resolve(0);
        }, TEST_TIMEOUT_MS);

        setTimeout(async () => {
            try {
                const { execSync } = require('child_process');
                const output = execSync(
                    `curl -I -s --socks5 127.0.0.1:1080 --max-time 5 https://${site}`,
                    { timeout: 6000 }
                ).toString();

                const success = output.includes('HTTP/') || output.includes('200');
                clearTimeout(timeout);
                xrayProcess.kill();
                resolve(success ? 1 : 0);
            } catch (err) {
                clearTimeout(timeout);
                xrayProcess.kill();
                resolve(0);
            }
        }, 2000);
    });
}

// ====================== MAIN ======================

async function checkTGandYT() {
    console.log('🚀 Запуск проверки t.me и youtube.com через Xray-core...\n');

    let db = await loadDatabase();
    if (db.length === 0) return;

    let updatedCount = 0;

    for (let i = 0; i < db.length; i++) {
        const record = db[i];
        console.log(`[${i+1}/${db.length}] Проверка → ${record.country.padEnd(4)} | ${record.protocol}`);

        const tgResult = await checkSiteThroughXray(record.subscription, 't.me');
        const ytResult = await checkSiteThroughXray(record.subscription, 'youtube.com');

        record.tg = String(tgResult);
        record.yt = String(ytResult);

        updatedCount++;
        await new Promise(r => setTimeout(r, CHECK_DELAY_MS));
    }

    await saveDatabase(db);

    if (fs.existsSync(TEMP_CONFIG_PATH)) fs.unlinkSync(TEMP_CONFIG_PATH);

    console.log(`\n✅ Проверка TG и YT завершена! Обновлено записей: ${updatedCount}`);
}

checkTGandYT().catch(err => {
    console.error('💥 Критическая ошибка:', err);
});

module.exports = { checkTGandYT };
