/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.0.1
 * Date: 14 May 2026
 * 
 * Скрипт для автоматического скачивания и установки Xray в node_modules/.bin
 */

const fs = require('fs');
const https = require('https');
const path = require('path');
const { execSync } = require('child_process');
const config = require('./config');

const { 
    XRAY_PATH
} = config;

const XRAY_DIR = path.join(XRAY_PATH, '../');
const ZIP_PATH = path.join(__dirname, 'xray-linux-64.zip');

const DOWNLOAD_URL = 'https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-64.zip';

console.log('🔽 Начинаем скачивание Xray...');

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Следуем за редиректом
                return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
            }

            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log('✅ Скачивание завершено.');
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
        // Создаём папку, если её нет
        if (!fs.existsSync(XRAY_DIR)) {
            fs.mkdirSync(XRAY_DIR, { recursive: true });
        }

        // Скачиваем Xray
        await downloadFile(DOWNLOAD_URL, ZIP_PATH);

        // Распаковываем
        console.log('📦 Распаковываем Xray...');
        execSync(`unzip -o ${ZIP_PATH} -d ${XRAY_DIR}`, { stdio: 'inherit' });

        // Даём права на выполнение
        fs.chmodSync(XRAY_PATH, '755');

        // Удаляем zip-файл
        fs.unlinkSync(ZIP_PATH);

        console.log('🎉 Xray успешно установлен в node_modules/.bin/xray');
        console.log(`   Путь: ${XRAY_PATH}`);
        console.log('\nТеперь ты можешь запустить проверку командой:');
        console.log('   npm run check');

    } catch (error) {
        console.error('❌ Ошибка при установке Xray:', error.message);
    }
}

main();
