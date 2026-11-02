import bcrypt from 'bcryptjs';
import { pool } from '../config/database.js';

async function main() {
  console.log('Seeding initial passwords for demo accounts...');
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash('Password123!', salt);

  // Set default password for admin_1, operator_1, and aziz
  const demoAccounts = ['admin_1', 'operator_1', 'aziz'];
  for (const username of demoAccounts) {
    const [res]: any = await pool.query(
      `UPDATE users SET password_hash = ?, wajib_reset_password = 0 WHERE username = ?`,
      [hash, username]
    );
    console.log(`Updated account [${username}]: ${res.affectedRows} row(s) updated.`);
  }

  // Ensure operator_1 has a phone number so walkin & user lookups operate smoothly
  await pool.query(
    `UPDATE users SET telepon = '081299990001' WHERE username = 'operator_1' AND telepon IS NULL`
  );

  console.log('Demo passwords seeded successfully! Default password is: Password123!');
  await pool.end();
}

main().catch((err) => {
  console.error('Failed to seed passwords:', err);
  process.exit(1);
});

