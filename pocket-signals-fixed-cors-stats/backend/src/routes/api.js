const express = require('express');
const router = express.Router();

const postbackController = require('../controllers/postbackController');
const chainController = require('../controllers/chainController');
const userController = require('../controllers/userController');
const accountController = require('../controllers/accountController');
const statsController = require('../controllers/statsController');
const uploadController = require('../controllers/uploadController');

// ============================================
// Postback routes
// ============================================
router.get('/postback/test', postbackController.test.bind(postbackController));
router.post('/postback', postbackController.handlePostback.bind(postbackController));
router.get('/postback', postbackController.handlePostback.bind(postbackController));

// ============================================
// Upload routes
// ============================================
router.post('/upload', uploadController.uploadSingle.bind(uploadController));
router.get('/images', uploadController.listImages.bind(uploadController));
router.delete('/images/:filename', uploadController.deleteImage.bind(uploadController));

// ============================================
// Chain routes
// ============================================
router.get('/chains', chainController.getAll.bind(chainController));
router.get('/chains/:id', chainController.getOne.bind(chainController));
router.post('/chains', chainController.create.bind(chainController));
router.put('/chains/:id', chainController.update.bind(chainController));
router.delete('/chains/:id', chainController.delete.bind(chainController));

// Chain steps
router.post('/chains/:id/steps', chainController.addStep.bind(chainController));
router.put('/chains/steps/:stepId', chainController.updateStep.bind(chainController));
router.delete('/chains/steps/:stepId', chainController.deleteStep.bind(chainController));

// ============================================
// User routes
// ============================================
router.get('/users', userController.getAll.bind(userController));
router.get('/users/stats', userController.getStats.bind(userController));
router.get('/users/:id', userController.getOne.bind(userController));

// ============================================
// Telegram Account routes
// ============================================
router.get('/accounts', accountController.getAll.bind(accountController));
router.get('/accounts/stats', accountController.getStats.bind(accountController));
router.post('/accounts', accountController.create.bind(accountController));
router.put('/accounts/:id', accountController.update.bind(accountController));
router.delete('/accounts/:id', accountController.delete.bind(accountController));

// ============================================
// Stats & Logs routes
// ============================================
router.get('/stats/overview', statsController.getOverview.bind(statsController));
router.get('/stats/daily', statsController.getDailyStats.bind(statsController));
router.get('/stats/chains', statsController.getChainStats.bind(statsController));
router.get('/logs', statsController.getRecentLogs.bind(statsController));

module.exports = router;
