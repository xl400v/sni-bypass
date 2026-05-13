/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 1.3.0
 * Date: 13 May 2026
 */

const FTP = require('ftp');

async function uploadToFTP(localFile, ftpConfig) {
    return new Promise((resolve) => {
        const client = new FTP();
        const remotePath = `/${ftpConfig.host}/happ.su/${localFile}`;

        client.on('ready', () => {
            client.put(localFile, remotePath, (err) => {
                if (err) console.error(`❌ FTP ошибка:`, err.message);
                else console.log(`✅ Успешно загружено: ${remotePath}`);
                client.end();
                resolve();
            });
        });

        client.on('error', (err) => {
            console.error('❌ FTP соединение ошибка:', err.message);
            resolve();
        });

        client.connect(ftpConfig);
    });
}

module.exports = { uploadToFTP };