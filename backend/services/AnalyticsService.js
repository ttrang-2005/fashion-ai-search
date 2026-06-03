const redisClient = require('../config/redis');
const InteractionLog = require('../models/InteractionLog');

const LOG_QUEUE_KEY = 'analytics:event_queue';

class AnalyticsService {
    constructor() {
        // Khởi động worker chạy ngầm mỗi 5 giây để flush data từ Redis vào MongoDB
        setInterval(() => this.flushLogsToDB(), 5000);
    }

    // Nhận log từ API và đẩy cực nhanh vào bộ nhớ đệm Redis
    async logEvent(eventData) {
        try {
            await redisClient.rPush(LOG_QUEUE_KEY, JSON.stringify(eventData));
        } catch (error) {
            console.error('[Analytics] Failed to push log to Redis', error);
        }
    }

    // Background Job: Xử lý theo lô (Batch Processing)
    async flushLogsToDB() {
        try {
            // Lấy độ dài hiện tại của hàng đợi
            const queueLength = await redisClient.lLen(LOG_QUEUE_KEY);
            if (queueLength === 0) return;

            // Lấy ra tối đa 500 logs mỗi lần để tránh quá tải
            const batchSize = Math.min(queueLength, 500);
            const logsToInsert = [];

            for (let i = 0; i < batchSize; i++) {
                const logString = await redisClient.lPop(LOG_QUEUE_KEY);
                if (logString) {
                    logsToInsert.push(JSON.parse(logString));
                }
            }

            if (logsToInsert.length > 0) {
                await InteractionLog.insertMany(logsToInsert, { ordered: false });
                console.log(`[Analytics] Flushed ${logsToInsert.length} events to MongoDB.`);
            }
        } catch (error) {
            console.error('[Analytics] Failed to flush logs to MongoDB', error);
        }
    }
}

module.exports = new AnalyticsService();