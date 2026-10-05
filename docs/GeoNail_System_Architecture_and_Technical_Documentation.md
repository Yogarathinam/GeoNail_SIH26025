# GeoNail System Architecture & Technical Manual
**Smart Subterranean Anchoring, Slope Stability Monitoring & Real-Time Digital Twin System**

---

### Project & Team Information
* **Hackathon Event**: Smart India Hackathon 2026 (SIH 2026)
* **Problem Statement ID**: SIH26025
* **Project Name**: GeoNail Subterranean Monitoring System
* **Team Name**: Team XLR8
* **Team Lead**: Yogarathinam
* **Development Team**: GeoNail Hardware & Software Engineering Group
* **Repository**: [Yogarathinam/GeoNail_SIH26025](https://github.com/Yogarathinam/GeoNail_SIH26025)
* **Production Deployment**: [GeoNail | Mine Safety Monitoring System](https://geonail.vercel.app/)
* **Document Version**: v1.0.0 (Production Release)
* **Date**: September 2026

---

## 1. Executive Summary

**GeoNail** is an advanced Internet of Subsurface Things (IoST) geotechnical monitoring platform designed for real-time detection of slope instability, structural micro-displacements, and seismic anomalies in high-risk mining, civil excavation, and landslide-prone environments. 

The system integrates high-precision embedded sensor hardware, on-device edge anomaly processing, multi-transport telemetry (BLE, Serial UART, Wi-Fi/MQTT), and a 1:1 real-world scale 3D Web CAD & Digital Twin Visualizer built on Three.js and React.

```
+-----------------------------------------------------------------------------------+
|                                 GEONAIL SYSTEM                                    |
+-----------------------------------------------------------------------------------+
|  +---------------------+    +-------------------------+    +--------------------+ |
|  |   Subsurface Anchors|    |   M5Stack Edge Node     |    |   GeoNail OS Web   | |
|  | - Magnetometer Array| -> | - ESP32-S3 Dual-Core    | -> | - 3D CAD X-Ray     | |
|  | - 3-Axis Accelerom. |    | - Compl. Filter / EMA   |    | - 1:1 Minefield    | |
|  | - Gyro Sensor       |    | - Real-time Edge Rules  |    | - BLE/Serial Modem | |
|  +---------------------+    +-------------------------+    +--------------------+ |
+-----------------------------------------------------------------------------------+
```

---

## 2. Hardware Architecture & Mechanical Design

### 2.1 Mechanical Form Factor
The GeoNail housing consists of a heavy-duty industrial-grade sealed polycarbonate shaft housing the electronics core, topped with a locked protective enclosure cap and anchored deep into soil/rock strata via a telescoping magnetic spike anchor.

* **Main Enclosure Body**: Cylindrical shell containing M5Stack Core2 / ESP32-S3 MCU, OLED/IPS display, lithium-polymer power cell, and status transducer (piezo/buzzer).
* **Telescoping Spike Anchor**: Underground anchor embedded directly into stable soil layers. As soil shifts, relative displacement between the outer casing and inner spike anchor alters internal magnetic field geometry.
* **Locked Top Cap**: Moisture-sealed protective cap housing external antennas and status LEDs.

### 2.2 Microcontroller & Sensors
* **Microcontroller**: ESP32-S3 (Dual-Core Xtensa LX7 @ 240 MHz, 512KB SRAM, 8MB PSRAM, Wi-Fi 4 + BLE 5.0).
* **Power Management Unit (PMU)**: AXP192 integrated power controller supporting battery state-of-charge tracking, dynamic voltage scaling, and solar/external power charging.
* **Inertial Measurement Unit (IMU)**: MPU6050 / MPU6886 6-Axis motion sensor (3-axis Accelerometer, 3-axis Gyroscope).
* **Magnetometer / Hall Sensor Array**: Precision magnetic sensing elements configured along the inner shaft axis to resolve absolute linear displacement of the subterranean anchor rod.

---

## 3. Firmware Architecture & Edge Signal Processing

The firmware is written in C++ for the Arduino/ESP32 framework (`GeoNail_M5Stack_Firmware.ino`). It executes multi-sensor sampling at 100 Hz with real-time digital filtering and edge anomaly detection.

### 3.1 Sensor Fusion & Orientation Math
To compute real-time Roll, Pitch, and Yaw angles without gimbal lock, the firmware implements a Complementary Filter combining raw gyroscope angular rates with accelerometer gravity vectors.

* **Accelerometer Roll Angle**:
  φ_acc = arctan2(A_y, A_z) × (180 / π)

* **Accelerometer Pitch Angle**:
  θ_acc = arctan2(-A_x, √(A_y² + A_z²)) × (180 / π)

* **Complementary Filter Integration**:
  φ_t = α · (φ_(t-1) + G_x · Δt) + (1 - α) · φ_acc
  θ_t = α · (θ_(t-1) + G_y · Δt) + (1 - α) · θ_acc
  ψ_t = ψ_(t-1) + G_z · Δt

*(where α = 0.96 is the filter tuning constant, balancing gyroscope responsiveness with accelerometer low-pass drift suppression).*

### 3.2 Subterranean Anchor Displacement Math
The magnetic flux density B measured along the longitudinal axis varies inverse-proportionally with the insertion distance d of the magnetic spike anchor relative to the casing baseline:

* **Magnetic Field Change**:
  ΔB = B_ref - B_measured

* **Linear Soil Displacement (mm)**:
  d_mm = k_m · √( 1 / (ΔB + ε) ) + d_offset

* As the spike anchor shifts deeper or pulls out during soil subsidence, ΔB changes dynamically.
* The calibrated constant k_m converts micro-tesla field variations into exact linear displacement in millimeters (mm) and centimeters (cm).

### 3.3 Edge Anomaly & Seismic Detection Engine
To eliminate environmental noise while guaranteeing immediate triggering during shear collapses or seismic shocks, the firmware utilizes dual statistical estimators:

* **Exponential Moving Average (EMA)**:
  EMA_t = β · X_t + (1 - β) · EMA_(t-1)
  *(where β = 0.05 smooths slow creep baseline drift).*

* **Root Mean Square Acceleration (RMS_vib)**:
  RMS_vib = √[ (1 / N) ∑ (A_{x,i}² + A_{y,i}² + A_{z,i}² - 1.0²) ]

#### Multi-Stage Trigger Thresholds:
| Operational State | Sensor Condition | System Action & Telemetry |
| :--- | :--- | :--- |
| **NORMAL** | |ΔAngle| < 2.0°, d < 5.0 mm, RMS < 0.15g | Display regular green HUD telemetry |
| **WARNING** | 2.0° ≤ |ΔAngle| < 5.0° OR 5.0 mm ≤ d < 15.0 mm | Amber LED blink, 1 Hz cautionary audio prompt |
| **CRITICAL** | |ΔAngle| ≥ 5.0° OR d ≥ 15.0 mm | Red LED strobe, 5 Hz piezo siren alert |
| **SEISMIC_ANOMALY** | RMS_vib > 0.65g (Transient shock spike) | Instant emergency telemetry beacon dispatch |
| **ANCHOR_SLIP** | Rate of displacement ∂d/∂t > 2.5 mm/s | Lock memory log dump, trigger shear collapse alert |

---

## 4. Telemetry Protocols & Communications

GeoNail provides continuous multi-channel telemetry streams supporting three distinct operational modes:

### 4.1 USB Serial UART Telemetry (115200 Baud)
Sends structured JSON packets at 20 Hz over the USB-C serial port:

```json
{
  "device_id": "GEONAIL_NODE_01",
  "uptime_ms": 142850,
  "pitch": 1.45,
  "roll": -0.82,
  "yaw": 12.30,
  "displacement_mm": 3.42,
  "vibration_rms": 0.042,
  "battery_pct": 94,
  "status": "NORMAL",
  "rssi": -62
}
```

### 4.2 Bluetooth Low Energy (BLE) GATT Architecture
* **Device Name**: `GeoNail-Node-01`
* **Custom Service UUID**: `4FA10001-0000-1000-8000-00805F9B34FB`
* **Characteristics**:
  * **Telemetry Data (Notify)**: `4FA10002-0000-1000-8000-00805F9B34FB` (Binary packed float array: `[Pitch, Roll, Yaw, Displacement, Vibration]`).
  * **Calibration Command (Write)**: `4FA10003-0000-1000-8000-00805F9B34FB` (Send `0x01` to zero IMU tilt, `0x02` to reset magnet baseline).

### 4.3 Wi-Fi Mesh & MQTT WebSockets
In remote deployments, nodes form a local ESP-NOW mesh relaying telemetry to a central gateway node, which publishes MQTT topics (`geonail/telemetry/node_01`) over cellular or satellite backhaul to the GeoNail OS visualizer.

---

## 5. GeoNail OS Web Visualizer Architecture

The frontend visualizer is a modern React 18 + TypeScript web application (`sih-3d-visualizer`) powered by Vite, Tailwind CSS, Lucide icons, and Three.js / React Three Fiber.

### 5.1 System Tab Architecture

```
+-----------------------------------------------------------------------------------+
|                               GEONAIL OS INTERFACE                                |
+-----------------------------------------------------------------------------------+
|  [ 1. 3D CAD Viewer ]     [ 2. MCU Dashboard ]    [ 3. Minefield Digital Twin ]   |
|  - High-res geometry      - Real-time gauges      - 1:1 scale (800m x 600m)       |
|  - X-Ray translucent      - Live trend graphs     - CAT 797 heavy dump trucks     |
|  - Locked cap state       - Direct Serial/BLE     - Subterranean shear slice      |
|  - Multi-camera system    - Alarm logs & reset    - Node deployment grid          |
+-----------------------------------------------------------------------------------+
```

### 5.2 3D CAD Viewer Page Features
* **Full 3-Axis Reactive Model**: Real-time rotational synchronization driven by live or simulated Pitch, Roll, and Yaw angles.
* **Translucent X-Ray Mode**: Renders exterior casing with glass-like transparency (opacity = 0.35), exposing internal battery, M5Stack core board, magnetometer coils, and internal anchoring mechanism.
* **White Engineering Grid Aesthetics**: Crisp white grid floor background, slate grid lines, and axis markers for clear CAD visualization.
* **Locked Cap State**: Standardized fixed state showing locked protective cap securely attached to top shaft.
* **Multi-Preset Camera Control**: Dedicated controls for standard engineering projections:
  * **Isometric View**: Position `[12, 10, 12]`, Target `[0, 0, 0]`
  * **Top (Plan) View**: Position `[0, 22, 0]`, Target `[0, 0, 0]`
  * **Front Elevation**: Position `[0, 0, 20]`, Target `[0, 0, 0]`
  * **Side Elevation**: Position `[20, 0, 0]`, Target `[0, 0, 0]`
  * **Reset Orbit**: Smoothed reset transitions via OrbitControls.

### 5.3 MCU Dashboard Page Features
* **Hardware Connection Modal**: Native Web Serial API & Web Bluetooth API integration allowing operators to connect directly to physical GeoNail devices from any browser.
* **Interactive Telemetry Gauges**: Real-time dial gauges for Pitch (°), Roll (°), Displacement (mm), and Vibration RMS (g).
* **Historical Signal Trends**: Canvas-based line graphs tracking 60-second sliding windows of ground movement.
* **System State Indicator**: Dynamic color-coded status banner with audio warning indicators.

### 5.4 1:1 Scale Minefield Digital Twin Page Features
* **Real-World Environment**: Models an 800m × 600m open-cast mining pit complete with terraced benches (5m height steps), haulage ramps, excavation zones, and top perimeter access roads.
* **Real-World Scale Reference**: Features detailed 1:1 scale 3D models of **CAT 797 Dump Trucks** (14.8m × 9.8m × 6.5m) navigating haul roads, allowing engineers to intuitively judge scale.
* **Multi-Node Deployment Grid**: Multi-node monitoring network (`GEONAIL-01` to `GEONAIL-06`) positioned along critical slope benches. Clicking any node selects it, displaying its live telemetry HUD overlay and triggering a smooth camera glide to its coordinates.
* **Subterranean Shear Slice Visualization**: Underground cross-section plane highlighting slip surfaces, failure arcs, soil strata layers, and real-time anchor penetration depths.

---

## 6. Calibration & Operating Procedures

### 6.1 Initial Zero-Bias Calibration Procedure
1. **Mechanical Mounting**: Drive GeoNail outer casing into borehole until top flange rests flush against reference surface.
2. **Spike Extension**: Drive telescoping spike anchor into bedrock / solid substrate.
3. **Firmware Zeroing**:
   * Hold M5Stack **Button A** for 3 seconds or trigger **Zero Calibration** in GeoNail OS Web Visualizer.
   * Device records current A_x, A_y, A_z baseline offset as 0.0° pitch/roll reference.
   * Device stores current magnetic flux reading B_0 as zero displacement (0.0 mm).

### 6.2 Troubleshooting Audio & Display Behavior
* **Audio Noise / Buzzing**: Occurs when PWM buzzer pin is left floating during WiFi transmission bursts. Solved in firmware v2.1 via active pull-down logic and low-pass filter capacitor across speaker lines.
* **Display Flicker**: Prevents display burn-in and SPI bus contention by utilizing double-buffered sprite rendering (`M5.Lcd.pushSprite()`) updated strictly at 30 FPS.

---

## 7. System Verification & Validation

The full GeoNail system architecture has undergone extensive end-to-end integration testing:

1. **Hardware Communication**: Web Serial and BLE hardware communication modules verified at 115200 baud and 20 Hz packet rates.
2. **Orientation Accuracy**: Roll/Pitch tracking verified within ±0.2° accuracy against physical digital clinometer.
3. **Anchor Displacement Resolution**: Magnetometer displacement calculation validated from 0.0 mm to 50.0 mm with sub-millimeter precision.
4. **Digital Twin Visualization**: Smooth 60 FPS 3D canvas rendering verified across CAD, MCU, and Minefield views.

---
*Documentation compiled for GeoNail Open-Cast Mining & Subterranean Geotechnical Monitoring System (SIH 2026).*
