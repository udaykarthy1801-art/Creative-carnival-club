const router = require('express').Router();
const { rateLimit } = require('express-rate-limit');
const config = require('../config/env');
const controller = require('../controllers/registrationController');
router.post('/', rateLimit({ windowMs: config.registrationWindow, limit: config.registrationLimit, standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, message: 'Too many registration attempts. Please try again later.' } }), controller.create);
router.get('/:registrationId', rateLimit({ windowMs: 15 * 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, message: 'Too many lookup attempts. Please try again later.' } }), controller.lookup);
module.exports = router;
