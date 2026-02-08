import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform, Alert, Modal } from 'react-native';
import {
  Button,
  Card,
  Text,
  TextInput,
  Checkbox,
  RadioButton,
  Chip,
  Divider
} from 'react-native-paper';
// import MapView, { Marker } from 'react-native-maps';
import MapPlaceholder from '../components/MapPlaceholder';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFishingData } from '../contexts/FishingDataContext';
import { FirebaseService } from '../services/FirebaseService';

const WATER_SOURCES = [
  'คก',
  'วัง',
  'หาด',
  'บุ่ง',
  'โซ่',
  'แก่ง',
  'ริมฝั่งโขง',
  'น้ำสาขา/ห้วยสาขา',
  'ดอนทราย'
];

const WEATHER_OPTIONS = [
  'แดดร้อน',
  'ฝนฟ้าคะนอง',
  'มีเมฆ',
  'ลมแรง',
  'อากาศเย็น'
];

const FISHING_GEAR = [
  'มอง',
  'แห',
  'เบ็ดราว',
  'ลอบ',
  'จั่น',
  'ตุ้ม',
  'กะโหล่',
  'ซ่อน',
  'ต่อง',
  'โต่ง',
  'เบ็ดน้ำเต้า',
  'เอ๊าะ',
  'สวิง',
  'สะดุ้ง',
  'อื่นๆ'
];

const TIME_PERIODS = [
  'เช้า',
  'กลางวัน',
  'เย็น'
];

