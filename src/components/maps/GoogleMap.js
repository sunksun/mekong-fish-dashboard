'use client';

import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { useMemo, useEffect, useRef } from 'react';
import { MarkerClusterer } from '@googlemaps/markerclusterer';

// Component สำหรับจัดการ Fish Markers พร้อม Clustering
function FishMarkerClusterer({ fishMarkers, onFishMarkerClick, showFishMarkers }) {
  const map = useMap();
  const clustererRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if (!map || !showFishMarkers) return;

    // สร้าง MarkerClusterer ด้วย algorithm ที่แยกหมุดได้ง่าย
    if (!clustererRef.current) {
      clustererRef.current = new MarkerClusterer({
        map,
        markers: [],
        algorithmOptions: {
          maxZoom: 15, // แยก cluster เมื่อ zoom > 15
          radius: 60,  // ระยะรวมกลุ่ม (pixels) - ยิ่งน้อยยิ่งแยกง่าย
        },
      });
    }

    // ล้าง markers เก่า
    if (markersRef.current.length > 0) {
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];
    }

    // สร้าง markers ใหม่
    const newMarkers = fishMarkers.map((markerData) => {
      const marker = new google.maps.Marker({
        position: markerData.position,
        title: `${markerData.fish.species} (${markerData.fish.quantity} ตัว)`,
        icon: {
          url: '/icons/fish-marker.svg',
          scaledSize: new google.maps.Size(32, 32),
        },
      });

      marker.addListener('click', () => {
        onFishMarkerClick?.(markerData.fish);
      });

      return marker;
    });

    markersRef.current = newMarkers;
    clustererRef.current.clearMarkers();
    clustererRef.current.addMarkers(newMarkers);

    // Cleanup
    return () => {
      if (markersRef.current.length > 0) {
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];
      }
    };
  }, [map, fishMarkers, onFishMarkerClick, showFishMarkers]);

  // ไม่แสดง markers ถ้า showFishMarkers = false
  useEffect(() => {
    if (!showFishMarkers && clustererRef.current) {
      clustererRef.current.clearMarkers();
      if (markersRef.current.length > 0) {
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];
      }
    }
  }, [showFishMarkers]);

  return null;
}

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

        {/* Fish Distribution Markers with Clustering (ปลา - หมุดน้ำเงิน) */}
        <FishMarkerClusterer
          fishMarkers={fishMarkers}
          onFishMarkerClick={onFishMarkerClick}
          showFishMarkers={showFishMarkers}
        />
      </Map>
    </APIProvider>
  );
}
