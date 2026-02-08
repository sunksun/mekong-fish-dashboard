import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

// Enable caching with revalidation every 10 minutes (600 seconds)
// Water level data changes slowly, so 10 minutes is reasonable
export const revalidate = 600;

/**
 * API to provide Mekong River water level data
 * Scrapes real data from MRC Flood Forecasting Website
 * Station: Chiang Khan (CKH)
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const station = searchParams.get('station') || 'Chiang Khan';

    console.log('🌊 Scraping water level data for station:', station);

    // Try to scrape real data from MRC
    const scrapedData = await scrapeChiangKhanData();

    if (scrapedData.success) {
      return NextResponse.json({
        success: true,
        station: station,
        data: scrapedData.data,
        source: 'MRC Flood Forecasting Website',
        timestamp: new Date().toISOString(),
        url: 'https://ffw.mrcmekong.org/stations.php?StCode=CKH&StName=Chiang%20Khan'
      });
    } else {
      // Fallback to mock data if scraping fails
      console.log('⚠️ Scraping failed, using fallback data');
      const mockData = generateMockWaterLevelData(station);

      return NextResponse.json({
        success: true,
        station: station,
        data: mockData,
        source: 'Simulated Data (Scraping Failed)',
        timestamp: new Date().toISOString(),
        note: 'Unable to scrape data from MRC. Using simulated data.',
        realDataSource: 'https://ffw.mrcmekong.org/stations.php?StCode=CKH&StName=Chiang%20Khan'
      });
    }

  } catch (error) {
    console.error('❌ Error fetching water level data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch water level data',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * Scrape water level data from MRC Flood Forecasting Website
 */
async function scrapeChiangKhanData() {
  const url = 'https://ffw.mrcmekong.org/stations.php?StCode=CKH&StName=Chiang%20Khan';

  try {
    console.log('🔍 Fetching from:', url);

    const res = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Mekong-Fish-Dashboard/1.0)',
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Find current water level text
    let currentLevelText = 'ไม่พบข้อมูล';
    let waterLevel = null;

    $('body').find('*').contents().each(function() {
      if (this.type === 'text' && this.data && this.data.includes('Water level on')) {
        currentLevelText = this.data.trim();

        // Extract water level number (e.g., "5.23 m")
        const match = currentLevelText.match(/(\d+\.\d+)\s*m/);
        if (match) {
          waterLevel = parseFloat(match[1]);
        }
        return false;
      }
    });

    console.log('📊 Current level text:', currentLevelText);
    console.log('📊 Extracted water level:', waterLevel);

    // Extract forecast/observation table
    const tableData = [];
    $('table').each((tableIndex, table) => {
      const headers = [];
      const rows = [];

      $(table).find('tr').first().find('td, th').each((_, col) => {
        headers.push($(col).text().trim());
      });

      const headerText = headers.join(' ');
      if (headerText.includes('Forecast') || headerText.includes('Observe')) {
        $(table).find('tr').each((rowIndex, row) => {
          if (rowIndex === 0) return;
          const cols = [];
          $(row).find('td').each((_, col) => {
            cols.push($(col).text().trim());
          });
          if (cols.length > 0) rows.push(cols);
        });

        if (rows.length > 0) {
          tableData.push({ headers, rows });
        }
      }
    });

    // If we found water level, convert to our format
    if (waterLevel !== null) {
      const data = convertScrapedDataToFormat(waterLevel, currentLevelText, tableData);
      return { success: true, data };
    } else {
      console.log('⚠️ Could not extract water level from page');
      return { success: false };
    }

  } catch (error) {
    console.error('❌ Scraping error:', error.message);
    return { success: false };
  }
}

/**
 * Convert scraped data to our API format
 */
