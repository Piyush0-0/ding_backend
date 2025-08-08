const express = require("express");
const router = express.Router();
const db = require("../db");
const { clearAndReplaceCart } = require("../utils/cart");
const { calculateCartTotalsByCartId } = require("../utils/cartCalculations");
const {
  authenticateUser,
  optionalAuthenticateUser,
} = require("../middlewares/authenticateUser");

// Utility to get or create an active cart
const getOrCreateCart = async (userId, sessionId, restaurantId, orderGroupId = null, orderType = 'DINE_IN') => {
  const condition = userId ? "user_id = ?" : "session_id = ?";
  const param = userId || sessionId;
  
  console.log('getOrCreateCart called with:', {
    userId,
    sessionId,
    restaurantId,
    orderGroupId,
    orderType,
    param
  });
  
  // First check for any active carts
  const activeCarts = await db.query(
    `SELECT * FROM Cart 
     WHERE ${condition} AND is_finalized = FALSE`,
    [param]
  );

  console.log('Found active carts:', activeCarts);

  // FIXED: Improved cart conflict handling
  if (activeCarts.length > 1) {
    // Multiple carts - resolve conflicts by keeping only matching context
    console.log('[DEBUG] Multiple active carts found, resolving conflicts...');
    
    let matchingCart = null;
    const cartsToRemove = [];
    
    for (const cart of activeCarts) {
      const restaurantMatch = cart.restaurant_id === parseInt(restaurantId);
      const groupMatch = (orderGroupId ? cart.order_group_id === parseInt(orderGroupId) : !cart.order_group_id);
      const orderTypeMatch = cart.order_type === orderType;
      
      if (restaurantMatch && groupMatch && orderTypeMatch) {
        if (!matchingCart) {
          matchingCart = cart;
        } else {
          // Multiple matching carts - keep the most recent one
          if (new Date(cart.updated_at) > new Date(matchingCart.updated_at)) {
            cartsToRemove.push(matchingCart);
            matchingCart = cart;
          } else {
            cartsToRemove.push(cart);
          }
        }
      } else {
        cartsToRemove.push(cart);
      }
    }
    
    // Remove conflicting carts
    for (const cartToRemove of cartsToRemove) {
      console.log(`[DEBUG] Removing conflicting cart ${cartToRemove.id}`);
      await db.query(`DELETE FROM CartItems WHERE cart_id = ?`, [cartToRemove.id]);
      await db.query(`DELETE FROM Cart WHERE id = ?`, [cartToRemove.id]);
    }
    
    if (matchingCart) {
      console.log(`[DEBUG] Using matching cart ${matchingCart.id} after conflict resolution`);
      return matchingCart;
    }
    
    // No matching cart found after cleanup, will create new one below
  }

  // If there's exactly one active cart, check if it matches context
  if (activeCarts.length === 1) {
    const existingCart = activeCarts[0];
    const restaurantMatch = existingCart.restaurant_id === parseInt(restaurantId);
    const groupMatch = (orderGroupId ? existingCart.order_group_id === parseInt(orderGroupId) : !existingCart.order_group_id);
    const orderTypeMatch = existingCart.order_type === orderType;

    // Only return the cart if restaurant, group, and order type match
    if (restaurantMatch && groupMatch && orderTypeMatch) {
      return existingCart;
    }
    // Otherwise, throw a generic cart conflict error
    throw {
      error: "cart_conflict",
      message: "You have an active cart for a different context. Would you like to delete it and create a new cart?",
      carts: [
        {
          id: existingCart.id,
          restaurant_id: existingCart.restaurant_id,
          order_group_id: existingCart.order_group_id,
          order_type: existingCart.order_type
        }
      ]
    };
  }

  // No active carts found, create a new one
  if (orderGroupId) {
    // Check if group is still open
    const groupRows = await db.query(
      `SELECT * FROM OrderGroups WHERE id = ? AND group_status = 'active'`,
      [orderGroupId]
    );
    if (!groupRows.length) {
      throw new Error("Group order not found or is no longer active");
    }
    // Create a new cart for this user/group
    const result = await db.query(
      `INSERT INTO Cart (user_id, session_id, restaurant_id, order_group_id, order_type) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId || null, sessionId || null, restaurantId, orderGroupId, orderType]
    );
    return { id: result.insertId, order_type: orderType };
  } else {
    // Create a new cart for this user/restaurant
    const result = await db.query(
      `INSERT INTO Cart (user_id, session_id, restaurant_id, order_type) 
       VALUES (?, ?, ?, ?)`,
      [userId || null, sessionId || null, restaurantId, orderType]
    );
    return { id: result.insertId, order_type: orderType };
  }
};

router.post("/set-instructions", async (req, res) => {
  const { session_id, restaurant_id, cooking_instructions } = req.body;

  if (!session_id || !restaurant_id) {
    return res.status(400).json({ error: "Missing session_id or restaurant_id" });
  }

  try {
    await db.query(
      `UPDATE cart SET cooking_instructions = ? WHERE session_id = ? AND restaurant_id = ?`,
      [cooking_instructions, session_id, restaurant_id]
    );

    return res.status(200).json({ message: "Instructions saved" });
  } catch (err) {
    console.error("Error updating instructions:", err);
    return res.status(500).json({ error: "Database error" });
  }
});


// Add item (with variations & addons)
router.post("/add-item", optionalAuthenticateUser, async (req, res) => {
  try {
    const { session_id, item_id, quantity = 1, restaurant_id, variation_id, addon_items, order_group_id, order_type = 'DINE_IN' } = req.body;
    const user_id = req.user ? req.user.userId : null;

    if (!item_id || !restaurant_id) {
      return res.status(400).json({ error: "item_id and restaurant_id are required" });
    }

    if (quantity <= 0) {
      return res.status(400).json({ error: "Quantity must be positive" });
    }

    // Validate order_type
    const validOrderTypes = ['DINE_IN', 'PICKUP', 'DELIVERY'];
    if (!validOrderTypes.includes(order_type)) {
      return res.status(400).json({ error: "Invalid order_type. Must be DINE_IN, PICKUP, or DELIVERY" });
    }

    // If order_group_id is provided, verify it exists and is active
    if (order_group_id) {
      const groupCheck = await db.query(
        `SELECT * FROM OrderGroups WHERE id = ? AND group_status = 'active'`,
        [order_group_id]
      );
      
      if (groupCheck.length === 0) {
        return res.status(400).json({ error: "Group order not found or is no longer active" });
      }
      
      // Verify the group order belongs to the specified restaurant
      if (groupCheck[0].restaurant_id !== parseInt(restaurant_id)) {
        return res.status(400).json({ 
          error: "Group order does not belong to the specified restaurant" 
        });
      }
    }

    // Get or create cart
    let cart;
    try {
      cart = await getOrCreateCart(user_id, session_id, restaurant_id, order_group_id, order_type);
    } catch (error) {
      if (error?.error === "cart_conflict") {
        return res.status(409).json(error);
      }
      throw error;
    }

    // Fetch base item price
    let basePrice;
    if (variation_id) {
      const variation = await db.query(
        `SELECT price FROM Variations WHERE id = ? AND item_id = ?`,
        [variation_id, item_id]
      );
      if (variation.length === 0) {
        return res.status(400).json({ error: "Invalid variation selected." });
      }
      basePrice = variation[0].price;
    } else {
      const item = await db.query(`SELECT price FROM Items WHERE id = ?`, [item_id]);
      if (item.length === 0) {
        return res.status(400).json({ error: "Invalid item selected." });
      }
      basePrice = item[0].price;
    }

    // Fetch Add-on prices if applicable
    let addonTotal = 0;
    if (addon_items && addon_items.length > 0) {
      // Extract just the IDs from the addon_items array
      const addonIds = addon_items.map(addon => addon.id);
      const addonItems = await db.query(
        `SELECT id, price FROM AddOnItems WHERE id IN (${addonIds.map(() => '?').join(',')})`,
        addonIds
      );
      
      // Calculate total add-on price considering quantities
      addonTotal = addon_items.reduce((total, addon) => {
        const addonPrice = addonItems.find(item => item.id === addon.id)?.price || 0;
        return total + (parseFloat(addonPrice) * (addon.quantity || 1));
      }, 0);
    }

    // Calculate unit price (base + addons)
    const unitPrice = parseFloat(basePrice) + addonTotal;
    
    // Calculate total price for this item (unit price * quantity)
    const itemTotalPrice = unitPrice * quantity;

    // Serialize addon items to JSON
    const addonItemsJSON = addon_items && addon_items.length > 0 ? JSON.stringify(addon_items.sort((a, b) => a.id - b.id)) : null;

    // First check if an identical item exists
    const existingItem = await db.query(
      `SELECT id, quantity, unit_price FROM CartItems 
       WHERE cart_id = ? 
       AND item_id = ? 
       AND (variation_id <=> ?) 
       AND (addon_items <=> ?)`,
      [cart.id, item_id, variation_id || null, addonItemsJSON]
    );

    if (existingItem.length > 0) {
      // Update existing item - only update quantity, unit_price is calculated automatically
      const newQuantity = existingItem[0].quantity + quantity;
      
      await db.query(
        `UPDATE CartItems 
         SET quantity = ?,
             unit_price = ?
         WHERE id = ?`,
        [newQuantity, unitPrice, existingItem[0].id]
      );
    } else {
      // Insert new item - don't include price in the column list as it's generated
      await db.query(
        `INSERT INTO CartItems (cart_id, item_id, variation_id, addon_items, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [cart.id, item_id, variation_id || null, addonItemsJSON, quantity, unitPrice]
      );
    }

    // Fetch updated cart items for response
    const updatedCartItems = await db.query(
      `SELECT 
        ci.id,
        ci.item_id,
        i.name AS item_name,
        i.description,
        ci.quantity,
        ci.unit_price,
        ci.price,
        ci.variation_id,
        v.name AS variation_name,
        ci.addon_items,
        i.image_url
      FROM CartItems ci
      JOIN Items i ON ci.item_id = i.id
      LEFT JOIN Variations v ON ci.variation_id = v.id
      WHERE ci.cart_id = ?`,
      [cart.id]
    );

    // Fetch Add-ons details for the updated items
    const addonItemsDetailsPromises = updatedCartItems.map(async (cartItem) => {
      if (!cartItem.addon_items) {
        return cartItem;
      }

      try {
        const addonIds = JSON.parse(cartItem.addon_items).map(addon => addon.id);
        
        if (addonIds.length > 0) {
          const addonResults = await db.query(
            `SELECT id, name, price FROM AddOnItems WHERE id IN (${addonIds.map(() => '?').join(',')})`,
            addonIds
          );

          // Create a map of addon details by ID for quick lookup
          const addonDetailsMap = addonResults.reduce((map, addon) => {
            map[addon.id] = addon;
            return map;
          }, {});

          // Parse the original addon_items to preserve quantities
          const originalAddons = JSON.parse(cartItem.addon_items);

          // Combine addon details with quantities
          const addonDetails = originalAddons.map(addon => ({
            ...addonDetailsMap[addon.id],
            quantity: addon.quantity || 1
          })).filter(addon => addon.id); // Filter out any missing addons

          return {
            ...cartItem,
            addon_items: JSON.stringify(originalAddons), // Keep the original string for comparison
            selected_addons: addonDetails // Add the detailed addon information
          };
        }
      } catch (e) {
        console.error('Error processing addons for cart item:', e);
      }

      return cartItem;
    });

    const cartItemsWithAddons = await Promise.all(addonItemsDetailsPromises);

    // Fetch restaurant details for minimum order amount
    const restaurant = await db.query(
      `SELECT minimum_order_amount FROM Restaurants WHERE id = ?`,
      [restaurant_id]
    );

    // Calculate totals using the utility function
    const totals = await calculateCartTotalsByCartId(cart.id);

    res.status(200).json({ 
      message: "Item added to cart.",
      cart: {
        items: cartItemsWithAddons,
        restaurant_id: restaurant_id,
        order_type: order_type
      },
      totals,
      minOrderAmount: Number(restaurant[0]?.minimum_order_amount || 0)
    });
  } catch (error) {
    console.error("Failed to add item to cart:", error);
    res.status(500).json({ error: "Failed to add item to cart" });
  }
});

