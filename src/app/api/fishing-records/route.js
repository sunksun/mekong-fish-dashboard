import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';

// GET - Fetch fishing records with filters and pagination
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);

    // Extract query parameters
    const searchTerm = searchParams.get('search') || '';
    const province = searchParams.get('province') || 'all';
    const verifiedStatus = searchParams.get('verified') || 'all';
    const dateFilter = searchParams.get('dateFilter') || 'all';
    const userId = searchParams.get('userId') || null;
    const pageSize = parseInt(searchParams.get('limit') || '10');
    const page = parseInt(searchParams.get('page') || '0');
    const minDate = searchParams.get('minDate'); // Year Filter (e.g., '2025-01-01')

    // console.log('📋 API Query Parameters:', {
    //   userId,
    //   verifiedStatus,
    //   searchTerm,
    //   province,
    //   dateFilter,
    //   limit: pageSize
    // });

    // Build Firestore query
    let constraints = [];

    // Filter by userId (for user-specific stats)
    if (userId) {
      // console.log('🔍 Filtering by userId:', userId);
      constraints.push(where('userId', '==', userId));
    }

    // Note: We can't filter by province directly because the structure varies
    // (location.address.province or location.spotName)
    // We'll do client-side filtering instead

    // Filter by verification status
    if (verifiedStatus === 'verified') {
      // console.log('✅ Adding verified filter: verified == true');
      constraints.push(where('verified', '==', true));
    } else if (verifiedStatus === 'unverified') {
      // console.log('⚠️ Adding unverified filter: verified == false');
      constraints.push(where('verified', '==', false));
    } else {
      // console.log('ℹ️ No verified filter applied (showing all records)');
    }

    // Filter by minimum date (Year Filter from client)
    if (minDate) {
      const minDateObj = new Date(minDate);
      constraints.push(where('date', '>=', Timestamp.fromDate(minDateObj)));
    }

    // Filter by date range - mobile app uses 'date' field
    if (dateFilter !== 'all') {
      const now = new Date();
      let startDate;

      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      if (startDate) {
        constraints.push(where('date', '>=', Timestamp.fromDate(startDate)));
      }
    }

    // Add ordering - mobile app uses 'date' field
    // NOTE: Composite index required for userId + date ordering
    // Index: userId (Ascending) + date (Descending)
    constraints.push(orderBy('date', 'desc'));

    // Create query
    const recordsRef = collection(db, 'fishingRecords');

    // For pagination: fetch all records then slice client-side
    // (Firestore doesn't support offset, only startAfter cursor)
    const q = query(recordsRef, ...constraints);

    // Execute query
    const querySnapshot = await getDocs(q);

    // console.log(`📊 Query returned ${querySnapshot.size} records`);
    // if (userId) {
    //   console.log(`   (filtered for userId: ${userId})`);
    // }

    // Collect all unique user IDs from ALL docs (before pagination)
    const allDocs = querySnapshot.docs;
    const userIds = new Set();
    allDocs.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      if (data.userId) {
        userIds.add(data.userId);
      }
    });

    // Fetch user data for all unique user IDs
    const usersMap = new Map();
    await Promise.all(
      Array.from(userIds).map(async (userId) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            usersMap.set(userId, userDoc.data());
          }
        } catch (error) {
          console.error(`Error fetching user ${userId}:`, error);
        }
      })
    );

    // Fetch fish_species data for local_name enrichment
    const fishSpeciesSnapshot = await getDocs(collection(db, 'fish_species'));
    const fishSpeciesMap = new Map();
    fishSpeciesSnapshot.forEach(speciesDoc => {
      const speciesData = speciesDoc.data();
      // Map by common_name_thai (primary)
      if (speciesData.common_name_thai) {
        fishSpeciesMap.set(speciesData.common_name_thai, speciesData);
      }
      // Map by thai_name (secondary)
      if (speciesData.thai_name && !fishSpeciesMap.has(speciesData.thai_name)) {
        fishSpeciesMap.set(speciesData.thai_name, speciesData);
      }
    });

    // Process results and transform ALL docs to match dashboard format (before pagination)
    let records = [];
    allDocs.forEach((docSnapshot) => {
      const data = docSnapshot.data();

      // Get user data
      const userData = usersMap.get(data.userId);

      // Transform mobile app data structure to dashboard format
      const transformed = {
        id: docSnapshot.id,

        // Fisher info - fetch from users collection
        fisherId: data.userId || '',
        fisherName: userData?.name || 'ไม่ระบุชื่อ',
        fisherEmail: userData?.email || '',
        fisherPhone: userData?.phone || '',
        fisherProvince: userData?.province || '',
        fisherDistrict: userData?.district || '',
        fisherVillage: userData?.village || '',

        // Fisher profile with photo
        fisherProfile: {
          profilePhoto: userData?.fisherProfile?.profilePhoto || null,
          nickname: userData?.fisherProfile?.nickname || null,
          age: userData?.fisherProfile?.age || null,
          experience: userData?.fisherProfile?.experience || null
        },

        // Recorded by info - from recordedBy field or fallback to fisher data
        recordedBy: {
          name: data.recordedBy?.name || userData?.name || 'ไม่ระบุ',
          role: data.recordedBy?.role || userData?.role || 'ไม่ระบุ'
        },

        // Date handling - mobile app uses 'date' field
        catchDate: data.date?.toDate?.()?.toISOString() || data.date,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,

        // Location handling - mobile app has different structure
        location: {
          province: data.location?.address?.province || data.location?.spotName || 'ไม่ระบุ',
          district: data.location?.address?.district || '',
          subDistrict: data.location?.address?.village || '',
          waterSource: data.waterSource || '',
          latitude: data.location?.coordinates?.latitude || data.location?.latitude,
          longitude: data.location?.coordinates?.longitude || data.location?.longitude,
          spotName: data.location?.spotName
        },

        // Fish data - mobile app uses 'fishList' instead of 'fishData'
        fishList: data.fishList || [], // Preserve original fishList from mobile app
        fishData: (data.fishList || []).map(fish => {
          const speciesName = fish.name || '';
          const speciesInfo = fishSpeciesMap.get(speciesName);
          return {
            species: speciesName,
            localName: speciesInfo?.local_name || '', // Add local_name from fish_species
            category: 'MEDIUM', // We don't have category in mobile data
            quantity: parseInt(fish.count) || 0,
            weight: parseFloat(fish.weight) || 0,
            estimatedValue: parseFloat(fish.price) * parseInt(fish.count) || 0,
            minLength: fish.minLength,
            maxLength: fish.maxLength,
            photo: fish.photo
          };
        }),

        // Fishing details
        method: data.fishingGear?.name || '',
        fishingGear: {
          name: data.fishingGear?.name || '',
          details: data.fishingGear?.details || ''
        },
        weather: data.weather || '',
        waterLevel: data.waterLevel || '',
        startTime: data.startTime || '',
        endTime: data.endTime || '',

        // Calculated totals
        totalWeight: parseFloat(data.totalWeight) || 0,
        totalValue: (data.fishList || []).reduce((sum, fish) => {
          return sum + (parseFloat(fish.price) * parseInt(fish.count) || 0);
        }, 0),

        // Additional fields from mobile app
        sampleWeight: data.sampleWeight,
        noFishing: data.noFishing || false,
        usage: data.usage,

        // Verification status - mobile app doesn't have this, default to false
        verified: data.verified || false,

        // Payment status
        isPaid: data.isPaid || false,
        paymentId: data.paymentId || null,
        paymentDate: data.paymentDate?.toDate?.()?.toISOString() || data.paymentDate || null,
        paymentAmount: data.paymentAmount || null,

        // Source tracking
        source: data.source || 'mobile_app',
        version: data.version
      };

      records.push(transformed);
    });

    // Apply client-side filters (for fields not indexed in Firestore)
    // Filter by province
    if (province !== 'all') {
      records = records.filter(record => {
        const recordProvince = record.location?.province || '';
        return recordProvince.includes(province);
      });
    }

    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      records = records.filter(record => {
        const matchesName = record.fisherName?.toLowerCase().includes(searchLower);
        const matchesProvince = record.location?.province?.toLowerCase().includes(searchLower);
        const matchesSpotName = record.location?.spotName?.toLowerCase().includes(searchLower);
        const matchesSpecies = record.fishData?.some(fish =>
          fish.species?.toLowerCase().includes(searchLower)
        );
        return matchesName || matchesProvince || matchesSpotName || matchesSpecies;
      });
    }

    // Calculate statistics from filtered records (before pagination)
    const totalFilteredRecords = records.length;
    const stats = {
      totalRecords: totalFilteredRecords,
      totalWeight: records.reduce((sum, r) => sum + (r.totalWeight || 0), 0),
      totalValue: records.reduce((sum, r) => sum + (r.totalValue || 0), 0),
      verifiedCount: records.filter(r => r.verified).length,
    };

    // Apply pagination AFTER filtering (unless userId is specified)
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedRecords = userId ? records : records.slice(startIndex, endIndex);

    return NextResponse.json({
      success: true,
      data: paginatedRecords,
      stats,
      pagination: {
        page,
        pageSize,
        totalRecords: totalFilteredRecords,
        hasMore: endIndex < totalFilteredRecords
      }
    });

  } catch (error) {
    console.error('Error fetching fishing records:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch fishing records',
        message: error.message
      },
      { status: 500 }
    );
  }
}
