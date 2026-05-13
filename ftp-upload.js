/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 1.1.0
 * Date: 13 May 2026
 * 
 * Модуль загрузки файла на FTP
 */

const FTP = require('ftp');

/**
 * Загружает файл на FTP по указанному пути
 */
async function uploadToFTP(localFile, ftpConfig) {
    return new Promise((resolve) => {
        const client = new FTP();

        const remotePath = `/${ftpConfig.host}/happ.su/${localFile}`;

        client.on('ready', () => {
            client.put(localFile, remotePath, (err) => {
                if (err) {
                    console.error(`❌ Ошибка загрузки на FTP (${remotePath}):`, err.message);
                } else {
                    console.log(`✅ Файл успешно загружен на FTP: ${remotePath}`);
                }
                client.end();
                resolve();
            });
        });

        client.on('error', (err) => {
            console.error('❌ FTP ошибка соединения:', err.message);
            resolve();
        });

        client.connect(ftpConfig);
    });
}

module.exports = { uploadToFTP };
