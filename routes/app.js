const express = require('express');
const router = express.Router();
const db = require('../db'); // adjust path to your DB connection

// POST /app/ratings
router.post('/ratings', async (req, res) => {
  const { rating, user_id } = req.body;

  if (!rating || !user_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
  const result = await db.query(
    'INSERT INTO app_ratings (user_id, rating) VALUES (?, ?)',
    [user_id, rating]
  );

  console.log("DB result:", result);

  res.status(201).json({ message: 'App rating submitted', id: result.insertId });
} catch (err) {
  console.error("Database error:", err);
  res.status(500).json({ error: 'Database error' });
}

});

module.exports = router;
