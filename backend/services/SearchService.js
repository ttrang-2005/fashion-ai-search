const Product = require('../models/Product');
const aiClient = require('../utils/aiClient');

class SearchService {
    async performHybridSearch({ query, image_base64, limit = 20 }) {
        try {
            const aiResponse = await aiClient.post('/search/hybrid', {
                query: query || null,
                image_base64: image_base64 || null,
                top_k: limit
            });

            const aiResults = aiResponse.data?.results || [];
            if (!Array.isArray(aiResults) || aiResults.length === 0) {
                return [];
            }

            const rankedIds = aiResults.map((item) => item.product_id);
            const products = await Product.find({
                product_id: { $in: rankedIds },
                is_active: { $ne: false }
            }).lean();

            const productMap = products.reduce((acc, product) => {
                acc[product.product_id] = product;
                return acc;
            }, {});

            return aiResults
                .map((result) => {
                    const product = productMap[result.product_id];
                    return product
                        ? {
                              ...product,
                              ai_score: result.score
                          }
                        : null;
                })
                .filter(Boolean);
        } catch (error) {
            console.error('[SearchService] Hybrid search failed:', error.message);
            throw new Error(`AI Search Engine unavailable: ${error.message}`);
        }
    }
}

module.exports = new SearchService();
