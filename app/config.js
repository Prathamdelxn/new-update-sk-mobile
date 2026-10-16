// API Configuration
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

// Public web app (new-update-web-sklite) base URL — used to build client-facing
// share links (e.g. /share/drawing/{token}) that only exist as web pages.
export const WEB_APP_URL = (process.env.EXPO_PUBLIC_WEB_APP_URL || 'https://new-update-two.vercel.app').replace(/\/+$/, '');

// Cloudinary Configuration (Frontend Signed Upload)
export const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
export const CLOUDINARY_API_KEY = process.env.EXPO_PUBLIC_CLOUDINARY_API_KEY;
export const CLOUDINARY_API_SECRET = process.env.EXPO_PUBLIC_CLOUDINARY_API_SECRET;

// Signed Upload API URL
export const CLOUDINARY_API_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
