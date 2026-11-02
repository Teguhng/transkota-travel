import { execFileSync } from 'child_process';
import path from 'path';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const artifactDir = 'C:\\Users\\kikid\\.gemini\\antigravity\\brain\\80a30fbe-dd55-463f-9719-8445c3d021a2';
const tempDir = process.env.TEMP || 'C:\\Users\\kikid\\AppData\\Local\\Temp';

const lightUrl = 'file:///' + path.join(artifactDir, 'preview_home_antislop.html').replace(/\\/g, '/');
const darkUrl = 'file:///' + path.join(artifactDir, 'preview_home_antislop_dark.html').replace(/\\/g, '/');
const mobile360Url = 'file:///' + path.join(artifactDir, 'preview_home_antislop_360.html').replace(/\\/g, '/');
const mobile402Url = 'file:///' + path.join(artifactDir, 'preview_home_antislop_402.html').replace(/\\/g, '/');

const captures = [
  { name: 'desktop_antislop.png', url: lightUrl, width: 1280, height: 900 },
  { name: 'iphone_402_antislop.png', url: mobile402Url, width: 500, height: 874 },
  { name: 'galaxy_360_antislop.png', url: mobile360Url, width: 500, height: 780 },
  { name: 'desktop_antislop_dark.png', url: darkUrl, width: 1280, height: 900 },
  { name: 'galaxy_360_antislop_dark.png', url: darkUrl, width: 1280, height: 900 }
];

for (const c of captures) {
  const targetPath = path.join(tempDir, c.name);
  console.log(`Capturing ${c.name}...`);
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--screenshot=${targetPath}`,
    `--window-size=${c.width},${c.height}`,
    c.url
  ]);
  
  // Copy to artifact directory
  const destPath = path.join(artifactDir, c.name);
  const fs = await import('fs');
  fs.copyFileSync(targetPath, destPath);
  console.log(`Saved: ${destPath}`);
}

console.log('All screenshots captured successfully.');
