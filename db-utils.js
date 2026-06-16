/**
 * Database and Utility functions
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.4.5
 * Date: 16 June 2026
 */

const fs = require('fs');
const { createObjectCsvWriter } = require('csv-writer');
const csvParser = require('csv-parser');
const config = require('./config');

const { DB_FILE, CSV_HEADER } = config;

/** Извлечение host:port */
function extractHostPort(line) {
    try {
        const urlPart = line.split('#')[0];
        const match = urlPart.match(/@([_a-zA-Z0-9.-]+:\d+)/);
        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
}

/** Новый уникальный ключ: host:port + quic */
function getUniqueKey(record) {
    const hostPort = extractHostPort(record.subscription || '');
    const quic = record.quic || record.Quic || '0';
    return `${hostPort}|${quic}`;
}

/** Приведение ключей к заголовкам */
function mapRecordToHeader(record, header) {
    const mapped = {};
    header.forEach(col => {
        mapped[col.id] = record[col.id] !== undefined ? record[col.id] : (record[col.title] || '');
    });
    return mapped;
}

/** Загрузка базы данных */
async function loadDatabase() {
    if (!fs.existsSync(DB_FILE)) {
        const writer = createObjectCsvWriter({ path: DB_FILE, header: CSV_HEADER });
        await writer.writeRecords([]);
        return [];
    }

    return new Promise((resolve, reject) => {
        const records = [];
        fs.createReadStream(DB_FILE)
            .pipe(csvParser())
            .on('data', data => records.push(data))
            .on('end', () => resolve(records.filter(r => r && Object.keys(r).length > 0)))
            .on('error', reject);
    });
}

/** Сохранение с дедупликацией по (host:port + quic) */
async function saveDatabase(records) {
    // Дедупликация: оставляем лучшую запись для каждой пары (host:port + quic)
    const uniqueMap = new Map();

    for (const record of records) {
        const key = getUniqueKey(record);
        const existing = uniqueMap.get(key);

        if (!existing || 
            parseInt(record.rating || 0) > parseInt(existing.rating || 0) ||
            (parseInt(record.rating || 0) === parseInt(existing.rating || 0) && 
             record.lastCheck > existing.lastCheck)) {
            uniqueMap.set(key, record);
        }
    }

    const deduped = Array.from(uniqueMap.values());

    // Сортировка
    deduped.sort((a, b) => {
        if (a.lastCheck !== b.lastCheck) return b.lastCheck.localeCompare(a.lastCheck);
        // 2. rating по убыванию
        const ratingA = parseInt(a.rating || 0);
        const ratingB = parseInt(b.rating || 0);
        if (ratingA !== ratingB) return ratingB - ratingA;
        // 3. tg по возрастанию, но 0 в конец
        const tgA = parseInt(a.telegram || 0);
        const tgB = parseInt(b.telegram || 0);
        if (tgA === 0 && tgB === 0) return 0;
        if (tgA === 0) return 1;
        if (tgB === 0) return -1;
        return tgA - tgB;
    });

    const recordsForCsv = deduped.map(r => mapRecordToHeader(r, CSV_HEADER));
    const writer = createObjectCsvWriter({ path: DB_FILE, header: CSV_HEADER });
    await writer.writeRecords(recordsForCsv);

    console.info(`✅ Сохранено ${deduped.length} уникальных записей (после дедупликации)`);
}

module.exports = {
    extractHostPort,
    getUniqueKey,
    loadDatabase,
    saveDatabase
};
