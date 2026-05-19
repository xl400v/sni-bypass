/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.0.3
 * Date: 14 May 2026
 */

const path = require('path');
const isWindows = process.platform === 'win32';

module.exports = {
    // Основные файлы
    DB_FILE: 'servers-db.csv',
    OUTPUT_FILE: 'best-serv.txt',

    // Основной список серверов
    SUBSCRIPTIONS_URL: 'Vless-Reality-White-Lists.txt',
    
    // Второй список серверов (можно добавить любой URL)
    SUBSCRIPTIONS_URL_2: '',   // ← Заполни, если нужно второй источник

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

    // Xray
    XRAY_PATH: path.join(__dirname, 'node_modules', '.bin', isWindows ? 'xray.exe' : 'xray'),
    TEMP_CONFIG_PATH: 'temp-xray-config.json',
    
    // Настройки проверки TG/YT
    TEST_TIMEOUT_MS: 10000,      // увеличено для стабильности
    CHECK_DELAY_MS: 1200,        // задержка между проверками

    // Флаги стран
    COUNTRY_FLAGS: {
        '%F0%9F%87%A9%F0%9F%87%AA': 'DE',
        '%F0%9F%87%B7%F0%9F%87%BA': 'RU',
        '%F0%9F%87%B1%F0%9F%87%B9': 'LT',
        '%F0%9F%87%B3%F0%9F%87%B1': 'NL',
        '%F0%9F%87%B5%F0%9F%87%B1': 'PL',
        '%F0%9F%87%B1%F0%9F%87%BB': 'LV',
        '%F0%9F%87%B0%F0%9F%87%B7': 'KR',
        '%F0%9F%87%AB%F0%9F%87%AE': 'FI',
        '%F0%9F%87%AB%F0%9F%87%B7': 'FR',
        '%F0%9F%87%B0%F0%9F%87%BF': 'KZ',
        '%F0%9F%87%B9%F0%9F%87%AD': 'TH',
        '%F0%9F%87%AC%F0%9F%87%A7': 'GB',
        '%F0%9F%87%A8%F0%9F%87%A6': 'CA',
        '%F0%9F%87%BA%F0%9F%87%B8': 'US'
    }
};
