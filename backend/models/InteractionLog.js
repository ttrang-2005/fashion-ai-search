const mongoose = require('mongoose');

const interactionLogSchema = new mongoose.Schema({
    session_id: { type: String, required: true, index: true },
    event_type: { 
        type: String, 
        enum: ['search', 'click_product', 'view_detail'], 
        required: true,
        index: true
    },
    product_id: { type: String, index: true },
    query_text: String,        // Dành cho sự kiện search
    has_image_query: Boolean,  // Đánh dấu nếu search bằng ảnh
    position: Number,          // Vị trí của sản phẩm trong grid (Rank)
    ai_score: Number,          // Điểm model dự đoán ban đầu
    client_info: {
        user_agent: String,
        screen_width: Number
    }
}, { timestamps: true }); // Tự động có createdAt

module.exports = mongoose.model('InteractionLog', interactionLogSchema);