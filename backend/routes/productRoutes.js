const express = require('express');
const router = express.Router();

const productController = require('../controllers/productController') || {
    getProduct: (req, res) => res.status(200).json({ success: true, data: { id: req.params.id, name: "Mock Product" } }),
    getSimilar: (req, res) => res.status(200).json({ success: true, data: [] })
};

// Lấy chi tiết 1 sản phẩm
router.get('/:id', productController.getProduct);

// Lấy danh sách sản phẩm tương tự (Item-to-Item Recommendation)
router.get('/:id/similar', productController.getSimilar);

module.exports = router;