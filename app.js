require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const { db, dbAsync } = require('./config/database');
const authRoutes = require('./routes/auth');
const templateRoutes = require('./routes/template');
const emailSettingsRoutes = require('./routes/emailSettings');
const generatorRoutes = require('./routes/generator');
const { startContentGenerationJob, testEmailConnection } = require('./services/emailer');
const { startContentGenerationJob: startScheduledJob } = require('./jobs/contentGenerator');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Passport configuration
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Check if user exists
    let user = await dbAsync.get(
      'SELECT * FROM users WHERE googleId = ?',
      [profile.id]
    );

    if (!user) {
      // Create new user
      const result = await dbAsync.run(
        `INSERT INTO users (googleId, email, displayName, profilePicture)
         VALUES (?, ?, ?, ?)`,
        [profile.id, profile.emails[0].value, profile.displayName, profile.photos[0]?.value || null]
      );

      user = {
        id: result.id,
        googleId: profile.id,
        email: profile.emails[0].value,
        displayName: profile.displayName,
        profilePicture: profile.photos[0]?.value || null
      };

      // Create default email settings
      await dbAsync.run(
        `INSERT INTO email_settings (userId, recipientEmails)
         VALUES (?, ?)`,
        [user.id, user.email]
      );
    } else {
      // Update user info
      await dbAsync.run(
        `UPDATE users SET displayName = ?, profilePicture = ? WHERE id = ?`,
        [profile.displayName, profile.photos[0]?.value || user.profilePicture, user.id]
      );

      user.displayName = profile.displayName;
      user.profilePicture = profile.photos[0]?.value || user.profilePicture;
    }

    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await dbAsync.get('SELECT * FROM users WHERE id = ?', [id]);
    done(null, user);
  } catch (error) {
    done(error);
  }
});

// Routes
app.use('/auth', authRoutes);
app.use('/api', templateRoutes);
app.use('/api', emailSettingsRoutes);
app.use('/api', generatorRoutes);

// Content Generator page
app.get('/generator', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'content-generator.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Dashboard
app.get('/dashboard', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Main page
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API: Generate content manually (with auth)
app.post('/api/generate-now', async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const templates = await dbAsync.all(
      'SELECT * FROM templates WHERE userId = ? AND active = 1',
      [req.user.id]
    );

    if (templates.length === 0) {
      return res.status(404).json({ error: 'No active templates found' });
    }

    const { generateContentManually } = require('./jobs/contentGenerator');
    const results = [];

    for (const template of templates) {
      const result = await generateContentManually(template.id);
      results.push({
        templateId: template.id,
        templateTitle: template.title,
        ...result
      });
    }

    res.json({
      success: true,
      message: `Generated content from ${results.length} template(s)`,
      results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`\n📧 Setting up automated content generation...`);

  // Test email configuration
  const emailReady = await testEmailConnection();
  if (emailReady) {
    console.log('✅ Email server configured and ready');
  } else {
    console.log('⚠️  Email configuration may have issues - check your .env file');
  }

  // Start scheduled job
  startScheduledJob();

  console.log(`\n✅ Application ready!`);
  console.log(`📝 Create templates and configure email settings to get started`);
  console.log(`🕘 Content will be generated daily at 9:00 AM\n`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  process.exit(0);
});
