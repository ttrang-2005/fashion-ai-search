const express = require('express');
const router = express.Router();

const analyticsController = require('../controllers/analyticsController') || {
    trackEvent: (req, res) => res.status(202).json({ success: true, message: "Event logged" })
};

// Nhận tracking event
router.post('/events', analyticsController.trackEvent);

module.exports = router;