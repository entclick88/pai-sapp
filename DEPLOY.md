# 🚀 One-Click Deploy to Render

Deploy Auto Content Generator ไปยัง Render ได้อย่างง่ายด้วย **1 click!**

---

## ⚡ Quick Deploy

### Click ปุ่มนี้เพื่อ Deploy:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/entclick88/pai-sapp)

---

## 📋 ขั้นตอนการ Deploy

### 1️⃣ Click Deploy Button ด้านบน

### 2️⃣ Authorize Render with GitHub
- Click "Authorize"
- Render จะขอสิทธิ์เข้า GitHub

### 3️⃣ กรอก Environment Variables

Render จะถามให้ใส่ค่าเหล่านี้:

| ตัวแปร | ค่า | หมายเหตุ |
|-------|-----|---------|
| `ANTHROPIC_API_KEY` | `sk-ant-xxxxx` | Claude API Key จาก https://console.anthropic.com |
| `GOOGLE_CLIENT_ID` | `xxxxx.apps.googleusercontent.com` | จาก Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxxxx` | จาก Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | `https://auto-content-generator-xxxx.onrender.com/auth/google/callback` | Render จะให้ URL หลังจาก deploy |
| `EMAIL_USER` | `your-email@gmail.com` | Gmail address |
| `EMAIL_PASSWORD` | `xxxx xxxx xxxx xxxx` | Gmail App Password |
| `EMAIL_FROM` | `your-email@gmail.com` | Gmail address |
| `SESSION_SECRET` | `random-secret-key-12345` | Random key สำหรับ session |
| `CONTENT_TOPIC` | `Technology news and trends` | Topic สำหรับ generate content |

---

### 4️⃣ Click "Deploy"

Render จะ:
- ✅ Clone code จาก GitHub
- ✅ Install dependencies (npm install)
- ✅ Start server (npm start)
- ✅ ได้ URL public

**รอ 3-5 นาที** ให้ deploy เสร็จ

---

### 5️⃣ Update Google OAuth Callback URL

⚠️ **สำคัญ!** หลังจาก deploy:

1. ไปที่ Render dashboard
2. ดู URL ที่ได้ (ประมาณ `https://auto-content-generator-xxxx.onrender.com`)
3. ไปที่ Google Cloud Console → Credentials
4. Edit OAuth 2.0 Client ID
5. Update **Authorized redirect URIs**:
   ```
   https://auto-content-generator-xxxx.onrender.com/auth/google/callback
   ```
6. Save

---

### 6️⃣ Update GitHub Repository

```powershell
# Edit .env
notepad .env

# Change this line:
GOOGLE_CALLBACK_URL=https://auto-content-generator-xxxx.onrender.com/auth/google/callback

# Commit & Push
git add .env
git commit -m "Update callback URL for production"
git push origin main
```

Render จะ auto-deploy หลัง push ✅

---

## 🎉 เสร็จแล้ว!

ได้ URL public:
```
https://auto-content-generator-xxxx.onrender.com
```

**คนอื่นสามารถเข้าใช้ได้เลย!** ✅

---

## 🧪 ทดสอบ

1. ไปที่ URL ที่ได้
2. Login ด้วย Gmail
3. สร้าง Template
4. ตั้งค่าอีเมล + ทดสอบ
5. สร้างเนื้อหา

---

## ❓ ติดตรงไหน?

- Error ไหน?
- Logs ไหน?
- ต้องช่วยไหม?

ติดต่อไป GitHub Issues หรือ ข้อความ

---

## 📚 ข้อมูลเพิ่มเติม

- [Render Documentation](https://render.com/docs)
- [Claude API](https://console.anthropic.com)
- [Google Cloud Console](https://console.cloud.google.com)
- [Gmail App Password Setup](https://myaccount.google.com/)
