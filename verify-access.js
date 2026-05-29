/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.4.3
 * Date: 29 May 2026
 * 
 * Запуск: npm run check   или   node verify-access.js
 */

const fs = require('fs');
const { spawn } = require('child_process');
const config = require('./config');
const { loadDatabase, saveDatabase, extractHostPort } = require('./db-utils');

const { 
    XRAY_PATH, 
    TEMP_CONFIG_PATH, 
    CHECK_DELAY_MS,
    CHECK_TIMEOUT_MS,
    MAX_CONCURRENT,
    INITIAL_RATING,
    CSV_HEADER
} = config;

// ====================== XRAY CONFIG ======================

function createXrayConfig(parsed) {
    const isGrpc = parsed.type === 'grpc';

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
                        flow: parsed.flow || ""
                    }] 
                }] 
            },
            streamSettings: {
                network: parsed.type || "tcp",
                security: parsed.security || "reality",
                ...(isGrpc && {
                    grpcSettings: {
                        serviceName: parsed.serviceName || ""
                    }
                }),
                realitySettings: {
                    serverName: parsed.sni,
                    fingerprint: parsed.fp,
                    shortId: parsed.sid,
                    publicKey: parsed.pbk
                }
            }
        }]
    };
}

/** Парсинг одной строки подписки для xray */
function parseVlessSubscription(line) {
    try {
        const url = new URL(line.split('#')[0]);

        return {
            uuid: url.username,
            host: url.hostname,
            port: parseInt(url.port) || 443,
            type: url.searchParams.get('type') || 'tcp',
            security: url.searchParams.get('security') || 'reality',
            sni: url.searchParams.get('sni') || '',
            fp: url.searchParams.get('fp') || 'chrome',
            flow: url.searchParams.get('flow') || '',
            sid: url.searchParams.get('sid') || '',
            pbk: url.searchParams.get('pbk') || '',
            serviceName: url.searchParams.get('serviceName') || ''
        };
    } catch (err) {
        return null;
    }
}

// ====================== CHECK SITE ======================

async function checkSite(subscription, site) {
    const proc = spawn(XRAY_PATH, ['run', '-c', TEMP_CONFIG_PATH], { 
        stdio: ['ignore', 'ignore', 'pipe'] 
    });

    const parsed = parseVlessSubscription(subscription);
    if (!parsed) {
        proc.kill();
        return { web: site.title, url: site.url, success: 0, latency: delay };
    }

    const cfg = createXrayConfig(parsed);
    fs.writeFileSync(TEMP_CONFIG_PATH, JSON.stringify(cfg, null, 2));

    return new Promise((resolve) => {
        const timeoutId = setTimeout(() => proc.kill(), CHECK_TIMEOUT_MS);

        setTimeout(async () => {
            const start = Date.now();
            try {
                const { execSync } = require('child_process');
                const output = execSync(
                    `curl -I -s --socks5 127.0.0.1:1080 --max-time ${Math.floor(CHECK_TIMEOUT_MS / 1000) - 1} https://${site.url}`,
                    { timeout: CHECK_TIMEOUT_MS }
                ).toString();

                const success = output.includes('HTTP/') || output.includes('200');
                const delay = Date.now() - start;

                proc.kill();
                clearTimeout(timeoutId);
                resolve({ web: site.title, url: site.url, success: success ?? 0, latency: delay });
            } catch (err) {
                proc.kill();
                clearTimeout(timeoutId);
                resolve({ web: site.title, url: site.url, success: 0, latency: 0 });
            }
        }, CHECK_DELAY_MS);
    });
}

// ====================== WORKER ======================

async function checkAllSites(records, today, isStandalone) {
    const results = [];
    const queue = [...records];

    async function worker() {
        while (queue.length > 0) {
            const record = queue.shift();
            const hostPort = extractHostPort(record.subscription);

            let sitesToCheck = CSV_HEADER
                .filter(item => isStandalone ? item.url : item.url && item.id !== 'gk');

            const checkPromises = sitesToCheck.map(site => checkSite(record.subscription, site));
            const checkResults = await Promise.all(checkPromises);

            for (const item of checkResults) {
                if (item.success) {
                    record[item.web] = String(item.latency);
                    record.rating = String(parseInt(record.rating || 0) + 30);
                    console.log(`   ✅ ${item.url} → ${item.latency} ms`);
                } else {
                    record[item.web] = "0";
                    record.rating = String(parseInt(record.rating || 0) - 10);
                    console.log(`   ❌ ${item.url} → fail`);
                }
            }

            record.lastCheck = today;
            results.push(record);
            console.log(`Проверено → ${record.country} | ${hostPort}`);
        }
    }

    const workers = Array.from({ length: MAX_CONCURRENT }, () => worker());
    await Promise.all(workers);

    return results;
}

// ====================== MAIN ======================

async function verifyAccess(db, today, isStandalone = false) {
    const now = new Date();
    const toCheck = isStandalone 
        ? [...db] 
        : db.filter(record => {
            const checkDate = new Date(record.lastCheck);
            checkDate.setDate(checkDate.getDate() + 2);
            return checkDate >= now;
        });

    if (toCheck.length === 0) {
        console.log(`\nℹ️ Нет записей для проверки.\n`);
        return;
    }

    console.log(`🔎 Запущена проверка ${toCheck.length} серверов в ${MAX_CONCURRENT} потоках.`);
    const checkedRecords = await checkAllSites(toCheck, today, isStandalone);
    const recordsToRemove = new Set();
    for (const record of checkedRecords) {
        if (parseInt(record.rating) < 0) {
            console.log(`   🗑 Удаление записи (от сервера нет отклика)`);
            recordsToRemove.add(extractHostPort(record.subscription));
        }
    }

    const finalDb = db.filter(r => !recordsToRemove.has(extractHostPort(r.subscription)));

    await saveDatabase(finalDb);
    await fs.promises.unlink(TEMP_CONFIG_PATH).catch(() => {});

    console.log(`\n✅ Проверка завершена.\n   Осталось записей: ${finalDb.length}\n   Удалено записей: ${recordsToRemove.size}`);
}

// ====================== EXECUTION ======================

if (require.main === module) {
    // Standalone режим
    (async () => {
        console.log('🚀 verify-access.js запущен в standalone режиме\n');
        try {
            const db = await loadDatabase();
            const today = new Date().toISOString().split('T')[0];
            await verifyAccess(db, today, true);
        } catch (err) {
            console.error('💥 Ошибка verify-access.js:\n', err);
            process.exit(1);
        }
    })();
} else {
    // Вызов из main.js
    module.exports = { verifyAccess };
}
