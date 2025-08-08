const mysql = require("mysql2/promise");
require("dotenv").config(); // loads .env for local dev

// Detect if running in Cloud Run
const isCloudRun = !!process.env.INSTANCE_CONNECTION_NAME && !process.env.DB_HOST;

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3309),
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  idleTimeout: 300000,
  maxIdle: 10,
};

if (isCloudRun) {
  config.socketPath = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
} else {
  config.host = process.env.DB_HOST || "localhost";
}

const pool = mysql.createPool(config);

module.exports = {
  query: async (sql, params) => {
    const [results] = await pool.execute(sql, params);
    return results;
  },

  getConnection: async () => pool.getConnection(),
  beginTransaction: async (conn) => conn.beginTransaction(),
  commit: async (conn) => conn.commit(),
  rollback: async (conn) => conn.rollback(),
  release: async (conn) => conn.release(),
  executeInTransaction: async (callback) => {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await callback(conn);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  },

  close: () => pool.end(),
};