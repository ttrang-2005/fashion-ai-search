const path = require('path');
const fs = require('fs');

// Try to find and load .env from multiple possible locations
let envPath = null;
const possiblePaths = [
    path.join(__dirname, '../.env'),           // From scrpits/seed_with_images.js -> backend/.env
    path.join(__dirname, '../../.env'),        // Fallback
    path.join(process.cwd(), '.env'),          // Current working directory
    path.join(process.cwd(), 'backend', '.env') // If running from root
];

for (const tryPath of possiblePaths) {
    if (fs.existsSync(tryPath)) {
        envPath = tryPath;
        console.log('[Seed] Found .env at:', tryPath);
        break;
    }
}

if (!process.env.MONGO_URI && !envPath) {
    console.error('[Seed] ❌ Error: Could not find .env file and MONGO_URI is not set in environment variables');
    console.error('[Seed] Tried paths:');
    possiblePaths.forEach(p => console.error('   -', p));
    process.exit(1);
}

if (envPath) {
    require('dotenv').config({ path: envPath });
}
const mongoose = require('mongoose');
const Product = require('../models/Product');

// Debug: Check if MONGO_URI is loaded
if (!process.env.MONGO_URI) {
    console.error('[Seed] ❌ Error: MONGO_URI not found in environment variables');
    process.exit(1);
}

const seedDBWithImages = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('[Seed] Connected to MongoDB');

        // Read the processed_images.txt to get the image filenames in order
        let processedImagesPath = path.join(__dirname, '../../ai_service/data/processed_images.txt');
        
        // Fallback for Docker container where backend is mapped directly to /app (no parent folder)
        if (!fs.existsSync(processedImagesPath)) {
            processedImagesPath = path.join(__dirname, '../ai_service/data/processed_images.txt');
        }
        
        if (!fs.existsSync(processedImagesPath)) {
            console.error('[Seed] ❌ Error: processed_images.txt not found at', processedImagesPath);
            process.exit(1);
        }

        const fileContent = fs.readFileSync(processedImagesPath, 'utf8').trim();
        const originalLines = fileContent.split('\n').map(line => line.replace(/\r/g, '').trim());
        const processedImages = originalLines.map(line => line.split(/[/\\]/).pop());

        console.log(`[Seed] Found ${processedImages.length} images in processed_images.txt`);

        // Load product_ids from the extracted text file
        const productIdsPath = path.join(__dirname, '../../ai_service/data/product_ids.txt');
        let finalProductIdsPath = productIdsPath;
        if (!fs.existsSync(finalProductIdsPath)) {
            finalProductIdsPath = path.join(__dirname, '../ai_service/data/product_ids.txt');
        }

        if (!fs.existsSync(finalProductIdsPath)) {
            console.error('[Seed] ❌ Error: product_ids.txt not found at', finalProductIdsPath);
            process.exit(1);
        }

        const productIds = fs.readFileSync(finalProductIdsPath, 'utf8')
            .trim()
            .split('\n')
            .map(line => line.replace(/\r/g, '').trim());

        console.log(`[Seed] Loaded ${productIds.length} product IDs from product_ids.txt`);

        const seenIds = new Set();
        const products = [];
        for (let index = 0; index < processedImages.length; index++) {
            const imageName = processedImages[index];
            const originalLine = originalLines[index];
            const product_id = productIds[index];

            if (!product_id) continue;
            
            if (seenIds.has(product_id)) {
                continue; // Skip duplicate IDs to avoid unique index violation
            }
            seenIds.add(product_id);
            
            const isWomen = originalLine.toLowerCase().includes('women');
            
            // Extract the relative path preserving nested directories
            let relativePath = imageName;
            const lowerLine = originalLine.toLowerCase();
            if (isWomen && lowerLine.includes('women')) {
                const index = lowerLine.indexOf('women');
                relativePath = originalLine.slice(index + 5).replace(/\\/g, '/');
                if (relativePath.startsWith('/')) relativePath = relativePath.slice(1);
            } else if (lowerLine.includes('clothesimages')) {
                const index = lowerLine.indexOf('clothesimages');
                relativePath = originalLine.slice(index + 13).replace(/\\/g, '/');
                if (relativePath.startsWith('/')) relativePath = relativePath.slice(1);
            }

            const imageUrl = isWomen ? `/images/women/${relativePath}` : `/images/clothes/${relativePath}`;
            const productNumber = imageName.replace(/\.(jpg|jpeg|png|webp)$/i, '');

            products.push({
                product_id: product_id,
                name: `Fashion Item ${productNumber}`,
                description: `Premium fashion clothing item. Stylish and comfortable design.`,
                brand: 'FashionAI Collection',
                category: isWomen ? "Women's Collection" : "Men's Apparel",
                gender: isWomen ? 'female' : ['male', 'unisex'][index % 2],
                color: ['Black', 'White', 'Blue', 'Red', 'Green', 'Yellow', 'Navy', 'Grey'][index % 8],
                material: ['Cotton', 'Polyester', 'Silk', 'Wool', 'Linen', 'Denim'][index % 6],
                image_urls: [imageUrl],
                is_active: true
            });
        }

        console.log(`[Seed] Generated ${products.length} products with image URLs`);

        // Clear existing data
        await Product.deleteMany({});
        console.log('[Seed] Cleared existing products from database');

        // Insert new products in batches (to avoid memory issues with large datasets)
        const batchSize = 1000;
        for (let i = 0; i < products.length; i += batchSize) {
            const batch = products.slice(i, i + batchSize);
            await Product.insertMany(batch, { ordered: false });
            const batchNum = Math.floor(i / batchSize) + 1;
            console.log(`[Seed] Inserted batch ${batchNum} (${batch.length} products)`);
        }

        console.log(`\n[Seed] ✅ Successfully seeded database with ${products.length} products!`);
        console.log('[Seed] All products now have image URLs pointing to http://localhost:3000/images/clothes/');
        process.exit(0);
    } catch (error) {
        console.error('[Seed] ❌ Error:', error.message);
        process.exit(1);
    }
};

seedDBWithImages();
