const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Cấu hình Connection Pool cho Production
        const options = {
            maxPoolSize: 50, // Duy trì tối đa 50 socket connections cùng lúc
            serverSelectionTimeoutMS: 5000, // Timeout sau 5s nếu không tìm thấy server
            socketTimeoutMS: 45000, // Đóng socket sau 45s không hoạt động
            
            // CHỐT CHẶN: Ép buộc Mongoose chui đúng vào database này, 
            // không cho phép tự động nhận diện sang database mặc định 'test'
            dbName: 'fashion_db' 
        };

        // Thực hiện kết nối
        const conn = await mongoose.connect(process.env.MONGO_URI, options);
        
        // Thay đổi log để in ra chính xác tên Database đang được kết nối thực tế
        console.log(`[MongoDB] Connected successfully to database: "${conn.connection.name}" on host: ${conn.connection.host}`);
        
        // Lắng nghe các sự kiện rớt mạng để log lỗi trong quá trình vận hành
        mongoose.connection.on('error', err => {
            console.error(`[MongoDB] Connection Error: ${err.message}`);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('[MongoDB] Disconnected. Attempting to reconnect...');
        });

    } catch (error) {
        console.error(`[MongoDB] Initial Connection Failed: ${error.message}`);
        // Giết tiến trình nếu không kết nối được DB khi khởi động hệ thống
        process.exit(1); 
    }
};

module.exports = connectDB;