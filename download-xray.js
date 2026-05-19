/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.0.2
 * Date: 14 May 2026
 * 
 * Автоматическая загрузка Xray в node_modules/.bin
 * Использование: node download-xray.js [linux|windows]
 */

const fs = require('fs');
const https = require('https');
const path = require('path');
const { execSync } = require('child_process');
const config = require('./config');

const PLATFORM = (process.argv[2] || 'linux').toLowerCase();
//const BIN_DIR = path.join(__dirname, 'node_modules', '.bin');
const XRAY_PATH = config.XRAY_PATH;
const BIN_DIR = path.dirname(XRAY_PATH);

let downloadUrl = '';
let zipName = '';

if (PLATFORM === 'windows') {
    downloadUrl = 'https://github.com/XTLS/Xray-core/releases/latest/download/Xray-windows-64.zip';
    zipName = 'xray-windows-64.zip';
} else {
    downloadUrl = 'https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip';
    zipName = 'xray-linux-64.zip';
}

const ZIP_PATH = path.join(__dirname, zipName);

console.log(`🔽 Скачивание Xray для ${PLATFORM.toUpperCase()}...`);

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function main() {
    try {
        if (!fs.existsSync(BIN_DIR)) {
            fs.mkdirSync(BIN_DIR, { recursive: true });
        }

        await downloadFile(downloadUrl, ZIP_PATH);

        console.log('📦 Распаковываем Xray...');
        execSync(`unzip -o "${ZIP_PATH}" -d "${BIN_DIR}"`, { stdio: 'inherit' });

        // Для Linux/macOS устанавливаем права
        if (PLATFORM !== 'windows' && fs.existsSync(XRAY_PATH)) {
            fs.chmodSync(XRAY_PATH, '755');
        }

        if (fs.existsSync(ZIP_PATH)) fs.unlinkSync(ZIP_PATH);

        console.log('✅ Xray успешно установлен!');
        console.log(`   Путь: ${XRAY_PATH}`);

    } catch (error) {
        console.error('❌ Ошибка при установке Xray:', error.message);
    }
}

main();
