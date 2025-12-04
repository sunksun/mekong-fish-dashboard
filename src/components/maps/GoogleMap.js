'use client';

import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { useMemo } from 'react';

export default function GoogleMap({
  spots = [],
  fishDistribution = [],
  center = { lat: 17.4, lng: 102.8 },
  zoom = 10,
  onMarkerClick,
  onFishMarkerClick,
  showFishMarkers = true,
  height = '600px'
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  // Memoize fishing spot markers
  const spotMarkers = useMemo(() => {
    return spots.map((spot) => ({
      id: spot.id,
      position: { lat: spot.latitude, lng: spot.longitude },
      spot: spot
    }));
  }, [spots]);

  // Memoize fish distribution markers
  const fishMarkers = useMemo(() => {
    console.log('🐟 GoogleMap: fishDistribution count =', fishDistribution.length);
    if (fishDistribution.length > 0) {
      console.log('🐟 Sample fish data:', fishDistribution[0]);
    }
    return fishDistribution.map((fish, index) => ({
      id: `fish-${fish.id || index}`,
      position: { lat: fish.latitude, lng: fish.longitude },
      fish: fish
    }));
  }, [fishDistribution]);

  if (!apiKey || apiKey === 'YOUR_GOOGLE_MAPS_API_KEY_HERE') {
    return (
      <div
        style={{
          width: '100%',
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          border: '2px dashed #ccc',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center'
        }}
      >
        <div>
          <h3 style={{ marginBottom: '10px', color: '#666' }}>
            ⚠️ กรุณาตั้งค่า Google Maps API Key
          </h3>
          <p style={{ color: '#999', fontSize: '14px', marginBottom: '10px' }}>
            เพิ่ม NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ในไฟล์ .env.local
          </p>
          <p style={{ color: '#999', fontSize: '12px' }}>
            ดูวิธีการสร้าง API Key ได้ที่:{' '}
            <a
              href="https://console.cloud.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#1976d2' }}
            >
              Google Cloud Console
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <Map
        style={{ width: '100%', height }}
        defaultCenter={center}
        defaultZoom={zoom}
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapId="mekong-fish-dashboard-map"
      >
        {/* Fishing Spot Markers (จุดจับปลา - หมุดแดง) */}
        {spotMarkers.map((marker) => (
          <AdvancedMarker
            key={marker.id}
            position={marker.position}
            onClick={() => onMarkerClick?.(marker.spot)}
            title={marker.spot.spotName}
          >
            <img
              src="/icons/fishing-spot-marker.svg"
              alt={marker.spot.spotName}
              style={{ width: '40px', height: '40px', cursor: 'pointer' }}
            />
          </AdvancedMarker>
        ))}

        {/* Fish Distribution Markers (ปลา - หมุดน้ำเงิน) */}
        {showFishMarkers && fishMarkers.map((marker) => (
          <AdvancedMarker
            key={marker.id}
            position={marker.position}
            onClick={() => onFishMarkerClick?.(marker.fish)}
            title={`${marker.fish.species} (${marker.fish.quantity} ตัว)`}
          >
            <img
              src="/icons/fish-marker.svg"
              alt={marker.fish.species}
              style={{ width: '32px', height: '32px', cursor: 'pointer' }}
            />
          </AdvancedMarker>
        ))}
      </Map>
    </APIProvider>
  );
}
