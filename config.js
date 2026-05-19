/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.0.7
 * Date: 19 May 2026
 */

const path = require('path');
const isWindows = process.platform === 'win32';

module.exports = {
    DB_FILE: 'servers-db.csv',
    OUTPUT_FILE: 'best-serv.txt',

    DEFAULT_SUBSCRIPTIONS_URL: 'https://github.com/hussaroff/lte-universal-checked/raw/refs/heads/main/checked.txt',

    INITIAL_RATING: 70,

    FTP_CONFIG: {
        host: 'name.org',
        port: 21,
        user: 'acc',
        password: 'pass'
    },

    XRAY_PATH: path.join(__dirname, 'node_modules', '.bin', isWindows ? 'xray.exe' : 'xray'),
    TEMP_CONFIG_PATH: 'temp-xray-config.json',
    CHECK_DELAY_MS: 1200,

    CSV_HEADER: [
        { id: 'lastCheck', title: 'lastCheck' },
        { id: 'rating', title: 'rating' },
        { id: 'protocol', title: 'protocol' },
        { id: 'country', title: 'country' },
        { id: 'cidr', title: 'cidr' },
        { id: 'tg', title: 'tg' },
        { id: 'yt', title: 'yt' },
        { id: 'quic', title: 'quic' },
        { id: 'subscription', title: 'subscription' }
    ],

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
        '%F0%9F%87%BA%F0%9F%87%B8': 'US',
        '%F0%9F%87%A6%F0%9F%87%B9': 'AT',
        '%F0%9F%87%AA%F0%9F%87%AA': 'EE',
        '%F0%9F%87%B8%F0%9F%87%AA': 'SE'    // Швеция
    }
};