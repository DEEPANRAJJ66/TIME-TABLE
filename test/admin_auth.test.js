// Test Suite: Administrator Authentication & Confidential Password Verification
// Verifies that jeyaramandeeban@gmail.com is configured as an authorized Administrator
// with private, confidential password handling and Google SSO recognition.

import assert from 'assert';
import { LearningStore } from '../js/learning/learningStore.js';
import { LearningAuthService } from '../js/learning/learningAuth.js';

// Setup Mock Browser Environment
const storage = new Map();
global.localStorage = {
  getItem: (k) => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k),
  clear: () => storage.clear()
};

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

async function itAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${desc}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(err);
    process.exit(1);
  }
}

console.log('\n=== RUNNING ADMIN AUTHENTICATION TEST SUITE ===\n');

const store = new LearningStore();
const auth = new LearningAuthService(store);

it('1. jeyaramandeeban@gmail.com is recognized as authorized in Manager / Admin registry', () => {
  assert.strictEqual(store.isAuthorizedManager('jeyaramandeeban@gmail.com'), true);
  assert.strictEqual(store.isAuthorizedManager('JEYARAMANDEEBAN@GMAIL.COM'), true);
});

await itAsync('2. First confidential password entry sets and authenticates jeyaramandeeban@gmail.com as Admin', async () => {
  localStorage.clear();
  const testSecretPassword = 'MySecretPrivatePassword2026!';
  const user = await auth.loginAdmin('jeyaramandeeban@gmail.com', testSecretPassword);

  assert.strictEqual(user.role, 'admin');
  assert.strictEqual(user.email, 'jeyaramandeeban@gmail.com');
  assert.strictEqual(auth.isAdmin(), true);
  assert.strictEqual(localStorage.getItem('college_lr_admin_pass_jeyaramandeeban@gmail.com'), testSecretPassword);
});

await itAsync('3. Subsequent login with matching confidential password succeeds', async () => {
  const testSecretPassword = 'MySecretPrivatePassword2026!';
  const user = await auth.loginAdmin('jeyaramandeeban@gmail.com', testSecretPassword);
  assert.strictEqual(user.role, 'admin');
  assert.strictEqual(auth.isAdmin(), true);
});

await itAsync('4. Login with incorrect password is strictly rejected', async () => {
  let failed = false;
  try {
    await auth.loginAdmin('jeyaramandeeban@gmail.com', 'WrongPassword123');
  } catch (e) {
    failed = true;
    assert(e.message.includes('Invalid Admin password'));
  }
  assert.strictEqual(failed, true, 'Should have rejected wrong password');
});

await itAsync('5. Unauthorized email cannot authenticate as admin', async () => {
  let failed = false;
  try {
    await auth.loginAdmin('unauthorized.random@gmail.com', 'SomePassword123');
  } catch (e) {
    failed = true;
    assert(e.message.includes('not registered as an Admin account'));
  }
  assert.strictEqual(failed, true, 'Should reject unauthorized email');
});

await itAsync('6. Google sign-in recognizes jeyaramandeeban@gmail.com as Administrator', async () => {
  const user = await auth.loginWithGoogle('admin', {
    email: 'jeyaramandeeban@gmail.com',
    name: 'Deepanraj J',
    sub: 'google_12345'
  });

  assert.strictEqual(user.role, 'admin');
  assert.strictEqual(user.email, 'jeyaramandeeban@gmail.com');
  assert.strictEqual(auth.isAdmin(), true);
});

console.log('\n==============================================');
console.log('TEST SUMMARY: 6 PASSED, 0 FAILED OUT OF 6 TESTS');
console.log('==============================================\n');
