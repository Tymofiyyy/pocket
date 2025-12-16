const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const apiRoutes = require('./routes/api');
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS налаштування - дозволяємо запити з будь-якого джерела для тестування
const corsOptions = {
  origin: function (origin, callback) {
    // Дозволяємо запити без origin (наприклад, Postman, curl)
    if (!origin) return callback(null, true);
    
    // Дозволяємо localhost, 127.0.0.1, та будь-які cloudflare домени
    const allowedPatterns = [
      /^http:\/\/localhost(:\d+)?$/,
      /^http:\/\/127\.0\.0\.1(:\d+)?$/,
      /\.trycloudflare\.com$/,
      /\.cloudflare\.com$/,
      /pocketsignals\.uk$/
    ];
    
    const isAllowed = allowedPatterns.some(pattern => pattern.test(origin));
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log('⚠️  CORS blocked origin:', origin);
      callback(null, true); // Все одно дозволяємо (для розробки)
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
};

// Middleware
app.use(cors(corsOptions));
app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Логування всіх запитів для дебагу
app.use((req, res, next) => {
  console.log(`\n📝 ${req.method} ${req.path}`);
  if (Object.keys(req.query).length > 0) {
    console.log('Query params:', req.query);
  }
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', req.body);
  }
  next();
});

// Routes (API routes ПЕРЕД статичними файлами!)
app.use('/api', apiRoutes);

// Обслуговування завантажених зображень
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

console.log('📁 Uploads directory:', path.join(__dirname, '../../uploads'));

// Health check (перед статичними файлами!)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Обслуговування статичних файлів адмін-панелі (ОСТАННІМ!)
app.use(express.static(path.join(__dirname, '../../admin-panel')));

// Головна сторінка
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../admin-panel/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message 
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log('\n🚀 Pocket Signals Backend Starting...');
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\n📍 URLs:`);
  console.log(`   - Admin Panel: http://localhost:${PORT}/`);
  console.log(`   - Health: http://localhost:${PORT}/health`);
  console.log(`   - API: http://localhost:${PORT}/api/`);
  console.log(`   - Uploads: http://localhost:${PORT}/uploads/`);
  console.log('\n✨ Ready!\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 SIGTERM signal received: closing HTTP server');
  db.pool.end(() => {
    console.log('✅ Database pool closed');
    process.exit(0);
  });
});
