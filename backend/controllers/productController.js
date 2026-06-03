const Product = require('../models/Product');
const redisClient = require('../config/redis');
const aiClient = require('../utils/aiClient');

const productController = {
    // GET /api/v1/products/:id
    async getProduct(req, res, next) {
        try {
            const { id } = req.params;
            const cacheKey = `product:detail:${id}`;

            const cached = await redisClient.get(cacheKey);
            if (cached) return res.status(200).json({ success: true, data: JSON.parse(cached) });

            // Removed is_active filter to allow all products (whether active or not)
            const product = await Product.findOne({ product_id: id }).lean();
            if (!product) return res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại' });

            await redisClient.setEx(cacheKey, 86400, JSON.stringify(product)); // Cache 24h

            res.status(200).json({ success: true, data: product });
        } catch (error) {
            next(error);
        }
    },

    // GET /api/v1/products/:id/similar
    async getSimilar(req, res, next) {
        try {
            const { id } = req.params;
            const limit = parseInt(req.query.limit, 10) || 20;
            const cacheKey = `product:similar:${id}:${limit}`;

            const cached = await redisClient.get(cacheKey);
            if (cached) return res.status(200).json({ success: true, data: JSON.parse(cached) });

            // Gọi AI để lấy các vector láng giềng
            const aiResponse = await aiClient.get(`/search/similar`, {
                params: { product_id: id, top_k: limit }
            });

            const aiResults = aiResponse.data.results;
            if (!aiResults.length) return res.status(200).json({ success: true, data: [] });

            const rankedIds = aiResults.map(item => item.product_id);
            // Removed is_active filter to allow all products
            const products = await Product.find({ product_id: { $in: rankedIds } }).lean();

            const productMap = products.reduce((acc, p) => {
                acc[p.product_id] = p;
                return acc;
            }, {});

            const finalResults = aiResults.map(aiItem => {
                const p = productMap[aiItem.product_id];
                return p ? { ...p, ai_score: aiItem.score } : null;
            }).filter(Boolean);

            await redisClient.setEx(cacheKey, 3600, JSON.stringify(finalResults)); // Cache 1h

            res.status(200).json({ success: true, count: finalResults.length, data: finalResults });
        } catch (error) {
            // Trả về mảng rỗng để UI không bị sập nếu AI lỗi khi load similar
            console.error('[AI Similar Error]', error.message);
            res.status(200).json({ success: true, data: [] });
        }
    }
};

module.exports = productController;