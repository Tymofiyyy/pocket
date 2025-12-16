const express = require('express');
const router = express.Router();
const postbackController = require('../controllers/postbackController');

// Тестовий endpoint
router.get('/test', postbackController.test.bind(postbackController));

// Головний endpoint для постбеків
router.post('/postback', postbackController.handlePostback.bind(postbackController));
router.get('/postback', postbackController.handlePostback.bind(postbackController));

module.exports = router;
