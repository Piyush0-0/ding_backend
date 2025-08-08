const express = require("express");
const router = express.Router();
const db = require("../db"); // Database connection

// Create or update a session
router.post("/", async (req, res) => {
  const { session_id } = req.body;

  if (!session_id) {
    return res.status(400).json({ error: "Session ID is required." });
  }

  try {
    const sessionQuery = `
      INSERT IGNORE INTO Sessions (session_id, is_guest, created_at)
      VALUES (?, TRUE, NOW());
    `;
    await db.query(sessionQuery, [session_id]);

    res.status(200).json({ message: "Session created or already exists." });
  } catch (error) {
    console.error("Failed to create session:", error);
    res.status(500).json({ error: "Failed to create session." });
  }
});

module.exports = router;
