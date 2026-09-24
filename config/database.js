const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || './data/content.db';

// Create data directory if it doesn't exist
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Uploaded menu photos live alongside the database, so they survive
// deploys/restarts on the same persistent disk.
const uploadsDir = path.join(dataDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
    setTimeout(seedRestaurantDefaults, 500);
  }
});

function initializeDatabase() {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      googleId TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      displayName TEXT,
      profilePicture TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Templates table
  db.run(`
    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      title TEXT NOT NULL,
      topic TEXT NOT NULL,
      prompt TEXT NOT NULL,
      style TEXT DEFAULT 'informative',
      wordCount INTEGER DEFAULT 500,
      active BOOLEAN DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES users(id)
    )
  `);

  // Generated Content table
  db.run(`
    CREATE TABLE IF NOT EXISTS generated_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      templateId INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      generatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      sentAt DATETIME,
      FOREIGN KEY(userId) REFERENCES users(id),
      FOREIGN KEY(templateId) REFERENCES templates(id)
    )
  `);

  // Email Settings table
  db.run(`
    CREATE TABLE IF NOT EXISTS email_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER UNIQUE NOT NULL,
      recipientEmails TEXT NOT NULL,
      includeContentLink BOOLEAN DEFAULT 1,
      emailTemplate TEXT DEFAULT 'default',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(userId) REFERENCES users(id)
    )
  `);

  // Restaurant System - Tables
  db.run(`
    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_number INTEGER UNIQUE NOT NULL,
      qr_code TEXT UNIQUE NOT NULL,
      status TEXT DEFAULT 'available',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Restaurant System - Menu Items
  db.run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      image_url TEXT,
      available BOOLEAN DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Restaurant System - Orders
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT UNIQUE NOT NULL,
      table_id INTEGER NOT NULL,
      customer_name TEXT,
      status TEXT DEFAULT 'pending',
      total REAL NOT NULL,
      payment_status TEXT DEFAULT 'unpaid',
      device_id TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      completedAt DATETIME,
      FOREIGN KEY(table_id) REFERENCES restaurant_tables(id)
    )
  `);
  // Migration for databases created before customer_name existed
  db.run(`ALTER TABLE orders ADD COLUMN customer_name TEXT`, () => {});

  // Restaurant System - Order Items
  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      menu_item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      notes TEXT,
      prepared BOOLEAN DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(order_id) REFERENCES orders(id),
      FOREIGN KEY(menu_item_id) REFERENCES menu_items(id)
    )
  `);

  // Restaurant System - Settings (key/value, e.g. PromptPay ID, shop name)
  db.run(`
    CREATE TABLE IF NOT EXISTS restaurant_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
}

// Promisify database methods
const dbAsync = {
  run: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, changes: this.changes });
      });
    });
  },

  get: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  all: (sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
};

// Seeds the ส้มตำ menu and tables on first boot only (checks before writing,
// so it's safe to run on every deploy without touching existing data).
async function seedRestaurantDefaults() {
  try {
    const menuCount = await dbAsync.get('SELECT COUNT(*) as count FROM menu_items');
    if (menuCount && menuCount.count === 0) {
      const menuItems = [
        { name: 'ส้มตำไทย', category: 'ส้มตำ', price: 40 },
        { name: 'ส้มตำข้าวโพด', category: 'ส้มตำ', price: 50 },
        { name: 'ส้มตำปู', category: 'ส้มตำ', price: 40 },
        { name: 'ส้มตำปลาร้า', category: 'ส้มตำ', price: 40 },
        { name: 'ส้มตำปูปลาร้า', category: 'ส้มตำ', price: 45 },
        { name: 'ส้มตำหมูยอปลาร้า', category: 'ส้มตำ', price: 45 },
        { name: 'ส้มตำปูม้า', category: 'ส้มตำ', price: 80 },
        { name: 'ส้มตำกุ้งสด', category: 'ส้มตำ', price: 80 },
        { name: 'ลาบหมู', category: 'กับข้าว', price: 70 },
        { name: 'น้ำตกหมู', category: 'กับข้าว', price: 70 },
        { name: 'ต้มแซบ', category: 'กับข้าว', price: 60 },
        { name: 'แกงเห็ด', category: 'กับข้าว', price: 50 },
        { name: 'คอหมูย่าง', category: 'กับข้าว', price: 70 },
        { name: 'ไก่ย่าง', category: 'กับข้าว', price: 50 },
      ];

      for (const item of menuItems) {
        await dbAsync.run(
          'INSERT INTO menu_items (name, category, price, available) VALUES (?, ?, ?, 1)',
          [item.name, item.category, item.price]
        );
      }
      console.log(`🌶️ Seeded ${menuItems.length} menu items`);
    }

    const tableCount = await dbAsync.get('SELECT COUNT(*) as count FROM restaurant_tables');
    if (tableCount && tableCount.count === 0) {
      const crypto = require('crypto');
      for (let i = 1; i <= 10; i++) {
        const qrCode = crypto.randomBytes(8).toString('hex');
        await dbAsync.run(
          `INSERT INTO restaurant_tables (table_number, qr_code, status) VALUES (?, ?, 'available')`,
          [i, qrCode]
        );
      }
      console.log('🪑 Seeded 10 restaurant tables');
    }
  } catch (error) {
    console.error('Seed error:', error.message);
  }
}

module.exports = { db, dbAsync, uploadsDir };
