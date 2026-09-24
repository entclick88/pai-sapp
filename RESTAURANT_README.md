# 🌶️ ปายแซ่บ - Restaurant Ordering System

**สโลแกน:** คิดถึงความแซ่บ นัว คิดถึงเรา

ระบบสั่งอาหารออนไลน์สำหรับร้านอาหาร ผ่าน QR Code ประจำโต๊ะ

## ✨ ฟีเจอร์หลัก

### 🍽️ ฝั่งลูกค้า (Customer)
- **สแกน QR Code** ประจำโต๊ะ (ไม่ต้อง login)
- **ดูเมนู** แบ่งตามหมวดหมู่ (ส้มตำ, กับข้าว)
- **เลือกอาหาร** พร้อมจำนวนและหมายเหตุ
- **ยืนยันออเดอร์พร้อมชื่อ** ลูกค้ากรอกชื่อ ("ลงชื่อ") ตอนกดยืนยันสั่งอาหาร แล้วออเดอร์จะถูกส่งเข้าร้านทันที
- **หน้าติดตามสถานะ** (`order-status.html`) อัปเดตอัตโนมัติทุก 3 วินาที ตั้งแต่รับออเดอร์ → กำลังทำ → เสร็จแล้ว
- **ชำระเงิน** เมื่อร้านกดเสร็จสิ้น ระบบคำนวณราคารวมและสร้าง QR Code PromptPay ให้ลูกค้าสแกนจ่ายจากมือถือได้ทันที

### 👨‍🍳 ฝั่งแอดมิน (Admin/Chef)
- **Dashboard ออนไลน์** ดูออเดอร์ทั้งหมดพร้อมชื่อลูกค้าและโต๊ะ
- **อัปเดตสถานะ** รับออเดอร์ → กำลังทำ → เสร็จสิ้น (คำนวณราคา + แสดง QR PromptPay) → ยืนยันรับเงินแล้ว
- **ทำเครื่องหมายรายการ** เมื่อทำสินค้าต่อชิ้น
- **จัดการเมนู** (`admin-menu.html`) เพิ่มเมนูใหม่, แก้ราคา, เปิด/ปิดขายเมนูแต่ละรายการ
- **ตั้งค่า PromptPay** กำหนดเบอร์/เลขบัตรประชาชนของร้านสำหรับสร้าง QR รับเงิน
- **Refresh อัตโนมัติ** ทุก 5 วินาที

## 🚀 การใช้งาน

### เข้าถึงระบบ

**หน้าแรก (Home):**
```
http://localhost:3000/restaurant
```

**ลูกค้า - สแกน QR:**
```
http://localhost:3000/qr-scanner.html
```

**ลูกค้า - สั่งอาหาร (ทดสอบด้วย QR code โต๊ะที่ 1):**
```
http://localhost:3000/order.html?qr=b274831e2492681a
```

**แอดมิน - ระบบเชฟ:**
```
http://localhost:3000/admin-dashboard.html
```

### ขั้นตอนการใช้งาน

#### 📱 ลูกค้า
1. ไปที่ http://localhost:3000/restaurant
2. คลิก "สแกน QR และสั่งอาหาร"
3. ใช้กล้องโทรศัพท์สแกน QR code บนโต๊ะ (หรือใส่รหัส QR)
4. เลือกอาหารจากเมนู แล้วเพิ่มลงตะกร้า
5. คลิก "ยืนยันการสั่งอาหาร" แล้วกรอกชื่อผู้สั่ง
6. รอดูสถานะที่หน้า order-status (อัปเดตอัตโนมัติ)
7. เมื่อร้านทำเสร็จ สแกน QR PromptPay ที่ขึ้นมาเพื่อจ่ายเงิน แล้วกด "ฉันโอนเงินแล้ว"

#### 👨‍🍳 แอดมิน
1. ไปที่ http://localhost:3000/admin-dashboard.html
2. ดูรายการออเดอร์ที่เข้ามา (พร้อมชื่อลูกค้า)
3. คลิก "เริ่มทำ" เพื่อเริ่มทำอาหาร
4. คลิกปุ่มติ้ก (✓) บนแต่ละรายการอาหารเมื่อเสร็จ
5. คลิก "เสร็จสิ้น คำนวณราคา" เมื่อทำอาหารเสร็จ — ระบบจะคำนวณยอดและสร้าง QR PromptPay ให้ลูกค้าอัตโนมัติ
6. เมื่อได้รับเงินแล้ว คลิก "✓ ยืนยันรับเงินแล้ว" เพื่อปิดออเดอร์
7. จัดการเมนูและตั้งค่า PromptPay ได้ที่ปุ่ม "จัดการเมนู" (admin-menu.html)

## 📊 ข้อมูลฐาน (Database)

### ตาราหลัก

**restaurant_tables** - ข้อมูลโต๊ะ
- `id` - รหัสโต๊ะ
- `table_number` - หมายเลขโต๊ะ (1-10)
- `qr_code` - รหัส QR
- `status` - สถานะ (available, occupied)

**menu_items** - เมนูอาหาร
- `id` - รหัสอาหาร
- `name` - ชื่ออาหาร
- `category` - หมวดหมู่
- `price` - ราคา
- `available` - คือว่าอาหารพร้อมได้หรือไม่

