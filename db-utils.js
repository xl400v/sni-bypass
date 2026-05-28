/**
 * Database and Utility functions
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.4.1
 * Date: 28 May 2026
 */

const fs = require('fs');
const { createObjectCsvWriter } = require('csv-writer');
const csvParser = require('csv-parser');
const config = require('./config');

const { 
    DB_FILE, 
    CSV_HEADER
} = config;

/** Извлечение host:port из subscription */
function extractHostPort(line) {
    try {
        const urlPart = line.split('#')[0];
        const match = urlPart.match(/@([_a-zA-Z0-9.-]+:\d+)/);
        return match ? match[1] : null;
    } catch (e) {
        return null;
    }
}

/** Приведение ключей к заголовкам */
function mapRecordToHeader(record, header) {
    const mapped = {};
    header.forEach(col => {
        if (col.title in record) {
            mapped[col.id] = record[col.title];
        } else {
            mapped[col.id] = record[col.id]; // fallback: ищем по id
        }
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
            .on('end', () => resolve(records.filter(r => r && Object.keys(r).length)))
            .on('error', reject);
    });
}

/** Сохранение базы */
async function saveDatabase(records) {
    records.sort((a, b) => {
        // 1. lastCheck по убыванию
        if (a.lastCheck !== b.lastCheck) return b.lastCheck.localeCompare(a.lastCheck);
        // 2. rating по убыванию
        const ratingA = parseInt(a.rating);
        const ratingB = parseInt(b.rating);
        if (ratingA !== ratingB) {
            return ratingB - ratingA;
        }
        // 3. tg по возрастанию, но 0 в конец
        const tgA = parseInt(a.telegram || 0);
        const tgB = parseInt(b.telegram || 0);
        if (tgA === 0 && tgB === 0) return 0;
        if (tgA === 0) return 1;
        if (tgB === 0) return -1;
        return tgA - tgB;
    });

    const recordsForCsv = records.map(r => mapRecordToHeader(r, CSV_HEADER));
    const writer = createObjectCsvWriter({ path: DB_FILE, header: CSV_HEADER });
    await writer.writeRecords(recordsForCsv);
}

module.exports = {
    extractHostPort,
    loadDatabase,
    saveDatabase
};