router.post("/remove-item", optionalAuthenticateUser, async (req, res) => {
  try {
    const { cart_item_id, restaurant_id, session_id } = req.body;
    const userId = req.user ? req.user.userId : null;

    if (!cart_item_id || !restaurant_id) {
      return res.status(400).json({ error: "cart_item_id and restaurant_id are required" });
    }

    if (!userId && !session_id) {
      return res.status(400).json({ error: "Either session_id or user authentication required." });
    }

    // Fetch active cart
    const condition = userId ? "user_id = ?" : "session_id = ?";
    const conditionValue = userId || session_id;

    const cartResults = await db.query(
      `SELECT id, order_type FROM Cart WHERE ${condition} AND restaurant_id = ? AND is_finalized = FALSE LIMIT 1`,
      [conditionValue, restaurant_id]
    );

    if (cartResults.length === 0) {
      return res.status(404).json({ error: "Cart not found." });
    }

    const cartId = cartResults[0].id;
    const orderType = cartResults[0].order_type || 'DINE_IN';

    // First fetch the cart item to get its current quantity and price
    const cartItem = await db.query(
      `SELECT quantity, unit_price FROM CartItems WHERE id = ? AND cart_id = ?`,
      [cart_item_id, cartId]
    );

    if (cartItem.length === 0) {
      return res.status(404).json({ error: "Cart item not found." });
    }

    const currentQuantity = cartItem[0].quantity;

    if (currentQuantity > 1) {
      // Calculate new quantity - only update quantity, price is calculated automatically
      const newQuantity = currentQuantity - 1;

      await db.query(
        `UPDATE CartItems 
         SET quantity = ?
         WHERE id = ? AND cart_id = ?`,
        [newQuantity, cart_item_id, cartId]
      );
    } else {
      // If quantity is 1, delete the item
      await db.query(
        `DELETE FROM CartItems WHERE id = ? AND cart_id = ?`,
        [cart_item_id, cartId]
      );
    }

    // Fetch updated cart items for response
    const updatedCartItems = await db.query(
      `SELECT 
        ci.id,
        ci.item_id,
        i.name AS item_name,
        i.description,
        ci.quantity,
        ci.unit_price,
        ci.price,
        ci.variation_id,
        v.name AS variation_name,
        ci.addon_items,
        i.image_url
      FROM CartItems ci
      JOIN Items i ON ci.item_id = i.id
      LEFT JOIN Variations v ON ci.variation_id = v.id
      WHERE ci.cart_id = ?`,
      [cartId]
    );

    // Fetch Add-ons details for the updated items
    const addonItemsDetailsPromises = updatedCartItems.map(async (cartItem) => {
      if (!cartItem.addon_items) {
        return cartItem;
      }

      try {
        const addonIds = JSON.parse(cartItem.addon_items).map(addon => addon.id);
        
        if (addonIds.length > 0) {
          const addonResults = await db.query(
            `SELECT id, name, price FROM AddOnItems WHERE id IN (${addonIds.map(() => '?').join(',')})`,
            addonIds
          );

          // Create a map of addon details by ID for quick lookup
          const addonDetailsMap = addonResults.reduce((map, addon) => {
            map[addon.id] = addon;
            return map;
          }, {});

          // Parse the original addon_items to preserve quantities
          const originalAddons = JSON.parse(cartItem.addon_items);

          // Combine addon details with quantities
          const addonDetails = originalAddons.map(addon => ({
            ...addonDetailsMap[addon.id],
            quantity: addon.quantity || 1
          })).filter(addon => addon.id); // Filter out any missing addons

          return {
            ...cartItem,
            addon_items: JSON.stringify(originalAddons), // Keep the original string for comparison
            selected_addons: addonDetails // Add the detailed addon information
          };
        }
      } catch (e) {
        console.error('Error processing addons for cart item:', e);
      }

      return cartItem;
    });

    const cartItemsWithAddons = await Promise.all(addonItemsDetailsPromises);

    // Calculate totals using the utility function
    const totals = await calculateCartTotalsByCartId(cartId);

    return res.status(200).json({ 
      message: "Item quantity reduced from cart.",
      cart: {
        items: cartItemsWithAddons,
        restaurant_id: restaurant_id,
        order_type: orderType
      },
      totals
    });
  } catch (error) {
    console.error("Failed to remove item:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/merge-cart", authenticateUser, async (req, res) => {
  try {
    await clearAndReplaceCart(req.user.userId, req.body.sessionId);
    res.status(200).json({ message: "Cart merged successfully." });
  } catch (error) {
    console.error("Error merging cart:", error);
    res.status(500).json({ error: "Failed to merge cart." });
  }
});

// Get cart with items
router.post("/", optionalAuthenticateUser, async (req, res) => {
  try {
    const { session_id, restaurant_id, force, order_group_id, order_type = 'DINE_IN' } = req.body;
    const user_id = req.user ? req.user.userId : null;

    if (!session_id && !user_id) {
      return res.status(400).json({ error: "Either session_id or user authentication required." });
    }

    // Validate order_type if provided
    if (order_type) {
      const validOrderTypes = ['DINE_IN', 'PICKUP', 'DELIVERY'];
      if (!validOrderTypes.includes(order_type)) {
        return res.status(400).json({ error: "Invalid order_type. Must be DINE_IN, PICKUP, or DELIVERY" });
      }
    }
    
    // First, try to find any active cart for this user/session
    const condition = user_id ? "user_id = ?" : "session_id = ?";
    const param = user_id || session_id;
    const activeCarts = await db.query(
      `SELECT * FROM Cart WHERE ${condition} AND is_finalized = FALSE`,
      [param]
    );

    // If restaurant_id is not provided, return the first active cart (if any)
    if (!restaurant_id) {
      if (activeCarts.length === 0) {
        const emptyTotals = await calculateCartTotalsByCartId(null);
        return res.status(200).json({
          cart: { items: [] },
          totals: emptyTotals,
          minOrderAmount: 0,
          isLoggedIn: !!user_id
        });
      }
      
      // Get the most recently updated cart
      const cart = activeCarts[0];
      
      // Fetch restaurant details for minimum order amount
      const restaurantResult = await db.query(
        `SELECT minimum_order_amount, is_active FROM Restaurants WHERE id = ?`,
        [cart.restaurant_id]
      );
      
      // Calculate totals based on actual cart items using the utility function
      const cartTotals = await calculateCartTotalsByCartId(cart.id);
      
      return res.status(200).json({
        cart: { 
          id: cart.id, 
          items: [], 
          restaurant_id: cart.restaurant_id, 
          order_group_id: cart.order_group_id,
          order_type: cart.order_type || 'DINE_IN'
        },
        totals: cartTotals,
        minOrderAmount: restaurantResult.length > 0 ? Number(restaurantResult[0].minimum_order_amount) : 0,
        isLoggedIn: !!user_id
      });
    }

    // If restaurant_id is provided, continue with existing logic
    // If force, delete all other active carts except for the same restaurant/group/order_type
    if (force) {
      await db.query(
        `DELETE ci FROM CartItems ci JOIN Cart c ON ci.cart_id = c.id
         WHERE (c.user_id = ? OR c.session_id = ?)
         AND c.is_finalized = FALSE
         AND NOT (c.restaurant_id = ? AND (c.order_group_id <=> ?) AND c.order_type = ?)`,
        [user_id, session_id, restaurant_id, order_group_id || null, order_type]
      );
      await db.query(
        `DELETE FROM Cart
         WHERE (user_id = ? OR session_id = ?)
         AND is_finalized = FALSE
         AND NOT (restaurant_id = ? AND (order_group_id <=> ?) AND order_type = ?)`,
        [user_id, session_id, restaurant_id, order_group_id || null, order_type]
      );
    } else {
      // If there are multiple active carts, throw a cart conflict error
      if (activeCarts.length > 1) {
        return res.status(409).json({
          error: "cart_conflict",
          message: "Multiple active carts found. Please resolve the conflict.",
          carts: activeCarts
        });
      }
      // If there is an active cart for a different restaurant/group/order_type, prompt for force
      if (activeCarts.length === 1) {
        const oldCart = activeCarts[0];
        if (oldCart.restaurant_id !== parseInt(restaurant_id) || 
            (order_group_id && oldCart.order_group_id != order_group_id) ||
            oldCart.order_type !== order_type) {
          // Calculate total for old cart using the utility function
          const oldCartTotals = await calculateCartTotalsByCartId(oldCart.id);
          return res.status(409).json({
            error: "active_cart_exists",
            cart: {
              id: oldCart.id,
              restaurant_id: oldCart.restaurant_id,
              order_group_id: oldCart.order_group_id,
              order_type: oldCart.order_type,
              total: oldCartTotals.total
            }
          });
        }
      }
    }

    try {
      // Check if a cart with these exact parameters already exists
      const existingCartQuery = `SELECT id, order_type FROM Cart 
       WHERE ${condition} AND restaurant_id = ? AND (order_group_id <=> ?) AND order_type = ? AND is_finalized = 0 
       LIMIT 1`;
      
      const existingCartParams = [param, restaurant_id, order_group_id || null, order_type];
      const existingCartResult = await db.query(existingCartQuery, existingCartParams);
      
      if (existingCartResult && existingCartResult.length > 0) {
        // Return existing cart with proper totals calculation using utility function
        const cartTotals = await calculateCartTotalsByCartId(existingCartResult[0].id);
        
        return res.status(200).json({
          cart: { 
            id: existingCartResult[0].id, 
            items: [], 
            restaurant_id, 
            order_group_id: order_group_id || null,
            order_type: existingCartResult[0].order_type
          },
          totals: cartTotals,
          minOrderAmount: 0,
          isLoggedIn: !!user_id
        });
      }
    } catch (error) {
      console.error("Error checking for existing cart:", error);
      // Continue with cart creation even if check fails
    }

    // Implement retry logic for cart creation
    let retryCount = 0;
    const maxRetries = 3;
    let cartCreated = false;
    let newCartId;
    
    while (!cartCreated && retryCount < maxRetries) {
      try {
        // Create new cart
        const result = await db.query(
          `INSERT INTO Cart (user_id, session_id, restaurant_id, order_group_id, order_type, is_finalized, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, 0, NOW(), NOW())`,
          [user_id || null, session_id || null, restaurant_id, order_group_id || null, order_type]
        );
        newCartId = result.insertId;
        cartCreated = true;
      } catch (error) {
        if ((error.code === 'ER_DUP_ENTRY' || error.code === 'ER_LOCK_DEADLOCK') && retryCount < maxRetries) {
          // Small delay before retry with exponential backoff
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retryCount)));
          retryCount++;
          
          // Check if cart was actually created despite the error
          if (error.code === 'ER_DUP_ENTRY') {
            try {
              const dupCheckQuery = `SELECT id FROM Cart 
                 WHERE ${condition} AND restaurant_id = ? AND (order_group_id <=> ?) AND order_type = ? AND is_finalized = 0 
                 LIMIT 1`;
              
              const dupCheckParams = [param, restaurant_id, order_group_id || null, order_type];
              const dupCheckResult = await db.query(dupCheckQuery, dupCheckParams);
              
              if (dupCheckResult && dupCheckResult.length > 0) {
                // Cart already exists, use it
                newCartId = dupCheckResult[0].id;
                cartCreated = true;
              }
            } catch (checkError) {
              console.error("Error during duplicate cart check:", checkError);
              // Continue retrying
            }
          }
        } else {
          // Not a retriable error or too many retries
          throw error;
        }
      }
    }

    if (!cartCreated) {
      throw new Error("Failed to create cart after multiple attempts");
    }

    // Return new cart info with proper totals calculation using utility function
    const cartTotals = await calculateCartTotalsByCartId(newCartId);
    
    return res.status(201).json({
      cart: { 
        id: newCartId, 
        items: [], 
        restaurant_id, 
        order_group_id: order_group_id || null,
        order_type: order_type
      },
      totals: cartTotals,
      minOrderAmount: 0,
      isLoggedIn: !!user_id
    });
  } catch (error) {
    console.error("Failed to create cart:", error);
    res.status(500).json({ error: "Failed to create cart" });
  }
});

