const express = require("express");
const router = express.Router();
const db = require("../db"); // Adjust the path to your database module

router.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW() as current_time");
    res.status(200).json(result[0]);
  } catch (error) {
    console.error("Database connection failed:", error);
    res.status(500).json({ error: "Database connection error" });
  }
});

module.exports = router;
