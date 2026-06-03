require('dotenv').config({ path: '../.env' }); // Trỏ đúng về file .env
const mongoose = require('mongoose');
const Product = require('../models/Product');

const dummyProducts = [
    {
        product_id: "prod_001",
        name: "Navy Blue Polo Shirt",
        description: "Men's regular fit cotton polo shirt, breathable material.",
        brand: "Coolmate",
        category: "Polo",
        gender: "male",
        color: "Navy Blue",
        material: "Cotton",
        image_urls: ["https://example.com/polo-xanh.jpg"],
        is_active: true
    },
    {
        product_id: "prod_002",
        name: "Sneaker",
        description: "Men's athletic sneaker with comfortable rubber sole.",
        brand: "Biti's",
        category: "Sneaker",
        gender: "male",
        color: "White",
        material: "Synthetic Leather",
        image_urls: ["https://example.com/sneaker-trang.jpg"],
        is_active: true
    }
];

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('[Seed] Đã kết nối MongoDB');

        await Product.deleteMany({}); // Xóa dữ liệu cũ (chỉ dùng cho lúc dev)
        await Product.insertMany(dummyProducts);
        
        console.log(`[Seed] Đã insert thành công ${dummyProducts.length} sản phẩm.`);
        process.exit(0);
    } catch (error) {
        console.error('[Seed] Lỗi:', error);
        process.exit(1);
    }
};

seedDB();