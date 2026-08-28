# 🚀 Setup Guide - ขั้นตอนการตั้งค่าระบบ

## ขั้นตอนที่ 1: ติดตั้ง Dependencies

```bash
npm install
```

## ขั้นตอนที่ 2: รับ API Keys

### 🔑 1. Claude API Key

**ขั้นตอน:**
1. ไปที่ https://console.anthropic.com/
2. Click "Sign in" หรือ "Sign up"
3. ใส่ email และ password
4. ไปที่ **API Keys** (sidebar ด้านซ้าย)
5. Click **"Create Key"**
6. Copy key ที่ได้

**ใน .env:**
```env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 🔐 2. Google OAuth Credentials

**ขั้นตอน:**

1. ไปที่ https://console.cloud.google.com/
2. Click "Select a Project" → "New Project"
3. ตั้งชื่อ project (เช่น: Content Generator)
4. Click "Create"
5. ไปที่ **APIs & Services** → **OAuth consent screen**
6. เลือก "External" → Click "Create"
7. กรอกข้อมูล:
   - App name: "Auto Content Generator"
   - User support email: your-email@gmail.com
   - Developer contact: your-email@gmail.com
   - Click "Save and Continue"
8. ข้าม "Scopes" และ "Test users" ไป
9. ไปที่ **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**
10. เลือก "Web application"
11. ใส่:
    - Name: "Content Generator"
    - Authorized JavaScript origins: `http://localhost:3000`
    - Authorized redirect URIs: `http://localhost:3000/auth/google/callback`
12. Click "Create"
13. Copy **Client ID** และ **Client Secret**

**ใน .env:**
```env
GOOGLE_CLIENT_ID=xxxxxxxx-xxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
```

---

### 📧 3. Gmail Configuration

Gmail ต้องใช้ **App Password** (ไม่ใช่ account password ปกติ)

**ขั้นตอน:**

1. ไปที่ https://myaccount.google.com/
2. ไปที่ **Security** (sidebar ด้านซ้าย)
3. หา **2-Step Verification** → click **Enable** (ถ้ายังไม่เปิด)
   - ตามขั้นตอน verify ด้วย phone
4. กลับไปที่ Security
5. ค้นหา **App passwords** (อยู่ใต้ 2-Step Verification)
6. เลือ:
   - Select the app: **Mail**
   - Select the device: **Windows Computer** (หรือ device ที่ใช้)
7. Click "Generate"
8. Copy password ที่ได้ (16 ตัวอักษร)

**ใน .env:**
```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
EMAIL_FROM=your-email@gmail.com
```

---

## ขั้นตอนที่ 3: สร้าง .env File

```bash
cp .env.example .env
```

**Edit `.C:\Users\psu05\Claude\.env`:**

```env
# Claude API (จากขั้นตอนที่ 2.1)
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx

# Google OAuth (จากขั้นตอนที่ 2.2)
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Email Configuration (จากขั้นตอนที่ 2.3)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=xxxx xxxx xxxx xxxx
EMAIL_FROM=your-email@gmail.com

# App Configuration
PORT=3000
NODE_ENV=development
SESSION_SECRET=your-random-secret-key-change-this-12345

# Database
DATABASE_PATH=./data/content.db

# Content Generation
CONTENT_TOPIC=Technology news and trends
```

---

## ขั้นตอนที่ 4: รันแอปพลิเคชัน

### Option 1: Production Mode
```bash
npm start
```

### Option 2: Development Mode (with auto-reload)
```bash
npm run dev
```

**Output ที่ควรเห็น:**
```
🚀 Server running on http://localhost:3000

📧 Setting up automated content generation...
✅ Email server configured and ready
✅ Application ready!
```

---

## ขั้นตอนที่ 5: ใช้งานแอป

### 1. เปิดแบบเบราว์เซอร์

ไปที่ http://localhost:3000

### 2. Login ด้วย Gmail

- คลิก "เข้าสู่ระบบด้วย Gmail"
- Google จะขอสิทธิ์เข้าถึง
- Click "Allow" (ครั้งแรกเท่านั้น)

### 3. Dashboard

ระบบจะเปิด Dashboard หลัก

### 4. สร้าง Template

ไปที่ **Templates** tab:

**Example Template 1 - Daily News:**
- ชื่อ: `Daily Tech News`
- Topic: `Technology and Science`
- Prompt: 
```
Create an engaging blog post about the latest technology trends and news. 
Focus on:
- Recent breakthroughs
- Impact on society
- Future implications

Make it informative and easy to understand.
```
- Style: `Informative`
- Word Count: `600`

