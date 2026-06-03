const aiClient = require('../utils/aiClient');
const Product = require('../models/Product');
const redisClient = require('../config/redis');

const searchController = {
    async hybridSearch(req, res, next) {
        try {
            const query = req.body?.query || req.query?.q || null;
            const image_base64 = req.body?.image || null;
            const limit = parseInt(req.body?.limit || req.query?.limit, 10) || 20;

            if (!query && !image_base64) {
                return res.status(400).json({ success: false, message: 'Yêu cầu từ khóa hoặc hình ảnh' });
            }

            let cacheKey = null;
            if (query && !image_base64) {
                cacheKey = `search:hybrid:${query.trim().toLowerCase()}:${limit}`;
            }

            if (cacheKey) {
                const cached = await redisClient.get(cacheKey);
                if (cached) return res.status(200).json({ success: true, count: limit, data: JSON.parse(cached) });
            }

            // Gọi AI 
            const aiResponse = await aiClient.post('/search/hybrid', {
                query: query,
                image_base64: image_base64,
                top_k: limit
            });

            const aiResults = aiResponse.data.results;
            
            if (!aiResults || aiResults.length === 0) {
                return res.status(200).json({ success: true, count: 0, data: [] });
            }

            // Ép kiểu ID sạch sẽ
            const cleanRankedIds = aiResults.map(item => String(item.product_id).trim());
            
            // Tìm trong MongoDB (Đã bỏ is_active để tránh sót data)
            const products = await Product.find({ product_id: { $in: cleanRankedIds } }).lean();

            const productMap = products.reduce((acc, p) => {
                acc[p.product_id] = p;
                return acc;
            }, {});

            const finalResults = aiResults.map(aiItem => {
                const p = productMap[String(aiItem.product_id).trim()];
                if (!p) return null;
                return { ...p, ai_score: aiItem.score };
            }).filter(Boolean);

            if (cacheKey && finalResults.length > 0) {
                await redisClient.setEx(cacheKey, 3600, JSON.stringify(finalResults));
            }

            res.status(200).json({ success: true, count: finalResults.length, data: finalResults });

        } catch (error) {
            console.error("\n[Search Controller Error]:", error.message);
            if (error.code === 'ECONNABORTED' || (error.message && error.message.includes('Network Error'))) {
                return res.status(503).json({ success: false, message: 'AI Service is currently unavailable' });
            }
            next(error); 
        }
    }
};

module.exports = searchController;