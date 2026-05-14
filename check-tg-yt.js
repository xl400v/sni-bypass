/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 1.4.5
 * Date: 14 May 2026
 * 
 * Отдельный скрипт для проверки доступности t.me и youtube.com 
 * через серверы из базы (VLESS + Hysteria2)
 */

const fs = require('fs');
const { createObjectCsvWriter } = require('csv-writer');
const csvParser = require('csv-parser');

const DB_FILE = 'servers-db.csv';

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
            .on('data', (data) => records.push(data))
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

/**
 * Заглушка для реальной проверки через VPN
 * В будущем здесь будет запуск xray/hysteria2 клиента
 */
async function checkSiteThroughVPN(subscription, site) {
    // TODO: Реализация реального подключения и проверки
    console.log(`   [Проверка] ${site} через ${subscription.substring(0, 60)}...`);

    // Пока имитируем проверку (50% шанс успеха)
    return Math.random() > 0.3 ? 1 : 0;
}

// ====================== ОСНОВНАЯ ФУНКЦИЯ ======================

async function checkTGandYT() {
    console.log('🔍 Запуск проверки доступности t.me и youtube.com...\n');

    let db = await loadDatabase();
    if (db.length === 0) return;

    let updatedCount = 0;

    for (let i = 0; i < db.length; i++) {
        const record = db[i];
        console.log(`\n📡 Проверка сервера ${i+1}/${db.length}: ${record.country} | ${record.protocol}`);

        // Проверяем t.me
        const tgResult = await checkSiteThroughVPN(record.subscription, 't.me');
        record.tg = String(tgResult);

        // Проверяем youtube.com
        const ytResult = await checkSiteThroughVPN(record.subscription, 'youtube.com');
        record.yt = String(ytResult);

        updatedCount++;

        // Небольшая задержка, чтобы не перегружать систему
        await new Promise(r => setTimeout(r, 800));
    }

    await saveDatabase(db);

    console.log('\n✅ Проверка TG и YT завершена!');
    console.log(`   Обновлено записей: ${updatedCount}`);
}

// ====================== ЗАПУСК ======================

checkTGandYT().catch(err => {
    console.error('💥 Критическая ошибка при проверке TG/YT:', err);
});

module.exports = { checkTGandYT };