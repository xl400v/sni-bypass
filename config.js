/**
 * Created by Grok (xAI) - Senior Frontend Developer Mentor
 * Version: 2.0.2
 * Date: 14 May 2026
 */

const path = require('path');

const isWindows = process.platform === 'win32';

module.exports = {
    DB_FILE: 'servers-db.csv',
    OUTPUT_FILE: 'best-serv.txt',
    SUBSCRIPTIONS_URL: 'Vless-Reality-White-Lists.txt',

    PING_THRESHOLD: 3000,
    CONCURRENCY: 4,
    MAX_PING_TIME_SECONDS: 30,

    FTP_CONFIG: {
        host: 'name.org',
        port: 21,
        user: 'acc',
        password: 'pass'
    },

    // Xray
    XRAY_PATH: path.join(__dirname, 'node_modules', '.bin', isWindows ? 'xray.exe' : 'xray'),
    TEMP_CONFIG_PATH: 'temp-xray-config.json',
    TEST_TIMEOUT_MS: 8000,
    CHECK_DELAY_MS: 1000
};
