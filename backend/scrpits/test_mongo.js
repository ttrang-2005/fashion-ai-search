const mongoose = require('mongoose');
const Product = require('../models/Product');
const path = require('path');
const fs = require('fs');

// Load environment variables
let envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
}

const run = async () => {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/fashion_db';
        console.log('Connecting to:', uri);
        await mongoose.connect(uri);
        console.log('✅ Connected to DB');
        
        const count = await Product.countDocuments();
        console.log('📦 Total Products in DB:', count);
        
        const sample = await Product.findOne().lean();
        console.log('🔍 Sample Product Record:', JSON.stringify(sample, null, 2));
        
        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    }
};

run();
