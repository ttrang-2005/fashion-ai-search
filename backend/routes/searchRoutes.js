const express = require('express');
const router = express.Router();

const searchController = require('../controllers/searchController') || {
    hybridSearch: (req, res) => res.status(200).json({ success: true, message: "Search API is working" })
};

// CHỈ bắt POST (Dành cho upload ảnh + chữ) và GET (Dành cho chữ)
// Tha cho phương thức OPTIONS để CORS xử lý
router.post('/hybrid', searchController.hybridSearch);
router.get('/hybrid', searchController.hybridSearch);

module.exports = router;