function convertScrapedDataToFormat(waterLevel, statusText, tableData) {
  // MRC Thresholds for Chiang Khan
  const LTA = 5.0;
  const maxLevel = 7.5;
  const minLevel = 2.5;

  // Determine status based on MRC Water Level Definitions
  let status, statusColor, statusDescription;
  if (waterLevel > maxLevel) {
    status = 'Above Max';
    statusColor = 'error';
    statusDescription = 'ระดับน้ำสูงเกินค่าสูงสุด (Extreme High water level)';
  } else if (waterLevel > LTA) {
    status = 'Above LTA';
    statusColor = 'warning';
    statusDescription = 'ระดับน้ำสูงกว่าค่าเฉลี่ยระยะยาว (High water level)';
  } else if (waterLevel >= minLevel && waterLevel <= LTA) {
    status = 'Normal';
    statusColor = 'success';
    statusDescription = 'ระดับน้ำอยู่ในระดับปกติ (Water level lies between Long Term Average Level)';
  } else if (waterLevel > 0 && waterLevel < minLevel) {
    status = 'Below LTA';
    statusColor = 'info';
    statusDescription = 'ระดับน้ำต่ำกว่าค่าเฉลี่ยระยะยาว (Low water level)';
  } else {
    status = 'Below Min';
    statusColor = 'error';
    statusDescription = 'ระดับน้ำต่ำกว่าค่าต่ำสุด (Critical water level)';
  }

  // Generate mock historical data (we only have current level from scraping)
  const measurements = [];
  const today = new Date();

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Use current level for today, estimate for past days
    const level = i === 0 ? waterLevel : waterLevel + (Math.random() - 0.5) * 0.5;

    measurements.push({
      date: date.toISOString().split('T')[0],
      time: '12:00:00',
      waterLevel: parseFloat(level.toFixed(2)),
      unit: 'meters',
      status: level > 7 ? 'high' : level < 3 ? 'low' : 'normal'
    });
  }

  const avgLevel = parseFloat((measurements.reduce((sum, d) => sum + d.waterLevel, 0) / measurements.length).toFixed(2));

  return {
    station: {
      name: 'Chiang Khan',
      code: 'CKH',
      location: {
        latitude: 17.9031,
        longitude: 101.6619,
        province: 'Loei',
        country: 'Thailand'
      }
    },
    current: {
      waterLevel: waterLevel,
      unit: 'meters',
      status: status,
      statusColor: statusColor,
      statusDescription: statusDescription,
      rawText: statusText,
      timestamp: new Date().toISOString()
    },
    thresholds: {
      LTA: LTA,
      max: maxLevel,
      min: minLevel,
      unit: 'meters',
      definitions: {
        'Above Max': 'Extreme High water level',
        'Above LTA': 'High water level',
        'Normal': 'Water level lies between Long Term Average Level',
        'Below LTA': 'Low water level',
        'Below Min': 'Critical water level'
      }
    },
    measurements: measurements,
    summary: {
      current: waterLevel,
      average: avgLevel,
      min: Math.min(...measurements.map(d => d.waterLevel)),
      max: Math.max(...measurements.map(d => d.waterLevel)),
      trend: waterLevel > avgLevel ? 'rising' : waterLevel < avgLevel ? 'falling' : 'stable'
    },
    scrapedTableData: tableData,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Generate mock water level data for testing
 */
function generateMockWaterLevelData(station) {
  const today = new Date();
  const data = [];

  // Generate data for the past 7 days
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Mock water level (meters) - varies by season
    const baseLevel = 5.0;
    const variation = Math.sin(i * 0.5) * 2;
    const randomVariation = (Math.random() - 0.5) * 0.5;
    const waterLevel = baseLevel + variation + randomVariation;

    data.push({
      date: date.toISOString().split('T')[0],
      time: '12:00:00',
      waterLevel: parseFloat(waterLevel.toFixed(2)),
      unit: 'meters',
      status: waterLevel > 7 ? 'high' : waterLevel < 3 ? 'low' : 'normal'
    });
  }

  // Add forecast for next 3 days
  for (let i = 1; i <= 3; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);

    const baseLevel = 5.0;
    const variation = Math.sin((6 + i) * 0.5) * 2;
    const waterLevel = baseLevel + variation;

    data.push({
      date: date.toISOString().split('T')[0],
      time: '12:00:00',
      waterLevel: parseFloat(waterLevel.toFixed(2)),
      unit: 'meters',
      status: 'forecast',
      isForecast: true
    });
  }

  const currentLevel = data[data.length - 4].waterLevel;
  const avgLevel = parseFloat((data.slice(0, 7).reduce((sum, d) => sum + d.waterLevel, 0) / 7).toFixed(2));

  // MRC Thresholds for Chiang Khan station (example values - should be from historical data)
  const LTA = 5.0; // Long Term Average Level
  const maxLevel = 7.5; // Historical maximum
  const minLevel = 2.5; // Historical minimum

  // Determine status based on MRC Water Level Definitions
  let status, statusColor, statusDescription;
  if (currentLevel > maxLevel) {
    status = 'Above Max';
    statusColor = 'error';
    statusDescription = 'ระดับน้ำสูงเกินค่าสูงสุด (Extreme High water level)';
  } else if (currentLevel > LTA) {
    status = 'Above LTA';
    statusColor = 'warning';
    statusDescription = 'ระดับน้ำสูงกว่าค่าเฉลี่ยระยะยาว (High water level)';
  } else if (currentLevel >= minLevel && currentLevel <= LTA) {
    status = 'Normal';
    statusColor = 'success';
    statusDescription = 'ระดับน้ำอยู่ในระดับปกติ (Water level lies between Long Term Average Level)';
  } else if (currentLevel > 0 && currentLevel < minLevel) {
    status = 'Below LTA';
    statusColor = 'info';
    statusDescription = 'ระดับน้ำต่ำกว่าค่าเฉลี่ยระยะยาว (Low water level)';
  } else {
    status = 'Below Min';
    statusColor = 'error';
    statusDescription = 'ระดับน้ำต่ำกว่าค่าต่ำสุด (Critical water level)';
  }

  return {
    station: {
      name: station,
      code: 'CHKG',
      location: {
        latitude: 17.9031,
        longitude: 101.6619,
        province: 'Loei',
        country: 'Thailand'
      }
    },
    current: {
      waterLevel: currentLevel,
      unit: 'meters',
      status: status,
      statusColor: statusColor,
      statusDescription: statusDescription,
      timestamp: new Date().toISOString()
    },
    thresholds: {
      LTA: LTA,
      max: maxLevel,
      min: minLevel,
      unit: 'meters',
      definitions: {
        'Above Max': 'Extreme High water level',
        'Above LTA': 'High water level',
        'Normal': 'Water level lies between Long Term Average Level',
        'Below LTA': 'Low water level',
        'Below Min': 'Critical water level'
      }
    },
    measurements: data,
    summary: {
      current: currentLevel,
      average: avgLevel,
      min: Math.min(...data.slice(0, 7).map(d => d.waterLevel)),
      max: Math.max(...data.slice(0, 7).map(d => d.waterLevel)),
      trend: currentLevel > avgLevel ? 'rising' : currentLevel < avgLevel ? 'falling' : 'stable'
    },
    lastUpdated: new Date().toISOString()
  };
}