**Example Template 2 - Industry Updates:**
- ชื่อ: `Business Updates`
- Topic: `Business and Markets`
- Prompt:
```
Write a business news article about market trends and corporate updates.
Include analysis and insights for professionals.
```
- Style: `Professional`
- Word Count: `500`

### 5. ตั้งค่าอีเมล

ไปที่ **Settings** tab:

1. ใส่อีเมลที่จะรับผลลัพธ์:
```
your-email@gmail.com
```

หรือหลายอีเมล (คั่นด้วย comma):
```
email1@gmail.com, email2@gmail.com, work@company.com
```

2. Click **"ทดสอบอีเมล"** เพื่อยืนยันว่าใช้ได้

3. Click **"บันทึก Settings"**

### 6. เสร็จแล้ว! ✅

ระบบจะทำงาน:
- **ทุกวัน เวลา 9:00 น** → สร้างเนื้อหาจาก Template ทั้งหมด
- **สร้างอัตโนมัติ** → ใช้ Claude AI
- **ส่งอีเมล** → ไปยังอีเมลที่ตั้งค่าไว้
- **บันทึกประวัติ** → ดูใน Generated Content tab

---

## 🧪 ทดสอบระบบ

### ทดสอบการสร้างเนื้อหา (ตอนนี้)

1. ไปที่ Dashboard
2. Click **"🚀 สร้างเนื้อหาตอนนี้"**
3. รอให้สร้างเสร็จ (20-30 วินาที)
4. ไปที่ **Generated Content** tab ดูผลลัพธ์

### ทดสอบอีเมล

1. ไปที่ Settings
2. Click **"✉️ ทดสอบอีเมล"**
3. ตรวจสอบกล่องขาเข้าของอีเมลที่ตั้งค่าไว้

---

## 🐛 แก้ไขปัญหา

### ❌ "Invalid API Key" (Claude API)

**สาเหตุ:** API Key ผิด หรือไม่มี

**วิธีแก้:**
1. ไปที่ https://console.anthropic.com/
2. ตรวจสอบ API Key
3. Update `.env` ใหม่
4. Restart server

---

### ❌ Google Login ไม่ได้

**สาเหตุ:** Redirect URL ไม่ตรงกัน หรือ OAuth ยังไม่ approve

**วิธีแก้:**
1. ไปที่ https://console.cloud.google.com/
2. ไปที่ APIs & Services → Credentials
3. Edit OAuth 2.0 Client ID
4. ตรวจสอบ Authorized redirect URIs:
   - ต้องเป็น: `http://localhost:3000/auth/google/callback`
5. Save และ restart server

---

### ❌ Email ไม่ส่ง

**สาเหตุ:** Email password ผิด หรือ 2-Step Verification ไม่เปิด

**วิธีแก้:**
1. ตรวจสอบ EMAIL_USER และ EMAIL_PASSWORD ใน `.env`
2. ไปที่ https://myaccount.google.com/security
3. ตรวจสอบ 2-Step Verification เปิดหรือไม่
4. ไปที่ App passwords สร้างใหม่
5. Update `.env` ด้วย password ใหม่
6. Restart server
7. ทดสอบ "ทดสอบอีเมล" ใน Settings

---

### ❌ Database Error

**วิธีแก้:**
1. ลบ folder `data/`
2. Restart server
3. Database จะสร้างใหม่เองโดยอัตโนมัติ

---

## ✅ Checklist ก่อนใช้งาน

- [ ] npm install ได้แล้ว
- [ ] ได้ Claude API Key
- [ ] ได้ Google OAuth Credentials
- [ ] ได้ Gmail App Password
- [ ] สร้าง .env file แล้ว
- [ ] ใส่ API Keys ทั้งหมดใน .env
- [ ] ทดสอบ Email ส่งได้
- [ ] สร้าง Template 1 อันขึ้นไป
- [ ] ตั้งค่าอีเมลรับผลลัพธ์

---

## 🎯 ขั้นตอนถัดไป

1. ✅ ระบบจะสร้างเนื้อหาอัตโนมัติทุกวัน 9:00 น
2. ✅ ตรวจสอบอีเมลทุกวันเช้า
3. ✅ ปรับ Template ตามความต้องการ
4. ✅ เปลี่ยนเวลาการ generate ได้ใน `jobs/contentGenerator.js`

---

## 📞 ติดต่อ / ช่วยเหลือ

หากมีปัญหา:
1. ตรวจสอบ error ใน console
2. ตรวจสอบ .env configuration
3. ลองเทสต์ด้วยตนเองใน Dashboard

**Good luck! 🚀**
