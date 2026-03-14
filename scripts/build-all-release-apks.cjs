/**
 * Build User, Admin, and Agent release APKs (each with its own UI).
 * Run: npm run cap:apk:release:all
 * Output: dist/apk/lucky-win-user-release.apk, lucky-win-admin-release.apk, lucky-win-agent-release.apk
 *
 * - User APK: full user interface (games, deposit, etc.)
 * - Admin APK: admin only, starts at /admin
 * - Agent APK: agent only, starts at /agent-login
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const possibleJava17Paths = [
  process.env.JAVA_HOME,
  process.env.ANDROID_STUDIO_JBR,
  'C:\\Program Files\\Android\\Android Studio\\jbr',
  'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.13.11-hotspot',
  'C:\\Program Files\\Microsoft\\jdk-17.0.13.11-hotspot',
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Eclipse Adoptium', 'jdk-17.0.13.11-hotspot'),
].filter(Boolean);

let javaHome = process.env.JAVA_HOME;
if (!javaHome || process.env.FORCE_JAVA17 === '1') {
  for (const p of possibleJava17Paths) {
    if (p && fs.existsSync(p)) {
      const javaExe = path.join(p, 'bin', 'java.exe');
      const javaBin = path.join(p, 'bin', 'java');
      if (fs.existsSync(javaExe) || fs.existsSync(javaBin)) {
        javaHome = p;
        console.log('Using Java at:', javaHome);
        break;
      }
    }
  }
}

if (javaHome) process.env.JAVA_HOME = javaHome;

const root = path.resolve(__dirname, '..');
const androidDir = path.join(root, 'android');
const distDir = path.join(root, 'dist', 'apk');
const isWindows = process.platform === 'win32';
const gradlew = isWindows ? '.\\gradlew.bat' : './gradlew';
const env = { ...process.env };
if (javaHome) env.JAVA_HOME = javaHome;

console.log('=== Building User + Admin + Agent Release APKs ===\n');

// 1. User APK (default build)
console.log('1. Building User variant (VITE_APP_VARIANT=user)...');
execSync('npm run build', { cwd: root, stdio: 'inherit' });
console.log('   Syncing to Android...');
execSync('npx cap sync', { cwd: root, stdio: 'inherit' });
console.log('   Building User APK (bd.luckywin.app)...');
execSync(`${gradlew} assembleUserRelease`, { cwd: androidDir, stdio: 'inherit', env });

// 2. Admin APK (admin build)
console.log('\n2. Building Admin variant (VITE_APP_VARIANT=admin)...');
execSync('npm run build:admin', { cwd: root, stdio: 'inherit' });
console.log('   Syncing to Android...');
execSync('npx cap sync', { cwd: root, stdio: 'inherit' });
console.log('   Building Admin APK (bd.luckywin.admin)...');
execSync(`${gradlew} assembleAdminRelease`, { cwd: androidDir, stdio: 'inherit', env });

// 3. Agent APK (agent build)
console.log('\n3. Building Agent variant (VITE_APP_VARIANT=agent)...');
execSync('npm run build:agent', { cwd: root, stdio: 'inherit' });
console.log('   Syncing to Android...');
execSync('npx cap sync', { cwd: root, stdio: 'inherit' });
console.log('   Building Agent APK (bd.luckywin.agent)...');
execSync(`${gradlew} assembleAgentRelease`, { cwd: androidDir, stdio: 'inherit', env });

// Copy to dist with clear names
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

const apks = [
  { src: path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'user', 'release', 'app-user-release.apk'), dest: path.join(distDir, 'lucky-win-user-release.apk'), name: 'User' },
  { src: path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'admin', 'release', 'app-admin-release.apk'), dest: path.join(distDir, 'lucky-win-admin-release.apk'), name: 'Admin' },
  { src: path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'agent', 'release', 'app-agent-release.apk'), dest: path.join(distDir, 'lucky-win-agent-release.apk'), name: 'Agent' },
];

for (const { src, dest, name } of apks) {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`\n✅ ${name} APK:`, dest);
    console.log('   Size:', (fs.statSync(dest).size / 1024 / 1024).toFixed(2), 'MB');
  }
}

console.log('\n=== Done! ===');
