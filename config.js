/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.0.1
 * Date: 14 May 2026
 */

const path = require('path');

module.exports = {
    // Основные пути и файлы
    DB_FILE: 'servers-db.csv',
    OUTPUT_FILE: 'best-serv.txt',
    SUBSCRIPTIONS_URL: 'Vless-Reality-White-Lists.txt',

    // Настройки проверки пинга
    PING_THRESHOLD: 3000,
    CONCURRENCY: 4,
    MAX_PING_TIME_SECONDS: 30,

    // Настройки FTP
    FTP_CONFIG: {
        host: 'name.org',
        port: 21,
        user: 'acc',
        password: 'pass'
    },

    // Настройки Xray
    XRAY_PATH: path.join(__dirname, 'node_modules', '.bin', 'xray'),
    TEMP_CONFIG_PATH: 'temp-xray-config.json',
    TEST_TIMEOUT_MS: 7000,
    CHECK_DELAY_MS: 800
};
