-- phpMyAdmin SQL Dump
-- version 5.2.1deb3
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Mar 18, 2026 at 12:10 PM
-- Server version: 10.11.14-MariaDB-0ubuntu0.24.04.1
-- PHP Version: 8.3.6

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `mekong_watcher`
--

-- --------------------------------------------------------

--
-- Table structure for table `sensor_data`
--

CREATE TABLE `sensor_data` (
  `id` int(11) NOT NULL,
  `device_id` varchar(50) NOT NULL,
  `turbidity` float NOT NULL COMMENT 'Turbidity value in NTU (Nephelometric Turbidity Units)',
  `ec` float NOT NULL COMMENT 'Electrical Conductivity in µS/cm',
  `tds` float DEFAULT NULL COMMENT 'Total Dissolved Solids in ppm (optional, converted from EC)',
  `temperature` float DEFAULT NULL COMMENT 'Water temperature in Celsius (optional)',
  `battery_level` float DEFAULT NULL COMMENT 'Battery level percentage (optional)',
  `status` enum('normal','warning','critical') DEFAULT 'normal',
  `timestamp` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sensor_data`
--

INSERT INTO `sensor_data` (`id`, `device_id`, `turbidity`, `ec`, `tds`, `temperature`, `battery_level`, `status`, `timestamp`) VALUES
(6, 'ESP32_001', 83, 173.57, 86.79, 30.37, NULL, 'critical', '2026-03-18 14:09:28'),
(7, 'ESP32_001', 89, 188.76, 94.38, 26.87, NULL, 'critical', '2026-03-18 14:09:55'),
(8, 'ESP32_001', 80, 198.52, 99.26, 24.5, NULL, 'critical', '2026-03-18 14:10:23'),
(9, 'ESP32_001', 89, 200.19, 100.09, 24.06, NULL, 'critical', '2026-03-18 14:10:50'),
(11, 'ESP32_001', 103, 208.47, 104.24, 24, NULL, 'critical', '2026-03-18 14:11:45'),
(12, 'ESP32_001', 80, 213.67, 106.83, 23.94, NULL, 'critical', '2026-03-18 14:12:12'),
(20, 'ESP32_001', 89, 211.37, 105.68, 25.88, NULL, 'critical', '2026-03-18 14:18:29'),
(21, 'ESP32_001', 83, 218.26, 109.13, 24.31, NULL, 'critical', '2026-03-18 14:18:57'),
(22, 'ESP32_001', 94, 219.56, 109.78, 24, NULL, 'critical', '2026-03-18 14:19:24'),
(23, 'ESP32_001', 80, 220.17, 110.09, 24, NULL, 'critical', '2026-03-18 14:19:52'),
(24, 'ESP32_001', 66, 220.44, 110.22, 23.94, NULL, 'warning', '2026-03-18 14:20:20'),
(25, 'ESP32_001', 75, 220.44, 110.22, 23.94, NULL, 'warning', '2026-03-18 14:20:47'),
(26, 'ESP32_001', 114, 220.44, 110.22, 23.94, NULL, 'critical', '2026-03-18 14:21:15'),
(27, 'ESP32_001', 72, 221.05, 110.53, 23.94, NULL, 'warning', '2026-03-18 14:21:42'),
(28, 'ESP32_001', 89, 220.44, 110.22, 23.94, NULL, 'critical', '2026-03-18 14:22:10'),
(29, 'ESP32_001', 72, 221.05, 110.53, 23.94, NULL, 'warning', '2026-03-18 14:22:37'),
(30, 'ESP32_001', 75, 221.05, 110.53, 23.94, NULL, 'warning', '2026-03-18 14:23:05'),
(31, 'ESP32_001', 30, 33.54, 16.77, 23.87, NULL, 'critical', '2026-03-18 14:23:32');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `sensor_data`
--
ALTER TABLE `sensor_data`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sensor_data_device_id` (`device_id`),
  ADD KEY `sensor_data_timestamp` (`timestamp`),
  ADD KEY `sensor_data_device_id_timestamp` (`device_id`,`timestamp`),
  ADD KEY `sensor_data_status` (`status`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `sensor_data`
--
ALTER TABLE `sensor_data`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `sensor_data`
--
ALTER TABLE `sensor_data`
  ADD CONSTRAINT `sensor_data_ibfk_1` FOREIGN KEY (`device_id`) REFERENCES `devices` (`device_id`) ON DELETE NO ACTION ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
