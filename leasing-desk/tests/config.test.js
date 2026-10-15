// Fake config.js for the browser tests (the Playwright scripts serve it in place of the generated config.js).
// The Firebase SDK is replaced by apps/shared/demo/fake-firestore.js, so these values never reach a real project.
window.APP_CONFIG = {
  firebase: { apiKey: 'test-api-key', authDomain: 'demo-test.example', projectId: 'demo-test', storageBucket: 'demo-test.example', messagingSenderId: '0', appId: 'test-app' },
  managerPin: 'test-pin-never-typed'
};
