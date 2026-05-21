/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.2.4
 * Date: 21 May 2026
 * 
 * Запуск: npm run check   или   node verify-access.js
 */

const fs = require('fs');
const { spawn } = require('child_process');
const { createObjectCsvWriter } = require('csv-writer');
const csvParser = require('csv-parser');
const { loadDatabase, saveDatabase, extractHostPort } = require('./db-utils');
const { XRAY_PATH, TEMP_CONFIG_PATH, INITIAL_RATING, CHECK_DELAY_MS } = require('./config');

// ====================== УТИЛИТЫ ======================

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

async function checkSite(subscription, site) {
    const parsed = parseVlessSubscription(subscription);
    if (!parsed) return { success: 0, latency: 0 };

    const cfg = createXrayConfig(parsed);
    fs.writeFileSync(TEMP_CONFIG_PATH, JSON.stringify(cfg, null, 2));

    return new Promise((resolve) => {
        const start = Date.now();
        const proc = spawn(XRAY_PATH, ['run', '-c', TEMP_CONFIG_PATH], { 
            stdio: ['ignore', 'ignore', 'pipe'] 
        });

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
    console.log('🚀 Запуск проверки telegram.org | vkvideo.ru | youtube.com...\n');

    let toCheck;
    if (isStandalone) {
        toCheck = db.filter(r => r.lastCheck <= today);
        console.log('⚙️ Режим самостоятельного запуска — записи за прошлые дни\n');
    } else {
        toCheck = db.filter(r => r.lastCheck === today && parseInt(r.rating) === INITIAL_RATING);
        console.log(`🔎 Найдено записей для проверки: ${toCheck.length}\n`);
    }

    const recordsToKeep = [];

    for (const record of toCheck) {
        const hostPort = extractHostPort(record.subscription);
        console.log(`Проверка → ${record.country.padEnd(4)} | ${hostPort}`);

        // telegram.org
        const tgResult = await checkSite(record.subscription, 'telegram.org');
        if (tgResult.success) {
            record.tg = String(tgResult.latency);
            record.rating = String(parseInt(record.rating) + 5);
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
            record.rating = String(parseInt(record.rating) + 5);
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
            record.rating = String(parseInt(record.rating) + 5);
            console.log(`   ✅ youtube.com → ${ytResult.latency} ms`);
        } else {
            record.yt = "0";
            record.rating = String(parseInt(record.rating) - 10);
            console.log(`   ❌ youtube.com → недоступен`);
        }

        // Проверка рейтинга после всех тестов
        if (parseInt(record.rating) >= 0) {
            recordsToKeep.push(record);
        } else {
            console.log(`   🗑 Запись удалена (рейтинг < 0)`);
        }

        await new Promise(r => setTimeout(r, CHECK_DELAY_MS));
    }

    // Формируем обновлённый db (оставляем только хорошие + непроверенные сегодня)
    const checkedQuics = new Set(toCheck.map(r => r.quic));
    const finalDb = db.filter(record => {
        if (checkedQuics.has(record.quic)) {
            return recordsToKeep.some(kept => kept.quic === record.quic);
        }
        return true;
    });

    if (toCheck.length > 0) {
        await saveDatabase(finalDb);
        try { await fs.promises.unlink(TEMP_CONFIG_PATH).catch(() => {}); } catch (e) {}
        console.log(`\n✅ Проверка завершена. Удалено записей с отрицательным рейтингом.`);
    }
}

// ====================== EXECUTION ======================

if (require.main === module) {
    (async () => {
        console.log('🚀 verify-access.js запущен в standalone режиме\n');
        try {
            const db = await loadDatabase();
            const today = new Date().toISOString().split('T')[0];
            await verifyAccess(db, today, true);
        } catch (err) {
            console.error('💥 Ошибка:', err.message);
            process.exit(1);
        }
    })();
} else {
    module.exports = { verifyAccess };
}
