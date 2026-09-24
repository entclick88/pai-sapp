const express = require('express');
const router = express.Router();
const { dbAsync, uploadsDir } = require('../config/database');
const crypto = require('crypto');
const path = require('path');
const multer = require('multer');

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `menu-${req.params.id}-${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
});

const uploadSlip = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `slip-${req.params.orderId}-${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype))
});

// Generate unique QR code identifier
function generateQRCode() {
  return crypto.randomBytes(8).toString('hex');
}

// Generate unique order ID
function generateOrderId() {
  return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`.toUpperCase();
}

// ===== CUSTOMER ROUTES =====

// Get table info and check QR code
router.get('/restaurant/table/:qrCode', async (req, res) => {
  try {
    const table = await dbAsync.get(
      'SELECT * FROM restaurant_tables WHERE qr_code = ?',
      [req.params.qrCode]
    );

    if (!table) {
      return res.status(404).json({ error: 'ไม่พบโต๊ะนี้' });
    }

    res.json({ success: true, table });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get this table's active (unfinished) order, if any - lets a customer who
// re-scans the QR after closing the page pick up right where they left off.
router.get('/restaurant/table/:qrCode/active-order', async (req, res) => {
  try {
    const table = await dbAsync.get(
      'SELECT * FROM restaurant_tables WHERE qr_code = ?',
      [req.params.qrCode]
    );

    if (!table) {
      return res.status(404).json({ error: 'ไม่พบโต๊ะนี้' });
    }

    const order = await dbAsync.get(
      `SELECT * FROM orders WHERE table_id = ? AND status IN ('pending', 'confirmed', 'preparing')
       ORDER BY createdAt DESC LIMIT 1`,
      [table.id]
    );

    if (!order) {
      return res.json({ success: true, order: null });
    }

    const items = await dbAsync.all(
      `SELECT oi.*, mi.name, mi.category FROM order_items oi
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.order_id = ?`,
      [order.id]
    );

    res.json({ success: true, order: { ...order, items } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all menu items
router.get('/restaurant/menu', async (req, res) => {
  try {
    const items = await dbAsync.all(
      'SELECT * FROM menu_items WHERE available = 1 ORDER BY category, name'
    );
    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get menu items by category
router.get('/restaurant/menu/:category', async (req, res) => {
  try {
    const items = await dbAsync.all(
      'SELECT * FROM menu_items WHERE category = ? AND available = 1 ORDER BY name',
      [req.params.category]
    );
    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get public shop settings (PromptPay ID, shop name) for building payment QR codes
router.get('/restaurant/settings', async (req, res) => {
  try {
    const rows = await dbAsync.all('SELECT key, value FROM restaurant_settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });

    res.json({
      success: true,
      settings: {
        promptpayId: settings.promptpay_id || '',
        shopName: settings.shop_name || 'ปายแซ่บ'
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new order
router.post('/restaurant/order', async (req, res) => {
  try {
    const { tableId, deviceId } = req.body;

    if (!tableId) {
      return res.status(400).json({ error: 'ต้องระบุโต๊ะ' });
    }

    const orderId = generateOrderId();

    const result = await dbAsync.run(
      `INSERT INTO orders (order_id, table_id, status, total, device_id)
       VALUES (?, ?, ?, ?, ?)`,
      [orderId, tableId, 'pending', 0, deviceId || null]
    );

    res.json({
      success: true,
      order: {
        id: result.id,
        order_id: orderId,
        table_id: tableId,
        status: 'pending',
        total: 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add item to order
router.post('/restaurant/order/:orderId/items', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { menuItemId, quantity, notes } = req.body;

    if (!menuItemId || !quantity) {
      return res.status(400).json({ error: 'ต้องระบุอาหารและจำนวน' });
    }

    // Get order
    const order = await dbAsync.get(
      'SELECT * FROM orders WHERE order_id = ?',
      [orderId]
    );

    if (!order) {
      return res.status(404).json({ error: 'ไม่พบออเดอร์นี้' });
    }

    // Get menu item
    const menuItem = await dbAsync.get(
      'SELECT * FROM menu_items WHERE id = ?',
      [menuItemId]
    );

    if (!menuItem) {
      return res.status(404).json({ error: 'ไม่พบอาหารนี้' });
    }

    // Add item to order
    await dbAsync.run(
      `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [order.id, menuItemId, quantity, menuItem.price, notes || null]
    );

    // Update order total
    const items = await dbAsync.all(
      `SELECT oi.quantity, oi.unit_price FROM order_items oi WHERE oi.order_id = ?`,
      [order.id]
    );

    const total = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    await dbAsync.run(
      'UPDATE orders SET total = ? WHERE id = ?',
      [total, order.id]
    );

    res.json({
      success: true,
      message: 'เพิ่มอาหารในออเดอร์แล้ว',
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Confirm order: customer signs with their name and submits it to the shop
router.put('/restaurant/order/:orderId/confirm', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { customerName } = req.body;

    if (!customerName || !customerName.trim()) {
      return res.status(400).json({ error: 'กรุณากรอกชื่อผู้สั่ง' });
    }

    const order = await dbAsync.get(
      'SELECT * FROM orders WHERE order_id = ?',
      [orderId]
    );

    if (!order) {
      return res.status(404).json({ error: 'ไม่พบออเดอร์นี้' });
    }

    const itemCount = await dbAsync.get(
      'SELECT COUNT(*) as count FROM order_items WHERE order_id = ?',
      [order.id]
    );

    if (!itemCount || itemCount.count === 0) {
      return res.status(400).json({ error: 'กรุณาเลือกอาหารอย่างน้อย 1 รายการ' });
    }

    await dbAsync.run(
      'UPDATE orders SET customer_name = ?, status = ? WHERE order_id = ?',
      [customerName.trim(), 'confirmed', orderId]
    );

    res.json({ success: true, message: 'ส่งออเดอร์ให้ร้านแล้ว' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get order details
router.get('/restaurant/order/:orderId', async (req, res) => {
  try {
    const order = await dbAsync.get(
      `SELECT o.*, t.table_number FROM orders o
       JOIN restaurant_tables t ON o.table_id = t.id
       WHERE o.order_id = ?`,
      [req.params.orderId]
    );

    if (!order) {
      return res.status(404).json({ error: 'ไม่พบออเดอร์นี้' });
    }

    const items = await dbAsync.all(
      `SELECT oi.*, mi.name, mi.category FROM order_items oi
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.order_id = ? ORDER BY oi.createdAt DESC`,
      [order.id]
    );

    res.json({
      success: true,
      order: {
        ...order,
        items
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update order (add/remove items)
router.put('/restaurant/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { action, itemId, quantity } = req.body;

    const order = await dbAsync.get(
      'SELECT * FROM orders WHERE order_id = ?',
      [orderId]
    );

    if (!order) {
      return res.status(404).json({ error: 'ไม่พบออเดอร์นี้' });
    }

    if (action === 'remove') {
      await dbAsync.run(
        'DELETE FROM order_items WHERE id = ? AND order_id = ?',
        [itemId, order.id]
      );
    } else if (action === 'update') {
      await dbAsync.run(
        'UPDATE order_items SET quantity = ? WHERE id = ? AND order_id = ?',
        [quantity, itemId, order.id]
      );
    }

    // Recalculate total
    const items = await dbAsync.all(
      `SELECT oi.quantity, oi.unit_price FROM order_items oi WHERE oi.order_id = ?`,
      [order.id]
    );

    const total = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    await dbAsync.run(
      'UPDATE orders SET total = ? WHERE id = ?',
      [total, order.id]
    );

    res.json({
      success: true,
      message: 'อัปเดตออเดอร์แล้ว',
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Checkout order (show payment options)
router.post('/restaurant/order/:orderId/checkout', async (req, res) => {
  try {
    const order = await dbAsync.get(
      'SELECT * FROM orders WHERE order_id = ?',
      [req.params.orderId]
    );

    if (!order) {
      return res.status(404).json({ error: 'ไม่พบออเดอร์นี้' });
    }

    const items = await dbAsync.all(
      `SELECT oi.*, mi.name FROM order_items oi
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.order_id = ?`,
      [order.id]
    );

    res.json({
      success: true,
      order: {
        ...order,
        itemCount: items.length,
        items: items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.unit_price,
          subtotal: item.quantity * item.unit_price
        }))
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Customer reports that they have transferred payment (awaiting shop confirmation),
// optionally attaching a photo of the transfer slip as proof.
router.post('/restaurant/order/:orderId/pay', uploadSlip.single('slip'), async (req, res) => {
  try {
    const order = await dbAsync.get(
      'SELECT * FROM orders WHERE order_id = ?',
      [req.params.orderId]
    );

    if (!order) {
      return res.status(404).json({ error: 'ไม่พบออเดอร์นี้' });
    }

    if (req.file) {
      const slipUrl = `/uploads/${req.file.filename}`;
      await dbAsync.run(
        'UPDATE orders SET payment_status = ?, payment_slip_url = ? WHERE order_id = ?',
        ['transferred', slipUrl, req.params.orderId]
      );
    } else {
      await dbAsync.run(
        'UPDATE orders SET payment_status = ? WHERE order_id = ?',
        ['transferred', req.params.orderId]
      );
    }

    res.json({
      success: true,
      message: 'แจ้งการชำระเงินแล้ว รอร้านยืนยัน'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ADMIN ROUTES =====

// Get all active orders
router.get('/restaurant/admin/orders', async (req, res) => {
  try {
    const orders = await dbAsync.all(
      `SELECT o.*, t.table_number
       FROM orders o
       JOIN restaurant_tables t ON o.table_id = t.id
       WHERE o.status IN ('confirmed', 'preparing', 'completed')
       ORDER BY o.createdAt DESC`
    );

    const ordersWithItems = [];
    for (const order of orders) {
      const items = await dbAsync.all(
        `SELECT oi.*, mi.name FROM order_items oi
         JOIN menu_items mi ON oi.menu_item_id = mi.id
         WHERE oi.order_id = ?`,
        [order.id]
      );
      ordersWithItems.push({ ...order, items });
    }

    res.json({ success: true, orders: ordersWithItems });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update order status (mark as served)
router.put('/restaurant/admin/order/:orderId/status', async (req, res) => {
  try {
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'preparing', 'completed', 'paid', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
    }

    const params = [status];
    let sql = 'UPDATE orders SET status = ?';

    if (status === 'completed') {
      sql += ', completedAt = ?';
      params.push(new Date().toISOString());
    }

    if (status === 'paid') {
      sql += ', payment_status = ?';
      params.push('paid');
    }

    sql += ' WHERE order_id = ?';
    params.push(req.params.orderId);

    await dbAsync.run(sql, params);

    res.json({
      success: true,
      message: `อัปเดตสถานะเป็น ${status} แล้ว`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark specific order items as prepared
router.put('/restaurant/admin/order/:orderId/items/:itemId/prepare', async (req, res) => {
  try {
    await dbAsync.run(
      'UPDATE order_items SET prepared = 1 WHERE id = ? AND order_id = ?',
      [req.params.itemId, req.params.orderId]
    );

    res.json({ success: true, message: 'ทำเสร็จแล้ว' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ADMIN MENU MANAGEMENT =====

// Get all menu items
router.get('/restaurant/admin/menu', async (req, res) => {
  try {
    const items = await dbAsync.all(
      'SELECT * FROM menu_items ORDER BY category, name'
    );
    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create menu item
router.post('/restaurant/admin/menu', async (req, res) => {
  try {
    const { name, category, price, description, imageUrl } = req.body;

    if (!name || !category || !price) {
      return res.status(400).json({ error: 'ต้องระบุชื่อ, หมวดหมู่ และราคา' });
    }

    const result = await dbAsync.run(
      `INSERT INTO menu_items (name, category, price, description, image_url)
       VALUES (?, ?, ?, ?, ?)`,
      [name, category, price, description || null, imageUrl || null]
    );

    res.json({
      success: true,
      message: 'เพิ่มเมนูแล้ว',
      item: { id: result.id, name, category, price }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update menu item (partial update - only fields provided are changed)
router.put('/restaurant/admin/menu/:id', async (req, res) => {
  try {
    const existing = await dbAsync.get('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'ไม่พบเมนูนี้' });
    }

    const {
      name = existing.name,
      category = existing.category,
      price = existing.price,
      description = existing.description,
      imageUrl = existing.image_url,
      available = existing.available
    } = req.body;

    await dbAsync.run(
      `UPDATE menu_items SET name = ?, category = ?, price = ?, description = ?, image_url = ?, available = ?
       WHERE id = ?`,
      [name, category, price, description, imageUrl, available ? 1 : 0, req.params.id]
    );

    res.json({ success: true, message: 'อัปเดตเมนูแล้ว' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload a photo for a menu item
router.post('/restaurant/admin/menu/:id/image', upload.single('image'), async (req, res) => {
  try {
    const existing = await dbAsync.get('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
    if (!existing) {
      return res.status(404).json({ error: 'ไม่พบเมนูนี้' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'กรุณาเลือกไฟล์รูปภาพ' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    await dbAsync.run('UPDATE menu_items SET image_url = ? WHERE id = ?', [imageUrl, req.params.id]);

    res.json({ success: true, message: 'อัปโหลดรูปแล้ว', imageUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ADMIN SETTINGS (PromptPay ID, shop name) =====

// Admin-only settings read (includes owner_pin, unlike the public /settings endpoint)
router.get('/restaurant/admin/settings', async (req, res) => {
  try {
    const rows = await dbAsync.all('SELECT key, value FROM restaurant_settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });

    res.json({
      success: true,
      settings: {
        promptpayId: settings.promptpay_id || '',
        shopName: settings.shop_name || 'ปายแซ่บ',
        ownerPin: settings.owner_pin || ''
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/restaurant/admin/settings', async (req, res) => {
  try {
    const { promptpayId, shopName, ownerPin } = req.body;

    if (promptpayId !== undefined) {
      await dbAsync.run(
        `INSERT INTO restaurant_settings (key, value) VALUES ('promptpay_id', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [promptpayId]
      );
    }

    if (shopName !== undefined) {
      await dbAsync.run(
        `INSERT INTO restaurant_settings (key, value) VALUES ('shop_name', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [shopName]
      );
    }

    if (ownerPin !== undefined) {
      await dbAsync.run(
        `INSERT INTO restaurant_settings (key, value) VALUES ('owner_pin', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [ownerPin]
      );
    }

    res.json({ success: true, message: 'บันทึกการตั้งค่าแล้ว' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== TABLE MANAGEMENT =====

// Get all tables
router.get('/restaurant/admin/tables', async (req, res) => {
  try {
    const tables = await dbAsync.all(
      'SELECT * FROM restaurant_tables ORDER BY table_number'
    );
    res.json({ success: true, tables });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create table with QR code
router.post('/restaurant/admin/tables', async (req, res) => {
  try {
    const { tableNumber } = req.body;

    if (!tableNumber) {
      return res.status(400).json({ error: 'ต้องระบุหมายเลขโต๊ะ' });
    }

    const qrCode = generateQRCode();

    const result = await dbAsync.run(
      `INSERT INTO restaurant_tables (table_number, qr_code)
       VALUES (?, ?)`,
      [tableNumber, qrCode]
    );

    res.json({
      success: true,
      message: 'เพิ่มโต๊ะแล้ว',
      table: {
        id: result.id,
        table_number: tableNumber,
        qr_code: qrCode
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ADMIN EXPENSES (cost of goods, for profit/loss analysis) =====

// List expenses, optionally filtered by date range
router.get('/restaurant/admin/expenses', async (req, res) => {
  try {
    const { from, to } = req.query;
    let sql = 'SELECT * FROM expenses';
    const params = [];

    if (from && to) {
      sql += ' WHERE expense_date BETWEEN ? AND ?';
      params.push(from, to);
    }

    sql += ' ORDER BY expense_date DESC, id DESC';

    const expenses = await dbAsync.all(sql, params);
    res.json({ success: true, expenses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add an expense (e.g. buying raw ingredients)
router.post('/restaurant/admin/expenses', async (req, res) => {
  try {
    const { date, description, category, amount } = req.body;

    if (!date || !description || !amount) {
      return res.status(400).json({ error: 'ต้องระบุวันที่, รายการ และจำนวนเงิน' });
    }

    const result = await dbAsync.run(
      'INSERT INTO expenses (expense_date, description, category, amount) VALUES (?, ?, ?, ?)',
      [date, description, category || null, amount]
    );

    res.json({ success: true, message: 'บันทึกรายจ่ายแล้ว', expense: { id: result.id } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete an expense entry (corrections)
router.delete('/restaurant/admin/expenses/:id', async (req, res) => {
  try {
    await dbAsync.run('DELETE FROM expenses WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'ลบรายการแล้ว' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== OWNER ANALYTICS =====

// Whether the owner dashboard should prompt for a PIN before showing data
router.get('/restaurant/owner/pin-required', async (req, res) => {
  try {
    const row = await dbAsync.get(`SELECT value FROM restaurant_settings WHERE key = 'owner_pin'`);
    res.json({ success: true, required: !!(row && row.value) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/restaurant/owner/verify-pin', async (req, res) => {
  try {
    const row = await dbAsync.get(`SELECT value FROM restaurant_settings WHERE key = 'owner_pin'`);
    const correctPin = row && row.value;
    const ok = !correctPin || correctPin === req.body.pin;
    res.json({ success: ok });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sales, cost, and profit/loss summary for a date range (dates are Thai local, UTC+7)
router.get('/restaurant/owner/analytics', async (req, res) => {
  try {
    const from = req.query.from || '2000-01-01';
    const to = req.query.to || '2100-01-01';

    const salesRow = await dbAsync.get(
      `SELECT COALESCE(SUM(total), 0) as sales, COUNT(*) as orderCount
       FROM orders
       WHERE status = 'paid' AND date(createdAt, '+7 hours') BETWEEN ? AND ?`,
      [from, to]
    );

    const costRow = await dbAsync.get(
      `SELECT COALESCE(SUM(amount), 0) as costs
       FROM expenses
       WHERE expense_date BETWEEN ? AND ?`,
      [from, to]
    );

    const topItems = await dbAsync.all(
      `SELECT mi.name, SUM(oi.quantity) as quantity, SUM(oi.quantity * oi.unit_price) as revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE o.status = 'paid' AND date(o.createdAt, '+7 hours') BETWEEN ? AND ?
       GROUP BY oi.menu_item_id
       ORDER BY revenue DESC
       LIMIT 10`,
      [from, to]
    );

    const dailySales = await dbAsync.all(
      `SELECT date(createdAt, '+7 hours') as day, SUM(total) as sales, COUNT(*) as orderCount
       FROM orders
       WHERE status = 'paid' AND date(createdAt, '+7 hours') BETWEEN ? AND ?
       GROUP BY day
       ORDER BY day ASC`,
      [from, to]
    );

    const sales = salesRow.sales;
    const costs = costRow.costs;

    res.json({
      success: true,
      analytics: {
        sales,
        costs,
        profit: sales - costs,
        orderCount: salesRow.orderCount,
        topItems,
        dailySales
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
