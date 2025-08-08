require("dotenv").config(); // loads .env for local dev
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const restaurantRoutes = require("./routes/restaurants");
const authRoutes = require("./routes/auth");
const cookieParser = require("cookie-parser");
const cartRoutes = require("./routes/cart");
const sessionRoutes = require("./routes/sessions");
const testDbRoutes = require("./routes/test-db.js");
const orderRoutes = require("./routes/order");
const orderGroupsRoutes = require("./routes/orderGroups");
const paymentRoutes = require("./routes/payments");
const itemsRoutes = require("./routes/items");
const addonsRoutes = require("./routes/addons");
const appRouter = require('./routes/app');
const menuSyncRouter = require('./routes/menuSync');
const eventsRouter = require('./routes/events');
const genericWebhookRoutes = require('./routes/webhooks');
const callbackRoutes = require('./routes/callbacks');
const dashboardRoutes = require('./routes/dashboard');
const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cookieParser()); // Add this before your routes

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "dev"
        ? "http://localhost:3000"
        : "https://myding.in",
    credentials: true, // Allow cookies to be sent
  })
);

app.use((req, res, next) => {
  // console.log("Cookies:", req.cookies);
  next();
});

// Routes
app.use("/api/restaurants", restaurantRoutes);
app.use('/api/app', appRouter);
app.use("/api/auth", authRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/test-db", testDbRoutes); // Adjust the path
app.use("/api/orders", orderRoutes);
app.use("/api/order-groups", orderGroupsRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/items", itemsRoutes);
app.use("/api/addons", addonsRoutes);
app.use('/api/admin/pos-orders', require('./routes/adminPosOrders'));
app.use('/api/menu-sync', menuSyncRouter);
app.use('/api/events', eventsRouter);
app.use('/api/dashboard', dashboardRoutes);

// Webhook routes - unified generic approach
app.use('/api/webhooks', genericWebhookRoutes);

app.use('/callback', callbackRoutes);



// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});