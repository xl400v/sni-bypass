/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.3.1
 * Date: 25 May 2026
 * 
 * Запуск: npm run check   или   node verify-access.js
 */

const fs = require('fs');
const { spawn } = require('child_process');
const config = require('./config');
const { 
    XRAY_PATH, 
    TEMP_CONFIG_PATH, 
    CHECK_DELAY_MS
} = config;

const {
    loadDatabase,
    saveDatabase,
    extractHostPort
} = require('./db-utils');

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
                    publicKey: parsed.pbk || ""
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
            pbk: url.searchParams.get('pbk'),
            fp: url.searchParams.get('fp') || 'chrome',
            flow: url.searchParams.get('flow') || '',
            sid: url.searchParams.get('sid') || ''
        };
    } catch (e) {
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
        return { success: 0, latency: 0 };
    }
    fs.writeFileSync(TEMP_CONFIG_PATH, JSON.stringify(cfg, null, 2));

    return new Promise((resolve) => {
        const start = Date.now();

        setTimeout(async () => {
            try {
                const { execSync } = require('child_process');
                const output = execSync(
                    `curl -I -s --socks5 127.0.0.1:1080 --max-time 7 https://${site}`,
                    { timeout: CHECK_DELAY_MS * 4 }
                ).toString();

                const success = output.includes('HTTP/') || output.includes('200');
                const latency = Date.now() - start;

                proc.kill();
                resolve({ success: success ? 1 : 0, latency });
            } catch (err) {
                proc.kill();
                resolve({ success: 0, latency: 0 });
            }
        }, CHECK_DELAY_MS);
    });
}

// ====================== MAIN LOGIC ======================

async function verifyAccess(db, today, isStandalone = false) {
    let toCheck;
    // В standalone-режиме проверяем ВСЕ записи
    if (isStandalone) {
        toCheck = [...db]; // копия массива
    } else {
        toCheck = db.filter(r => {
            const now = new Date();
            const nextDay = new Date(r.lastCheck);
            nextDay.setDate(nextDay.getDate() + 2);

            return nextDay >= now;
        });
    }
    console.log(`🔎 Найдено записей для проверки: ${toCheck.length}\n`);

    const recordsToRemove = new Set();

    for (const record of toCheck) {
        const hostPort = extractHostPort(record.subscription);
        console.log(`Проверка → ${record.country} | ${hostPort}`);

        // telegram.org
        const tgResult = await checkSite(record.subscription, 'telegram.org');
        if (tgResult.success) {
            record.tg = String(tgResult.latency);
            record.rating = String(parseInt(record.rating) + 30);
            console.log(`   ✅ telegram.org → ${tgResult.latency} ms`);
        } else {
            record.tg = "0";
            record.rating = String(parseInt(record.rating) - 10);
            console.log(`   ❌ telegram.org → недоступен`);
        }

        // vkvideo.ru
        const vkResult = await checkSite(record.subscription, 'vkvideo.ru');
        if (vkResult.success) {
            record.vkvideo = String(vkResult.latency);
            record.rating = String(parseInt(record.rating) + 30);
            console.log(`   ✅ vkvideo.ru → ${vkResult.latency} ms`);
        } else {
            record.vkvideo = "0";
            record.rating = String(parseInt(record.rating) - 10);
            console.log(`   ❌ vkvideo.ru → недоступен`);
        }

        // youtube.com
        const ytResult = await checkSite(record.subscription, 'youtube.com');
        if (ytResult.success) {
            record.yt = String(ytResult.latency);
            record.rating = String(parseInt(record.rating) + 30);
            console.log(`   ✅ youtube.com → ${ytResult.latency} ms`);
        } else {
            record.yt = "0";
            record.rating = String(parseInt(record.rating) - 10);
            console.log(`   ❌ youtube.com → недоступен`);
        }

        // Проверка на удаление
        if (parseInt(record.rating) < 0) {
            console.log(`   🗑 Удаление записи (от сервера нет отклика)`);
            recordsToRemove.add(hostPort);
        }

        await new Promise(r => setTimeout(r, CHECK_DELAY_MS));
    }

    // Формируем финальную базу без удалённых записей
    let finalDb = db.filter(record => {
        const hp = extractHostPort(record.subscription);
        return !recordsToRemove.has(hp);
    });

    if (toCheck.length > 0) {
        await saveDatabase(finalDb);
        try { 
            await fs.promises.unlink(TEMP_CONFIG_PATH).catch(() => {}); 
        } catch (e) {}

        console.log(`\n✅ Проверка завершена.`);
        console.log(`   Проверено записей: ${toCheck.length}`);
        console.log(`   Удалено записей (нет отклика от серверов): ${recordsToRemove.size}`);
    } else {
        console.log(`\nℹ️ Нет записей для проверки.`);
    }
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
