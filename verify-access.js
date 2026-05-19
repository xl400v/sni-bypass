/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.0.5
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
    TEST_TIMEOUT_MS, 
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

    // Параллельная проверка в 2 потока
    const queue = [...toCheck];
    const workers = Array.from({ length: 2 }, async () => {
        while (queue.length > 0) {
            const record = queue.shift();
            if (!record) break;

            console.log(`Проверка → ${record.country.padEnd(4)} | ${record.protocol}`);

            const [tg, yt] = await Promise.all([
                checkSiteThroughXray(record.subscription, 't.me'),
                checkSiteThroughXray(record.subscription, 'youtube.com')
            ]);

            if (tg.success) {
                record.tg = String(tg.latency);
                record.rating = String(parseInt(record.rating) + 10);
                console.log(`   ✅ t.me   — ${tg.latency} ms`);
            }
            if (yt.success) {
                record.yt = String(yt.latency);
                record.rating = String(parseInt(record.rating) + 10);
                console.log(`   ✅ youtube — ${yt.latency} ms`);
            }
            await new Promise(r => setTimeout(r, CHECK_DELAY_MS));
        }
    });

    await Promise.all(workers);

    await saveDatabase(db);
    if (fs.existsSync(TEMP_CONFIG_PATH)) fs.unlinkSync(TEMP_CONFIG_PATH);

    console.log(`\n✅ Проверка завершена.`);
}

verifyAccess().catch(err => console.error('💥 Ошибка:', err));

module.exports = { verifyAccess };
