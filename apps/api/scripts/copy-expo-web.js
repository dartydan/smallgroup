/**
 * Builds Expo web and copies output to apps/api/public so the API deployment
 * can serve the web app at /. Run from apps/api (e.g. node scripts/copy-expo-web.js).
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const apiRoot = path.resolve(__dirname, '..');
const expoApp = path.resolve(apiRoot, '../expo');
const distDir = path.join(expoApp, 'dist');
const publicDir = path.join(apiRoot, 'public');

console.log('Building Expo web...');
execSync('npx expo export --platform web', {
  cwd: expoApp,
  stdio: 'inherit',
  env: { ...process.env },
});

if (!fs.existsSync(distDir)) {
  console.error('Expo web build did not produce dist/');
  process.exit(1);
}

console.log('Copying Expo web build to api/public...');
if (fs.existsSync(publicDir)) {
  fs.rmSync(publicDir, { recursive: true });
}
fs.mkdirSync(publicDir, { recursive: true });
fs.cpSync(distDir, publicDir, { recursive: true });
console.log('Done.');
