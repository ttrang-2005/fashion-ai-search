#!/usr/bin/env node

/**
 * Quick verification script to check if the image fix is working
 * Run this after seeding: node verify_fix.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

async function verify() {
    try {
        console.log('\n📋 VERIFYING IMAGE DISPLAY FIX...\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Check total products
        const count = await Product.countDocuments();
        console.log(`📦 Total products in database: ${count}`);

        if (count === 0) {
            console.log('\n⚠️  No products found! Run: npm run seed\n');
            process.exit(1);
        }

        // Get a sample product
        const sampleProduct = await Product.findOne().lean();
        console.log('\n📦 Sample Product:');
        console.log(`   - product_id: ${sampleProduct.product_id}`);
        console.log(`   - name: ${sampleProduct.name}`);
        console.log(`   - brand: ${sampleProduct.brand}`);

        // Check image URLs
        if (!sampleProduct.image_urls || sampleProduct.image_urls.length === 0) {
            console.log('\n❌ ERROR: Product has no image_urls!');
            process.exit(1);
        }

        const imageUrl = sampleProduct.image_urls[0];
        console.log(`\n   - image_url: ${imageUrl}`);

        // Validate image URL format
        if (!imageUrl.includes('http://localhost:3000/images/clothes/')) {
            console.log('\n⚠️  Image URL format looks incorrect!');
            console.log(`   Expected format: http://localhost:3000/images/clothes/{filename}.jpg`);
            console.log(`   Got: ${imageUrl}`);
        } else {
            console.log('\n✅ Image URL format is correct!');
        }

        // Check products with active status
        const activeCount = await Product.countDocuments({ is_active: true });
        const inactiveCount = await Product.countDocuments({ is_active: false });
        const unknownCount = count - activeCount - inactiveCount;

        console.log(`\n📊 Product Status:
   - Active: ${activeCount}
   - Inactive: ${inactiveCount}
   - Unknown: ${unknownCount}`);

        // Check for products with image_urls
        const withImages = await Product.countDocuments({ image_urls: { $exists: true, $ne: [] } });
        console.log(`\n🖼️  Products with image_urls: ${withImages}/${count}`);

        if (withImages === count) {
            console.log('✅ All products have image URLs!\n');
        } else {
            console.log(`⚠️  ${count - withImages} products missing image URLs!\n`);
        }

        // Verify backend server status
        console.log('🔗 Connection Check:');
        console.log(`   - MongoDB: ✅ Connected`);
        console.log(`   - AI Service: Check if http://127.0.0.1:8000 is running`);
        console.log(`   - Backend: Ensure running on http://localhost:3000`);
        console.log(`   - Frontend: Ensure running on http://localhost:5173`);

        console.log('\n📝 Next Steps:');
        console.log('   1. Start backend: npm start');
        console.log('   2. Start AI service: python main.py (in ai_service folder)');
        console.log('   3. Start frontend: npm run dev (in frontend folder)');
        console.log('   4. Search for products and verify images display\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

verify();