**orders** - ออเดอร์
- `id` - รหัสออเดอร์ประจำระบบ
- `order_id` - รหัสออเดอร์ที่แสดงต่อลูกค้า (ORD-xxx-xxx)
- `table_id` - โต๊ะที่สั่ง
- `status` - สถานะ (pending, confirmed, preparing, ready, served, completed, cancelled)
- `total` - ราคารวม
- `payment_status` - สถานะการชำระเงิน (unpaid, paid)

**order_items** - รายการอาหารในออเดอร์
- `id` - รหัสรายการ
- `order_id` - รหัสออเดอร์
- `menu_item_id` - รหัสอาหาร
- `quantity` - จำนวน
- `unit_price` - ราคาต่อหน่วย
- `notes` - หมายเหตุพิเศษ
- `prepared` - ว่าเสร็จแล้วหรือยัง

## 📝 API Endpoints

### Customer API

**ดึงข้อมูลโต๊ะ**
```
GET /api/restaurant/table/:qrCode
```

**ดึงเมนู**
```
GET /api/restaurant/menu
GET /api/restaurant/menu/:category
```

**สร้างออเดอร์**
```
POST /api/restaurant/order
Body: { tableId, deviceId? }
```

**เพิ่มรายการอาหาร**
```
POST /api/restaurant/order/:orderId/items
Body: { menuItemId, quantity, notes? }
```

**ดูรายละเอียดออเดอร์**
```
GET /api/restaurant/order/:orderId
```

**อัปเดตออเดอร์**
```
PUT /api/restaurant/order/:orderId
Body: { action: "remove|update", itemId, quantity? }
```

**ยืนยันออเดอร์ (ลงชื่อ + ส่งเข้าร้าน)**
```
PUT /api/restaurant/order/:orderId/confirm
Body: { customerName }
```

**แจ้งชำระเงินแล้ว (ลูกค้ากดหลังโอน)**
```
POST /api/restaurant/order/:orderId/pay
```

**ดึงค่าตั้งค่าร้าน (PromptPay ID, ชื่อร้าน)**
```
GET /api/restaurant/settings
```

### Admin API

**ดึงออเดอร์ทั้งหมด**
```
GET /api/restaurant/admin/orders
```

**อัปเดตสถานะออเดอร์**
```
PUT /api/restaurant/admin/order/:orderId/status
Body: { status: "confirmed|preparing|completed|paid|cancelled" }
```

**ตั้งค่า PromptPay / ชื่อร้าน**
```
PUT /api/restaurant/admin/settings
Body: { promptpayId, shopName }
```

**ทำเครื่องหมายรายการเสร็จ**
```
PUT /api/restaurant/admin/order/:orderId/items/:itemId/prepare
```

## 🎨 Design Features

✅ **Responsive Design** - ใช้ได้กับมือถือและแท็บเล็ต
✅ **Easy Navigation** - ไม่ต้อง login, สแกน QR และสั่งได้เลย
✅ **Real-time Updates** - Admin dashboard refresh ทุก 5 วินาที
✅ **Visual Feedback** - แสดงสถานะออเดอร์ชัดเจน
✅ **Price Calculation** - คำนวณราคาโดยอัตโนมัติ

## 🔧 Tech Stack

- **Backend:** Node.js + Express.js
- **Database:** SQLite3
- **Frontend:** HTML5 + CSS3 + Vanilla JavaScript
- **QR Code Scanner:** jsQR library
- **Real-time Updates:** Auto-refresh

## 📱 ข้อมูล QR Code โต๊ะ

| โต๊ะที่ | QR Code |
|--------|---------|
| 1 | `b274831e2492681a` |
| 2 | `0f119dac1d4a4bd1` |
| 3 | `f611281eea1392a1` |
| 4 | `bc715ce45019da82` |
| 5 | `db9850f8810b9545` |
| 6 | `71884951c7c4ec4a` |
| 7 | `7deb1b2aaad38cab` |
| 8 | `7771f819a504db25` |
| 9 | `223f92edd3cacea4` |
| 10 | `acb1e54371e28827` |

## 📚 รายการเมนู

### ส้มตำ
- ส้มตำไทย - ฿40
- ส้มตำข้าวโพด - ฿50
- ส้มตำปู - ฿40
- ส้มตำปลาร้า - ฿40
- ส้มตำปูปลาร้า - ฿45
- ส้มตำหมูยอปลาร้า - ฿45
- ส้มตำปูม้า - ฿80
- ส้มตำกุ้งสด - ฿80

### กับข้าว
- ลาบหมู - ฿70
- น้ำตกหมู - ฿70
- ต้มแซบ - ฿60
- แกงเห็ด - ฿50
- คอหมูย่าง - ฿70
- ไก่ย่าง - ฿50

แก้ไขเมนู เพิ่มรายการใหม่ หรือเปิด/ปิดขายได้ที่หน้า **admin-menu.html** (ไม่ต้องแก้โค้ด)

## 🎯 ฟีเจอร์เพิ่มเติมในอนาคต

- [ ] Notification เมื่อเสร็จสินค้า (LINE/Push)
- [ ] ประวัติออเดอร์/ยอดขายย้อนหลัง
- [ ] Report ยอดขายรายวัน
- [ ] หลายภาษา (English, Chinese)

## 📞 Support

สำหรับปัญหาการใช้งาน ติดต่อเชฟหรือผู้จัดการร้าน

---

**ยินดีต้อนรับสู่ ปายแซ่บ!** 🌶️
