const express = require("express");
const router = express.Router();
const db = require("../db");

// Get add-on groups for an item
router.get("/item/:itemId", async (req, res) => {
  const { itemId } = req.params;
  try {
    const query = `
      SELECT ag.id AS addon_group_id, ag.name, ag.selection_min, ag.selection_max
      FROM ItemAddonGroup iag
      JOIN AddonGroup ag ON iag.addon_group_id = ag.id
      WHERE iag.item_id = ?;
    `;
    const addonGroups = await db.query(query, [itemId]);

    // Fetch add-on items for each group
    for (const group of addonGroups) {
      const addonItemsQuery = `
        SELECT id, name, price FROM AddonItem WHERE addon_group_id = ?;
      `;
      const addonItems = await db.query(addonItemsQuery, [group.addon_group_id]);
      group.addon_items = addonItems;
    }

    res.json({ addonGroups });
  } catch (error) {
    console.error("Error fetching add-ons:", error);
    res.status(500).json({ error: "Failed to fetch add-ons" });
  }
});

module.exports = router;