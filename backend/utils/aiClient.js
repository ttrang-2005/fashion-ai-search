const axios = require('axios');

const aiClient = axios.create({
    baseURL: process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000',
    timeout: 30000, // Timeout 5 giây: Nếu AI xử lý quá lâu, Node.js sẽ ngắt để bảo vệ hệ thống
    headers: {
        'Content-Type': 'application/json'
    }
});

module.exports = aiClient;