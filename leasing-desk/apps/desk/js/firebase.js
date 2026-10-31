// Firebase setup: deployment config from config.js and the Firestore handle.

// Deployment settings (Firebase web config, manager PIN) come from config.js, generated from .env by scripts/write-config.mjs
export const CONFIG = window.APP_CONFIG || {};
if (!window.APP_CONFIG) console.error('config.js is missing: copy .env.example to .env, fill it in, and run node scripts/write-config.mjs');

const FB_CONFIG = CONFIG.firebase;   // Firebase web config from config.js (.env); public by design, access is set by the Firestore rules
export function fbDb() {
  if (typeof firebase === 'undefined') return null;
  if (!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
  return firebase.firestore();
}