// API: Fetch Cart Items
router.post("/items", optionalAuthenticateUser, async (req, res) => {
  const { restaurant_id, session_id } = req.body;
  const userId = req.user ? req.user.userId : null;

  if (!restaurant_id) {
    return res.status(400).json({ error: "restaurant_id is required" });
  }

  if (!userId && !session_id) {
    return res.status(400).json({ error: "Either session_id or user authentication required." });
  }

  try {
    let cartQuery, cartParams;
    if (userId) {
      cartQuery = `
        SELECT id FROM Cart
        WHERE user_id = ? AND restaurant_id = ? AND is_finalized = FALSE
        LIMIT 1;
      `;
      cartParams = [userId, restaurant_id];
    } else {
      cartQuery = `
        SELECT id FROM Cart 
        WHERE session_id = ? AND restaurant_id = ? AND is_finalized = FALSE 
        LIMIT 1;
      `;
      cartParams = [session_id, restaurant_id];
    }

    const cartResults = await db.query(cartQuery, cartParams);

    if (!cartResults || cartResults.length === 0) {
      return res.json({ cartItems: [] });
    }

    const cartId = cartResults[0].id;

    // Fetch cart items and associated details
    const cartItemsQuery = `
        SELECT 
          ci.id,
          ci.item_id,
          ci.quantity,
          ci.price,
          ci.addon_items,
          ci.variation_id,
          i.name as item_name,
          i.price as item_price,
          i.image_url,
          i.prep_time,
          v.name as variation_name,
          v.price as variation_price
        FROM CartItems ci
        JOIN Items i ON ci.item_id = i.id
        LEFT JOIN Variations v ON ci.variation_id = v.id
        WHERE ci.cart_id = ?
        ORDER BY ci.created_at ASC;
      `;

    const cartItems = await db.query(cartItemsQuery, [cartId]);

    // Process each cart item to include add-on details
    const cartItemsWithAddons = await Promise.all(cartItems.map(async (cartItem) => {
      if (!cartItem.addon_items) {
        return cartItem;
      }

      try {
        // Parse the addon_items JSON string
        const addonItemsArray = JSON.parse(cartItem.addon_items);
        
        if (addonItemsArray.length > 0) {
          // Extract addon IDs
          const addonIds = addonItemsArray.map(addon => addon.id);
          
          // Create a map of quantities by addon ID
          const quantityMap = addonItemsArray.reduce((map, addon) => {
            map[addon.id] = addon.quantity || 1;
            return map;
          }, {});

          // Fetch addon details from AddOnItems table
          const addonQuery = `
            SELECT id, name, price 
            FROM AddOnItems 
            WHERE id IN (${addonIds.map(() => '?').join(',')})
          `;
          
          const addonDetails = await db.query(addonQuery, addonIds);

          // Combine addon details with quantities
          const selected_addons = addonDetails.map(addon => ({
            id: addon.id,
            name: addon.name,
            price: parseFloat(addon.price),
            quantity: quantityMap[addon.id]
          }));

          return {
            ...cartItem,
            selected_addons
          };
        }
      } catch (error) {
        console.error('Error processing addons for cart item:', error);
      }

      return cartItem;
    }));
    
    res.status(200).json({ cartItems: cartItemsWithAddons });
    
  } catch (error) {
    console.error("Failed to fetch cart:", error);
    if (error.code === 'ER_PARSE_ERROR') {
      return res.status(500).json({ error: "Invalid addon items format" });
    }
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get cart
router.get("/", optionalAuthenticateUser, async (req, res) => {
  try {
    const { session_id, restaurant_id, order_group_id } = req.query;
    const user_id = req.user ? req.user.userId : null;

    if (!restaurant_id) {
      return res.status(400).json({ 
        success: false,
        error: "restaurant_id is required" 
      });
    }

    // Check if the cart exists, construct the where clause
    let whereClause = "";
    let queryParams = [];

    // Base condition on user ID or session ID
    if (user_id) {
      whereClause = "c.user_id = ?";
      queryParams.push(user_id);
    } else if (session_id) {
      whereClause = "c.session_id = ?";
      queryParams.push(session_id);
    } else {
      return res.status(400).json({ 
        success: false,
        error: "user_id or session_id is required" 
      });
    }

    // Add restaurant condition
    whereClause += " AND c.restaurant_id = ?";
    queryParams.push(restaurant_id);

    // Add not finalized condition
    whereClause += " AND c.is_finalized = 0";

    // Add order group condition if specified
    if (order_group_id) {
      whereClause += " AND c.order_group_id = ?";
      queryParams.push(order_group_id);
    }

    // ... rest of existing code for cart query ...

  } catch (error) {
    // ... existing error handling ...
  }
});

// Delete a cart
router.delete("/:cartId", optionalAuthenticateUser, async (req, res) => {
  try {
    const { cartId } = req.params;
    const user_id = req.user ? req.user.userId : null;
    const { session_id } = req.body;

    // Verify cart ownership
    const cart = await db.query(
      `SELECT * FROM Cart WHERE id = ? AND (user_id = ? OR session_id = ?)`,
      [cartId, user_id, session_id]
    );

    if (cart.length === 0) {
      return res.status(404).json({ error: "Cart not found or unauthorized" });
    }

    // Delete cart items first (due to foreign key constraint)
    await db.query(`DELETE FROM CartItems WHERE cart_id = ?`, [cartId]);
    
    // Delete the cart
    await db.query(`DELETE FROM Cart WHERE id = ?`, [cartId]);

    res.json({ message: "Cart deleted successfully" });
  } catch (error) {
    console.error("Error deleting cart:", error);
    res.status(500).json({ error: "Failed to delete cart" });
  }
});

module.exports = router;