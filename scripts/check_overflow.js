import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const artifactDir = 'C:\\Users\\kikid\\.gemini\\antigravity\\brain\\80a30fbe-dd55-463f-9719-8445c3d021a2';
const htmlPath = path.join(artifactDir, 'preview_home_antislop.html');
let html = fs.readFileSync(htmlPath, 'utf8');

const diagScript = `
<script>
window.addEventListener('load', () => {
  const elements = Array.from(document.querySelectorAll('*'));
  // Find leaf elements (no children or text-only) with offsetWidth > 300
  const wideLeaves = elements.filter(el => {
    return el.children.length === 0 && el.getBoundingClientRect().width > 280;
  }).map(el => ({
    tag: el.tagName,
    id: el.id,
    class: el.className,
    text: el.innerText ? el.innerText.slice(0, 30) : '',
    rectWidth: Math.round(el.getBoundingClientRect().width)
  }));

  // Also check elements causing minimum width in forms or grids
  const wideElements = elements.map(el => ({
    tag: el.tagName,
    id: el.id,
    class: el.className,
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    childrenCount: el.children.length
  })).sort((a, b) => b.scrollWidth - a.scrollWidth).slice(0, 15);

  const div = document.createElement('div');
  div.id = 'overflow-report';
  div.setAttribute('data-report', JSON.stringify({
    windowWidth: window.innerWidth,
    bodyScrollWidth: document.body.scrollWidth,
    wideLeaves: wideLeaves.slice(0, 10),
    wideElements
  }));
  document.body.appendChild(div);
});
</script>
`;

fs.writeFileSync(htmlPath, html.replace('</body>', `${diagScript}</body>`), 'utf8');

// Run chrome dump dom
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const out = execFileSync(chrome, [
  '--headless',
  '--disable-gpu',
  '--no-sandbox',
  '--window-size=360,780',
  '--dump-dom',
  'file:///' + htmlPath.replace(/\\/g, '/')
], { encoding: 'utf8' });

const match = out.match(/id="overflow-report"\s+data-report="([^"]+)"/);
if (match) {
  const report = JSON.parse(match[1].replace(/&quot;/g, '"'));
  console.log('OVERFLOW REPORT:', JSON.stringify(report, null, 2));
} else {
  console.log('No overflow report div found in dumped DOM.');
}
