/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 1.4.0
 * Date: 13 May 2026
 * 
 * Отдельный скрипт для проверки доступности TG и YT
 * Запуск: npm run tgyt
 */

const fs = require('fs');
const { createObjectCsvWriter } = require('csv-writer');
const csvParser = require('csv-parser');

const DB_FILE = 'servers-db.csv';

async function loadDatabase() {
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
}

// Здесь будет логика проверки TG и YT через реальное подключение (пока заглушка)
async function checkTGandYT() {
    console.log('🔍 Запуск проверки TG и YT...');
    let db = await loadDatabase();

    // TODO: Реализовать реальную проверку через прокси/VLESS/Hysteria2
    // Пока просто ставим 1 для примера
    db = db.map(record => ({
        ...record,
        tg: record.tg || "0",   // будет обновляться после реальной проверки
        yt: record.yt || "0"
    }));

    await saveDatabase(db);
    console.log('✅ Проверка TG и YT завершена (заглушка)');
}

checkTGandYT().catch(console.error);