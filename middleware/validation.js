const { body, validationResult } = require('express-validator');

const registerValidation = [
    body('username')
        .isLength({ min: 3, max: 20 }).withMessage('Username must be 3-20 characters')
        .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers and underscore'),
    
    body('email')
        .isEmail().withMessage('Valid email required')
        .normalizeEmail(),
    
    body('password')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    
    body('pay_password')
        .isLength({ min: 4, max: 6 }).withMessage('Payment password must be 4-6 digits')
        .isNumeric().withMessage('Payment password must be numeric')
];

const loginValidation = [
    body('username').notEmpty().withMessage('Username or email required'),
    body('password').notEmpty().withMessage('Password required')
];

const validateRequest = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    next();
};

module.exports = {
    registerValidation,
    loginValidation,
    validateRequest
};