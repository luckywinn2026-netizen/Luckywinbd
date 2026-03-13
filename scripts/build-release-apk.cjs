/**
 * Build release APK (signed). Uses Java 17 from Android Studio if available.
 * Run: npm run cap:apk:release
 * Ensure android/app/keystore.properties exists for signing (or build unsigned).
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
const isWindows = process.platform === 'win32';
const gradlew = isWindows ? 'gradlew.bat' : './gradlew';

console.log('Building release APK...');
console.log('1. Syncing (build + cap sync)...');
execSync('npm run cap:sync', { cwd: root, stdio: 'inherit' });

console.log('2. Running Gradle assembleUserRelease...');
const env = { ...process.env };
if (javaHome) env.JAVA_HOME = javaHome;
execSync(`${gradlew} assembleUserRelease`, { cwd: androidDir, stdio: 'inherit', env });

const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'user', 'release', 'app-user-release.apk');
console.log('\nDone! Release APK:', apkPath);
if (fs.existsSync(apkPath)) {
  console.log('Size:', (fs.statSync(apkPath).size / 1024 / 1024).toFixed(2), 'MB');
}
