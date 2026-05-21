/**
 * Database and Utility functions
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.2.4
 * Date: 21 May 2026
 */

const fs = require('fs');
const { createObjectCsvWriter } = require('csv-writer');
const csvParser = require('csv-parser');
const { DB_FILE, CSV_HEADER } = require('./config');

/** Извлечение host:port из subscription */
function extractHostPort(subscription) {
    try {
        const urlPart = subscription.split('#')[0];
        // Ищем @host:port? где host — буквы/цифры/точки, port — цифры
        const match = urlPart.match(/@([a-zA-Z0-9.-]+:\d+)/);
        return match[1];
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
            .on('end', () => resolve(records))
            .on('error', reject);
    });
}

/** Сохранение базы данных с сортировкой */
async function saveDatabase(records) {
    records.sort((a, b) => {
        if (a.lastCheck !== b.lastCheck) return b.lastCheck.localeCompare(a.lastCheck);
        if (parseInt(b.rating) !== parseInt(a.rating)) return parseInt(b.rating) - parseInt(a.rating);
        return parseInt(a.vkvideo || 99999) - parseInt(b.vkvideo || 99999);
    });

    const writer = createObjectCsvWriter({ path: DB_FILE, header: CSV_HEADER });
    await writer.writeRecords(records);
}

module.exports = {
    extractHostPort,
    loadDatabase,
    saveDatabase
};
