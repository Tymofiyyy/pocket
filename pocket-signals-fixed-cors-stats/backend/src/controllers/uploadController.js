const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Налаштування сховища
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../uploads');
    
    console.log('📁 Upload directory:', uploadDir);
    
    // Створюємо папку якщо не існує
    if (!fs.existsSync(uploadDir)) {
      console.log('📂 Creating uploads directory...');
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Генеруємо унікальне ім'я
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = 'image-' + uniqueSuffix + ext;
    console.log('📝 Generated filename:', filename);
    cb(null, filename);
  }
});

// Фільтр файлів (тільки зображення)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Дозволені тільки зображення (JPEG, PNG, GIF, WebP)'), false);
  }
};

// Налаштування multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // Максимум 5MB
  }
});

class UploadController {
  // Завантаження одного зображення
  uploadSingle(req, res) {
    // Встановлюємо заголовки ДО обробки multer
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    upload.single('image')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ 
            error: 'Файл занадто великий. Максимум 5MB' 
          });
        }
        return res.status(400).json({ error: err.message });
      } else if (err) {
        return res.status(400).json({ error: err.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Файл не завантажено' });
      }

      console.log('✅ File uploaded successfully:', req.file.filename);

      // Генеруємо URL для доступу до файлу
      const fileUrl = `/uploads/${req.file.filename}`;
      const absolutePath = path.join(__dirname, '../../../uploads', req.file.filename);

      // КРИТИЧНО: Явно встановлюємо Content-Type як JSON
      res.setHeader('Content-Type', 'application/json');
      
      res.status(200).json({
        message: 'Файл успішно завантажено',
        filename: req.file.filename,
        url: fileUrl,
        fullUrl: `${req.protocol}://${req.get('host')}${fileUrl}`,
        absolutePath: absolutePath  // Додаємо абсолютний шлях
      });
    });
  }

  // Видалення зображення
  async deleteImage(req, res) {
    try {
      const { filename } = req.params;
      const filePath = path.join(__dirname, '../../../uploads', filename);

      console.log('🗑️ Deleting file:', filePath);

      // Перевіряємо чи існує файл
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Файл не знайдено' });
      }

      // Видаляємо файл
      fs.unlinkSync(filePath);

      res.json({ message: 'Файл успішно видалено' });
    } catch (error) {
      console.error('Error deleting image:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // Отримання списку всіх зображень
  async listImages(req, res) {
    try {
      const uploadsDir = path.join(__dirname, '../../../uploads');

      console.log('📋 Listing images from:', uploadsDir);

      if (!fs.existsSync(uploadsDir)) {
        return res.json({ images: [] });
      }

      const files = fs.readdirSync(uploadsDir);
      
      const images = files
        .filter(file => {
          const ext = path.extname(file).toLowerCase();
          return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
        })
        .map(file => {
          const filePath = path.join(uploadsDir, file);
          const stats = fs.statSync(filePath);
          
          return {
            filename: file,
            url: `/uploads/${file}`,
            fullUrl: `${req.protocol}://${req.get('host')}/uploads/${file}`,
            size: stats.size,
            created: stats.birthtime
          };
        })
        .sort((a, b) => b.created - a.created); // Сортуємо за датою (нові спочатку)

      res.json({ images });
    } catch (error) {
      console.error('Error listing images:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new UploadController();
