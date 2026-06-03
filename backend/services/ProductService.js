const Product = require('../models/Product');
const redisClient = require('../config/redis');
const aiClient = require('../utils/aiClient');

class ProductService {
    // Lấy thông tin chi tiết của 1 sản phẩm
    async getProductDetail(productId) {
        const cacheKey = `product:detail:${productId}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) return JSON.parse(cached);

        const product = await Product.findOne({ product_id: productId, is_active: true }).lean();
        if (!product) return null;

        // Cache 12 tiếng cho chi tiết sản phẩm
        await redisClient.setEx(cacheKey, 43200, JSON.stringify(product));
        return product;
    }

    // Lấy danh sách sản phẩm tương tự (Gọi AI)
    async getSimilarProducts(productId, limit = 20) {
        const cacheKey = `product:similar:${productId}:${limit}`;
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            console.log(`[Cache Hit] Similar Products for ${productId}`);
            return JSON.parse(cached);
        }

        try {
            // Gọi sang FastAPI AI Service
            const aiResponse = await aiClient.get(`/search/similar`, {
                params: { product_id: productId, top_k: limit }
            });

            const aiResults = aiResponse.data.results;
            if (!aiResults || aiResults.length === 0) return [];

            // Hydration: Lấy metadata từ MongoDB giữ nguyên thứ tự
            const rankedIds = aiResults.map(item => item.product_id);
            const products = await Product.find({ 
                product_id: { $in: rankedIds },
                is_active: true 
            }).lean();

            const productMap = products.reduce((acc, p) => {
                acc[p.product_id] = p;
                return acc;
            }, {});

            const finalResults = aiResults.map(aiItem => {
                const p = productMap[aiItem.product_id];
                return p ? { ...p, ai_score: aiItem.score } : null;
            }).filter(Boolean);

            // Cache 1 giờ cho Similar Products
            if (finalResults.length > 0) {
                await redisClient.setEx(cacheKey, 3600, JSON.stringify(finalResults));
            }

            return finalResults;
        } catch (error) {
            console.error('[AI Service Error - Similar Products]', error.message);
            return []; // Trả về mảng rỗng thay vì crash trang chi tiết nếu AI down
        }
    }
}

module.exports = new ProductService();