# Auto Content Generator 📝

ระบบสร้างเนื้อหาอัตโนมัติที่ใช้ Claude AI เพื่อสร้างบทความข่าวทุกวันเวลา 9:00 น และส่งไปยังอีเมลของคุณอัตโนมัติ

## ✨ Features

- 🔐 **Google OAuth Login** - เข้าสู่ระบบด้วย Gmail ได้อย่างปลอดภัย
- 🤖 **Claude AI Integration** - ใช้ Claude 3.5 Sonnet สำหรับการสร้างเนื้อหา
- 📅 **Scheduled Generation** - สร้างเนื้อหาอัตโนมัติทุกวันเวลา 9:00 น
- 📧 **Email Delivery** - ส่งผลลัพธ์ไปยังอีเมลอัตโนมัติ
- 📊 **Templates** - กรอกข้อมูล template นิยามการสร้างเนื้อหา
- 💾 **History** - เก็บประวัติเนื้อหาที่สร้างไว้
- ⚙️ **Settings** - ตั้งค่าอีเมลและการส่ง

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 หรือสูงกว่า)
- npm
- Claude API Key
- Google OAuth 2.0 Credentials
- Gmail Account (สำหรับส่งอีเมล)

### Installation

1. **Clone หรือ download project**

```bash
cd Auto-Content-Generator
```

2. **Install dependencies**

```bash
npm install
```

3. **สร้าง .env file**

Copy `.env.example` เป็น `.env`:

```bash
cp .env.example .env
```

4. **Edit .env และใส่ค่าต่อไปนี้:**

```env
# Claude API
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
EMAIL_FROM=your-email@gmail.com

# App Configuration
PORT=3000
NODE_ENV=development
SESSION_SECRET=your-random-secret-key

# Database
DATABASE_PATH=./data/content.db

# Content Generation
CONTENT_TOPIC=Technology news and trends
```

### วิธีการรับ API Keys

#### 1. Claude API Key

1. ไปที่ https://console.anthropic.com/
2. สร้าง account และ login
3. ไปที่ API Keys section
4. สร้าง API Key ใหม่
5. Copy และ paste ลงใน .env

#### 2. Google OAuth Credentials

1. ไปที่ https://console.cloud.google.com/
2. สร้าง project ใหม่
3. ไปที่ Credentials → Create Credentials → OAuth 2.0 Client ID
4. เลือก "Web application"
5. Add authorized redirect URIs: `http://localhost:3000/auth/google/callback`
6. Copy Client ID และ Client Secret

#### 3. Gmail App Password

1. ไปที่ https://myaccount.google.com/
2. Security → 2-Step Verification (ต้องเปิดก่อน)
3. ไปที่ App passwords
4. เลือก Mail และ Windows Computer
5. Copy password ที่ generate

### 5. **Run Server**

```bash
npm start
```

หรือ (ใช้ nodemon สำหรับ development):

```bash
npm run dev
```

Server จะเริ่มที่ `http://localhost:3000`

## 📖 How to Use

### 1. Login ครั้งแรก

- เปิด http://localhost:3000
- คลิก "เข้าสู่ระบบด้วย Gmail"
- อนุมัติการเข้าถึง
- จะ redirect ไปที่ Dashboard

### 2. สร้าง Template

1. ไปที่ Templates tab
2. กรอก:
   - **ชื่อ Template** (เช่น: Daily Tech News)
   - **Topic** (เช่น: Technology News)
   - **Prompt** (คำสั่งสำหรับ Claude)
   - **Style** (Informative, Conversational, etc.)
   - **Word Count** (จำนวนคำ)
3. คลิก "สร้าง Template"

### 3. ตั้งค่าอีเมล

1. ไปที่ Settings tab
2. ใส่อีเมลที่จะรับผลลัพธ์ (สามารถหลายอีเมลโดยคั่นด้วย comma)
3. คลิก "ทดสอบอีเมล" เพื่อยืนยัน
4. บันทึก

### 4. เสร็จ! ✅

ระบบจะทำงาน:
- 📅 **ทุกวัน เวลา 9:00 น** - สร้างเนื้อหาตามทุก Template ที่ Active
- 📧 **ส่งอีเมลอัตโนมัติ** - ส่งไปยังอีเมลที่ตั้งค่าไว้
- 💾 **บันทึกประวัติ** - เก็บไว้ใน Database

## 🛠️ API Endpoints

### Authentication
- `GET /auth/google` - Google login
- `GET /auth/google/callback` - Google callback
- `GET /auth/me` - Get current user
- `GET /auth/status` - Check auth status
- `POST /auth/logout` - Logout

### Templates
- `GET /api/templates` - Get all templates
- `GET /api/templates/:id` - Get single template
- `POST /api/templates` - Create template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template
- `POST /api/templates/:id/generate` - Generate content for template

### Content
- `GET /api/content/generated` - Get generated content
- `GET /api/content/:id` - Get single content

### Email Settings
- `GET /api/email-settings` - Get email settings
- `PUT /api/email-settings` - Update email settings
- `POST /api/email-settings/test` - Send test email

### Manual Generation
- `POST /api/generate-now` - Generate content now

## 🔧 Configuration

### เปลี่ยนเวลาการสร้างเนื้อหา

ที่ไฟล์ `jobs/contentGenerator.js`:

```javascript
// Default: 0 9 * * * (9:00 AM every day)
cronJob = cron.schedule('0 9 * * *', async () => {
  // Change this cron expression
  // Format: minute hour day month dayOfWeek
});
```

เช่น:
- `0 8 * * *` - 8:00 AM
- `30 14 * * *` - 2:30 PM
- `0 9 * * 1-5` - 9:00 AM weekdays only

## 🐛 Troubleshooting

### Email ไม่ส่ง
- ✅ ตรวจสอบ EMAIL_USER และ EMAIL_PASSWORD ใน .env
- ✅ Gmail ต้องเปิด 2-Step Verification
- ✅ ต้องใช้ App Password (ไม่ใช่ account password)
- ✅ คลิก "ทดสอบอีเมล" ใน Settings

### Content ไม่ generate
- ✅ ตรวจสอบ ANTHROPIC_API_KEY
- ✅ ตรวจสอบ Template มี active = 1
- ✅ ดูใน logs ว่ามี error ไหน

### Google Login ไม่ได้
- ✅ ตรวจสอบ GOOGLE_CLIENT_ID และ GOOGLE_CLIENT_SECRET
- ✅ ตรวจสอบ Redirect URL ตรงกับในการตั้งค่า Google
- ✅ ตรวจสอบ OAuth consent screen ถูก configure

## 📚 Stack

- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **AI**: Claude API (Anthropic)
- **Auth**: Passport.js + Google OAuth 2.0
- **Email**: Nodemailer
- **Scheduling**: node-cron
- **Frontend**: Vanilla JavaScript + HTML + CSS

## 📄 License

MIT
