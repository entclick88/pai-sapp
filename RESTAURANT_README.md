# 🌶️ ปายแซ่บ - Restaurant Ordering System

**สโลแกน:** คิดถึงความแซ่บ นัว คิดถึงเรา

ระบบสั่งอาหารออนไลน์สำหรับร้านอาหาร ผ่าน QR Code ประจำโต๊ะ

## ✨ ฟีเจอร์หลัก

### 🍽️ ฝั่งลูกค้า (Customer)
- **สแกน QR Code** ประจำโต๊ะ (ไม่ต้อง login)
- **ดูเมนู** แบ่งตามหมวดหมู่ (ก๋วยเตี๋ยว, ลาบ, สลัด, ผัด, แกง, เครื่องดื่ม, ของหวาน)
- **เลือกอาหาร** พร้อมจำนวนและหมายเหตุ
- **คำนวณราคารวม** ก่อนยืนยัน
- **ชำระเงิน** ผ่าน QR Code PromptPay
- **การเสิร์ฟแสดง** ลูกค้าได้รับแจ้งเมื่อเชฟทำเสร็จ

### 👨‍🍳 ฝั่งแอดมิน (Admin/Chef)
- **Dashboard ออนไลน์** ดูออเดอร์ทั้งหมด
- **จัดเรียงตามโต๊ะ** ชัดเจนง่ายต่อการจัดการ
- **อัปเดตสถานะ** ยืนยัน → เตรียม → พร้อมเสิร์ฟ → เสร็จสิ้น
- **ทำเครื่องหมายรายการ** เมื่อทำสินค้าต่อชิ้น
- **สถิติจำนวนออเดอร์** รอยืนยัน, กำลังเตรียม, พร้อมเสิร์ฟ
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
5. คลิก "ยืนยันการสั่งอาหาร"
6. เลือก "จ่ายเงิน" และสแกน QR Code PromptPay
7. รอการเสิร์ฟจากเชฟ

#### 👨‍🍳 แอดมิน
1. ไปที่ http://localhost:3000/admin-dashboard.html
2. ดูรายการออเดอร์ที่เข้ามา
3. คลิก "เริ่มเตรียม" เพื่อเริ่มทำอาหาร
4. คลิกปุ่มติ้ก (✓) บนแต่ละรายการอาหารเมื่อเสร็จ
5. คลิก "พร้อมเสิร์ฟ" เมื่อทุกอย่างพร้อม
6. คลิก "ส่งแล้ว" เมื่อนำไปให้ลูกค้า

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

**ชำระเงิน**
```
POST /api/restaurant/order/:orderId/pay
```

### Admin API

**ดึงออเดอร์ทั้งหมด**
```
GET /api/restaurant/admin/orders
```

**อัปเดตสถานะออเดอร์**
```
PUT /api/restaurant/admin/order/:orderId/status
Body: { status: "pending|confirmed|preparing|ready|served|completed|cancelled" }
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

## 📚 รายการเมนูตัวอย่าง

### ก๋วยเตี๋ยว
- ก๋วยเตี๋ยวเรือ - ฿40
- ก๋วยเตี๋ยวลุงเสมา - ฿50
- ก๋วยเตี๋ยวแห้ง - ฿40

### ลาบ
- ลาบไก่ - ฿80
- ลาบหมู - ฿85
- ลาบเบญจ - ฿100

### สลัด
- สัปปะรดปลาร้า - ฿90
- ยำปลาโลด - ฿120
- ยำผักบุ้ง - ฿50
- ยำไข่ขี้เมียง - ฿60

### ผัด
- ผัดกระเพราหมู - ฿70
- ผัดกระเพราไก่ - ฿70
- ผัดไทย - ฿60
- ผัดข้าวโพด - ฿70

### เครื่องดื่ม
- ชาเย็น - ฿20
- กาแฟดำเย็น - ฿25
- น้ำส้มคั้น - ฿30
- น้ำมะนาว - ฿25

## 🎯 ฟีเจอร์เพิ่มเติมในอนาคต

- [ ] ระบบอนุญาตให้แอดมินเพิ่มเมนูและโต๊ะ
- [ ] Notification เมื่อเสร็จสินค้า
- [ ] ประวัติออเดอร์
- [ ] Report ยอดขาย
- [ ] หลายภาษา (English, Chinese)
- [ ] ระบบเก็บรายได้

## 📞 Support

สำหรับปัญหาการใช้งาน ติดต่อเชฟหรือผู้จัดการร้าน

---

**ยินดีต้อนรับสู่ ปายแซ่บ!** 🌶️
