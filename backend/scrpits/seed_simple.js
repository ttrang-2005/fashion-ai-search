#!/usr/bin/env node

/**
 * SIMPLE SEED SCRIPT - Run from backend folder with MongoDB URI
 * Usage:
 *   node scrpits/seed_simple.js
 *   MONGO_URI=mongodb://localhost:27017/fashion_db node scrpits/seed_simple.js
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Get MongoDB URI from environment or use default
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/fashion_db';

console.log('[Seed] Using MongoDB URI:', MONGO_URI);

// Load Product model
const Product = require('./models/Product');

const seedDBWithImages = async () => {
    try {
        // Connect to MongoDB
        console.log('[Seed] Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('[Seed] ✅ Connected to MongoDB');

        // Read the processed_images.txt to get the image filenames in order
        const processedImagesPath = path.join(__dirname, '../ai_service/data/processed_images.txt');
        
        if (!fs.existsSync(processedImagesPath)) {
            console.error('[Seed] ❌ Error: processed_images.txt not found at', processedImagesPath);
            process.exit(1);
        }

        const processedImages = fs.readFileSync(processedImagesPath, 'utf8')
            .trim()
            .split('\n')
            .map(line => {
                // Extract filename from full path (e.g., "0.jpg", "1.jpg", etc.)
                return path.basename(line);
            });

        console.log(`[Seed] ✅ Found ${processedImages.length} images in processed_images.txt`);

        // Generate products from image files
        const products = processedImages.map((imageName, index) => {
            // Extract the number from filename (without extension)
            const productNumber = imageName.replace(/\.(jpg|jpeg|png|webp)$/i, '');
            
            return {
                product_id: productNumber.toString(),
                name: `Fashion Item ${productNumber}`,
                description: `Premium fashion clothing item. Stylish and comfortable design.`,
                brand: 'FashionAI Collection',
                category: 'Apparel',
                gender: ['male', 'female', 'unisex'][index % 3],
                color: ['Black', 'White', 'Blue', 'Red', 'Green', 'Yellow', 'Navy', 'Grey'][index % 8],
                material: ['Cotton', 'Polyester', 'Silk', 'Wool', 'Linen', 'Denim'][index % 6],
                // ✅ FIX: Use the backend static route to serve images
                image_urls: [`http://localhost:3000/images/clothes/${imageName}`],
                is_active: true
            };
        });

        console.log(`[Seed] ✅ Generated ${products.length} products with image URLs`);

        // Clear existing data
        await Product.deleteMany({});
        console.log('[Seed] ✅ Cleared existing products from database');

        // Insert new products in batches (to avoid memory issues with large datasets)
        const batchSize = 1000;
        for (let i = 0; i < products.length; i += batchSize) {
            const batch = products.slice(i, i + batchSize);
            await Product.insertMany(batch, { ordered: false });
            const batchNum = Math.floor(i / batchSize) + 1;
            console.log(`[Seed] ✅ Inserted batch ${batchNum} (${batch.length} products)`);
        }

        console.log(`\n[Seed] 🎉 Successfully seeded database with ${products.length} products!`);
        console.log('[Seed] All products now have image URLs pointing to http://localhost:3000/images/clothes/');
        
        // Verify the data
        const count = await Product.countDocuments();
        const sample = await Product.findOne();
        console.log(`\n[Seed] ✅ Verification:
   - Total products: ${count}
   - Sample product_id: ${sample.product_id}
   - Sample image_url: ${sample.image_urls[0]}`);
        
        process.exit(0);
    } catch (error) {
        console.error('[Seed] ❌ Error:', error.message);
        console.error(error);
        process.exit(1);
    }
};

seedDBWithImages();