export default function DataEntryScreen({ navigation }) {
  const { currentEntry, updateCurrentEntry } = useFishingData();
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showGearModal, setShowGearModal] = useState(false);
  const [selectedGear, setSelectedGear] = useState('');
  const [fishingSpots, setFishingSpots] = useState([]);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [loadingSpots, setLoadingSpots] = useState(false);
  const [customLocation, setCustomLocation] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [mapRegion, setMapRegion] = useState(null);
  const [tempMarkerCoords, setTempMarkerCoords] = useState(null);
  
  const [localData, setLocalData] = useState({
    date: currentEntry.date || new Date(),
    waterSource: currentEntry.waterSource || '',
    weather: currentEntry.weather || '',
    fishingGear: currentEntry.fishingGear || null,
    startTime: currentEntry.startTime || '',
    endTime: currentEntry.endTime || '',
    totalWeight: currentEntry.totalWeight || ''
  });

  const [gearDetails, setGearDetails] = useState({
    quantity: '',
    size: '',
    custom: '',
    meshSize: '',
    length: '',
    depth: ''
  });

  // Load fishing spots from Firebase
  useEffect(() => {
    loadFishingSpots();
  }, []);

  const loadFishingSpots = async () => {
    try {
      setLoadingSpots(true);

      // 1. ลองอ่านจาก AsyncStorage cache ก่อน
      const cachedData = await AsyncStorage.getItem('fishing_spots_cache');
      const cacheTime = await AsyncStorage.getItem('fishing_spots_cache_time');

      const now = Date.now();
      const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 วัน

      // 2. ถ้ามี cache และยังไม่หมดอายุ ใช้ cache
      if (cachedData && cacheTime) {
        const timeSinceCache = now - parseInt(cacheTime);

        if (timeSinceCache < CACHE_DURATION) {
          if (__DEV__) {
            const daysOld = Math.floor(timeSinceCache / (24 * 60 * 60 * 1000));
            console.log(`✅ Using cached fishing spots (${daysOld} days old, expires in ${30 - daysOld} days)`);
          }

          const spots = JSON.parse(cachedData);
          setFishingSpots(spots);
          setLoadingSpots(false);
          return;
        } else {
          if (__DEV__) console.log('⚠️ Cache expired, fetching from Firebase...');
        }
      } else {
        if (__DEV__) console.log('⚠️ No cache found, fetching from Firebase...');
      }

      // 3. ถ้าไม่มี cache หรือหมดอายุ → ดึงจาก Firebase
      if (__DEV__) console.log('🔄 Starting to load fishing spots from Firebase...');
      const result = await FirebaseService.getFishingSpots();

      if (__DEV__) console.log('📊 Result:', result);

      if (result.success) {
        console.log('✅ Loaded fishing spots from Firebase:', result.spots.length);
        console.log('📋 Spots:', result.spots.map(s => s.spotName).join(', '));

        if (__DEV__) {
          if (result.spots.length > 0) {
            console.log('📍 Sample spot:', result.spots[0]);
          }
        }

        // 4. บันทึกลง AsyncStorage cache
        try {
          await AsyncStorage.setItem('fishing_spots_cache', JSON.stringify(result.spots));
          await AsyncStorage.setItem('fishing_spots_cache_time', now.toString());
          console.log('💾 Cached fishing spots data for 30 days');
        } catch (cacheError) {
          // ถ้า cache ไม่ได้ก็ไม่เป็นไร ยังใช้งานได้ปกติ
          console.error('⚠️ Failed to cache data:', cacheError);
        }

        setFishingSpots(result.spots);
      } else {
        console.error('❌ Failed to load:', result.error);
        Alert.alert('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลจุดจับปลาได้: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('❌ Error loading fishing spots:', error);
      Alert.alert('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการโหลดข้อมูลจุดจับปลา: ' + error.message);
    } finally {
      setLoadingSpots(false);
    }
  };

  const handleSpotSelect = (spot) => {
    setSelectedSpot(spot);
    setCustomLocation(null); // รีเซ็ตพิกัดที่ปรับแล้ว
    setMapRegion({
      latitude: spot.latitude,
      longitude: spot.longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    });
    // Update the location in context
    updateCurrentEntry({
      location: {
        spotName: spot.spotName,
        latitude: spot.latitude,
        longitude: spot.longitude,
        accuracy: 'spot_default'
      }
    });
  };


  const handleMapMarkerDrag = (e) => {
    setTempMarkerCoords(e.nativeEvent.coordinate);
  };

  const handleConfirmLocation = () => {
    if (!tempMarkerCoords || !selectedSpot) return;
    
    const newCustomLocation = {
      spotName: selectedSpot.spotName,
      originalLat: selectedSpot.latitude,
      originalLng: selectedSpot.longitude,
      actualLat: tempMarkerCoords.latitude,
      actualLng: tempMarkerCoords.longitude,
    };
    
    setCustomLocation(newCustomLocation);
    setShowMap(false);
    
    // อัปเดตข้อมูลใน context
    updateCurrentEntry({
      location: {
        spotName: selectedSpot.spotName,
        latitude: tempMarkerCoords.latitude,
        longitude: tempMarkerCoords.longitude,
        originalLatitude: selectedSpot.latitude,
        originalLongitude: selectedSpot.longitude,
        accuracy: 'user_adjusted'
      }
    });
  };

  const handleCancelMap = () => {
    setShowMap(false);
    setTempMarkerCoords(null);
  };


  const handleWeatherSelect = (weather) => {
    setLocalData({ ...localData, weather: weather });
  };

  const handleWaterSourceSelect = (source) => {
    setLocalData({ ...localData, waterSource: source });
  };

  const handleFishingGearSelect = (gear) => {
    setSelectedGear(gear);
    setGearDetails({ quantity: '', size: '', custom: '', meshSize: '', length: '', depth: '' });
    setShowGearModal(true);
  };

  const handleStartTimeSelect = (time) => {
    setLocalData({ ...localData, startTime: time });
  };

  const handleEndTimeSelect = (time) => {
    setLocalData({ ...localData, endTime: time });
  };

  const handleGearModalSave = () => {
    const gearData = {
      name: selectedGear,
      details: gearDetails
    };
    setLocalData({ ...localData, fishingGear: gearData });
    setShowGearModal(false);
  };

  const getGearDisplayText = () => {
    if (!localData.fishingGear) return '';

    const gear = localData.fishingGear;
    const details = gear.details || {};

    // แสดงรายละเอียดตามประเภทเครื่องมือ
    if (gear.name === 'อื่นๆ') {
      return `${details.custom || ''} ${details.quantity ? `จำนวน ${details.quantity}` : ''}`;
    } else if (gear.name === 'มอง' || gear.name === 'แห') {
      // มอง/แห: ขนาดตา, ความยาว, ความลึก, จำนวน
      const parts = [];
      if (details.meshSize) parts.push(`ขนาดตา ${details.meshSize} ซม.`);
      if (details.length) parts.push(`ยาว ${details.length} ม.`);
      if (details.depth) parts.push(`ลึก ${details.depth} ม.`);
      if (details.quantity) parts.push(`จำนวน ${details.quantity} ผืน`);
      return parts.join(' ');
    } else if (gear.name === 'เบ็ดน้ำเต้า') {
      // เบ็ดน้ำเต้า: เบอร์, จำนวน (เต้า)
      const parts = [];
      if (details.size) parts.push(`เบอร์ ${details.size}`);
      if (details.quantity) parts.push(`จำนวน ${details.quantity} เต้า`);
      return parts.join(' ');
    } else {
      // เครื่องมืออื่นๆ: แสดงเฉพาะจำนวน
      return details.quantity ? `จำนวน ${details.quantity}` : '';
    }
  };

  const calculateHours = () => {
    if (!localData.startTime || !localData.endTime) return null;
    
    // กำหนดเวลาช่วงต่างๆ (ใช้เวลากลางของแต่ละช่วง)
    const timeMap = {
      'เช้า': 8,      // 6-10 โมง (กลางคือ 8 โมง)
      'กลางวัน': 14,  // 10-18 โมง (กลางคือ 14 โมง) 
      'เย็น': 20      // 18-22 โมง (กลางคือ 20 โมง)
    };
    
    const startHour = timeMap[localData.startTime];
    const endHour = timeMap[localData.endTime];
    
    if (startHour === undefined || endHour === undefined) return null;
    
    // คำนวณจำนวนชั่วโมง
    let hours = endHour - startHour;
    
    // ถ้าเวลาสิ้นสุดน้อยกว่าเวลาเริ่ม แสดงว่าข้ามวัน
    if (hours <= 0) {
      hours = (24 - startHour) + endHour;
    }
    
    return hours;
  };

  const getHoursDisplay = () => {
    const hours = calculateHours();
    if (hours === null) return '';
    
    if (hours === 0) {
      return 'เวลาเดียวกัน';
    } else if (hours === 1) {
      return '1 ชั่วโมง';
    } else {
      return `${hours} ชั่วโมง`;
    }
  };


  const handleDateChange = (event, selectedDate) => {
    console.log('handleDateChange called:', event, selectedDate);
    setShowDatePicker(false);
    if (selectedDate) {
      // แก้ปัญหา timezone: ใช้ setHours เพื่อกำหนดเวลาเป็นเที่ยงวันเพื่อหลีกเลี่ยงปัญหา timezone offset
      const normalizedDate = new Date(selectedDate);
      normalizedDate.setHours(12, 0, 0, 0);
      setLocalData({ ...localData, date: normalizedDate });
    }
  };

  const handleStartTimeChange = (event, selectedTime) => {
    setShowStartTimePicker(false);
    if (selectedTime) {
      setLocalData({ ...localData, startTime: selectedTime });
    }
  };

  const handleEndTimeChange = (event, selectedTime) => {
    setShowEndTimePicker(false);
    if (selectedTime) {
      setLocalData({ ...localData, endTime: selectedTime });
    }
  };

  // ฟังก์ชันสุ่มพิกัดในรัศมี 100-500 เมตร
  const randomizeLocation = (latitude, longitude) => {
    // สุ่มระยะทางระหว่าง 100-500 เมตร
    const minDistance = 100;
    const maxDistance = 500;
    const distance = minDistance + Math.random() * (maxDistance - minDistance);

    // สุ่มทิศทาง (0-360 องศา)
    const bearing = Math.random() * 360;

    // แปลงเป็น radian
    const bearingRad = (bearing * Math.PI) / 180;

    // รัศมีโลก (เมตร)
    const earthRadius = 6371000;

    // คำนวณพิกัดใหม่
    const latRad = (latitude * Math.PI) / 180;
    const lonRad = (longitude * Math.PI) / 180;

    const newLatRad = Math.asin(
      Math.sin(latRad) * Math.cos(distance / earthRadius) +
      Math.cos(latRad) * Math.sin(distance / earthRadius) * Math.cos(bearingRad)
    );

    const newLonRad = lonRad + Math.atan2(
      Math.sin(bearingRad) * Math.sin(distance / earthRadius) * Math.cos(latRad),
      Math.cos(distance / earthRadius) - Math.sin(latRad) * Math.sin(newLatRad)
    );

    // แปลงกลับเป็นองศา
    const newLat = (newLatRad * 180) / Math.PI;
    const newLon = (newLonRad * 180) / Math.PI;

    return { latitude: newLat, longitude: newLon };
  };

  const validateAndContinue = () => {
    if (!localData.waterSource) {
      Alert.alert('กรุณากรอกข้อมูลให้ครบถ้วน', 'กรุณาเลือกแหล่งน้ำ');
      return;
    }

    if (!localData.fishingGear || !localData.fishingGear.details?.quantity) {
      Alert.alert('กรุณาเลือกเครื่องมือ', 'กรุณาเลือกเครื่องมือที่ใช้ในการจับปลาและกรอกรายละเอียด');
      return;
    }

    // ตรวจสอบว่าได้เลือกจุดจับปลาแล้วหรือไม่
    if (!selectedSpot) {
      Alert.alert('กรุณาเลือกจุดจับปลา', 'กรุณาเลือกจุดจับปลาที่ต้องการบันทึก');
      return;
    }

    // สุ่มพิกัดในรัศมี 100-500 เมตร
    const originalLat = customLocation?.actualLat || selectedSpot.latitude;
    const originalLng = customLocation?.actualLng || selectedSpot.longitude;
    const randomizedCoords = randomizeLocation(originalLat, originalLng);

    // เพิ่ม location data พร้อมพิกัดที่สุ่มแล้ว
    const locationData = {
      spotName: customLocation?.spotName || selectedSpot.spotName,
      latitude: randomizedCoords.latitude,
      longitude: randomizedCoords.longitude,
      originalLatitude: originalLat,
      originalLongitude: originalLng,
      accuracy: 'randomized_100_500m'
    };

    const dataToUpdate = {
      ...localData,
      location: locationData
    };

    updateCurrentEntry(dataToUpdate);
    navigation.navigate('AddFish');
  };

  const formatTime = (time) => {
    if (!time) return 'เลือกเวลา';
    return time.toLocaleTimeString('th-TH', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  const formatDateThai = (date) => {
    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    
    const day = date.getDate();
    const month = thaiMonths[date.getMonth()];
    const year = date.getFullYear() + 543; // แปลงเป็น พ.ศ.
    
    return `${day} ${month} ${year}`;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Date Selection */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>
              วันที่บันทึก
            </Text>
            <Button
              mode="outlined"
              onPress={() => {
                console.log('Date picker button pressed, Platform:', Platform.OS);
                setShowDatePicker(true);
              }}
              style={styles.dateButton}
              icon="calendar"
            >
              {formatDateThai(localData.date)}
            </Button>
          </Card.Content>
        </Card>


            {/* Water Source */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  แหล่งน้ำ (เลือก 1 ข้อ)
                </Text>
                <View style={styles.chipContainer}>
                  {WATER_SOURCES.map(source => (
                    <Chip
                      key={source}
                      mode="outlined"
                      selected={localData.waterSource === source}
                      onPress={() => handleWaterSourceSelect(source)}
                      style={[
                        styles.chip,
                        localData.waterSource === source && styles.selectedChip
                      ]}
                    >
                      {source}
                    </Chip>
                  ))}
                </View>
              </Card.Content>
            </Card>

            {/* Weather */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  สภาพอากาศ (เลือก 1 ข้อ)
                </Text>
                <View style={styles.chipContainer}>
                  {WEATHER_OPTIONS.map(weather => (
                    <Chip
                      key={weather}
                      mode="outlined"
                      selected={localData.weather === weather}
                      onPress={() => handleWeatherSelect(weather)}
                      style={[
                        styles.chip,
                        localData.weather === weather && styles.selectedChip
                      ]}
                    >
                      {weather}
                    </Chip>
                  ))}
                </View>
              </Card.Content>
            </Card>

            {/* Fishing Gear */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  เครื่องมือที่ใช้ (เลือก 1 ข้อ) <Text style={{ color: 'red' }}>*</Text>
                </Text>
                <View style={styles.chipContainer}>
                  {FISHING_GEAR.map(gear => (
                    <Chip
                      key={gear}
                      mode="outlined"
                      selected={localData.fishingGear?.name === gear}
                      onPress={() => handleFishingGearSelect(gear)}
                      style={[
                        styles.chip,
                        localData.fishingGear?.name === gear && styles.selectedChip
                      ]}
                    >
                      {gear}
                    </Chip>
                  ))}
                </View>
                {localData.fishingGear && (
                  <Text variant="bodySmall" style={styles.gearDetailsText}>
                    {getGearDisplayText()}
                  </Text>
                )}
              </Card.Content>
            </Card>

            {/* Time Selection */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  เวลาการใช้เครื่องมือ
                </Text>
                
                <Text variant="bodyMedium" style={styles.subTitle}>
                  เวลาลงเครื่องมือ (เลือก 1 ข้อ)
                </Text>
                <View style={styles.timeChipRow}>
                  {TIME_PERIODS.map(time => (
                    <Chip
                      key={time}
                      mode="outlined"
                      selected={localData.startTime === time}
                      onPress={() => handleStartTimeSelect(time)}
                      style={[
                        styles.timeChip,
                        localData.startTime === time && styles.selectedChip
                      ]}
                    >
                      {time}
                    </Chip>
                  ))}
                </View>

                <Text variant="bodyMedium" style={styles.subTitle}>
                  เวลากู้เครื่องมือ (เลือก 1 ข้อ)
                </Text>
                <View style={styles.timeChipRow}>
                  {TIME_PERIODS.map(time => (
                    <Chip
                      key={time}
                      mode="outlined"
                      selected={localData.endTime === time}
                      onPress={() => handleEndTimeSelect(time)}
                      style={[
                        styles.timeChip,
                        localData.endTime === time && styles.selectedChip
                      ]}
                    >
                      {time}
                    </Chip>
                  ))}
                </View>

                {/* Hours Calculation Display */}
                {localData.startTime && localData.endTime && (
                  <View style={styles.hoursDisplay}>
                    <Text variant="bodySmall" style={styles.hoursText}>
                      💡 ระยะเวลาใช้เครื่องมือ: {getHoursDisplay()}
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>

            {/* Total Weight */}
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.sectionTitle}>
                  ผลจับรวม
                </Text>
                
                <Text variant="bodyMedium" style={styles.subTitle}>
                  น้ำหนักปลาที่จับได้ทั้งหมด (กิโลกรัม)
                </Text>
                <TextInput
                  value={localData.totalWeight}
                  onChangeText={(value) => setLocalData({ ...localData, totalWeight: value })}
                  keyboardType="numeric"
                  mode="outlined"
                  placeholder="0.00"
                  style={styles.weightInput}
                />
              </Card.Content>
            </Card>

        {/* Location Section */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium" style={styles.sectionTitle}>
                ตำแหน่งการจับปลา <Text style={{ color: 'red' }}>*</Text>
              </Text>
              <Button
                mode="text"
                compact
                onPress={async () => {
                  try {
                    // ล้าง cache และโหลดใหม่
                    console.log('🗑️ Clearing fishing spots cache...');
                    await AsyncStorage.removeItem('fishing_spots_cache');
                    await AsyncStorage.removeItem('fishing_spots_cache_time');
                    console.log('✅ Cache cleared, loading fresh data...');
                    loadFishingSpots();
                    Alert.alert('สำเร็จ', 'กำลังโหลดจุดจับปลาใหม่จาก Firebase...');
                  } catch (error) {
                    console.error('❌ Error clearing cache:', error);
                    Alert.alert('ข้อผิดพลาด', 'ไม่สามารถล้างข้อมูลได้: ' + error.message);
                  }
                }}
                style={styles.refreshButton}
              >
                รีเฟรช
              </Button>
            </View>

            <Text variant="bodySmall" style={styles.spotCount}>
              พบ {fishingSpots.length} จุด
            </Text>

            {loadingSpots ? (
              <View style={styles.locationSection}>
                <Text variant="bodyMedium" style={styles.locationDescription}>
                  กำลังโหลดจุดจับปลา...
                </Text>
              </View>
            ) : (
              <View style={styles.spotsContainer}>
                <View style={styles.spotsGrid}>
                  {fishingSpots.map((spot) => (
                    <Chip
                      key={spot.id}
                      mode="outlined"
                      selected={selectedSpot?.id === spot.id}
                      onPress={() => handleSpotSelect(spot)}
                      style={[
                        styles.spotChip,
                        selectedSpot?.id === spot.id && styles.selectedSpotChip
                      ]}
                    >
                      {spot.spotName}
                    </Chip>
                  ))}
                </View>

                {selectedSpot && (
                  <View style={styles.selectedSpotInfo}>
                    {/* แสดงพิกัดปัจจุบัน */}
                    <Text variant="bodyMedium" style={styles.coordinatesText}>
                      พิกัด: {customLocation ?
                        `${customLocation.actualLat.toFixed(6)}, ${customLocation.actualLng.toFixed(6)}` :
                        `${selectedSpot.latitude?.toFixed(6)}, ${selectedSpot.longitude?.toFixed(6)}`
                      }
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Continue Button */}
        <Button
          mode="contained"
          onPress={validateAndContinue}
          style={styles.continueButton}
          contentStyle={styles.buttonContent}
        >
          เพิ่มรายการปลา
        </Button>

        {/* Date/Time Pickers */}
        {showDatePicker && (
          <Modal
            visible={showDatePicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text variant="titleMedium" style={styles.modalTitle}>
                  เลือกวันที่
                </Text>
                <DateTimePicker
                  value={localData.date}
                  mode="date"
                  display={Platform.select({
                    ios: 'spinner',
                    android: 'spinner',
                    default: 'default'
                  })}
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                  style={styles.dateTimePicker}
                  locale="th-TH"
                  textColor={Platform.OS === 'ios' ? '#000' : undefined}
                  accentColor="#2196F3"
                />
                <View style={styles.modalButtons}>
                  <Button 
                    mode="outlined" 
                    onPress={() => setShowDatePicker(false)}
                    style={styles.modalButton}
                  >
                    ยกเลิก
                  </Button>
                  <Button 
                    mode="contained" 
                    onPress={() => setShowDatePicker(false)}
                    style={styles.modalButton}
                  >
                    ตกลง
                  </Button>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {showStartTimePicker && (
          <Modal
            visible={showStartTimePicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowStartTimePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text variant="titleMedium" style={styles.modalTitle}>
                  เลือกเวลาลงเครื่องมือ
                </Text>
                <DateTimePicker
                  value={localData.startTime || new Date()}
                  mode="time"
                  display="spinner"
                  onChange={handleStartTimeChange}
                  is24Hour={true}
                  style={styles.dateTimePicker}
                  locale="th-TH"
                  textColor="#000"
                />
                <View style={styles.modalButtons}>
                  <Button 
                    mode="outlined" 
                    onPress={() => setShowStartTimePicker(false)}
                    style={styles.modalButton}
                  >
                    ยกเลิก
                  </Button>
                  <Button 
                    mode="contained" 
                    onPress={() => setShowStartTimePicker(false)}
                    style={styles.modalButton}
                  >
                    ตกลง
                  </Button>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {showEndTimePicker && (
          <Modal
            visible={showEndTimePicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowEndTimePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text variant="titleMedium" style={styles.modalTitle}>
                  เลือกเวลากู้เครื่องมือ
                </Text>
                <DateTimePicker
                  value={localData.endTime || new Date()}
                  mode="time"
                  display="spinner"
                  onChange={handleEndTimeChange}
                  is24Hour={true}
                  style={styles.dateTimePicker}
                  locale="th-TH"
                  textColor="#000"
                />
                <View style={styles.modalButtons}>
                  <Button 
                    mode="outlined" 
                    onPress={() => setShowEndTimePicker(false)}
                    style={styles.modalButton}
                  >
                    ยกเลิก
                  </Button>
                  <Button 
                    mode="contained" 
                    onPress={() => setShowEndTimePicker(false)}
                    style={styles.modalButton}
                  >
                    ตกลง
                  </Button>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Fishing Gear Details Modal */}
        {showGearModal && (
          <Modal
            visible={showGearModal}
            transparent
            animationType="slide"
            onRequestClose={() => setShowGearModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text variant="titleMedium" style={styles.modalTitle}>
                  รายละเอียดเครื่องมือ
                </Text>
                <Text variant="bodyMedium" style={styles.selectedGearText}>
                  {selectedGear}
                </Text>

                <ScrollView
                  style={styles.modalScrollView}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modalScrollContent}
                >
                {/* Input fields based on gear type */}
                {selectedGear === 'มอง' || selectedGear === 'แห' ? (
                  <>
                    <TextInput
                      label="ขนาดตา (ซม.)"
                      value={gearDetails.meshSize}
                      onChangeText={(value) => setGearDetails({...gearDetails, meshSize: value})}
                      mode="outlined"
                      style={styles.modalInput}
                      placeholder="เช่น 4, 12, 14"
                    />
                    <TextInput
                      label="ความยาว (ม.)"
                      value={gearDetails.length}
                      onChangeText={(value) => setGearDetails({...gearDetails, length: value})}
                      mode="outlined"
                      style={styles.modalInput}
                      placeholder="เช่น 280, 300, 600"
                    />
                    <TextInput
                      label="ความลึก (ม.)"
                      value={gearDetails.depth}
                      onChangeText={(value) => setGearDetails({...gearDetails, depth: value})}
                      mode="outlined"
                      style={styles.modalInput}
                      placeholder="เช่น 1.74, 0.94"
                    />
                    <TextInput
                      label="จำนวน (ผืน)"
                      value={gearDetails.quantity}
                      onChangeText={(value) => setGearDetails({...gearDetails, quantity: value})}
                      mode="outlined"
                      style={styles.modalInput}
                    />
                  </>
                ) : selectedGear === 'เบ็ดน้ำเต้า' ? (
                  <>
                    <TextInput
                      label="เบอร์"
                      value={gearDetails.size}
                      onChangeText={(value) => setGearDetails({...gearDetails, size: value})}
                      mode="outlined"
                      style={styles.modalInput}
                      placeholder="เช่น 1, 2, 3"
                    />
                    <TextInput
                      label="จำนวน (เต้า)"
                      value={gearDetails.quantity}
                      onChangeText={(value) => setGearDetails({...gearDetails, quantity: value})}
                      mode="outlined"
                      style={styles.modalInput}
                    />
                  </>
                ) : selectedGear === 'อื่นๆ' ? (
                  <>
                    <TextInput
                      label="ระบุเครื่องมือ"
                      value={gearDetails.custom}
                      onChangeText={(value) => setGearDetails({...gearDetails, custom: value})}
                      mode="outlined"
                      style={styles.modalInput}
                      placeholder="ระบุชื่อเครื่องมือ"
                    />
                    <TextInput
                      label="จำนวน"
                      value={gearDetails.quantity}
                      onChangeText={(value) => setGearDetails({...gearDetails, quantity: value})}
                      mode="outlined"
                      style={styles.modalInput}
                    />
                  </>
                ) : (
                  <TextInput
                    label="จำนวน"
                    value={gearDetails.quantity}
                    onChangeText={(value) => setGearDetails({...gearDetails, quantity: value})}
                    mode="outlined"
                    style={styles.modalInput}
                  />
                )}
                </ScrollView>

                <View style={styles.modalButtons}>
                  <Button 
                    mode="outlined" 
                    onPress={() => setShowGearModal(false)}
                    style={styles.modalButton}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleGearModalSave}
                    style={styles.modalButton}
                    disabled={
                      !gearDetails.quantity ||
                      (selectedGear === 'เบ็ดน้ำเต้า' && !gearDetails.size) ||
                      (selectedGear === 'อื่นๆ' && !gearDetails.custom)
                    }
                  >
                    บันทึก
                  </Button>
                </View>
              </View>
            </View>
          </Modal>
        )}

        {/* Map Modal */}
        {showMap && (
          <Modal
            visible={showMap}
            animationType="slide"
            onRequestClose={handleCancelMap}
          >
            <View style={styles.mapContainer}>
              <View style={styles.mapHeader}>
                <Text variant="titleLarge" style={styles.mapTitle}>
                  ปรับตำแหน่งการจับปลา
                </Text>
                <Text variant="bodyMedium" style={styles.mapSubtitle}>
                  ลากปิ่นเพื่อระบุตำแหน่งที่แท้จริง
                </Text>
              </View>
              
              <MapPlaceholder
                style={styles.map}
                markerCoordinate={tempMarkerCoords || {
                  latitude: selectedSpot?.latitude || 0,
                  longitude: selectedSpot?.longitude || 0
                }}
                onMarkerDrag={handleMapMarkerDrag}
                markerTitle={selectedSpot?.spotName}
              />
              
              <View style={styles.mapFooter}>
                <View style={styles.coordinateDisplay}>
                  <Text variant="bodyMedium" style={styles.coordinateLabel}>
                    พิกัดปัจจุบัน:
                  </Text>
                  <Text variant="bodySmall" style={styles.coordinateValue}>
                    {tempMarkerCoords ? 
                      `${tempMarkerCoords.latitude.toFixed(6)}, ${tempMarkerCoords.longitude.toFixed(6)}` :
                      'กำลังโหลด...'
                    }
                  </Text>
                </View>
                
                <View style={styles.mapButtons}>
                  <Button
                    mode="outlined"
                    onPress={handleCancelMap}
                    style={styles.mapCancelButton}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    mode="contained"
                    onPress={handleConfirmLocation}
                    style={styles.mapConfirmButton}
                  >
                    ยืนยันตำแหน่ง
                  </Button>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  subTitle: {
    marginBottom: 8,
    marginTop: 8,
    fontWeight: '500',
  },
  dateButton: {
    marginTop: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabel: {
    marginLeft: 8,
    flex: 1,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    marginBottom: 8,
  },
  picker: {
    height: 50,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginRight: 8,
    marginBottom: 8,
  },
  selectedChip: {
    backgroundColor: '#2196F3',
  },
  gearDetailsText: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    color: '#2196F3',
    fontStyle: 'italic',
  },
  selectedGearText: {
    marginBottom: 16,
    color: '#666',
    textAlign: 'center',
  },
  modalInput: {
    marginBottom: 12,
    width: '100%',
  },
  modalScrollView: {
    width: '100%',
    maxHeight: 400,
  },
  modalScrollContent: {
    paddingBottom: 10,
  },
  timeChipRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeChip: {
    flex: 1,
    minWidth: 80,
  },
  hoursDisplay: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  hoursText: {
    color: '#1976d2',
    fontWeight: '500',
    textAlign: 'center',
  },
  weightInput: {
    marginTop: 8,
  },
  continueButton: {
    marginTop: 16,
    marginBottom: 32,
  },
  buttonContent: {
    paddingVertical: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '85%',
    alignItems: 'center',
    maxHeight: '80%',
  },
  modalTitle: {
    marginBottom: 16,
    color: '#2196F3',
    fontWeight: 'bold',
  },
  dateTimePicker: {
    width: '100%',
    marginVertical: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  modalButton: {
    minWidth: 80,
  },
  // Location styles
  locationSection: {
    marginTop: 8,
  },
  locationDescription: {
    marginBottom: 12,
    color: '#666',
    textAlign: 'center',
  },
  spotsContainer: {
    marginTop: 8,
  },
  spotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  spotChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  selectedSpotChip: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196F3',
  },
  selectedSpotInfo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  spotTitle: {
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  coordinatesText: {
    fontFamily: 'monospace',
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  spotDescription: {
    color: '#666',
    fontStyle: 'italic',
  },
  accuracyText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  distanceText: {
    color: '#ff9800',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  mapActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  mapButton: {
    flex: 1,
  },
  resetButton: {
    flex: 1,
  },
  // Map Modal Styles
  mapContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapHeader: {
    padding: 16,
    backgroundColor: '#2196F3',
    paddingTop: 50, // Safe area
  },
  mapTitle: {
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  mapSubtitle: {
    color: '#e3f2fd',
    fontSize: 14,
  },
  map: {
    flex: 1,
  },
  mapFooter: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  coordinateDisplay: {
    marginBottom: 16,
  },
  coordinateLabel: {
    fontWeight: '500',
    marginBottom: 4,
  },
  coordinateValue: {
    fontFamily: 'monospace',
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  distanceValue: {
    color: '#ff9800',
    fontWeight: '500',
  },
  mapButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  mapCancelButton: {
    flex: 1,
  },
  mapConfirmButton: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  refreshButton: {
    marginRight: -8,
  },
  spotCount: {
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic',
  },
});