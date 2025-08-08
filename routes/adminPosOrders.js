const express = require('express');
const router = express.Router();
const db = require('../db');
const posIntegrationService = require('../services/posIntegrationService');

// List failed or pending POS orders
router.get('/', async (req, res) => {
  try {
    const orders = await db.query(
      "SELECT id, user_id, restaurant_id, pos_push_status, pos_push_response, pos_push_time, created_at FROM Orders WHERE pos_push_status IN ('failed', 'pending') ORDER BY pos_push_time DESC"
    );
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Retry POS push for a specific order
router.post('/:orderId/retry', async (req, res) => {
  const { orderId } = req.params;
  try {
    await posIntegrationService.pushOrderToPOS(orderId);
    res.json({ success: true, message: 'POS push retried.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router; 