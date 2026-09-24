// Resets the menu to the ปายแซ่บ ส้มตำ menu. Keeps existing tables and settings.
const { dbAsync } = require('../config/database');

const menuItems = [
  // ส้มตำ
  { name: 'ส้มตำไทย', category: 'ส้มตำ', price: 40 },
  { name: 'ส้มตำข้าวโพด', category: 'ส้มตำ', price: 50 },
  { name: 'ส้มตำปู', category: 'ส้มตำ', price: 40 },
  { name: 'ส้มตำปลาร้า', category: 'ส้มตำ', price: 40 },
  { name: 'ส้มตำปูปลาร้า', category: 'ส้มตำ', price: 45 },
  { name: 'ส้มตำหมูยอปลาร้า', category: 'ส้มตำ', price: 45 },
  { name: 'ส้มตำปูม้า', category: 'ส้มตำ', price: 80 },
  { name: 'ส้มตำกุ้งสด', category: 'ส้มตำ', price: 80 },

  // กับข้าว
  { name: 'ลาบหมู', category: 'กับข้าว', price: 70 },
  { name: 'น้ำตกหมู', category: 'กับข้าว', price: 70 },
  { name: 'ต้มแซบ', category: 'กับข้าว', price: 60 },
  { name: 'แกงเห็ด', category: 'กับข้าว', price: 50 },
  { name: 'คอหมูย่าง', category: 'กับข้าว', price: 70 },
  { name: 'ไก่ย่าง', category: 'กับข้าว', price: 50 },
];

async function seed() {
  try {
    console.log('🌶️ กำลังตั้งค่าเมนู ปายแซ่บ...\n');

    // Remove old orders/order_items referencing the old menu, then old menu items
    await dbAsync.run('DELETE FROM order_items');
    await dbAsync.run('DELETE FROM orders');
    await dbAsync.run('DELETE FROM menu_items');

    for (const item of menuItems) {
      await dbAsync.run(
        `INSERT INTO menu_items (name, category, price, available) VALUES (?, ?, ?, 1)`,
        [item.name, item.category, item.price]
      );
    }
    console.log(`✅ เพิ่มเมนู ${menuItems.length} รายการ`);

    // Make sure at least one table exists
    const tables = await dbAsync.all('SELECT * FROM restaurant_tables ORDER BY table_number');
    if (tables.length === 0) {
      const crypto = require('crypto');
      for (let i = 1; i <= 10; i++) {
        const qrCode = crypto.randomBytes(8).toString('hex');
        await dbAsync.run(
          `INSERT INTO restaurant_tables (table_number, qr_code, status) VALUES (?, ?, 'available')`,
          [i, qrCode]
        );
      }
      console.log('✅ สร้างโต๊ะ 10 โต๊ะ');
    } else {
      console.log(`✅ มีโต๊ะอยู่แล้ว ${tables.length} โต๊ะ`);
    }

    const finalTables = await dbAsync.all('SELECT * FROM restaurant_tables ORDER BY table_number');
    console.log('\n📱 รหัส QR สำหรับแต่ละโต๊ะ:');
    console.log('─'.repeat(50));
    finalTables.forEach(t => console.log(`โต๊ะที่ ${t.table_number}: /order.html?qr=${t.qr_code}`));
    console.log('─'.repeat(50));

    console.log('\n✅ เสร็จสิ้น! อย่าลืมตั้งค่าเลข PromptPay ที่หน้า /admin-menu.html');
    process.exit(0);
  } catch (error) {
    console.error('❌ ข้อผิดพลาด:', error.message);
    process.exit(1);
  }
}

setTimeout(seed, 500);
