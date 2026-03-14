/**
 * Build Agent release APK only (bd.luckywin.agent – agent interface only).
 * Run: npm run cap:apk:release:agent
 * Output: dist/apk/lucky-win-agent-release.apk
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

console.log('=== Building Agent APK (bd.luckywin.agent) ===\n');

console.log('1. Building Agent variant (VITE_APP_VARIANT=agent)...');
execSync('npm run build:agent', { cwd: root, stdio: 'inherit' });

console.log('2. Syncing to Android...');
execSync('npx cap sync', { cwd: root, stdio: 'inherit' });

console.log('3. Building Agent APK...');
execSync(`${gradlew} assembleAgentRelease`, { cwd: androidDir, stdio: 'inherit', env });

const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'agent', 'release', 'app-agent-release.apk');
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });
const destPath = path.join(distDir, 'lucky-win-agent-release.apk');
if (fs.existsSync(apkPath)) {
  fs.copyFileSync(apkPath, destPath);
  console.log('\n✅ Agent APK:', destPath);
  console.log('   Size:', (fs.statSync(destPath).size / 1024 / 1024).toFixed(2), 'MB');
} else {
  console.log('\n❌ APK not found at:', apkPath);
  process.exit(1);
}
