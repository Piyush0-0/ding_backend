const express = require("express");
const router = express.Router();
const db = require("../db");
const { createLinkedAccount } = require('../services/razorpay');
const { authenticateUser } = require('../middlewares/authenticateUser');
const OnboardingService = require('../services/onboardingService');

// Get all restaurants
router.get("/", async (req, res) => {
  try {
    const query = `
      SELECT id, name, address, contact, latitude, longitude,
             minimum_order_amount, minimum_prep_time, delivery_charge,
             packaging_charge, packaging_charge_type, payment_acceptance_type,
             is_active, sc_applicable_on, sc_type, sc_value
      FROM Restaurants;
    `;
    const restaurants = await db.query(query);
    res.json({ restaurants });
  } catch (error) {
    console.error("Error fetching restaurants:", error);
    res.status(500).json({ error: "Failed to fetch restaurants" });
  }
});

// Get restaurant details
router.get("/:restaurantId", async (req, res) => {
  const { restaurantId } = req.params;
  try {
    const query = `
      SELECT id, name, address, contact, latitude, longitude,
             minimum_order_amount, minimum_prep_time, delivery_charge,
             packaging_charge, packaging_charge_type, payment_acceptance_type,
             is_active, sc_applicable_on, sc_type, sc_value,
             city, state, country
      FROM Restaurants WHERE id = ?;
    `;
    const restaurantRows = await db.query(query, [restaurantId]);
    const restaurant = restaurantRows[0];
    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }
    res.json({ restaurant });
  } catch (error) {
    console.error("Error fetching restaurant:", error);
    res.status(500).json({ error: "Failed to fetch restaurant" });
  }
});

router.get("/:restaurantId/restaurant-reviews", async (req, res) => {
  const { restaurantId } = req.params;
  console.log("Fetching restaurant reviews for restaurantId:", restaurantId);

  try {
    const query = `
      SELECT 
          rr.id AS review_id,
          rr.rating,
          rr.comment,
          rr.created_at,
          u.name AS user_name
      FROM RestaurantReview rr
      JOIN Users u ON rr.user_id = u.id
      WHERE rr.restaurant_id = 1;
    `;

    const reviews = await db.query(query, [restaurantId]);
    console.log("Restaurant Reviews Query Result:", reviews);

    res.json({ reviews });
  } catch (error) {
    console.error("Error fetching restaurant reviews:", error);
    res.status(500).json({ error: "Failed to fetch restaurant reviews" });
  }
});

