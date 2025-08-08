const express = require("express");
const { sendOtp, verifyOtp } = require("../utils/twilio");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { clearAndReplaceCart } = require("../utils/cart");
const { authenticateUser } = require("../middlewares/authenticateUser");

const router = express.Router();
const JWT_SECRET = "your_jwt_secret"; // Replace with a secure secret

// Send OTP route
router.post("/send-otp", async (req, res) => {
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  try {
    //await sendOtp(phoneNumber);
    res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// Verify OTP route
router.post("/verify-otp", async (req, res) => {
  const { phoneNumber, otp, sessionId } = req.body;

  if (!phoneNumber || !otp) {
    return res.status(400).json({ error: "Phone number and OTP are required" });
  }

  try {
    // Verify the OTP
    const isVerified = true; //await verifyOtp(phoneNumber, otp);

    if (!isVerified) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Check if the user exists
    let userQuery = `
        SELECT id FROM Users WHERE phone_number = ?;
      `;
    const userResult = await db.query(userQuery, [phoneNumber]);

    let userId;

    if (!userResult || userResult.length === 0) {
      // Create a new user if one doesn't exist
      const createUserQuery = `
        INSERT INTO Users (phone_number, password_hash, role, name, created_at, updated_at)
        VALUES (?, 'hash', 'customer', 'ding', NOW(), NOW());
        `;

      // Execute the query
      await db.query(createUserQuery, [phoneNumber]);

      // Get the ID of the newly created user
      const userIdResult = await db.query("SELECT LAST_INSERT_ID() AS id;");
      userId = userIdResult[0].id;
    } else {
      userId = userResult[0].id;
    }

    console.log("UserIdResult:", userResult);
    console.log("userId", userId);

    // Generate a JWT for the user
    const token = jwt.sign({ userId, phoneNumber }, JWT_SECRET, {
      expiresIn: "1h",
    });

    // Set the JWT token in an HTTP-only cookie
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax", // Prevent cross-site cookie leakage
      maxAge: 1 * 60 * 60 * 1000, // 1 hour in milliseconds
      path: "/", // Makes the cookie available to all routes
    });

    if (sessionId) {
      await clearAndReplaceCart(userId, sessionId);
    }

    res.status(200).json({ message: "OTP verified and user logged in." });
  } catch (error) {
    console.error("Error verifying OTP:", error.message);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
});

router.get("/verify-token", (req, res) => {
  const token = req.cookies?.auth_token;
  if (!token) {
    return res.status(200).json({ isValid: false });
  }

  try {
    jwt.verify(token, JWT_SECRET);
    return res.status(200).json({ isValid: true });
  } catch (error) {
    return res.status(200).json({ isValid: false });
  }
});

// Get user information
router.get("/me", authenticateUser, async (req, res) => {
  const { userId } = req.user;

  try {
    const userQuery = `
      SELECT id, name, email, phone_number, role, created_at, updated_at
      FROM Users
      WHERE id = ?;
    `;
    const userRows = await db.query(userQuery, [userId]);
    const user = userRows[0];
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // For restaurant owners, also fetch their restaurant info
    let restaurantData = null;
    if (user.role === 'RESTAURANT_OWNER') {
      const restaurants = await db.query(
        'SELECT id, name FROM Restaurants WHERE created_by_user_id = ? LIMIT 1',
        [user.id]
      );
      if (restaurants.length > 0) {
        restaurantData = restaurants[0];
      }
    }

    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
      phoneNumber: user.phone_number,
      phone_number: user.phone_number, // Keep both for compatibility
      role: user.role,
      restaurantId: restaurantData?.id || null,
      restaurantName: restaurantData?.name || null,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user information" });
  }
});

// Logout route
router.post("/logout", (req, res) => {
  res.clearCookie("auth_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/"
  });
  res.status(200).json({ message: "Logged out successfully" });
});

// Restaurant registration endpoint
router.post('/restaurant-register', async (req, res) => {
  const { name, email, phoneNumber, password, role } = req.body;

  try {
    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM Users WHERE phone_number = ? OR email = ?',
      [phoneNumber, email]
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'User with this phone number or email already exists' 
      });
    }

    // Hash password
    const bcrypt = require('bcrypt');
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await db.query(
      'INSERT INTO Users (name, email, phone_number, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      [name, email, phoneNumber, passwordHash, role || 'RESTAURANT_OWNER']
    );

    const userId = result.insertId;

    // Generate JWT token
    const token = jwt.sign(
      { userId, phoneNumber, role: role || 'RESTAURANT_OWNER' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set the JWT token in an HTTP-only cookie (like existing system)
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      path: "/",
    });

    // Get user data
    const userData = await db.query(
      'SELECT id, name, email, phone_number, role FROM Users WHERE id = ?',
      [userId]
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user: userData[0]
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Registration failed' 
    });
  }
});

// Restaurant login endpoint
router.post('/restaurant-login', async (req, res) => {
  const { phoneNumber, password } = req.body;

  try {
    // Get user
    const users = await db.query(
      'SELECT id, name, email, phone_number, password_hash, role FROM Users WHERE phone_number = ? AND role = ?',
      [phoneNumber, 'RESTAURANT_OWNER']
    );

    if (users.length === 0) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    const user = users[0];

    // Verify password
    const bcrypt = require('bcrypt');
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, phoneNumber: user.phone_number, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set the JWT token in an HTTP-only cookie (like existing system)
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      path: "/",
    });

    // Update last login
    await db.query(
      'UPDATE Users SET last_login = NOW() WHERE id = ?',
      [user.id]
    );

    // For restaurant owners, also fetch their restaurant info
    let restaurantData = null;
    if (user.role === 'RESTAURANT_OWNER') {
      const restaurants = await db.query(
        'SELECT id, name FROM Restaurants WHERE created_by_user_id = ? LIMIT 1',
        [user.id]
      );
      if (restaurants.length > 0) {
        restaurantData = restaurants[0];
      }
    }

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone_number: user.phone_number,
        role: user.role,
        restaurantId: restaurantData?.id || null,
        restaurantName: restaurantData?.name || null
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Login failed' 
    });
  }
});



module.exports = router;
