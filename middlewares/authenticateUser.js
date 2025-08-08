const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// Middleware to verify auth_token and extract user_id
const authenticateUser = (req, res, next) => {
  const token = req.cookies.auth_token; // Retrieve token from the HTTP-only cookie

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Token not found" });
  }

  try {
    // Verify the token and extract payload
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach the decoded payload to the request object
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      res.clearCookie("auth_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        path: "/",
      });

      return res
        .status(401)
        .json({ error: "Token expired. Please log in again." });
    }
    console.error("Token verification failed:", error.message);
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

const optionalAuthenticateUser = (req, res, next) => {
  const token = req.cookies?.auth_token;

  if (!token) {
    req.user = null; // No user logged in
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach the user info if the token is valid
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      res.clearCookie("auth_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        path: "/",
      });
    }

    console.error("Invalid or expired token:", error.message);
    req.user = null; // Treat as guest
  }

  next();
};

module.exports = {
  authenticateUser,
  optionalAuthenticateUser,
};