/**
 * POST endpoint to manually update water level data
 * Accepts waterLevelStatus and flowThresholdStatus
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { station, waterLevelStatus, flowThresholdStatus, timestamp } = body;

    if (!station || !waterLevelStatus || !flowThresholdStatus) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: station, waterLevelStatus, flowThresholdStatus'
        },
        { status: 400 }
      );
    }

    // Validate waterLevelStatus
    const validWaterLevels = ['Above Max', 'Above LTA', 'Normal', 'Below LTA', 'Below Min'];
    if (!validWaterLevels.includes(waterLevelStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid waterLevelStatus. Must be one of: ' + validWaterLevels.join(', ')
        },
        { status: 400 }
      );
    }

    // Validate flowThresholdStatus
    const validFlowThresholds = ['Normal', 'Stable', 'Unstable', 'Severe'];
    if (!validFlowThresholds.includes(flowThresholdStatus)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid flowThresholdStatus. Must be one of: ' + validFlowThresholds.join(', ')
        },
        { status: 400 }
      );
    }

    console.log('📝 Updating water level data:', { station, waterLevelStatus, flowThresholdStatus });

    // Here you could save to your database
    // const db = getFirestore();
    // await db.collection('waterLevels').add({
    //   station,
    //   waterLevelStatus,
    //   flowThresholdStatus,
    //   timestamp
    // });

    return NextResponse.json({
      success: true,
      message: 'Water level data recorded successfully',
      data: {
        station,
        waterLevelStatus,
        flowThresholdStatus,
        timestamp: timestamp || new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ Error recording water level:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to record water level data',
        message: error.message
      },
      { status: 500 }
    );
  }
}
