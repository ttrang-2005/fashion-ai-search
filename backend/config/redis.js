const redis = require('redis');

const redisUrl = process.env.REDIS_URL;

const redisClient = redis.createClient({
    url: redisUrl,
    socket: {
        tls: redisUrl.startsWith('rediss://'), // Bật mã hóa TLS nếu dùng rediss
        rejectUnauthorized: false,             // Tránh lỗi chứng chỉ SSL tự ký
        keepAlive: 10000,                      // Bắn Ping mỗi 10 giây để giữ kết nối không bị Cloud drop
        reconnectStrategy: (retries) => {
            if (retries > 20) {
                console.error('[Redis] Quá nhiều lần thử lại, dừng kết nối.');
                return new Error('Retry time exhausted');
            }
            // Thời gian chờ tăng dần theo số lần thử (Tối đa 3 giây)
            return Math.min(retries * 100, 3000);
        }
    }
});

// Lắng nghe các vòng đời của Socket
redisClient.on('error', (err) => {
    // Chỉ log lỗi nếu không phải là lỗi rớt mạng tạm thời để tránh trôi màn hình terminal
    if (err.message !== 'Socket closed unexpectedly') {
        console.error('[Redis] Lỗi kết nối:', err.message);
    }
});

redisClient.on('connect', () => console.log('[Redis] Đã kết nối tới Server'));
redisClient.on('ready', () => console.log('[Redis] Sẵn sàng nhận truy vấn (Ready)'));
redisClient.on('end', () => console.warn('[Redis] Mất kết nối (End)'));
redisClient.on('reconnecting', () => console.log('[Redis] Đang thử kết nối lại...'));

// Khởi động kết nối
redisClient.connect().catch(console.error);

module.exports = redisClient;