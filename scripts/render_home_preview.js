import ejs from 'ejs';
import fs from 'fs';
import path from 'path';

const viewsDir = path.resolve('views');
const mainLayoutPath = path.join(viewsDir, 'layouts', 'main.ejs');
const homePath = path.join(viewsDir, 'public', 'home.ejs');

const mockData = {
  title: 'TRANSKOTA - Tiket Travel & Minibus Antarkota Eksekutif',
  user: null,
  csrfToken: 'mock-csrf-token',
  messages: { error: [], success: [] },
  cities: [
    { id: 1, nama: 'Bandar Lampung' },
    { id: 2, nama: 'Palembang' },
    { id: 3, nama: 'Jakarta' },
    { id: 4, nama: 'Metro' },
    { id: 5, nama: 'Tanggamus' }
  ],
  schedules: [
    {
      id: 1,
      nama_kendaraan: 'Daihatsu Xenia',
      nomor_polisi: 'BE 4677 DT',
      kursi_tersedia: 5,
      kota_asal: 'Bandar Lampung',
      kota_tujuan: 'Lampung Tengah',
      berangkat_pada: '2026-10-31T11:28:00.000Z',
      harga: 95000
    },
    {
      id: 2,
      nama_kendaraan: 'Toyota Avanza',
      nomor_polisi: 'BE 1212 AT',
      kursi_tersedia: 5,
      kota_asal: 'Bandar Lampung',
      kota_tujuan: 'Lampung Selatan',
      berangkat_pada: '2026-10-31T19:28:00.000Z',
      harga: 75000
    },
    {
      id: 3,
      nama_kendaraan: 'Toyota Avanza',
      nomor_polisi: 'BE 1212 AT',
      kursi_tersedia: 5,
      kota_asal: 'Bandar Lampung',
      kota_tujuan: 'Metro',
      berangkat_pada: '2026-11-01T17:28:00.000Z',
      harga: 85000
    }
  ]
};

function renderFilePromise(filePath, data) {
  return new Promise((resolve, reject) => {
    ejs.renderFile(filePath, data, { async: false }, (err, str) => {
      if (err) reject(err);
      else resolve(str);
    });
  });
}

async function render() {
  const homeContent = await renderFilePromise(homePath, mockData);
  const fullHtml = await renderFilePromise(mainLayoutPath, { ...mockData, body: homeContent });

  const artifactDir = 'C:/Users/kikid/.gemini/antigravity/brain/80a30fbe-dd55-463f-9719-8445c3d021a2';
  const outPath = path.join(artifactDir, 'preview_home_antislop.html');
  const darkOutPath = path.join(artifactDir, 'preview_home_antislop_dark.html');
  const mobile360Path = path.join(artifactDir, 'preview_home_antislop_360.html');
  const mobile402Path = path.join(artifactDir, 'preview_home_antislop_402.html');
  
  // Make CSS absolute for local browser rendering
  const cssPath = path.resolve('public/css/output.css').replace(/\\/g, '/');
  const correctedHtml = fullHtml.replace('/css/output.css', `file:///${cssPath}`);
  const darkHtml = correctedHtml.replace('<html lang="id" class="h-full">', '<html lang="id" class="h-full dark">');

  // Exact mobile viewport constraint so desktop Chrome renders 100% true mobile layout
  const mobile360Html = correctedHtml.replace('<body class="min-h-full flex flex-col bg-paper text-ink font-sans antialiased selection:bg-accent-2 selection:text-ink">', '<body class="min-h-full flex flex-col bg-paper text-ink font-sans antialiased selection:bg-accent-2 selection:text-ink" style="max-width: 360px; margin: 0 auto; overflow-x: clip;">');
  const mobile402Html = correctedHtml.replace('<body class="min-h-full flex flex-col bg-paper text-ink font-sans antialiased selection:bg-accent-2 selection:text-ink">', '<body class="min-h-full flex flex-col bg-paper text-ink font-sans antialiased selection:bg-accent-2 selection:text-ink" style="max-width: 402px; margin: 0 auto; overflow-x: clip;">');

  fs.writeFileSync(outPath, correctedHtml, 'utf8');
  fs.writeFileSync(darkOutPath, darkHtml, 'utf8');
  fs.writeFileSync(mobile360Path, mobile360Html, 'utf8');
  fs.writeFileSync(mobile402Path, mobile402Html, 'utf8');
  console.log('Rendered Desktop, Mobile 360, Mobile 402, and Dark previews.');
}

render().catch(console.error);
