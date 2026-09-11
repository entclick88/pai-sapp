const crypto = require('crypto');
const { dbAsync } = require('../config/database');

async function initRestaurant() {
  try {
    console.log('🍜 กำลังสร้างข้อมูลเริ่มต้นสำหรับระบบสั่งอาหาร...\n');

    // Check if data already exists
    const existingTables = await dbAsync.all('SELECT COUNT(*) as count FROM restaurant_tables');
    if (existingTables[0]?.count > 0) {
      console.log('✅ ข้อมูลเริ่มต้นมีอยู่แล้ว');
      process.exit(0);
    }

    // Menu items
    const menuItems = [
      // ก๋วยเตี๋ยว
      { name: 'ก๋วยเตี๋ยวเรือ', category: 'ก๋วยเตี๋ยว', price: 40 },
      { name: 'ก๋วยเตี๋ยวลุงเสมา', category: 'ก๋วยเตี๋ยว', price: 50 },
      { name: 'ก๋วยเตี๋ยวแห้ง', category: 'ก๋วยเตี๋ยว', price: 40 },

      // ลาบ
      { name: 'ลาบไก่', category: 'ลาบ', price: 80 },
      { name: 'ลาบหมู', category: 'ลาบ', price: 85 },
      { name: 'ลาบเบญจ', category: 'ลาบ', price: 100 },

      // สลัด
      { name: 'สัปปะรดปลาร้า', category: 'สลัด', price: 90 },
      { name: 'ยำปลาโลด', category: 'สลัด', price: 120 },
      { name: 'ยำผักบุ้ง', category: 'สลัด', price: 50 },
      { name: 'ยำไข่ขี้เมียง', category: 'สลัด', price: 60 },

      // ผัด
      { name: 'ผัดกระเพราหมู', category: 'ผัด', price: 70 },
      { name: 'ผัดกระเพราไก่', category: 'ผัด', price: 70 },
      { name: 'ผัดไทย', category: 'ผัด', price: 60 },
      { name: 'ผัดข้าวโพด', category: 'ผัด', price: 70 },

      // แกง
      { name: 'แกงส้มปลาทับทิม', category: 'แกง', price: 100 },
      { name: 'แกงเขียวหวานไก่', category: 'แกง', price: 85 },
      { name: 'แกงแพนง', category: 'แกง', price: 90 },

      // เครื่องดื่ม
      { name: 'ชาเย็น', category: 'เครื่องดื่ม', price: 20 },
      { name: 'กาแฟดำเย็น', category: 'เครื่องดื่ม', price: 25 },
      { name: 'น้ำส้มคั้น', category: 'เครื่องดื่ม', price: 30 },
      { name: 'น้ำมะนาว', category: 'เครื่องดื่ม', price: 25 },

      // ของหวาน
      { name: 'ขนมโต๊ะกลม', category: 'ของหวาน', price: 15 },
      { name: 'ขนมจีนน้ำยา', category: 'ของหวาน', price: 20 },
    ];

    // Create menu items
    console.log('📝 เพิ่มเมนูอาหาร...');
    for (const item of menuItems) {
      await dbAsync.run(
        `INSERT INTO menu_items (name, category, price, available)
         VALUES (?, ?, ?, ?)`,
        [item.name, item.category, item.price, 1]
      );
    }
    console.log(`✅ เพิ่มเมนู ${menuItems.length} รายการ\n`);

    // Create tables (10 tables)
    console.log('🪑 เพิ่มโต๊ะในระบบ...');
    const tables = [];
    for (let i = 1; i <= 10; i++) {
      const qrCode = crypto.randomBytes(8).toString('hex');
      await dbAsync.run(
        `INSERT INTO restaurant_tables (table_number, qr_code, status)
         VALUES (?, ?, ?)`,
        [i, qrCode, 'available']
      );
      tables.push({ tableNumber: i, qrCode });
    }
    console.log(`✅ เพิ่มโต๊ะ ${tables.length} โต๊ะ\n`);

    // Display QR codes info
    console.log('📱 รหัส QR สำหรับแต่ละโต๊ะ:');
    console.log('─'.repeat(50));
    tables.forEach(t => {
      console.log(`โต๊ะที่ ${t.tableNumber}: ${t.qrCode}`);
    });
    console.log('─'.repeat(50));
    console.log('\n💡 ใช้รหัส QR นี้เพื่อสร้างรหัส QR code');
    console.log('📍 หรือไปที่: http://localhost:3000/order.html?qr=<QR_CODE>\n');

    console.log('✅ การตั้งค่าเบื้องต้นเสร็จสิ้น!\n');
    console.log('🌐 เข้าถึงระบบ:');
    console.log('  - สแกน QR: http://localhost:3000/qr-scanner.html');
    console.log('  - Admin Dashboard: http://localhost:3000/admin-dashboard.html');
    console.log('  - Test Order: http://localhost:3000/order.html?qr=' + tables[0].qrCode);

    process.exit(0);
  } catch (error) {
    console.error('❌ ข้อผิดพลาด:', error.message);
    process.exit(1);
  }
}

// Wait for database to be ready
setTimeout(initRestaurant, 1000);
