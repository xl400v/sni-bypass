/**
 * Database and Utility functions
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.3.1
 * Date: 25 May 2026
 */

const fs = require('fs');
const { createObjectCsvWriter } = require('csv-writer');
const csvParser = require('csv-parser');
const { DB_FILE, CSV_HEADER } = require('./config');

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
        // 3. vkvideo по возрастанию, но 0 в конец
        const vkA = parseInt(a.vkvideo || 0);
        const vkB = parseInt(b.vkvideo || 0);
        if (vkA === 0 && vkB === 0) return 0;
        if (vkA === 0) return 1;
        if (vkB === 0) return -1;
        return vkA - vkB;
    });

    const writer = createObjectCsvWriter({ path: DB_FILE, header: CSV_HEADER });
    await writer.writeRecords(records);
}

module.exports = {
    extractHostPort,
    loadDatabase,
    saveDatabase
};
