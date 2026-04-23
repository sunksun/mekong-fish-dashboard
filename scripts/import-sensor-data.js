/**
 * Import Sensor Data Script
 *
 * This script reads sensor_data.sql and imports the data into Firestore
 * Run: node scripts/import-sensor-data.js
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '../firebase-service-account.json'), 'utf8')
);

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

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
    const batch = db.batch();
    let count = 0;

    for (const row of rows) {
      const docRef = db.collection('sensorData').doc();
      batch.set(docRef, {
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

      // Firestore batch limit is 500
      if (count % 500 === 0) {
        await batch.commit();
        console.log(`✅ Imported ${count} records...`);
      }
    }

    // Commit remaining records
    if (count % 500 !== 0) {
      await batch.commit();
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
