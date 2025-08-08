// Enhanced cart totals calculation with item-level tax support
const db = require('../db');

/**
 * Calculate cart totals by cart ID - fetches items and calculates totals
 * @param {number|null} cartId - The cart ID (null for empty cart)
 * @returns {Promise<Object>} - Complete totals object
 */
const calculateCartTotalsByCartId = async (cartId) => {
  if (!cartId) {
    // Return empty cart totals
    return getEmptyTotals();
  }

  try {
    // First, get cart details to know restaurant and order type
    const cartDetails = await db.query(
      `SELECT restaurant_id, order_type FROM Cart WHERE id = ?`,
      [cartId]
    );

    if (!cartDetails || cartDetails.length === 0) {
      throw new Error(`Cart with ID ${cartId} not found`);
    }

    const { restaurant_id, order_type } = cartDetails[0];

    // Fetch restaurant details for charges calculation
    const restaurant = await db.query(
      `SELECT id, delivery_charge, packaging_charge, packaging_charge_type, minimum_order_amount,
              sc_applicable_on, sc_type, sc_value, is_active
       FROM Restaurants WHERE id = ?`,
      [restaurant_id]
    );

    if (!restaurant || restaurant.length === 0) {
      throw new Error(`Restaurant with ID ${restaurant_id} not found`);
    }

    // Fetch cart items with all details
    const cartItems = await db.query(
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

    // Process addons for each cart item
    const cartItemsWithAddons = await Promise.all(cartItems.map(async (cartItem) => {
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
    }));

    // Calculate totals using the internal function
    return await calculateCartTotals(cartItemsWithAddons, restaurant[0], order_type || 'DINE_IN');

  } catch (error) {
    console.error('Error in calculateCartTotalsByCartId:', error);
    // Return empty totals on error
    return getEmptyTotals();
  }
};

/**
 * Helper function to return empty totals structure
 * @returns {Object} - Empty totals object
 */
function getEmptyTotals() {
  return {
    subtotal: 0,
    total: 0,
    deliveryCharge: 0,
    packagingCharge: 0,
    serviceCharge: 0,
    taxAmount: 0,
    breakdown: {
      itemTotal: 0,
      deliveryCharge: 0,
      packagingCharge: 0,
      serviceCharge: 0,
      taxAmount: 0
    }
  };
}

/**
 * Internal function to calculate cart totals from cart items array
 * @param {Array} cartItems - Array of cart items with details
 * @param {Object} restaurant - Restaurant configuration
 * @param {string} orderType - Order type (DINE_IN, PICKUP, DELIVERY)
 * @returns {Promise<Object>} - Complete totals object
 */
const calculateCartTotals = async (cartItems, restaurant, orderType = 'DINE_IN') => {
  if (!Array.isArray(cartItems)) {
    return getEmptyTotals();
  }

  // Calculate item subtotal and tax amounts
  let itemTotal = 0;
  let totalTaxAmount = 0;
  
  // Process each cart item for tax calculation
  for (const item of cartItems) {
    const itemPrice = parseFloat(item?.price || 0);
    itemTotal += itemPrice;
    
    // Calculate item-specific taxes
    if (item.item_id && restaurant?.id) {
      try {
        const taxAmount = await calculateItemTaxes(item.item_id, itemPrice, restaurant.id);
        totalTaxAmount += taxAmount;
      } catch (error) {
        console.error('Error calculating item taxes:', error);
        // Fallback to 5% if tax calculation fails
        totalTaxAmount += itemPrice * 0.05;
      }
    } else {
      // Fallback to 5% GST if no item details
      totalTaxAmount += itemPrice * 0.05;
    }
  }

  // Delivery charge - REMOVED (we don't support delivery)
  const deliveryCharge = 0;

  // Packaging charge - Only apply for PICKUP orders
  let packagingCharge = 0;
  if (orderType === 'PICKUP' && restaurant?.packaging_charge) {
    if (restaurant?.packaging_applicable_on === 'ITEM') {
      // Per item
      if (restaurant?.packaging_charge_type === 'PERCENTAGE') {
        packagingCharge = cartItems.reduce((sum, item) => {
          return sum + (parseFloat(item?.price || 0) * (parseFloat(restaurant.packaging_charge) || 0) / 100);
        }, 0);
      } else {
        // Fixed per item
        packagingCharge = cartItems.reduce((sum, item) => {
          return sum + ((parseFloat(restaurant.packaging_charge) || 0) * (item.quantity || 1));
        }, 0);
      }
    } else {
      // Per order (default)
      if (restaurant?.packaging_charge_type === 'PERCENTAGE') {
        packagingCharge = itemTotal * (parseFloat(restaurant.packaging_charge) || 0) / 100;
      } else {
        packagingCharge = parseFloat(restaurant.packaging_charge || 0);
      }
    }
  }

  // Service charge
  let serviceCharge = 0;
  // Map order types to PetPooja format for service charge applicability
  const orderTypeMapping = {
    'DINE_IN': 'D',
    'PICKUP': 'P',
    'DELIVERY': 'H'
  };
  const posOrderType = orderTypeMapping[orderType] || 'D';
  
  // Only apply if order type matches applicability (D/P/H)
  const scApplicable = (restaurant?.sc_applicable_on || 'H,P,D').split(',').includes(posOrderType);
  if (scApplicable) {
    if (restaurant?.sc_type === '1') {
      // Fixed
      serviceCharge = parseFloat(restaurant.sc_value || 0);
    } else {
      // Percentage (default to TOTAL, can be enhanced for CORE)
      // CORE = itemTotal, TOTAL = itemTotal + packaging (no delivery)
      const scBase = (restaurant?.sc_calculate_on === '1') ? itemTotal : (itemTotal + packagingCharge);
      serviceCharge = scBase * (parseFloat(restaurant.sc_value) || 0) / 100;
    }
  }

  // Taxes on service charge and packaging (if applicable)
  // Service charge tax is typically calculated separately
  const serviceChargeTax = serviceCharge * 0.05; // 5% on service charge
  const packagingChargeTax = packagingCharge * 0.05; // 5% on packaging charge
  
  // Final total tax amount includes item taxes + service charge tax + packaging tax
  const finalTaxAmount = totalTaxAmount + serviceChargeTax + packagingChargeTax;

  // Final total
  const total = itemTotal + packagingCharge + serviceCharge + finalTaxAmount;

  // Round all values
  return {
    subtotal: Number(itemTotal.toFixed(2)),
    total: Number(total.toFixed(2)),
    deliveryCharge: 0, // Always 0 - we don't support delivery
    packagingCharge: Number(packagingCharge.toFixed(2)),
    serviceCharge: Number(serviceCharge.toFixed(2)),
    taxAmount: Number(finalTaxAmount.toFixed(2)),
    breakdown: {
      itemTotal: Number(itemTotal.toFixed(2)),
      deliveryCharge: 0, // Always 0
      packagingCharge: Number(packagingCharge.toFixed(2)),
      serviceCharge: Number(serviceCharge.toFixed(2)),
      taxAmount: Number(finalTaxAmount.toFixed(2)),
      // Detailed tax breakdown
      itemTaxAmount: Number(totalTaxAmount.toFixed(2)),
      serviceChargeTax: Number(serviceChargeTax.toFixed(2)),
      packagingChargeTax: Number(packagingChargeTax.toFixed(2))
    }
  };
};

/**
 * Calculate taxes for a specific item based on its tax_ids
 * @param {number} itemId - The item ID
 * @param {number} itemPrice - The item price (including addons)
 * @param {number} restaurantId - The restaurant ID
 * @returns {Promise<number>} - Total tax amount for the item
 */
async function calculateItemTaxes(itemId, itemPrice, restaurantId) {
  try {
    // Get item tax configuration
    const itemRows = await db.query(
      `SELECT tax_ids, tax_inclusive FROM Items WHERE id = ? AND restaurant_id = ?`,
      [itemId, restaurantId]
    );

    if (!itemRows || itemRows.length === 0) {
      // Item not found, use fallback 5%
      return itemPrice * 0.05;
    }

    const item = itemRows[0];
    
    // If no tax IDs configured, use default 5%
    if (!item || !item.tax_ids) {
      return itemPrice * 0.05;
    }

    // Parse tax IDs
    const taxIds = item.tax_ids.split(',').map(id => id.trim()).filter(Boolean);
    
    if (taxIds.length === 0) {
      // No valid tax IDs, use fallback 5%
      return itemPrice * 0.05;
    }

    // Fetch tax details
    const placeholders = taxIds.map(() => '?').join(',');
    const taxRows = await db.query(
      `SELECT rate, type FROM Taxes 
       WHERE external_id IN (${placeholders}) 
       AND restaurant_id = ? 
       AND is_active = 1`,
      [...taxIds, restaurantId]
    );

    if (!taxRows || taxRows.length === 0) {
      // No tax found, use fallback 5%
      return itemPrice * 0.05;
    }

    // Calculate total tax amount
    let totalTaxAmount = 0;
    const taxableAmount = item.tax_inclusive ? itemPrice / (1 + (taxRows.reduce((sum, tax) => sum + parseFloat(tax.rate), 0) / 100)) : itemPrice;
    
    for (const tax of taxRows) {
      if (tax.type === 'percentage') {
        totalTaxAmount += taxableAmount * (parseFloat(tax.rate) / 100);
      } else {
        // Fixed tax amount
        totalTaxAmount += parseFloat(tax.rate);
      }
    }

    return totalTaxAmount;

  } catch (error) {
    console.error('Error in calculateItemTaxes:', error);
    // Fallback to 5% on error
    return itemPrice * 0.05;
  }
}

// Export only the public API
module.exports = {
  calculateCartTotalsByCartId,
  calculateItemTaxes
}; 