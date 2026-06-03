require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');

const connectDB = require('./config/mongo');
require('./config/redis');

const searchRoutes = require('./routes/searchRoutes');
const productRoutes = require('./routes/productRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

const app = express();

// ==========================================
// 1. MIDDLEWARES CỐT LÕI (Bắt buộc đúng thứ tự)
// ==========================================
// Chốt chặn Preflight thủ công (Vượt qua mọi rào cản của Express 5)
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
        return res.status(204).end(); // Trả về "No Content" ngay lập tức
    }
    next();
});

const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
};
app.use(cors(corsOptions));

app.use(helmet({ crossOriginResourcePolicy: false })); 

// NỚI LỎNG DUNG LƯỢNG LÊN 50MB
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(morgan('combined'));

// ==========================================
// 2. PHỤC VỤ FILE TĨNH (Ảnh)
// ==========================================
app.use('/images/clothes', express.static(process.env.CLOTHES_IMAGES_PATH || 'D:/fashion-ai-search/clothesimages'));
app.use('/images/women', express.static(process.env.WOMEN_IMAGES_PATH || 'D:/fashion-ai-search/women'));

// ==========================================
// 3. KÍCH HOẠT KẾT NỐI DATABASE
// ==========================================
connectDB();

// ==========================================
// 4. KHAI BÁO ROUTES
// ==========================================
app.get('/health', (req, res) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected';
    res.status(200).json({ 
        status: 'OK', 
        database: dbStatus,
        timestamp: new Date()
    });
});

app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

// ==========================================
// 5. XỬ LÝ LỖI (Error Handling)
// ==========================================
app.use((req, res, next) => {
    res.status(404).json({ success: false, message: 'API endpoint not found' });
});

app.use((err, req, res, next) => {
    console.error('[Global Error]:', err.message);
    res.status(500).json({ 
        success: false, 
        message: err.message || 'Internal Server Error' 
    });
});

// ==========================================
// 6. KHỞI ĐỘNG SERVER
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[Backend] Server running on port ${PORT}`);
});