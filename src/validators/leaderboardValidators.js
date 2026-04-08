import { query } from 'express-validator';

const allowedScopes = ['weekly'];
const allowedCategories = ['overall', 'quality'];

export const leaderboardQueryValidation = [
  query('scope')
    .exists()
    .withMessage('scope is required')
    .bail()
    .isString()
    .bail()
    .isIn(allowedScopes)
    .withMessage('scope must be weekly'),
  query('category')
    .exists()
    .withMessage('category is required')
    .bail()
    .isString()
    .bail()
    .isIn(allowedCategories)
    .withMessage('category must be overall or quality'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('limit must be an integer between 1 and 100')
];