// Get categories for a restaurant
router.get("/:restaurantId/categories", async (req, res) => {
  const { restaurantId } = req.params;
  try {
    // First verify if restaurant exists
    const restaurantRows = await db.query(
      "SELECT id FROM Restaurants WHERE id = ?",
      [restaurantId]
    );
    const restaurant = restaurantRows[0];
    if (!restaurant) {
      return res.status(404).json({ error: "Restaurant not found" });
    }

    // Fetch categories with their items count
    const query = `
      SELECT 
        c.id,
        c.external_id,
        c.name,
        c.is_active,
        COUNT(i.id) as items_count
      FROM Categories c
      LEFT JOIN Items i ON i.category_id = c.id AND i.is_active = true
      WHERE c.restaurant_id = ? AND c.is_active = true
      GROUP BY c.id
      ORDER BY c.name;
    `;
    
    const categories = await db.query(query, [restaurantId]);
    res.json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// Get items by menu
router.get("/:restaurantId/items", async (req, res) => {
  const { restaurantId } = req.params;

  try {
    const query = `
      SELECT 
        i.id,
        i.external_id,
        i.category_id,
        i.name,
        i.description,
        i.price,
        i.image_url,
        i.is_recommend,
        i.is_active,
        COALESCE(
          JSON_ARRAYAGG(
            CASE 
              WHEN v.id IS NOT NULL THEN
                JSON_OBJECT(
                  'id', v.id,
                  'external_id', v.external_id,
                  'name', v.name,
                  'price', v.price,
                  'is_active', v.is_active
                )
              ELSE NULL
            END
          ),
          JSON_ARRAY()
        ) as variations,
        (
          SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
              'id', ag.id,
              'external_id', ag.external_id,
              'name', ag.name,
              'min_selection', ag.min_selection,
              'max_selection', ag.max_selection,
              'items', (
                SELECT JSON_ARRAYAGG(
                  JSON_OBJECT(
                    'id', ai.id,
                    'external_id', ai.external_id,
                    'name', ai.name,
                    'price', ai.price,
                    'is_active', ai.is_active
                  )
                )
                FROM AddOnItems ai
                WHERE ai.addon_group_id = ag.id AND ai.is_active = true
              )
            )
          )
          FROM AddOnGroups ag
          INNER JOIN Item_Addon_Groups iag ON iag.addon_group_id = ag.id
          WHERE iag.item_id = i.id
        ) as addon_groups
      FROM Items i
      LEFT JOIN Variations v ON v.item_id = i.id AND v.is_active = true
      WHERE i.restaurant_id = ? AND i.is_active = true
      GROUP BY i.id;
    `;
    const items = await db.query(query, [restaurantId]);
    
    // Clean up the JSON arrays and add logging
    const processedItems = items.map(item => {
      // Parse variations if it's a string
      let variations = item.variations;
      if (typeof variations === 'string') {
        try {
          variations = JSON.parse(variations);
        } catch (e) {
          console.error('Error parsing variations:', e);
          variations = [];
        }
      }
      
      // Filter out null values from variations
      variations = variations.filter(v => v !== null);
      
      const processedItem = {
        ...item,
        variations,
        addon_groups: item.addon_groups === null ? [] : JSON.parse(item.addon_groups)
      };
      
      console.log('Processing item:', {
        id: processedItem.id,
        name: processedItem.name,
        variations: processedItem.variations,
        hasVariations: Array.isArray(processedItem.variations) && processedItem.variations.length > 0
      });
      
      return processedItem;
    });

    res.json({ items: processedItems });
  } catch (error) {
    console.error("Error fetching items:", error);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

// Get reviews for items in a restaurant
router.get("/:restaurantId/reviews", async (req, res) => {
  const { restaurantId } = req.params;
  console.log("Fetching reviews for restaurantId:", restaurantId);
  try {
    const query = `
      SELECT 
          i.id AS item_id,
          IFNULL(ROUND(AVG(r.rating), 1), 0) AS averageRating,
          COUNT(r.rating) AS reviewCount
      FROM Items i
      LEFT JOIN Review r ON i.id = r.item_id
      WHERE i.restaurant_id = ?
      GROUP BY i.id;
    `;

    const result = await db.query(query, [restaurantId]);
    console.log("Reviews Query Result:", result);

    const reviews = result.map((row) => ({
      item_id: row.item_id,
      averageRating: row.averageRating,
      reviewCount: row.reviewCount,
    }));

    res.json({ reviews });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
  
});

router.post('/:restaurantId/review', async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { 
      restaurant_rating, 
      comment, 
      user_id,
      item_ratings = []
    } = req.body;

    if (!restaurant_rating || !user_id) {
      return res.status(400).json({ 
        error: 'Missing required fields: restaurant_rating, user_id' 
      });
    }

    if (restaurant_rating < 1 || restaurant_rating > 5) {
      return res.status(400).json({ 
        error: 'Restaurant rating must be between 1 and 5' 
      });
    }

    // Insert restaurant review
    const restaurantReviewQuery = `
      INSERT INTO RestaurantReview (restaurant_id, user_id, rating, comment, created_at)
      VALUES (?, ?, ?, ?, NOW())
    `;
    const restaurantReviewResult = await db.query(restaurantReviewQuery, [
      restaurantId,
      user_id,
      restaurant_rating,
      comment || null,
    ]);

    // Insert item reviews
    if (item_ratings.length > 0) {
      const itemReviewQuery = `
  INSERT INTO Review (user_id, item_id, rating, created_at)
  VALUES (?, ?, ?, NOW())
`;

await Promise.all(item_ratings.map(item => {
  return db.query(itemReviewQuery, [
    user_id,
    item.item_id,
    item.rating
  ]);
}));

    }

    // Update average rating
    await updateRestaurantAverageRating(restaurantId);

    res.status(201).json({
      message: 'Restaurant and item reviews submitted successfully',
      review_id: restaurantReviewResult.insertId
    });

  } catch (error) {
    console.error('Error submitting reviews:', error);
    res.status(500).json({
      error: 'Failed to submit reviews',
      details: error.message
    });
  }
});

// Onboard a restaurant as a Razorpay linked account
router.post('/:restaurantId/onboard-razorpay', async (req, res) => {
  const { restaurantId } = req.params;
  const accountData = req.body; // Should contain required KYC and bank details

  try {
    // Create linked account on Razorpay
    const account = await createLinkedAccount(accountData);
    const razorpayAccountId = account.id;

    // Update restaurant with the new razorpay_account_id
    await db.query(
      'UPDATE Restaurants SET razorpay_account_id = ? WHERE id = ?',
      [razorpayAccountId, restaurantId]
    );

    res.json({ success: true, razorpayAccountId, account });
  } catch (error) {
    console.error('Error onboarding restaurant to Razorpay:', error);
    res.status(500).json({ error: 'Failed to onboard restaurant to Razorpay', details: error.message });
  }
});

// Update restaurant average rating
async function updateRestaurantAverageRating(restaurantId) {
  const [ratings] = await db.query(
    'SELECT rating FROM RestaurantReview WHERE restaurant_id = ?',
    [restaurantId]
  );

  if (ratings.length > 0) {
    const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
    await db.query(
      'UPDATE Restaurants SET average_rating = ? WHERE id = ?',
      [avg, restaurantId]
    );
  }
}

// Restaurant onboarding endpoint
router.post("/onboard", async (req, res) => {
  const {
    restaurantName,
    address,
    city,
    state,
    zipCode,
    contact,
    cuisineType,
    description,
    minimumOrderAmount,
    deliveryCharge,
    packagingCharge,
    latitude,
    longitude
  } = req.body;

  try {
    // Verify authentication using cookies (like other endpoints)
    const token = req.cookies?.auth_token;
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const jwt = require('jsonwebtoken');
    const JWT_SECRET = "your_jwt_secret"; // Should match auth.js
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.role !== 'RESTAURANT_OWNER') {
      return res.status(403).json({ error: "Only restaurant owners can create restaurants" });
    }

    // Create restaurant
    const query = `
      INSERT INTO Restaurants (
        name, address, city, state, country, contact, 
        latitude, longitude, minimum_order_amount, 
        minimum_prep_time, delivery_charge, packaging_charge,
        payment_acceptance_type, created_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const result = await db.query(query, [
      restaurantName,
      address,
      city,
      state,
      'India', // Default country
      contact,
      latitude || null,
      longitude || null,
      minimumOrderAmount || 0,
      30, // Default prep time
      deliveryCharge || 0,
      packagingCharge || 0,
      'PAY_AND_PLACE', // Default payment type
      decoded.userId // Link restaurant to the user who created it
    ]);

    const restaurantId = result.insertId;

    // Add default categories if cuisineType is provided
    if (cuisineType) {
      const defaultCategories = getDefaultCategoriesByCuisine(cuisineType);
      for (const category of defaultCategories) {
        await db.query(
          'INSERT INTO Categories (restaurant_id, name, is_active, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
          [restaurantId, category, true]
        );
      }
    }

    // Get the created restaurant
    const restaurantQuery = `
      SELECT id, name, address, city, state, contact, 
             minimum_order_amount, minimum_prep_time, 
             delivery_charge, packaging_charge, payment_acceptance_type
      FROM Restaurants WHERE id = ?
    `;
    
    const restaurant = await db.query(restaurantQuery, [restaurantId]);

    res.status(201).json({
      success: true,
      message: "Restaurant onboarded successfully",
      restaurant: restaurant[0]
    });

  } catch (error) {
    console.error("Error creating restaurant:", error);
    res.status(500).json({ 
      success: false, 
      error: "Failed to create restaurant" 
    });
  }
});

// Helper function to get default categories based on cuisine type
function getDefaultCategoriesByCuisine(cuisineType) {
  const categoryMap = {
    'north indian': ['Appetizers', 'Main Course', 'Rice & Biryani', 'Breads', 'Desserts', 'Beverages'],
    'south indian': ['Appetizers', 'Main Course', 'Rice & Biryani', 'Breads', 'Desserts', 'Beverages'],
    'indian': ['Appetizers', 'Main Course', 'Rice & Biryani', 'Breads', 'Desserts', 'Beverages'],
    'chinese': ['Appetizers', 'Soups', 'Main Course', 'Rice & Noodles', 'Desserts', 'Beverages'],
    'italian': ['Appetizers', 'Pasta', 'Pizza', 'Main Course', 'Desserts', 'Beverages'],
    'mexican': ['Appetizers', 'Tacos', 'Burritos', 'Main Course', 'Desserts', 'Beverages'],
    'american': ['Appetizers', 'Burgers', 'Sandwiches', 'Main Course', 'Desserts', 'Beverages'],
    'thai': ['Appetizers', 'Soups', 'Curries', 'Stir Fry', 'Desserts', 'Beverages'],
    'continental': ['Appetizers', 'Soups', 'Main Course', 'Sides', 'Desserts', 'Beverages'],
    'multi-cuisine': ['Appetizers', 'Main Course', 'Rice & Breads', 'Desserts', 'Beverages'],
    'fast food': ['Burgers', 'Sandwiches', 'Snacks', 'Sides', 'Beverages'],
    'desserts': ['Cakes', 'Ice Cream', 'Pastries', 'Traditional Sweets', 'Beverages'],
    'beverages': ['Hot Beverages', 'Cold Beverages', 'Juices', 'Smoothies'],
    'street food': ['Chaat', 'Snacks', 'Wraps', 'Appetizers', 'Beverages']
  };
  
  // Normalize cuisine type to lowercase for lookup
  const normalizedCuisine = cuisineType ? cuisineType.toLowerCase() : '';
  
  return categoryMap[normalizedCuisine] || ['Appetizers', 'Main Course', 'Desserts', 'Beverages'];
}

// Dashboard Statistics endpoint
router.get("/:restaurantId/stats", authenticateUser, async (req, res) => {
  const { restaurantId } = req.params;
  const { userId, role } = req.user;
  
  try {
    // Verify restaurant ownership or admin access
    if (role !== 'RESTAURANT_OWNER' && role !== 'ADMIN') {
      return res.status(403).json({ error: "Access denied" });
    }

    // For restaurant owners, verify they own this restaurant
    if (role === 'RESTAURANT_OWNER') {
      const [ownershipCheck] = await db.query(
        'SELECT id FROM Restaurants WHERE id = ? AND created_by_user_id = ?',
        [restaurantId, userId]
      );
      if (!ownershipCheck) {
        return res.status(403).json({ error: "Access denied - not your restaurant" });
      }
    }

    // Get total orders count
    const totalOrdersQuery = `
      SELECT COUNT(*) as total_orders 
      FROM Orders 
      WHERE restaurant_id = ?
    `;
    const [totalOrdersResult] = await db.query(totalOrdersQuery, [restaurantId]);
    const totalOrders = totalOrdersResult[0]?.total_orders || 0;

    // Get total revenue
    const totalRevenueQuery = `
      SELECT COALESCE(SUM(total_amount), 0) as total_revenue 
      FROM Orders 
      WHERE restaurant_id = ? AND order_status NOT IN ('cancelled', 'failed')
    `;
    const [totalRevenueResult] = await db.query(totalRevenueQuery, [restaurantId]);
    const totalRevenue = parseFloat(totalRevenueResult[0]?.total_revenue || 0);

    // Calculate average order value
    const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

    // Get pending orders count
    const pendingOrdersQuery = `
      SELECT COUNT(*) as pending_orders 
      FROM Orders 
      WHERE restaurant_id = ? AND order_status IN ('pending', 'confirmed', 'preparing')
    `;
    const [pendingOrdersResult] = await db.query(pendingOrdersQuery, [restaurantId]);
    const pendingOrders = pendingOrdersResult[0]?.pending_orders || 0;

    // Get today's orders
    const todayOrdersQuery = `
      SELECT COUNT(*) as today_orders,
             COALESCE(SUM(total_amount), 0) as today_revenue
      FROM Orders 
      WHERE restaurant_id = ? 
      AND DATE(created_at) = CURDATE()
      AND order_status NOT IN ('cancelled', 'failed')
    `;
    const [todayResult] = await db.query(todayOrdersQuery, [restaurantId]);
    const todayOrders = todayResult[0]?.today_orders || 0;
    const todayRevenue = parseFloat(todayResult[0]?.today_revenue || 0);

    const stats = {
      totalOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100, // Round to 2 decimal places
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      pendingOrders,
      todayOrders,
      todayRevenue: Math.round(todayRevenue * 100) / 100
    };

    res.json(stats);

  } catch (error) {
    console.error("Error fetching restaurant stats:", error);
    res.status(500).json({ error: "Failed to fetch restaurant statistics" });
  }
});

// Dashboard Orders endpoint
router.get("/:restaurantId/orders", authenticateUser, async (req, res) => {
  const { restaurantId } = req.params;
  const { limit = 10, status = 'all', page = 1 } = req.query;
  const { userId, role } = req.user;
  
  try {
    // Verify restaurant ownership or admin access
    if (role !== 'RESTAURANT_OWNER' && role !== 'ADMIN') {
      return res.status(403).json({ error: "Access denied" });
    }

    // For restaurant owners, verify they own this restaurant
    if (role === 'RESTAURANT_OWNER') {
      const [ownershipCheck] = await db.query(
        'SELECT id FROM Restaurants WHERE id = ? AND created_by_user_id = ?',
        [restaurantId, userId]
      );
      if (!ownershipCheck) {
        return res.status(403).json({ error: "Access denied - not your restaurant" });
      }
    }

    let statusCondition = '';
    if (status !== 'all') {
      if (status === 'recent') {
        statusCondition = `ORDER BY o.created_at DESC`;
      } else {
        statusCondition = `AND o.order_status = '${status}'`;
      }
    }

    const offset = (page - 1) * limit;
    
    const ordersQuery = `
      SELECT 
        o.id,
        o.order_number,
        o.total_amount,
        o.order_status as status,
        o.order_type,
        o.created_at,
        o.updated_at,
        u.name as customer_name,
        u.phoneNumber as customer_phone
      FROM Orders o
      LEFT JOIN Users u ON o.user_id = u.id
      WHERE o.restaurant_id = ? ${statusCondition}
      ${status === 'recent' ? '' : 'ORDER BY o.created_at DESC'}
      LIMIT ? OFFSET ?
    `;

    const orders = await db.query(ordersQuery, [restaurantId, parseInt(limit), parseInt(offset)]);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total_count 
      FROM Orders o 
      WHERE o.restaurant_id = ? ${statusCondition.replace('ORDER BY o.created_at DESC', '')}
    `;
    const [countResult] = await db.query(countQuery, [restaurantId]);
    const totalCount = countResult[0]?.total_count || 0;

    res.json({
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error("Error fetching restaurant orders:", error);
    res.status(500).json({ error: "Failed to fetch restaurant orders" });
  }
});

// REMOVED: Duplicate onboarding status endpoints
// Use GET /api/restaurants/onboarding/state instead

// Create POS Integration endpoint
router.post("/:restaurantId/pos-integration", authenticateUser, async (req, res) => {
  const { restaurantId } = req.params;
  const { posSystem, restaurantId: posRestaurantId, menuSharingCode, apiKey, apiSecret, accessToken } = req.body;
  const { userId, role } = req.user;
  
  try {
    // Verify restaurant ownership or admin access
    if (role !== 'RESTAURANT_OWNER' && role !== 'ADMIN') {
      return res.status(403).json({ error: "Access denied" });
    }

    // For restaurant owners, verify they own this restaurant
    if (role === 'RESTAURANT_OWNER') {
      const [ownershipCheck] = await db.query(
        'SELECT id FROM Restaurants WHERE id = ? AND created_by_user_id = ?',
        [restaurantId, userId]
      );
      if (!ownershipCheck) {
        return res.status(403).json({ error: "Access denied - not your restaurant" });
      }
    }

    // Validate required fields
    if (!posSystem || !posRestaurantId || !menuSharingCode || !apiKey || !apiSecret || !accessToken) {
      return res.status(400).json({ error: "Missing required POS integration fields" });
    }

    // Only support PetPooja for now
    if (posSystem !== 'petpooja') {
      return res.status(400).json({ error: "Only PetPooja POS is currently supported" });
    }

    // Get the POS provider ID for the provider
    const [posProvider] = await db.query(
      'SELECT id FROM pos_providers WHERE provider_name = ? AND is_active = 1',
      [posSystem]
    );
    
    if (!posProvider) {
      return res.status(400).json({ error: `POS provider '${posSystem}' not found or inactive` });
    }

    // Create POS integration configuration
    const posConfig = {
      restaurantid: posRestaurantId,
      menusharingcode: menuSharingCode,
      app_key: apiKey,
      app_secret: apiSecret,
      access_token: accessToken,
      endpoint: 'https://qle1yy2ydc.execute-api.ap-southeast-1.amazonaws.com/V1/mapped_restaurant_menus'
    };

    // Insert or update POS integration with proper pos_provider_id
    await db.query(
      `INSERT INTO restaurant_pos_integrations 
       (restaurant_id, pos_type, pos_provider_id, pos_restaurant_id, endpoint, api_key, config, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
       pos_provider_id = VALUES(pos_provider_id),
       pos_restaurant_id = VALUES(pos_restaurant_id),
       endpoint = VALUES(endpoint),
       api_key = VALUES(api_key),
       config = VALUES(config),
       active = VALUES(active),
       updated_at = NOW()`,
      [
        restaurantId,
        posSystem,
        posProvider.id,  // Now properly setting the pos_provider_id
        posRestaurantId,
        posConfig.endpoint,
        accessToken,
        JSON.stringify(posConfig),
        1
      ]
    );

    // POS integration created successfully - onboarding state will be updated dynamically

    res.json({
      success: true,
      message: "POS integration configured successfully",
      posType: posSystem,
      restaurantId: posRestaurantId
    });

  } catch (error) {
    console.error('Error creating POS integration:', error);
    res.status(500).json({ error: 'Failed to create POS integration' });
  }
});

// Fetch menu preview endpoint
router.get("/:restaurantId/menu-preview", authenticateUser, async (req, res) => {
  const { restaurantId } = req.params;
  const { userId, role } = req.user;
  
  try {
    // Verify restaurant ownership or admin access
    if (role !== 'RESTAURANT_OWNER' && role !== 'ADMIN') {
      return res.status(403).json({ error: "Access denied" });
    }

    // For restaurant owners, verify they own this restaurant
    if (role === 'RESTAURANT_OWNER') {
      const [ownershipCheck] = await db.query(
        'SELECT id FROM Restaurants WHERE id = ? AND created_by_user_id = ?',
        [restaurantId, userId]
      );
      if (!ownershipCheck) {
        return res.status(403).json({ error: "Access denied - not your restaurant" });
      }
    }

    // Get POS integration config
    const { fetchMenu } = require('../services/posAdapters/petpoojaAdapter');
    const { getPetpoojaAdapterConfig } = require('../services/posConfigService');
    
    const { integration, config } = await getPetpoojaAdapterConfig(restaurantId);
    
    if (!integration || !integration.active) {
      return res.status(400).json({ 
        success: false,
        error: 'No active POS integration found. Please configure POS integration first.' 
      });
    }

    // Fetch menu from PetPooja
    const menuResult = await fetchMenu(config);
    
    if (!menuResult.data || menuResult.data.success !== '1') {
      return res.status(400).json({
        success: false,
        error: 'Failed to fetch menu from PetPooja',
        details: menuResult.data
      });
    }

    // Log basic success info
    console.log('✅ Menu fetched successfully from Petpooja');

    // Extract menu data for preview
    const petpoojaData = menuResult.data;
    
    // Check if data exists in the menu structure first, then fallback to main structure
    const categories = petpoojaData.menu?.categories || petpoojaData.categories || [];
    const items = petpoojaData.menu?.items || petpoojaData.items || [];
    const addons = petpoojaData.menu?.addongroups || petpoojaData.addongroups || [];
    const taxes = petpoojaData.menu?.taxes || petpoojaData.taxes || [];
    
    console.log('🔍 Processing menu data:');
    console.log(`📂 Found ${categories.length} categories`);
    console.log(`🍽️ Found ${items.length} items`);
    
    // Transform data to match frontend expectations
    // Group items under their respective categories
    const categoriesWithItems = categories.map(category => {
      const categoryItems = items.filter(item => 
        item.item_categoryid === category.categoryid
      ).map(item => {
        // Enhanced price handling - try multiple price fields
        let itemPrice = 0;
        let priceSource = 'none';
        
        // Try different price fields in order of preference
        if (item.price && parseFloat(item.price) > 0) {
          itemPrice = parseFloat(item.price);
          priceSource = 'price';
        } else if (item.sellingrate && parseFloat(item.sellingrate) > 0) {
          itemPrice = parseFloat(item.sellingrate);
          priceSource = 'sellingrate';
        } else if (item.mrp && parseFloat(item.mrp) > 0) {
          itemPrice = parseFloat(item.mrp);
          priceSource = 'mrp';
        } else if (item.variation && item.variation.length > 0) {
          // If item has variations, use the first variation's price
          const firstVariation = item.variation[0];
          if (firstVariation.price && parseFloat(firstVariation.price) > 0) {
            itemPrice = parseFloat(firstVariation.price);
            priceSource = 'variation';
          }
        }
        
        // Log items with 0 price for debugging
        if (itemPrice === 0) {
          console.log(`⚠️ Zero price item: ${item.itemname}`, {
            price: item.price,
            sellingrate: item.sellingrate,
            mrp: item.mrp,
            hasVariations: !!(item.variation && item.variation.length > 0),
            variationCount: item.variation?.length || 0
          });
        }
        
        return {
          id: item.itemid,
          name: item.itemname,
          description: item.itemdescription,
          price: itemPrice,
          isVeg: item.item_attributeid === '1', // 1 = veg, 2 = non-veg, 5 = other
          isAvailable: item.in_stock !== '0',
          variations: item.variation || [],
          addons: item.addon || []
        };
      });
      
      return {
        id: category.categoryid,
        name: category.categoryname,
        items: categoryItems
      };
    });
    
    console.log('✅ Processed categories:', categoriesWithItems.map(cat => 
      `${cat.name} (${cat.items.length} items)`
    ));

    const menuPreview = {
      restaurantInfo: {
        name: petpoojaData.restaurants?.[0]?.res_name || 'Restaurant',
        restaurantId: petpoojaData.restaurants?.[0]?.restaurantid,
        menuSharingCode: petpoojaData.restaurants?.[0]?.menusharingcode
      },
      categories: categoriesWithItems,
      addons: addons,
      taxes: taxes
    };

    res.json({
      success: true,
      message: "Menu fetched successfully",
      menu: menuPreview
    });

  } catch (error) {
    console.error('Error fetching menu preview:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch menu preview',
      details: error.message
    });
  }
});

// Save menu from preview endpoint
router.post("/:restaurantId/save-menu", authenticateUser, async (req, res) => {
  const { restaurantId } = req.params;
  const { userId, role } = req.user;
  
  try {
    // Verify restaurant ownership or admin access
    if (role !== 'RESTAURANT_OWNER' && role !== 'ADMIN') {
      return res.status(403).json({ error: "Access denied" });
    }

    // For restaurant owners, verify they own this restaurant
    if (role === 'RESTAURANT_OWNER') {
      const [ownershipCheck] = await db.query(
        'SELECT id FROM Restaurants WHERE id = ? AND created_by_user_id = ?',
        [restaurantId, userId]
      );
      if (!ownershipCheck) {
        return res.status(403).json({ error: "Access denied - not your restaurant" });
      }
    }

    // Use existing menu sync service to save the menu
    const { syncMenu } = require('../services/menuSyncService');
    
    const syncResult = await syncMenu(restaurantId);
    
    // Mark menu setup as completed in onboarding status
    const [currentRestaurant] = await db.query(
      'SELECT onboarding_status FROM Restaurants WHERE id = ?',
      [restaurantId]
    );
    
    let onboardingStatus = {};
    if (currentRestaurant && currentRestaurant.onboarding_status) {
      onboardingStatus = JSON.parse(currentRestaurant.onboarding_status);
    }
    
    // Mark menu_setup as complete
    onboardingStatus.menu_setup = true;
    
    // Update restaurant with new onboarding status
    await db.query(
      'UPDATE Restaurants SET onboarding_status = ? WHERE id = ?',
      [JSON.stringify(onboardingStatus), restaurantId]
    );
    
    res.json({
      success: true,
      message: "Menu saved successfully",
      ...syncResult
    });

  } catch (error) {
    console.error('Error saving menu:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to save menu',
      details: error.message
    });
  }
});

// Get complete onboarding state with all steps and data
router.get("/onboarding/state", authenticateUser, async (req, res) => {
  const { userId } = req.user;
  
  try {
    const onboardingState = await OnboardingService.getOnboardingState(userId);
    
    res.json({
      success: true,
      ...onboardingState
    });

  } catch (error) {
    console.error('Error getting onboarding state:', error);
    res.status(500).json({ error: 'Failed to get onboarding state' });
  }
});

// REMOVED: Redundant current-step and can-access endpoints
// All info is available in the main state endpoint

module.exports = router;
