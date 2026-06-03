const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    product_id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: String,
    brand: { type: String, index: true },
    category: { type: String, index: true },
    gender: { type: String, enum: ['male', 'female', 'unisex'] },
    color: String,
    material: String,
    image_urls: [String],
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

productSchema.index({ category: 1, brand: 1 });
productSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Product', productSchema, 'products');