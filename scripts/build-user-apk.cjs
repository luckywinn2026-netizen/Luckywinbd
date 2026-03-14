/**
 * Build User release APK only (bd.luckywin.app – full user interface).
 * Run: npm run cap:apk:release:user
 * Output: dist/apk/lucky-win-user-release.apk
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
const gradlew = isWindows ? 'gradlew.bat' : './gradlew';
const env = { ...process.env };
if (javaHome) env.JAVA_HOME = javaHome;

console.log('=== Building User APK (bd.luckywin.app) ===\n');

console.log('1. Building User variant (VITE_APP_VARIANT=user)...');
execSync('npm run build', { cwd: root, stdio: 'inherit' });

console.log('2. Syncing to Android...');
execSync('npx cap sync', { cwd: root, stdio: 'inherit' });

console.log('3. Building User APK...');
execSync(`${gradlew} assembleUserRelease`, { cwd: androidDir, stdio: 'inherit', env });

const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'user', 'release', 'app-user-release.apk');
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
const destPath = path.join(distDir, 'lucky-win-user-release.apk');
if (fs.existsSync(apkPath)) {
  fs.copyFileSync(apkPath, destPath);
  console.log('\n✅ User APK:', destPath);
  console.log('   Size:', (fs.statSync(destPath).size / 1024 / 1024).toFixed(2), 'MB');
} else {
  console.log('\n❌ APK not found at:', apkPath);
  process.exit(1);
}
