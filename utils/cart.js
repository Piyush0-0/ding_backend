const db = require("../db"); // Database connection

/**
 * Transfers a guest session cart to a user cart after login
 * @param {number} userId - The user ID to transfer the cart to
 * @param {string} sessionId - The session ID of the guest cart
 */
const clearAndReplaceCart = async (userId, sessionId) => {
  let connection;
  try {
    // Validate inputs
    if (!userId || !sessionId) {
      throw new Error("Both userId and sessionId are required");
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Check if guest cart exists
    const guestCartQuery = `
      SELECT id, restaurant_id, order_group_id 
      FROM Cart 
      WHERE session_id = ? AND is_finalized = FALSE
      LIMIT 1;
    `;
    const [guestCarts] = await connection.query(guestCartQuery, [sessionId]);
    
    if (guestCarts.length === 0) {
      // No guest cart to transfer, just clean up any existing user carts
      await cleanupUserCarts(connection, userId);
      await connection.commit();
      return { transferred: false, message: "No guest cart found to transfer" };
    }
    
    const guestCart = guestCarts[0];
    
    // Check if user already has an active cart for this restaurant and order group
    const userCartQuery = `
      SELECT id 
      FROM Cart 
      WHERE user_id = ? 
      AND restaurant_id = ? 
      AND order_group_id <=> ? 
      AND is_finalized = FALSE
      LIMIT 1;
    `;
    const [userCarts] = await connection.query(
      userCartQuery, 
      [userId, guestCart.restaurant_id, guestCart.order_group_id]
    );
    
    if (userCarts.length > 0) {
      const userCartId = userCarts[0].id;
      
      // Move items from guest cart to user cart
      await mergeCartItems(connection, guestCart.id, userCartId);
      
      // Delete the now-empty guest cart
      await connection.query(
        `DELETE FROM Cart WHERE id = ?`, 
        [guestCart.id]
      );
    } else {
      // Just convert the guest cart to a user cart
      await connection.query(
        `UPDATE Cart SET user_id = ?, session_id = NULL WHERE id = ?`,
        [userId, guestCart.id]
      );
    }
    
    // Also update any relevant OrderGroup participants
    if (guestCart.order_group_id) {
      await updateOrderGroupParticipant(connection, guestCart.order_group_id, sessionId, userId);
    }
    
    await connection.commit();
    return { transferred: true, message: "Cart transferred successfully" };
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Failed to clear and replace cart:", error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/**
 * Merges items from a source cart into a destination cart
 */
async function mergeCartItems(connection, sourceCartId, destCartId) {
  // Query all items from the source cart
  const sourceItemsQuery = `
    SELECT item_id, variation_id, addon_items, quantity, unit_price
    FROM CartItems
    WHERE cart_id = ?;
  `;
  const [sourceItems] = await connection.query(sourceItemsQuery, [sourceCartId]);
  
  // For each item in source cart
  for (const item of sourceItems) {
    // Check if an identical item exists in the destination cart
    const existingItemQuery = `
      SELECT id, quantity, unit_price 
      FROM CartItems 
      WHERE cart_id = ? 
      AND item_id = ? 
      AND (variation_id <=> ?) 
      AND (addon_items <=> ?);
    `;
    
    const [existingItems] = await connection.query(
      existingItemQuery, 
      [destCartId, item.item_id, item.variation_id, item.addon_items]
    );
    
    if (existingItems.length > 0) {
      // Update quantity of existing item - price is generated automatically
      const existingItem = existingItems[0];
      const newQuantity = existingItem.quantity + item.quantity;
      
      await connection.query(
        `UPDATE CartItems SET quantity = ? WHERE id = ?`,
        [newQuantity, existingItem.id]
      );
    } else {
      // Insert as new item in destination cart - don't include price
      await connection.query(
        `INSERT INTO CartItems (cart_id, item_id, variation_id, addon_items, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [destCartId, item.item_id, item.variation_id, item.addon_items, item.quantity, item.unit_price]
      );
    }
  }
  
  // Delete all items from source cart
  await connection.query(`DELETE FROM CartItems WHERE cart_id = ?`, [sourceCartId]);
}

/**
 * Cleans up any existing user carts
 */
async function cleanupUserCarts(connection, userId) {
  // First delete cart items to maintain referential integrity
  await connection.query(`
    DELETE ci FROM CartItems ci
    JOIN Cart c ON ci.cart_id = c.id
    WHERE c.user_id = ? AND c.is_finalized = FALSE
  `, [userId]);
  
  // Then delete the carts
  await connection.query(`
    DELETE FROM Cart WHERE user_id = ? AND is_finalized = FALSE
  `, [userId]);
}

/**
 * Updates OrderGroup participant from session to user
 */
async function updateOrderGroupParticipant(connection, orderGroupId, sessionId, userId) {
  // First try to delete any existing session-based participant
  await connection.query(
    `DELETE FROM GroupParticipants
     WHERE order_group_id = ? AND session_id = ?`,
    [orderGroupId, sessionId]
  );

  // Then insert the user as a participant, ignoring if they already exist
  await connection.query(
    `INSERT IGNORE INTO GroupParticipants (order_group_id, user_id)
     VALUES (?, ?)`,
    [orderGroupId, userId]
  );
}

module.exports = { clearAndReplaceCart };
