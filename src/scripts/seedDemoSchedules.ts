import { pool } from '../config/database.js';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

async function main() {
  console.log('Seeding upcoming demo schedules...');

  // Pastikan setidaknya ada kendaraan dengan 5 kursi aktif
  const [vehicles] = await pool.query<RowDataPacket[]>('SELECT id FROM kendaraan LIMIT 2');
  if (vehicles.length === 0) {
    console.log('No vehicles found. Please initialize db_tiket.sql first.');
    process.exit(1);
  }

  // Ambil rute yang tersedia
  const [routes] = await pool.query<RowDataPacket[]>('SELECT id FROM rute LIMIT 4');
  if (routes.length === 0) {
    console.log('No routes found. Please initialize db_tiket.sql first.');
    process.exit(1);
  }

  // Waktu keberangkatan upcoming relatif terhadap saat script dijalankan (WIB)
  const now = new Date();
  
  const schedulesToSeed = [
    {
      routeId: routes[0].id,
      vehicleId: vehicles[0].id,
      hoursAhead: 4,
      harga: 85000
    },
    {
      routeId: routes[1] ? routes[1].id : routes[0].id,
      vehicleId: vehicles[1] ? vehicles[1].id : vehicles[0].id,
      hoursAhead: 18,
      harga: 95000
    },
    {
      routeId: routes[2] ? routes[2].id : routes[0].id,
      vehicleId: vehicles[0].id,
      hoursAhead: 26,
      harga: 75000
    },
    {
      routeId: routes[3] ? routes[3].id : routes[0].id,
      vehicleId: vehicles[1] ? vehicles[1].id : vehicles[0].id,
      hoursAhead: 34,
      harga: 110000
    },
    {
      routeId: routes[0].id,
      vehicleId: vehicles[0].id,
      hoursAhead: 48,
      harga: 85000
    }
  ];

  for (const item of schedulesToSeed) {
    const depTime = new Date(now.getTime() + item.hoursAhead * 3600 * 1000);
    const arrTime = new Date(depTime.getTime() + 4 * 3600 * 1000); // estimasi 4 jam perjalanan

    const depFormatted = depTime.toISOString().slice(0, 19).replace('T', ' ');
    const arrFormatted = arrTime.toISOString().slice(0, 19).replace('T', ' ');

    // Cek apakah jadwal serupa sudah ada agar idempoten
    const [existing] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM jadwal WHERE id_rute = ? AND id_kendaraan = ? AND berangkat_pada = ? LIMIT 1`,
      [item.routeId, item.vehicleId, depFormatted]
    );

    if (existing.length === 0) {
      const [res] = await pool.query<ResultSetHeader>(
        `INSERT INTO jadwal (id_rute, id_kendaraan, berangkat_pada, tiba_pada, harga, status)
         VALUES (?, ?, ?, ?, ?, 'dijadwalkan')`,
        [item.routeId, item.vehicleId, depFormatted, arrFormatted, item.harga]
      );
      console.log(`Inserted schedule #${res.insertId} for departure at ${depFormatted} (5 seats auto-created by trigger).`);
    } else {
      console.log(`Schedule already exists for departure at ${depFormatted}.`);
    }
  }

  console.log('Upcoming demo schedules seeded successfully!');
  await pool.end();
}

main().catch((err) => {
  console.error('Failed to seed demo schedules:', err);
  process.exit(1);
});
