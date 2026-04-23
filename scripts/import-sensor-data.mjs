/**
 * Import Sensor Data Script (Client SDK version)
 *
 * This script reads sensor_data.sql and imports the data into Firestore
 * Run: node scripts/import-sensor-data.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Firebase configuration (from .env or hardcoded)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBcGe7c4wuzUz9LxCt_NxJAMhUGPslv_V8",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "mekong-fish-dashboard.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "mekong-fish-dashboard",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "mekong-fish-dashboard.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "478992835542",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:478992835542:web:c6b5e0b4d86d23e55e7f52"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Parse SQL INSERT statement and extract data
 */
function parseSQLInsert(sqlContent) {
  const insertRegex = /INSERT INTO `sensor_data`.*?VALUES\s*([\s\S]*?);/gi;
  const match = insertRegex.exec(sqlContent);

  if (!match) {
    console.error('❌ No INSERT statement found');
    return [];
  }

  const valuesString = match[1];
  const rowRegex = /\(([^)]+)\)/g;
  const rows = [];
  let rowMatch;

  while ((rowMatch = rowRegex.exec(valuesString)) !== null) {
    const values = rowMatch[1].split(',').map(v => v.trim().replace(/^'|'$/g, ''));

    // Parse row: id, device_id, turbidity, ec, tds, temperature, battery_level, status, timestamp
    const [id, deviceId, turbidity, ec, tds, temperature, batteryLevel, status, timestamp] = values;

    rows.push({
      id: parseInt(id),
      deviceId: deviceId,
      turbidity: parseFloat(turbidity),
      ec: parseFloat(ec),
      tds: tds === 'NULL' ? null : parseFloat(tds),
      temperature: temperature === 'NULL' ? null : parseFloat(temperature),
      batteryLevel: batteryLevel === 'NULL' ? null : parseFloat(batteryLevel),
      status: status,
      timestamp: timestamp.replace(/'/g, '')
    });
  }

  return rows;
}

/**
 * Convert MySQL datetime to Firestore Timestamp
 */
function mysqlToFirestoreTimestamp(mysqlDatetime) {
  // Format: 2026-03-18 14:09:28
  const date = new Date(mysqlDatetime.replace(' ', 'T') + '+07:00'); // Assume Bangkok timezone
  return Timestamp.fromDate(date);
}

/**
 * Import data to Firestore
 */
async function importData() {
  try {
    console.log('🚀 Starting sensor data import...\n');

    // Read SQL file
    const sqlPath = join(__dirname, '../sensor_data.sql');
    const sqlContent = readFileSync(sqlPath, 'utf8');
    console.log('✅ SQL file read successfully');

    // Parse data
    const rows = parseSQLInsert(sqlContent);
    console.log(`📊 Found ${rows.length} sensor data records\n`);

    if (rows.length === 0) {
      console.error('❌ No data to import');
      return;
    }

    // Import to Firestore
    let count = 0;

    for (const row of rows) {
      await addDoc(collection(db, 'sensorData'), {
        deviceId: row.deviceId,
        turbidity: row.turbidity,
        ec: row.ec,
        tds: row.tds,
        temperature: row.temperature,
        batteryLevel: row.batteryLevel,
        status: row.status,
        timestamp: mysqlToFirestoreTimestamp(row.timestamp),
        createdAt: Timestamp.now(),
        // Keep original SQL id for reference
        sqlId: row.id
      });

      count++;
      if (count % 5 === 0) {
        console.log(`✅ Imported ${count}/${rows.length} records...`);
      }
    }

    console.log(`\n🎉 Successfully imported ${count} sensor data records to Firestore!`);
    console.log('\n📝 Sample data:');
    console.log(rows.slice(0, 3).map(r => ({
      deviceId: r.deviceId,
      turbidity: r.turbidity,
      ec: r.ec,
      tds: r.tds,
      temperature: r.temperature,
      status: r.status,
      timestamp: r.timestamp
    })));

  } catch (error) {
    console.error('❌ Error importing data:', error);
    process.exit(1);
  }
}

// Run import
importData().then(() => {
  console.log('\n✅ Import completed');
  process.exit(0);
});
