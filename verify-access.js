/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.4.2
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
    CSV_HEADER,
    CHECK_DELAY_MS
} = config;

// ====================== УТИЛИТЫ ======================

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
            pbk: url.searchParams.get('pbk') || ''
        };
    } catch (err) {
        return null;
    }
}

async function checkSite(subscription, site) {
    const proc = spawn(XRAY_PATH, ['run', '-c', TEMP_CONFIG_PATH], { 
        stdio: ['ignore', 'ignore', 'pipe'] 
    });
    const parsed = parseVlessSubscription(subscription);
    const cfg = createXrayConfig(parsed);
    if (!parsed) {
        return { web: site.title, url: site.url, success: 0, latency: 0 };
    }
    fs.writeFileSync(TEMP_CONFIG_PATH, JSON.stringify(cfg, null, 2));

    return new Promise((resolve) => {
        const start = Date.now();

        setTimeout(async () => {
            try {
                const { execSync } = require('child_process');
                const output = execSync(
                    `curl -I -s --socks5 127.0.0.1:1080 ` +
                    `--max-time ${9 + (site.id === 'yt' ? -1 : -3)} https://${site.url}`,
                    { timeout: CHECK_DELAY_MS * 4 }
                ).toString();

                const success = output.includes('HTTP/') || output.includes('200');
                const latency = Date.now() - start;

                proc.kill();
                resolve({ web: site.title, url: site.url, success: success ? 1 : 0, latency });
            } catch (err) {
                proc.kill();
                resolve({ web: site.title, url: site.url, success: 0, latency: 0 });
            }
        }, CHECK_DELAY_MS);
    });
}

/** Параллельная проверка с лимитом */
async function checkAllSites(records, sites, today) {
    const results = [];
    const queue = [...records];

    async function worker() {
        while (queue.length > 0) {
            const record = queue.shift();
            const hostPort = extractHostPort(record.subscription);
            //console.log(`Проверка → ${record.country} | ${hostPort}`);

            const checkPromises = sites.map(site => checkSite(record.subscription, site));
            const checkResults = await Promise.all(checkPromises);

            for (const item of checkResults) {
                //if (record.hasOwnProperty(record[item.web])) continue;
            
                if (item.success) {
                    record.lastCheck = today;
                    record[item.web] = item.latency;
                    record.rating = parseInt(record.rating) + 30;
                    console.log(`   ✅ ${item.url} → ${item.latency} ms`);
                } else {
                    record[item.web] = 0;
                    record.rating = parseInt(record.rating) - 10;
                    console.log(`   ❌ ${item.url} → недоступен`);
                }
            }

            console.log(`Проверено → ${record.country} | ${hostPort}`);
            results.push(record);
        }
    }

    // Запускаем workers
    const workers = Array.from({ length: 4 }, () => worker());
    await Promise.all(workers);

    return results;
}

// ====================== MAIN LOGIC ======================

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
    } else {
        console.log(`🔎 Найдено записей для проверки: ${toCheck.length}\n`);
    }

    const sites = CSV_HEADER
        .filter(item => isStandalone ? item.url : item.url && item.id !== 'gk');

    try {
        const checkedRecords = await checkAllSites(toCheck, sites, today);
        const recordsToRemove = new Set();

        for (const record of checkedRecords) {
            // Проверка на удаление
            if (parseInt(record.rating) < 0) {
                console.log(`   🗑 Удаление записи (от сервера нет отклика)`);
                recordsToRemove.add(extractHostPort(record.subscription));
            }
        }

        // Формируем финальную базу без удалённых записей
        const finalDb = db.filter(record => 
            !recordsToRemove.has(extractHostPort(record.subscription))
        );

        if (finalDb.length > 0) {
            await saveDatabase(finalDb);
            await fs.promises.unlink(TEMP_CONFIG_PATH).catch(err => void 0);
            
            console.log(`\n✅ Проверка завершена.`);
            console.log(`   Проверено записей: ${finalDb.length}`);
            console.log(`   Удалено записей (нет отклика от серверов): ${recordsToRemove.size}`);
        } else {
            console.log(`\nℹ️ Нет записей для проверки.`);
        }
    } catch (err) {}
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
            console.error('💥 Ошибка verify-access.js:', err.message);
            process.exit(1);
        }
    })();
} else {
    // Вызов из main.js
    module.exports = { verifyAccess };
}
