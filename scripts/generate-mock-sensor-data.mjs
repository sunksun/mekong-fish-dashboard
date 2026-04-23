/**
 * Generate Mock Sensor Data
 *
 * This script generates mock sensor data for testing
 * Copy the output and paste in Firestore console manually
 * Or use Firebase Admin SDK with proper credentials
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
 * Convert MySQL datetime to ISO string for Firestore
 */
function mysqlToISOString(mysqlDatetime) {
  // Format: 2026-03-18 14:09:28
  const date = new Date(mysqlDatetime.replace(' ', 'T') + '+07:00');
  return date.toISOString();
}

/**
 * Generate Firestore import JSON
 */
function generateFirestoreJSON() {
  try {
    console.log('🚀 Generating Firestore JSON data...\n');

    // Read SQL file
    const sqlPath = join(__dirname, '../sensor_data.sql');
    const sqlContent = readFileSync(sqlPath, 'utf8');
    console.log('✅ SQL file read successfully');

    // Parse data
    const rows = parseSQLInsert(sqlContent);
    console.log(`📊 Found ${rows.length} sensor data records\n`);

    if (rows.length === 0) {
      console.error('❌ No data to generate');
      return;
    }

    // Convert to Firestore format
    const firestoreData = rows.map((row, index) => ({
      id: `sensor_${row.id}`,
      fields: {
        deviceId: row.deviceId,
        turbidity: row.turbidity,
        ec: row.ec,
        tds: row.tds,
        temperature: row.temperature,
        batteryLevel: row.batteryLevel,
        status: row.status,
        timestamp: mysqlToISOString(row.timestamp),
        createdAt: new Date().toISOString(),
        sqlId: row.id
      }
    }));

    // Output JSON
    console.log('\n📄 Firestore Import Data (JSON):');
    console.log('=====================================\n');
    console.log(JSON.stringify(firestoreData, null, 2));

    console.log('\n\n📝 Sample Data Preview:');
    console.log(firestoreData.slice(0, 3));

    console.log('\n\n💡 Instructions:');
    console.log('1. Copy the JSON output above');
    console.log('2. Go to Firebase Console > Firestore');
    console.log('3. Create collection: "sensorData"');
    console.log('4. Manually add documents or use Firebase CLI/Admin SDK');
    console.log('\nOR use this simplified format for manual entry:\n');

    // Simple format for manual copy-paste
    firestoreData.forEach(item => {
      console.log(`\nDocument ID: ${item.id}`);
      console.log(JSON.stringify(item.fields, null, 2));
    });

  } catch (error) {
    console.error('❌ Error generating data:', error);
    process.exit(1);
  }
}

// Run generation
generateFirestoreJSON();
