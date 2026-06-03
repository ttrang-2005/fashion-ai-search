const redisClient = require('../config/redis');

// Chạy một job ngầm (Cron) nhỏ gọn để flush data từ Redis Queue vào MongoDB (Nếu cần tích hợp sau)
// Ở file controller này ta chỉ tập trung vào việc hứng log nhanh nhất có thể.

const analyticsController = {
    trackEvent(req, res) {
        // 1. Trả về response ngay lập tức để không block UI của người dùng
        res.status(202).json({ success: true, message: 'Event queued' });

        // 2. Chạy ngầm việc xử lý log
        (async () => {
            try {
                const eventData = {
                    ...req.body,
                    client_info: {
                        user_agent: req.headers['user-agent'],
                        ip: req.ip
                    },
                    timestamp: new Date().toISOString()
                };

                // Đẩy chuỗi JSON vào đuôi danh sách (Queue) trong Redis
                await redisClient.rPush('analytics:event_queue', JSON.stringify(eventData));
            } catch (error) {
                console.error('[Analytics Error] Failed to push to Redis:', error.message);
            }
        })();
    }
};

module.exports = analyticsController;