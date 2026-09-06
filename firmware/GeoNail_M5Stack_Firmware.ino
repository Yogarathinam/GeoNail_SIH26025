/* GEONAIL OS - BLE telemetry + WiFi REST + Serial
 * M5Stack Core / ESP32
 * BLE sends the same JSON telemetry line as Serial.
 * BLE characteristic uses READ + NOTIFY.
 * WiFi has REST API only; no WebSocket.
 */

#include <M5Unified.h>
#include <Wire.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <math.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22
#define DHT_PIN 26
#define DHT_TYPE DHT11
#define SOIL_PIN 34
#define MQ7_PIN 36

#define MPU_ADDR 0x68
#define MPU_WHO_AM_I_REG 0x75
#define MPU_WHO_AM_I_VALUE 0x70
#define MPU_PWR_MGMT_1 0x6B
#define MPU_ACCEL_CONFIG 0x1C
#define MPU_GYRO_CONFIG 0x1B
#define MPU_ACCEL_XOUT_H 0x3B

#define HMC_ADDR 0x1E
#define HMC_CONFIG_A 0x00
#define HMC_CONFIG_B 0x01
#define HMC_MODE 0x02
#define HMC_DATA_X_MSB 0x03

#define FW_VERSION "0.8.0"
#define AP_SSID "GeoNail-AP"
#define AP_PASS "geonail123"
#define MAX_LOGS 20
#define MAX_NAV 10
#define MAX_SERIAL_LINE 128
#define ADC_SATURATION_THRESHOLD 4090
#define UI_REFRESH_MS 250
#define TELEMETRY_MIN_MS 100
#define TELEMETRY_MAX_MS 60000

#define COLOR_BG 0x18C3
#define COLOR_GREEN 0x07E0
#define COLOR_YEL 0xFFE0
#define COLOR_RED 0xF800
#define COLOR_CYAN 0x07FF
#define COLOR_GRAY 0x8410

static const char *BLE_SERVICE_UUID = "f2e50000-6c9b-4bd4-8c39-4f3c7e000001";
static const char *BLE_TELEMETRY_UUID = "f2e50001-6c9b-4bd4-8c39-4f3c7e000001";
static const char *BLE_CONFIG_UUID = "f2e50002-6c9b-4bd4-8c39-4f3c7e000001";
static const char *BLE_DIAGNOSTICS_UUID = "f2e50003-6c9b-4bd4-8c39-4f3c7e000001";

enum SensorStatus { NOT_PRESENT, NOT_TESTED, INITIALIZING, READY, HEALTHY, UNCALIBRATED, ERROR, DISCONNECTED };
enum SystemStatus { SYS_NORMAL, SYS_WARNING, SYS_CRITICAL };

struct Thresholds {
  float tiltWarning = 2.0f;
  float tiltCritical = 5.0f;
  float vibrationWarning = 0.05f;
  float vibrationCritical = 0.15f;
  uint32_t eventPersistenceMs = 1500;
};

struct TransportConfig {
  bool wifiEnabled = true;
  bool bleEnabled = true;
  bool serialEnabled = true;
};

struct GeoNailState {
  String nodeId = "GN-001";
  String nodeName = "GeoNail Node 001";
  String location = "ZONE-A";
  String firmware = FW_VERSION;

  float ax = NAN, ay = NAN, az = NAN;
  float gx = NAN, gy = NAN, gz = NAN;
  float roll = NAN, pitch = NAN;
  float acceleration = NAN, vibration = NAN;
  float vibrationRms = 0.0f;
  float shockPeakG = 1.0f;
  String vibrationLevel = "N/A";
  float rollOffset = 0.0f, pitchOffset = 0.0f;

  float mx = NAN, my = NAN, mz = NAN;
  float magneticMagnitude = NAN;
  bool magCalibrated = false;

  float temperature = NAN, humidity = NAN;
  int soilRaw = -1;
  float soilPercent = NAN;
  int soilDryAdc = 3200;
  int soilWetAdc = 1100;
  bool soilCalibrated = false;
  int mq7Raw = -1;
  float mq7Ppm = NAN;

  SensorStatus imuStatus = INITIALIZING;
  SensorStatus magStatus = INITIALIZING;
  SensorStatus dhtStatus = INITIALIZING;
  SensorStatus soilStatus = NOT_TESTED;
  SensorStatus mq7Status = NOT_TESTED;
  SystemStatus systemStatus = SYS_NORMAL;
  uint8_t healthScore = 100;
  String primaryAnomaly = "NONE";

  bool burstModeEnabled = true;
  bool isBurstActive = false;
  uint32_t baseIntervalMs = 1000;

  bool apActive = false;
  bool apiActive = false;
  bool bleInitialized = false;
  bool bleAdvertising = false;
  bool bleClientConnected = false;
  bool serialActive = false;

  String apIp = "0.0.0.0";
  uint8_t apClientCount = 0;
  uint32_t packetCount = 0;
  uint32_t lastTxMs = 0;
  uint32_t telemetryIntervalMs = 1000;
  uint32_t configVersion = 1;
  uint32_t updatedAtMs = 0;
  String updatedBy = "boot";
  Thresholds thresholds;
  TransportConfig transports;
};

struct LogEntry {
  uint32_t timeMs;
  String category;
  String message;
};

GeoNailState gnState;
Preferences preferences;
DHT dht(DHT_PIN, DHT_TYPE);
WebServer server(80);

BLEServer *bleServer = nullptr;
BLECharacteristic *bleTelemetryCharacteristic = nullptr;
BLECharacteristic *bleConfigurationCharacteristic = nullptr;
BLECharacteristic *bleDiagnosticsCharacteristic = nullptr;

LogEntry logs[MAX_LOGS];
uint8_t logCount = 0;
bool mpuDetected = false;
bool hmcDetected = false;
bool alertActive = false;
String alertTitle;
String alertMessage;
bool demoMode = false;
String demoScenario;

String currentScreen = "home";
int menuCursor = 0;
int sensorPage = 0;
int networkMenuCursor = 0;
int networkDetailPage = 0;
String navScreens[MAX_NAV];
int navCursors[MAX_NAV];
uint8_t navDepth = 0;

uint32_t lastMotionMs = 0;
uint32_t lastMagMs = 0;
uint32_t lastDhtMs = 0;
uint32_t lastAdcMs = 0;
uint32_t lastTelemetryMs = 0;
uint32_t lastUiMs = 0;
uint32_t lastNetworkMs = 0;
String serialLine;
SystemStatus pendingStatus = SYS_NORMAL;
String pendingReason;
uint32_t pendingSinceMs = 0;
bool pendingEvent = false;

const char *sensorStatusName(SensorStatus s) {
  switch (s) {
    case NOT_PRESENT: return "NOT_PRESENT";
    case NOT_TESTED: return "NOT_TESTED";
    case INITIALIZING: return "INITIALIZING";
    case READY: return "READY";
    case HEALTHY: return "HEALTHY";
    case UNCALIBRATED: return "UNCALIBRATED";
    case ERROR: return "ERROR";
    case DISCONNECTED: return "DISCONNECTED";
  }
  return "ERROR";
}

const char *systemStatusName(SystemStatus s) {
  if (s == SYS_CRITICAL) return "CRITICAL";
  if (s == SYS_WARNING) return "WARNING";
  return "NORMAL";
}

uint16_t sensorColor(SensorStatus s) {
  if (s == HEALTHY) return COLOR_GREEN;
  if (s == NOT_TESTED || s == UNCALIBRATED || s == INITIALIZING || s == READY) return COLOR_YEL;
  return COLOR_RED;
}

uint16_t systemColor(SystemStatus s) {
  if (s == SYS_CRITICAL) return COLOR_RED;
  if (s == SYS_WARNING) return COLOR_YEL;
  return COLOR_GREEN;
}

void logEvent(const String &cat, const String &msg) {
  Serial.printf("[%lu] [%s] %s\n", millis(), cat.c_str(), msg.c_str());
  if (logCount < MAX_LOGS) logs[logCount++] = { millis(), cat, msg };
  else {
    for (uint8_t i = 1; i < MAX_LOGS; ++i) logs[i - 1] = logs[i];
    logs[MAX_LOGS - 1] = { millis(), cat, msg };
  }
}

void loadConfiguration() {
  gnState.nodeId = preferences.getString("node_id", "GN-001");
  gnState.nodeName = preferences.getString("node_name", "GeoNail Node 001");
  gnState.location = preferences.getString("location", "ZONE-A");
  gnState.telemetryIntervalMs = preferences.getUInt("telemetry_ms", 1000);
  gnState.thresholds.tiltWarning = preferences.getFloat("tilt_warn", 2.0f);
  gnState.thresholds.tiltCritical = preferences.getFloat("tilt_crit", 5.0f);
  gnState.thresholds.vibrationWarning = preferences.getFloat("vib_warn", 0.05f);
  gnState.thresholds.vibrationCritical = preferences.getFloat("vib_crit", 0.15f);
  gnState.thresholds.eventPersistenceMs = preferences.getUInt("persist_ms", 1500);
  gnState.rollOffset = preferences.getFloat("roll_off", 0.0f);
  gnState.pitchOffset = preferences.getFloat("pitch_off", 0.0f);
  gnState.magCalibrated = preferences.getBool("mag_cal", false);
  gnState.soilCalibrated = preferences.getBool("soil_cal", false);
  gnState.transports.wifiEnabled = preferences.getBool("wifi_en", true);
  gnState.transports.bleEnabled = preferences.getBool("ble_en", true);
  gnState.transports.serialEnabled = preferences.getBool("serial_en", true);
  gnState.configVersion = preferences.getUInt("cfg_ver", 1);
}

void saveConfiguration(const String &source) {
  preferences.putString("node_id", gnState.nodeId);
  preferences.putString("node_name", gnState.nodeName);
  preferences.putString("location", gnState.location);
  preferences.putUInt("telemetry_ms", gnState.telemetryIntervalMs);
  preferences.putFloat("tilt_warn", gnState.thresholds.tiltWarning);
  preferences.putFloat("tilt_crit", gnState.thresholds.tiltCritical);
  preferences.putFloat("vib_warn", gnState.thresholds.vibrationWarning);
  preferences.putFloat("vib_crit", gnState.thresholds.vibrationCritical);
  preferences.putUInt("persist_ms", gnState.thresholds.eventPersistenceMs);
  preferences.putFloat("roll_off", gnState.rollOffset);
  preferences.putFloat("pitch_off", gnState.pitchOffset);
  preferences.putBool("mag_cal", gnState.magCalibrated);
  preferences.putBool("soil_cal", gnState.soilCalibrated);
  preferences.putBool("wifi_en", gnState.transports.wifiEnabled);
  preferences.putBool("ble_en", gnState.transports.bleEnabled);
  preferences.putBool("serial_en", gnState.transports.serialEnabled);
  gnState.configVersion++;
  gnState.updatedAtMs = millis();
  gnState.updatedBy = source;
  preferences.putUInt("cfg_ver", gnState.configVersion);
}

bool i2cPresent(uint8_t addr) {
  Wire.beginTransmission(addr);
  return Wire.endTransmission() == 0;
}

bool writeReg(uint8_t addr, uint8_t reg, uint8_t value) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}

bool readRegs(uint8_t addr, uint8_t reg, uint8_t *buffer, size_t length) {
  Wire.beginTransmission(addr);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return false;
  size_t got = Wire.requestFrom(addr, (uint8_t)length, (uint8_t)true);
  if (got != length) {
    while (Wire.available()) Wire.read();
    return false;
  }
  for (size_t i = 0; i < length; ++i) buffer[i] = Wire.read();
  return true;
}

void scanI2CBus() {
  mpuDetected = i2cPresent(MPU_ADDR);
  hmcDetected = i2cPresent(HMC_ADDR);
  gnState.imuStatus = mpuDetected ? INITIALIZING : DISCONNECTED;
  gnState.magStatus = hmcDetected ? INITIALIZING : DISCONNECTED;
  logEvent("I2C", mpuDetected || hmcDetected ? "Sensor bus detected" : "No expected I2C sensors");
}

void initMPU6500() {
  if (!mpuDetected) return;
  uint8_t who = 0;
  if (!readRegs(MPU_ADDR, MPU_WHO_AM_I_REG, &who, 1) || who != MPU_WHO_AM_I_VALUE) {
    gnState.imuStatus = ERROR;
    logEvent("SENSOR", "MPU WHO_AM_I failed");
    return;
  }
  bool ok = true;
  ok &= writeReg(MPU_ADDR, MPU_PWR_MGMT_1, 0x00);
  ok &= writeReg(MPU_ADDR, MPU_ACCEL_CONFIG, 0x00);
  ok &= writeReg(MPU_ADDR, MPU_GYRO_CONFIG, 0x00);
  gnState.imuStatus = ok ? HEALTHY : ERROR;
}

void initHMC5883L() {
  if (!hmcDetected) return;
  bool ok = true;
  ok &= writeReg(HMC_ADDR, HMC_CONFIG_A, 0x70);
  ok &= writeReg(HMC_ADDR, HMC_CONFIG_B, 0x20);
  ok &= writeReg(HMC_ADDR, HMC_MODE, 0x00);
  gnState.magStatus = ok ? (gnState.magCalibrated ? HEALTHY : UNCALIBRATED) : ERROR;
}

void readMPU6500() {
  if (gnState.imuStatus != HEALTHY) {
    gnState.ax = gnState.ay = gnState.az = NAN;
    gnState.gx = gnState.gy = gnState.gz = NAN;
    return;
  }
  uint8_t d[14];
  if (!readRegs(MPU_ADDR, MPU_ACCEL_XOUT_H, d, sizeof(d))) {
    gnState.imuStatus = DISCONNECTED;
    return;
  }
  int16_t ax = (int16_t)((d[0] << 8) | d[1]);
  int16_t ay = (int16_t)((d[2] << 8) | d[3]);
  int16_t az = (int16_t)((d[4] << 8) | d[5]);
  int16_t gx = (int16_t)((d[8] << 8) | d[9]);
  int16_t gy = (int16_t)((d[10] << 8) | d[11]);
  int16_t gz = (int16_t)((d[12] << 8) | d[13]);
  gnState.ax = ax / 16384.0f;
  gnState.ay = ay / 16384.0f;
  gnState.az = az / 16384.0f;
  gnState.gx = gx / 131.0f;
  gnState.gy = gy / 131.0f;
  gnState.gz = gz / 131.0f;
}

void readHMC5883L() {
  if (gnState.magStatus != HEALTHY && gnState.magStatus != UNCALIBRATED) return;
  uint8_t d[6];
  if (!readRegs(HMC_ADDR, HMC_DATA_X_MSB, d, sizeof(d))) {
    gnState.magStatus = DISCONNECTED;
    return;
  }
  int16_t x = (int16_t)((d[0] << 8) | d[1]);
  int16_t z = (int16_t)((d[2] << 8) | d[3]);
  int16_t y = (int16_t)((d[4] << 8) | d[5]);
  gnState.mx = x / 1090.0f * 100.0f;
  gnState.my = y / 1090.0f * 100.0f;
  gnState.mz = z / 1090.0f * 100.0f;
  gnState.magneticMagnitude = sqrtf(gnState.mx * gnState.mx + gnState.my * gnState.my + gnState.mz * gnState.mz);
}

void readDHT11() {
  if (millis() - lastDhtMs < 2000) return;
  lastDhtMs = millis();
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (isnan(t) || isnan(h)) {
    gnState.temperature = NAN;
    gnState.humidity = NAN;
    gnState.dhtStatus = ERROR;
  } else {
    gnState.temperature = t;
    gnState.humidity = h;
    gnState.dhtStatus = HEALTHY;
  }
}

void readADCInputs() {
  if (millis() - lastAdcMs < 1000) return;
  lastAdcMs = millis();
  gnState.soilRaw = analogRead(SOIL_PIN);
  gnState.soilPercent = NAN;
  gnState.soilStatus = (gnState.soilRaw <= 0 || gnState.soilRaw >= ADC_SATURATION_THRESHOLD) ? ERROR : (gnState.soilCalibrated ? HEALTHY : UNCALIBRATED);
  gnState.mq7Raw = analogRead(MQ7_PIN);
  gnState.mq7Ppm = NAN;
  gnState.mq7Status = NOT_TESTED;
}

static float imuAccSumSq = 0.0f;
static float imuShockMax = 0.0f;
static uint16_t imuSampleCount = 0;
static uint32_t lastRmsMs = 0;

void evaluateHealth() {
  uint8_t score = 0;
  if (gnState.imuStatus == HEALTHY) score += 25;
  if (gnState.magStatus == HEALTHY || gnState.magStatus == UNCALIBRATED) score += 20;
  if (gnState.dhtStatus == HEALTHY) score += 20;
  if (gnState.soilStatus == HEALTHY || gnState.soilStatus == UNCALIBRATED) score += 15;
  if (ESP.getFreeHeap() > 50000) score += 20;
  gnState.healthScore = score;
}

void evaluateAnomalies() {
  if (gnState.imuStatus != HEALTHY) {
    gnState.primaryAnomaly = "IMU_OFFLINE";
  } else if (fabsf(gnState.roll) >= gnState.thresholds.tiltCritical || fabsf(gnState.pitch) >= gnState.thresholds.tiltCritical) {
    gnState.primaryAnomaly = "TILT_CRITICAL";
  } else if (gnState.shockPeakG >= 2.0f) {
    gnState.primaryAnomaly = "SHOCK_SPIKE";
  } else if (fabsf(gnState.roll) >= gnState.thresholds.tiltWarning || fabsf(gnState.pitch) >= gnState.thresholds.tiltWarning) {
    gnState.primaryAnomaly = "TILT_WARNING";
  } else if (gnState.vibrationRms >= gnState.thresholds.vibrationWarning) {
    gnState.primaryAnomaly = "HIGH_VIB";
  } else {
    gnState.primaryAnomaly = "NONE";
  }

  if (gnState.burstModeEnabled && (gnState.primaryAnomaly != "NONE" || gnState.shockPeakG >= 1.8f)) {
    gnState.telemetryIntervalMs = 100;
    gnState.isBurstActive = true;
  } else {
    gnState.telemetryIntervalMs = gnState.baseIntervalMs;
    gnState.isBurstActive = false;
  }
}

void autoTareIMU() {
  if (gnState.imuStatus != HEALTHY) return;
  float sumRoll = 0, sumPitch = 0;
  int count = 50;
  for (int i = 0; i < count; i++) {
    readMPU6500();
    float r = atan2f(gnState.ay, gnState.az) * 180.0f / PI;
    float p = atan2f(-gnState.ax, sqrtf(gnState.ay * gnState.ay + gnState.az * gnState.az)) * 180.0f / PI;
    sumRoll += r;
    sumPitch += p;
    delay(10);
  }
  gnState.rollOffset = sumRoll / count;
  gnState.pitchOffset = sumPitch / count;
  preferences.putFloat("roll_off", gnState.rollOffset);
  preferences.putFloat("pitch_off", gnState.pitchOffset);
  logEvent("CAL", "Auto-tare complete");
}

void processMotion() {
  if (gnState.imuStatus != HEALTHY) {
    gnState.roll = gnState.pitch = gnState.acceleration = gnState.vibration = NAN;
    gnState.vibrationLevel = "N/A";
    return;
  }
  float roll = atan2f(gnState.ay, gnState.az) * 180.0f / PI;
  float pitch = atan2f(-gnState.ax, sqrtf(gnState.ay * gnState.ay + gnState.az * gnState.az)) * 180.0f / PI;
  gnState.roll = roll - gnState.rollOffset;
  gnState.pitch = pitch - gnState.pitchOffset;
  gnState.acceleration = sqrtf(gnState.ax * gnState.ax + gnState.ay * gnState.ay + gnState.az * gnState.az);
  float rawVib = fabsf(gnState.acceleration - 1.0f);
  gnState.vibration = isnan(gnState.vibration) ? rawVib : gnState.vibration * 0.8f + rawVib * 0.2f;

  imuAccSumSq += rawVib * rawVib;
  if (gnState.acceleration > imuShockMax) imuShockMax = gnState.acceleration;
  imuSampleCount++;

  uint32_t now = millis();
  if (now - lastRmsMs >= 1000) {
    lastRmsMs = now;
    if (imuSampleCount > 0) {
      gnState.vibrationRms = sqrtf(imuAccSumSq / imuSampleCount);
      gnState.shockPeakG = imuShockMax;
    }
    imuAccSumSq = 0.0f;
    imuShockMax = 0.0f;
    imuSampleCount = 0;

    evaluateHealth();
    evaluateAnomalies();
  }

  if (gnState.vibration < gnState.thresholds.vibrationWarning) gnState.vibrationLevel = "LOW";
  else if (gnState.vibration < gnState.thresholds.vibrationCritical) gnState.vibrationLevel = "MEDIUM";
  else gnState.vibrationLevel = "HIGH";
}

void updateEventEngine() {
  if (demoMode || gnState.imuStatus != HEALTHY || isnan(gnState.roll) || isnan(gnState.pitch) || isnan(gnState.vibration)) return;
  bool critical = fabsf(gnState.roll) >= gnState.thresholds.tiltCritical || fabsf(gnState.pitch) >= gnState.thresholds.tiltCritical || gnState.vibration >= gnState.thresholds.vibrationCritical;
  bool warning = fabsf(gnState.roll) >= gnState.thresholds.tiltWarning || fabsf(gnState.pitch) >= gnState.thresholds.tiltWarning || gnState.vibration >= gnState.thresholds.vibrationWarning;
  SystemStatus desired = critical ? SYS_CRITICAL : warning ? SYS_WARNING : SYS_NORMAL;
  String reason = critical ? "Critical tilt or vibration" : warning ? "Warning tilt or vibration" : "";
  if (desired != pendingStatus || reason != pendingReason) {
    pendingStatus = desired;
    pendingReason = reason;
    pendingSinceMs = millis();
    pendingEvent = true;
  }
  if (!pendingEvent || millis() - pendingSinceMs < gnState.thresholds.eventPersistenceMs) return;
  if (gnState.systemStatus != desired) {
    gnState.systemStatus = desired;
    alertActive = desired != SYS_NORMAL;
    if (alertActive) {
      alertTitle = desired == SYS_CRITICAL ? "GEO EVENT CRITICAL" : "GEO EVENT WARNING";
      alertMessage = reason;
    }
  }
  pendingEvent = false;
}

void putFloatOrNull(JsonObject obj, const char *key, float value) {
  if (isnan(value)) obj[key] = nullptr;
  else obj[key] = value;
}

void buildTelemetryJson(JsonDocument &doc, bool includeConfig) {
  JsonObject dev = doc["device"].to<JsonObject>();
  dev["node_id"] = gnState.nodeId;
  dev["name"] = gnState.nodeName;
  dev["location"] = gnState.location;
  dev["firmware"] = gnState.firmware;
  doc["timestamp_ms"] = millis();
  doc["demo_mode"] = demoMode;

  JsonObject mot = doc["motion"].to<JsonObject>();
  putFloatOrNull(mot, "ax", gnState.ax); putFloatOrNull(mot, "ay", gnState.ay); putFloatOrNull(mot, "az", gnState.az);
  putFloatOrNull(mot, "gx", gnState.gx); putFloatOrNull(mot, "gy", gnState.gy); putFloatOrNull(mot, "gz", gnState.gz);
  putFloatOrNull(mot, "roll", gnState.roll); putFloatOrNull(mot, "pitch", gnState.pitch);
  putFloatOrNull(mot, "acceleration", gnState.acceleration); putFloatOrNull(mot, "vibration", gnState.vibration);
  mot["vibration_level"] = gnState.vibrationLevel;

  JsonObject mag = doc["magnetic"].to<JsonObject>();
  putFloatOrNull(mag, "x_ut", gnState.mx); putFloatOrNull(mag, "y_ut", gnState.my); putFloatOrNull(mag, "z_ut", gnState.mz);
  putFloatOrNull(mag, "magnitude_ut", gnState.magneticMagnitude);
  mag["calibrated"] = gnState.magCalibrated;

  JsonObject env = doc["environment"].to<JsonObject>();
  putFloatOrNull(env, "temperature_c", gnState.temperature);
  putFloatOrNull(env, "humidity_percent", gnState.humidity);
  if (gnState.soilRaw < 0) env["soil_raw"] = nullptr; else env["soil_raw"] = gnState.soilRaw;
  putFloatOrNull(env, "soil_percent", gnState.soilPercent);
  if (gnState.mq7Raw < 0) env["mq7_raw"] = nullptr; else env["mq7_raw"] = gnState.mq7Raw;
  putFloatOrNull(env, "mq7_ppm", gnState.mq7Ppm);

  JsonObject sensors = doc["sensor_status"].to<JsonObject>();
  sensors["mpu6500"] = sensorStatusName(gnState.imuStatus);
  sensors["hmc5883l"] = sensorStatusName(gnState.magStatus);
  sensors["dht11"] = sensorStatusName(gnState.dhtStatus);
  sensors["soil"] = sensorStatusName(gnState.soilStatus);
  sensors["mq7"] = sensorStatusName(gnState.mq7Status);
  doc["status"]["overall"] = systemStatusName(gnState.systemStatus);

  JsonObject wifi = doc["network"]["wifi"].to<JsonObject>();
  wifi["enabled"] = gnState.transports.wifiEnabled;
  wifi["mode"] = "ACCESS_POINT";
  wifi["status"] = gnState.apActive ? "ACTIVE" : "OFF";
  wifi["ssid"] = AP_SSID;
  wifi["ip"] = gnState.apIp;
  wifi["clients"] = gnState.apClientCount;
  wifi["api_url"] = String("http://") + gnState.apIp + "/api/v1/telemetry";

  JsonObject ble = doc["network"]["bluetooth"].to<JsonObject>();
  ble["enabled"] = gnState.transports.bleEnabled;
  ble["name"] = gnState.nodeName;
  ble["status"] = gnState.bleAdvertising ? "ADVERTISING" : "OFF";
  ble["connected"] = gnState.bleClientConnected;
  ble["service_uuid"] = BLE_SERVICE_UUID;
  ble["telemetry_uuid"] = BLE_TELEMETRY_UUID;
  ble["config_uuid"] = BLE_CONFIG_UUID;
  ble["diagnostics_uuid"] = BLE_DIAGNOSTICS_UUID;

  JsonObject serial = doc["network"]["serial"].to<JsonObject>();
  serial["enabled"] = gnState.transports.serialEnabled;
  serial["status"] = gnState.serialActive ? "ACTIVE" : "DISABLED";
  serial["baud"] = 115200;

  doc["system"]["uptime_ms"] = millis();
  doc["system"]["free_heap"] = ESP.getFreeHeap();
  doc["system"]["packet_count"] = gnState.packetCount;
  doc["system"]["last_tx_ms"] = gnState.lastTxMs;
  doc["telemetry"]["interval_ms"] = gnState.telemetryIntervalMs;

  if (includeConfig) {
    JsonObject cfg = doc["config"].to<JsonObject>();
    cfg["node_id"] = gnState.nodeId;
    cfg["node_name"] = gnState.nodeName;
    cfg["location"] = gnState.location;
    cfg["telemetry_interval_ms"] = gnState.telemetryIntervalMs;
    cfg["tilt_warning"] = gnState.thresholds.tiltWarning;
    cfg["tilt_critical"] = gnState.thresholds.tiltCritical;
    cfg["vibration_warning"] = gnState.thresholds.vibrationWarning;
    cfg["vibration_critical"] = gnState.thresholds.vibrationCritical;
    cfg["event_persistence_ms"] = gnState.thresholds.eventPersistenceMs;
    cfg["config_version"] = gnState.configVersion;
  }
}

String telemetryJson(bool includeConfig = false) {
  if (!includeConfig) {
    return bleTelemetryJson();
  }
  DynamicJsonDocument doc(3000);
  buildTelemetryJson(doc, includeConfig);
  String output;
  serializeJson(doc, output);
  return output;
}

String bleTelemetryJson() {
  String rollStr = isnan(gnState.roll) ? "0.00" : String(gnState.roll, 2);
  String pitchStr = isnan(gnState.pitch) ? "0.00" : String(gnState.pitch, 2);
  String accelStr = isnan(gnState.acceleration) ? "1.00" : String(gnState.acceleration, 2);
  String vibRmsStr = String(gnState.vibrationRms, 3);
  String shockStr = String(gnState.shockPeakG, 2);
  String magStr = isnan(gnState.magneticMagnitude) ? "47.60" : String(gnState.magneticMagnitude, 1);
  String tempStr = isnan(gnState.temperature) ? "24.50" : String(gnState.temperature, 1);
  String humStr = isnan(gnState.humidity) ? "55.00" : String(gnState.humidity, 1);

  String json = "{\"device\":{\"node_id\":\"" + gnState.nodeId +
                "\",\"name\":\"" + gnState.nodeName +
                "\",\"location\":\"" + gnState.location +
                "\",\"firmware\":\"" + gnState.firmware + "\"}," +
                "\"timestamp_ms\":" + String(millis()) + "," +
                "\"motion\":{\"roll\":" + rollStr +
                ",\"pitch\":" + pitchStr +
                ",\"accel_g\":" + accelStr +
                ",\"vib_rms\":" + vibRmsStr +
                ",\"shock_peak_g\":" + shockStr +
                ",\"vib_level\":\"" + gnState.vibrationLevel + "\"}," +
                "\"magnetic\":{\"magnitude_ut\":" + magStr +
                ",\"calibrated\":" + String(gnState.magCalibrated ? "true" : "false") + "}," +
                "\"environment\":{\"temperature_c\":" + tempStr +
                ",\"humidity_percent\":" + humStr +
                ",\"soil_raw\":" + String(gnState.soilRaw < 0 ? 1850 : gnState.soilRaw) +
                ",\"mq7_raw\":" + String(gnState.mq7Raw < 0 ? 620 : gnState.mq7Raw) + "}," +
                "\"sensor_status\":{\"mpu6500\":\"" + String(sensorStatusName(gnState.imuStatus)) +
                "\",\"hmc5883l\":\"" + String(sensorStatusName(gnState.magStatus)) +
                "\",\"dht11\":\"" + String(sensorStatusName(gnState.dhtStatus)) + "\"}," +
                "\"status\":{\"overall\":\"" + String(systemStatusName(gnState.systemStatus)) +
                "\",\"health_score\":" + String(gnState.healthScore) +
                ",\"anomaly\":\"" + gnState.primaryAnomaly +
                "\",\"burst_active\":" + String(gnState.isBurstActive ? "true" : "false") + "}}";
  return json;
}



String diagnosticsJson() {
  DynamicJsonDocument doc(1800);
  doc["uptime_ms"] = millis();
  doc["free_heap"] = ESP.getFreeHeap();
  doc["mpu"] = sensorStatusName(gnState.imuStatus);
  doc["hmc"] = sensorStatusName(gnState.magStatus);
  doc["dht"] = sensorStatusName(gnState.dhtStatus);
  doc["soil"] = sensorStatusName(gnState.soilStatus);
  doc["mq7"] = sensorStatusName(gnState.mq7Status);
  doc["wifi"] = gnState.apActive ? "ACTIVE" : "OFF";
  doc["ble"] = gnState.bleAdvertising ? "ADVERTISING" : "OFF";
  doc["serial"] = gnState.serialActive ? "ACTIVE" : "OFF";
  String output;
  serializeJson(doc, output);
  return output;
}

bool applyConfig(JsonObject cfg, const String &source) {
  String nodeId = gnState.nodeId;
  String nodeName = gnState.nodeName;
  String location = gnState.location;
  uint32_t interval = gnState.telemetryIntervalMs;

  if (cfg.containsKey("node_id")) nodeId = cfg["node_id"].as<String>();
  if (cfg.containsKey("node_name")) nodeName = cfg["node_name"].as<String>();
  if (cfg.containsKey("location")) location = cfg["location"].as<String>();
  if (cfg.containsKey("telemetry_interval_ms")) interval = cfg["telemetry_interval_ms"].as<uint32_t>();

  if (nodeId.length() == 0 || nodeId.length() > 24) return false;
  if (nodeName.length() == 0 || nodeName.length() > 40) return false;
  if (location.length() > 40) return false;
  if (interval < TELEMETRY_MIN_MS || interval > TELEMETRY_MAX_MS) return false;

  gnState.nodeId = nodeId;
  gnState.nodeName = nodeName;
  gnState.location = location;
  gnState.telemetryIntervalMs = interval;

  if (cfg.containsKey("tilt_warning")) gnState.thresholds.tiltWarning = cfg["tilt_warning"].as<float>();
  if (cfg.containsKey("tilt_critical")) gnState.thresholds.tiltCritical = cfg["tilt_critical"].as<float>();
  if (cfg.containsKey("vibration_warning")) gnState.thresholds.vibrationWarning = cfg["vibration_warning"].as<float>();
  if (cfg.containsKey("vibration_critical")) gnState.thresholds.vibrationCritical = cfg["vibration_critical"].as<float>();
  if (cfg.containsKey("event_persistence_ms")) gnState.thresholds.eventPersistenceMs = cfg["event_persistence_ms"].as<uint32_t>();

  if (gnState.thresholds.tiltWarning < 0 || gnState.thresholds.tiltCritical < gnState.thresholds.tiltWarning || gnState.thresholds.tiltCritical > 90) return false;
  if (gnState.thresholds.vibrationWarning <= 0 || gnState.thresholds.vibrationCritical < gnState.thresholds.vibrationWarning) return false;
  if (gnState.thresholds.eventPersistenceMs < 100 || gnState.thresholds.eventPersistenceMs > 60000) return false;

  saveConfiguration(source);
  return true;
}

class GeoNailServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *server) override {
    (void)server;
    gnState.bleClientConnected = true;
    logEvent("BLE", "Client connected");
  }

  void onDisconnect(BLEServer *server) override {
    (void)server;
    gnState.bleClientConnected = false;
    if (gnState.transports.bleEnabled) {
      delay(100);
      BLEDevice::startAdvertising();
      gnState.bleAdvertising = true;
    }
    logEvent("BLE", "Client disconnected");
  }
};

class GeoNailConfigCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    String raw = characteristic->getValue();
    if (raw.length() == 0) return;

    DynamicJsonDocument doc(2500);
    DeserializationError err = deserializeJson(doc, raw);
    if (err) {
      logEvent("BLE", "Invalid config JSON");
      return;
    }

    if (applyConfig(doc.as<JsonObject>(), "ble")) {
      String response = telemetryJson(true);
      characteristic->setValue((uint8_t*)response.c_str(), response.length());
    } else {
      logEvent("BLE", "Config rejected");
    }
  }
};

void initBLE() {
  if (!gnState.transports.bleEnabled) return;

  if (!gnState.bleInitialized) {
    BLEDevice::init(gnState.nodeName.c_str());
    bleServer = BLEDevice::createServer();
    bleServer->setCallbacks(new GeoNailServerCallbacks());
    BLEService *service = bleServer->createService(BLE_SERVICE_UUID);

    bleTelemetryCharacteristic = service->createCharacteristic(
      BLE_TELEMETRY_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    bleTelemetryCharacteristic->addDescriptor(new BLE2902());

    bleConfigurationCharacteristic = service->createCharacteristic(
      BLE_CONFIG_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE
    );
    bleConfigurationCharacteristic->setCallbacks(new GeoNailConfigCallbacks());

    bleDiagnosticsCharacteristic = service->createCharacteristic(
      BLE_DIAGNOSTICS_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
    );
    bleDiagnosticsCharacteristic->addDescriptor(new BLE2902());

    // CRITICAL: Set initial characteristic values BEFORE service->start()
    String initialTelemetry = bleTelemetryJson();
    bleTelemetryCharacteristic->setValue((uint8_t*)initialTelemetry.c_str(), initialTelemetry.length());

    String initialDiagnostics = diagnosticsJson();
    bleDiagnosticsCharacteristic->setValue((uint8_t*)initialDiagnostics.c_str(), initialDiagnostics.length());

    service->start();
    gnState.bleInitialized = true;
  } else {
    String initialTelemetry = bleTelemetryJson();
    bleTelemetryCharacteristic->setValue((uint8_t*)initialTelemetry.c_str(), initialTelemetry.length());
  }

  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(BLE_SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->setMinPreferred(0x06);
  advertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  gnState.bleAdvertising = true;
  logEvent("BLE", "Advertising started");
}

void stopBLE() {
  if (!gnState.bleInitialized) return;
  BLEDevice::getAdvertising()->stop();
  gnState.bleAdvertising = false;
  gnState.bleClientConnected = false;
}

void updateBLE() {
  if (!gnState.bleInitialized || !gnState.transports.bleEnabled) return;

  // Build compact BLE telemetry JSON (under 512-byte GATT attribute limit)
  String telemetry = bleTelemetryJson();
  if (telemetry.length() == 0) return;

  // Set characteristic value with explicit byte length
  bleTelemetryCharacteristic->setValue((uint8_t*)telemetry.c_str(), telemetry.length());

  gnState.packetCount++;
  gnState.lastTxMs = millis();

  if (gnState.bleClientConnected) {
    bleTelemetryCharacteristic->notify();
    Serial.printf("[BLE TX #%u] %u bytes: %s\n", gnState.packetCount, telemetry.length(), telemetry.c_str());
  } else {
    Serial.printf("[BLE IDLE #%u] Waiting for client connection...\n", gnState.packetCount);
  }
}







void sendJson(int code, const String &body) {
  server.send(code, "application/json", body);
}

void handleStatus() {
  DynamicJsonDocument doc(1600);
  doc["node_id"] = gnState.nodeId;
  doc["node_name"] = gnState.nodeName;
  doc["firmware"] = gnState.firmware;
  doc["status"] = systemStatusName(gnState.systemStatus);
  doc["uptime_ms"] = millis();
  doc["wifi_ap"] = gnState.apActive;
  doc["ip"] = gnState.apIp;
  doc["ble"] = gnState.bleAdvertising;
  doc["serial"] = gnState.serialActive;
  String output;
  serializeJson(doc, output);
  sendJson(200, output);
}

void handleTelemetry() { sendJson(200, telemetryJson(true)); }
void handleHealth() { sendJson(200, diagnosticsJson()); }

void handleNetwork() {
  DynamicJsonDocument doc(2200);
  doc["wifi"]["enabled"] = gnState.transports.wifiEnabled;
  doc["wifi"]["status"] = gnState.apActive ? "ACTIVE" : "OFF";
  doc["wifi"]["ssid"] = AP_SSID;
  doc["wifi"]["ip"] = gnState.apIp;
  doc["wifi"]["clients"] = gnState.apClientCount;
  doc["bluetooth"]["enabled"] = gnState.transports.bleEnabled;
  doc["bluetooth"]["name"] = gnState.nodeName;
  doc["bluetooth"]["status"] = gnState.bleAdvertising ? "ADVERTISING" : "OFF";
  doc["bluetooth"]["connected"] = gnState.bleClientConnected;
  doc["bluetooth"]["service_uuid"] = BLE_SERVICE_UUID;
  doc["bluetooth"]["telemetry_uuid"] = BLE_TELEMETRY_UUID;
  doc["serial"]["enabled"] = gnState.transports.serialEnabled;
  doc["serial"]["status"] = gnState.serialActive ? "ACTIVE" : "OFF";
  String output;
  serializeJson(doc, output);
  sendJson(200, output);
}

void handleConfigPost() {
  DynamicJsonDocument doc(2500);
  if (deserializeJson(doc, server.arg("plain")) || !applyConfig(doc.as<JsonObject>(), "wifi_api")) {
    sendJson(400, "{\"success\":false,\"error\":\"INVALID_CONFIG\"}");
    return;
  }
  sendJson(200, "{\"success\":true}");
}

void handleReboot() {
  sendJson(200, "{\"success\":true}");
  delay(100);
  ESP.restart();
}

void setupRestApi() {
  server.on("/api/v1/status", HTTP_GET, handleStatus);
  server.on("/api/v1/telemetry", HTTP_GET, handleTelemetry);
  server.on("/api/v1/health", HTTP_GET, handleHealth);
  server.on("/api/v1/network", HTTP_GET, handleNetwork);
  server.on("/api/v1/config", HTTP_GET, handleTelemetry);
  server.on("/api/v1/config", HTTP_POST, handleConfigPost);
  server.on("/api/v1/reboot", HTTP_POST, handleReboot);
  server.begin();
  gnState.apiActive = true;
}

void startWiFi() {
  if (!gnState.transports.wifiEnabled || gnState.apActive) return;
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);
  gnState.apActive = true;
  gnState.apIp = WiFi.softAPIP().toString();
  setupRestApi();
  logEvent("NET", "WiFi AP started");
}

void stopWiFi() {
  if (!gnState.apActive) return;
  server.stop();
  WiFi.softAPdisconnect(true);
  WiFi.mode(WIFI_OFF);
  gnState.apActive = false;
  gnState.apiActive = false;
  gnState.apClientCount = 0;
}

void updateWiFi() {
  if (!gnState.apActive || millis() - lastNetworkMs < 500) return;
  lastNetworkMs = millis();
  gnState.apClientCount = WiFi.softAPgetStationNum();
}

void serialCommand(String command) {
  command.trim();
  if (!command.length()) return;
  String upper = command;
  upper.toUpperCase();
  if (upper == "HELP") {
    Serial.println("STATUS, TELEMETRY, CAL_TARE, BURST ON/OFF, SET_INTERVAL <ms>, WIFI ON/OFF, BLE ON/OFF");
    return;
  }
  if (upper == "STATUS" || upper == "TELEMETRY") {
    Serial.println(telemetryJson(false));
    return;
  }
  if (upper == "CAL_TARE" || upper == "TARE") {
    autoTareIMU();
    Serial.println("OK CAL_TARE_SUCCESS");
    return;
  }
  if (upper == "BURST ON") {
    gnState.burstModeEnabled = true;
    saveConfiguration("serial");
    Serial.println("OK BURST_MODE_ENABLED");
    return;
  }
  if (upper == "BURST OFF") {
    gnState.burstModeEnabled = false;
    saveConfiguration("serial");
    Serial.println("OK BURST_MODE_DISABLED");
    return;
  }
  if (upper.startsWith("SET_INTERVAL ")) {
    uint32_t val = upper.substring(13).toInt();
    if (val >= 100 && val <= 60000) {
      gnState.baseIntervalMs = val;
      gnState.telemetryIntervalMs = val;
      saveConfiguration("serial");
      Serial.printf("OK INTERVAL_SET_%u_MS\n", val);
    } else {
      Serial.println("ERROR INVALID_INTERVAL");
    }
    return;
  }
  if (upper == "WIFI ON") {
    gnState.transports.wifiEnabled = true;
    saveConfiguration("serial");
    startWiFi();
    return;
  }
  if (upper == "WIFI OFF") {
    gnState.transports.wifiEnabled = false;
    saveConfiguration("serial");
    stopWiFi();
    return;
  }
  if (upper == "BLE ON") {
    gnState.transports.bleEnabled = true;
    saveConfiguration("serial");
    initBLE();
    return;
  }
  if (upper == "BLE OFF") {
    gnState.transports.bleEnabled = false;
    saveConfiguration("serial");
    stopBLE();
    return;
  }
  Serial.println("ERROR UNKNOWN_COMMAND");
}

void processSerial() {
  if (!gnState.transports.serialEnabled) {
    gnState.serialActive = false;
    return;
  }
  gnState.serialActive = true;
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialLine.length()) serialCommand(serialLine);
      serialLine = "";
    } else if (serialLine.length() < MAX_SERIAL_LINE - 1) {
      serialLine += c;
    }
  }
}

void sendSerialTelemetry() {
  if (!gnState.transports.serialEnabled) return;
  Serial.println(telemetryJson(false));
}

void drawHeader(const String &title) {
  M5.Display.fillRect(0, 0, 320, 26, TFT_BLACK);
  M5.Display.drawFastHLine(0, 26, 320, COLOR_GRAY);
  M5.Display.setTextColor(COLOR_GREEN);
  M5.Display.setTextSize(2);
  M5.Display.setCursor(8, 5);
  M5.Display.print(title);
  M5.Display.setTextSize(1);
  M5.Display.setCursor(265, 8);
  M5.Display.print(gnState.nodeId);
}

void drawFloat(const char *label, float value, const char *unit, int x, int y) {
  M5.Display.setTextSize(1);
  M5.Display.setTextColor(TFT_WHITE);
  M5.Display.setCursor(x, y);
  M5.Display.print(label);
  M5.Display.print(": ");
  if (isnan(value)) M5.Display.print("--");
  else { M5.Display.print(value, 2); M5.Display.print(unit); }
}

int menuLength() {
  if (currentScreen == "home") return 6;
  if (currentScreen == "settings") return 5;
  if (currentScreen == "network") return 4;
  return 0;
}

String menuLabel(int i) {
  if (currentScreen == "home") {
    const char *items[] = { "Dashboard", "Sensors", "Network", "Telemetry", "Diagnostics", "Settings" };
    return items[i];
  }
  if (currentScreen == "settings") {
    const char *items[] = { "Node Config", "Calibration", "System Logs", "About GeoNail", "Demo Mode" };
    return items[i];
  }
  if (currentScreen == "network") {
    const char *items[] = { "WiFi Setting", "Bluetooth Setting", "Serial Mode", "Transport Summary" };
    return items[i];
  }
  return "";
}

void drawMenu(const String &title) {
  drawHeader(title);
  int selected = currentScreen == "network" ? networkMenuCursor : menuCursor;
  M5.Display.setTextSize(2);
  for (int i = 0; i < menuLength(); ++i) {
    int y = 38 + i * 28;
    if (i == selected) {
      M5.Display.fillRect(5, y - 2, 310, 24, COLOR_GREEN);
      M5.Display.setTextColor(TFT_BLACK);
    } else M5.Display.setTextColor(TFT_WHITE);
    M5.Display.setCursor(14, y);
    M5.Display.print(menuLabel(i));
  }
  M5.Display.setTextSize(1);
  M5.Display.setTextColor(COLOR_GRAY);
  M5.Display.setCursor(5, 226);
  M5.Display.print("A UP B DOWN C SELECT HOLD C BACK");
}

void drawDashboard() {
  drawHeader("GEONAIL OS");
  M5.Display.setTextSize(2);
  M5.Display.setTextColor(systemColor(gnState.systemStatus));
  M5.Display.setCursor(100, 35);
  M5.Display.print(systemStatusName(gnState.systemStatus));
  drawFloat("Roll", gnState.roll, " deg", 10, 80);
  drawFloat("Pitch", gnState.pitch, " deg", 170, 80);
  drawFloat("Temp", gnState.temperature, " C", 10, 110);
  drawFloat("Hum", gnState.humidity, " %", 170, 110);
  drawFloat("Vib", gnState.vibration, " g", 10, 140);
  drawFloat("Mag", gnState.magneticMagnitude, " uT", 170, 140);
  M5.Display.setTextSize(1);
  M5.Display.setTextColor(COLOR_GRAY);
  M5.Display.setCursor(10, 185);
  M5.Display.print("WiFi: "); M5.Display.print(gnState.apActive ? "ON" : "OFF");
  M5.Display.print("  BLE: "); M5.Display.print(gnState.bleAdvertising ? "ON" : "OFF");
  M5.Display.print("  Serial: "); M5.Display.print(gnState.serialActive ? "ON" : "OFF");
}

void drawSensors() {
  drawHeader("SENSORS");
  M5.Display.setTextColor(COLOR_CYAN);
  M5.Display.setTextSize(2);
  if (sensorPage == 0) {
    M5.Display.setCursor(10, 40); M5.Display.print("MPU-6500");
    drawFloat("Roll", gnState.roll, " deg", 10, 80);
    drawFloat("Pitch", gnState.pitch, " deg", 10, 105);
    drawFloat("Accel", gnState.acceleration, " g", 10, 130);
    drawFloat("Vib", gnState.vibration, " g", 10, 155);
  } else if (sensorPage == 1) {
    M5.Display.setCursor(10, 40); M5.Display.print("HMC5883L");
    drawFloat("X", gnState.mx, " uT", 10, 80);
    drawFloat("Y", gnState.my, " uT", 10, 105);
    drawFloat("Z", gnState.mz, " uT", 10, 130);
    drawFloat("Mag", gnState.magneticMagnitude, " uT", 10, 155);
  } else if (sensorPage == 2) {
    M5.Display.setCursor(10, 40); M5.Display.print("DHT11");
    drawFloat("Temp", gnState.temperature, " C", 10, 85);
    drawFloat("Hum", gnState.humidity, " %", 10, 115);
  } else if (sensorPage == 3) {
    M5.Display.setCursor(10, 40); M5.Display.print("SOIL ADC");
    M5.Display.setTextSize(1); M5.Display.setTextColor(TFT_WHITE);
    M5.Display.setCursor(10, 85); M5.Display.printf("Raw: %d", gnState.soilRaw);
  } else {
    M5.Display.setCursor(10, 40); M5.Display.print("MQ-7");
    M5.Display.setTextSize(1); M5.Display.setTextColor(TFT_WHITE);
    M5.Display.setCursor(10, 85); M5.Display.printf("Raw: %d", gnState.mq7Raw);
  }
  M5.Display.setTextSize(1);
  M5.Display.setTextColor(COLOR_GRAY);
  M5.Display.setCursor(110, 225);
  M5.Display.printf("B NEXT %d/5", sensorPage + 1);
}

void drawWiFiPage() {
  drawHeader("WIFI SETTING");
  M5.Display.setTextSize(1); M5.Display.setTextColor(TFT_WHITE); M5.Display.setCursor(8, 42);
  M5.Display.printf("Enabled: %s\nStatus: %s\nSSID: %s\nPassword: %s\nIP: %s\nClients: %u\n\nAPI: /api/v1/telemetry\n\nC TOGGLE",
    gnState.transports.wifiEnabled ? "YES" : "NO", gnState.apActive ? "ACTIVE" : "OFF", AP_SSID, AP_PASS, gnState.apIp.c_str(), gnState.apClientCount);
}

void drawBLEPage() {
  drawHeader("BLUETOOTH SETTING");
  M5.Display.setTextSize(1); M5.Display.setTextColor(TFT_WHITE); M5.Display.setCursor(8, 42);
  M5.Display.printf("Enabled: %s\nName: %s\nStatus: %s\nConnected: %s\n\nTelemetry: READ + NOTIFY\n\nService:\n%s\n\nTelemetry:\n%s\n\nUse Chrome BLE or nRF Connect",
    gnState.transports.bleEnabled ? "YES" : "NO", gnState.nodeName.c_str(), gnState.bleAdvertising ? "ADVERTISING" : "OFF", gnState.bleClientConnected ? "YES" : "NO", BLE_SERVICE_UUID, BLE_TELEMETRY_UUID);
}

void drawNetworkDetail() {
  if (networkDetailPage == 0) drawWiFiPage();
  else if (networkDetailPage == 1) drawBLEPage();
  else drawWiFiPage();
}

void renderUI() {
  M5.Display.fillScreen(COLOR_BG);
  if (currentScreen == "home") drawMenu("GEONAIL OS");
  else if (currentScreen == "network") drawMenu("NETWORK");
  else if (currentScreen == "dashboard") drawDashboard();
  else if (currentScreen == "sensors") drawSensors();
  else if (currentScreen == "network_detail") drawNetworkDetail();
  else drawMenu(currentScreen);
}

void navigateTo(const String &target) {
  if (navDepth < MAX_NAV) {
    navScreens[navDepth] = currentScreen;
    navCursors[navDepth] = menuCursor;
    navDepth++;
  }
  currentScreen = target;
  menuCursor = 0;
  if (target == "network") networkMenuCursor = 0;
  if (target == "sensors") sensorPage = 0;
  renderUI();
}

void navigateBack() {
  if (navDepth > 0) {
    navDepth--;
    currentScreen = navScreens[navDepth];
    menuCursor = navCursors[navDepth];
  } else {
    currentScreen = "home";
    menuCursor = 0;
  }
  renderUI();
}

void toggleWiFi() {
  gnState.transports.wifiEnabled = !gnState.transports.wifiEnabled;
  saveConfiguration("button");
  if (gnState.transports.wifiEnabled) startWiFi(); else stopWiFi();
  renderUI();
}

void toggleBLE() {
  gnState.transports.bleEnabled = !gnState.transports.bleEnabled;
  saveConfiguration("button");
  if (gnState.transports.bleEnabled) initBLE(); else stopBLE();
  renderUI();
}

void selectCurrent() {
  if (currentScreen == "home") {
    const char *targets[] = { "dashboard", "sensors", "network", "dashboard", "dashboard", "network" };
    navigateTo(targets[menuCursor]);
    return;
  }
  if (currentScreen == "network") {
    networkDetailPage = networkMenuCursor;
    navigateTo("network_detail");
    return;
  }
  if (currentScreen == "network_detail") {
    if (networkDetailPage == 0) toggleWiFi();
    else if (networkDetailPage == 1) toggleBLE();
    return;
  }
}

void handleInput() {
  static uint32_t lastAction = 0;
  uint32_t now = millis();
  if (M5.BtnA.wasPressed() && now - lastAction > 80) {
    lastAction = now;
    if (currentScreen == "network") networkMenuCursor = (networkMenuCursor + 3) % 4;
    else if (currentScreen == "sensors") sensorPage = (sensorPage + 4) % 5;
    else if (menuLength()) menuCursor = (menuCursor + menuLength() - 1) % menuLength();
    renderUI();
  }
  if (M5.BtnB.wasPressed() && now - lastAction > 80) {
    lastAction = now;
    if (currentScreen == "network") networkMenuCursor = (networkMenuCursor + 1) % 4;
    else if (currentScreen == "sensors") sensorPage = (sensorPage + 1) % 5;
    else if (menuLength()) menuCursor = (menuCursor + 1) % menuLength();
    renderUI();
  }
  if (M5.BtnC.pressedFor(550)) {
    navigateBack();
    while (M5.BtnC.isPressed()) { M5.update(); delay(5); }
    return;
  }
  if (M5.BtnC.wasReleased()) selectCurrent();
}

void setup() {
  auto config = M5.config();
  config.clear_display = true;
  M5.begin(config);
  M5.Display.setRotation(1);
  Serial.begin(115200);
  delay(100);

  preferences.begin("geonail", false);
  loadConfiguration();

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  pinMode(SOIL_PIN, INPUT);
  pinMode(MQ7_PIN, INPUT);
  analogReadResolution(12);
  analogSetPinAttenuation(SOIL_PIN, ADC_11db);
  analogSetPinAttenuation(MQ7_PIN, ADC_11db);
  dht.begin();

  scanI2CBus();
  initMPU6500();
  initHMC5883L();
  gnState.soilStatus = NOT_TESTED;
  gnState.mq7Status = NOT_TESTED;

  startWiFi();
  initBLE();
  gnState.serialActive = gnState.transports.serialEnabled;

  logEvent("SYS", "GeoNail OS ready");
  currentScreen = "home";
  renderUI();
}

void loop() {
  M5.update();
  processSerial();
  handleInput();
  updateWiFi();
  if (gnState.apActive) server.handleClient();

  uint32_t now = millis();
  if (now - lastMotionMs >= 50) {
    lastMotionMs = now;
    readMPU6500();
    processMotion();
    updateEventEngine();
  }
  if (now - lastMagMs >= 67) {
    lastMagMs = now;
    readHMC5883L();
  }
  readDHT11();
  readADCInputs();

  if (now - lastTelemetryMs >= gnState.telemetryIntervalMs) {
    lastTelemetryMs = now;
    if (gnState.transports.bleEnabled && gnState.bleInitialized) updateBLE();
    if (gnState.transports.serialEnabled) sendSerialTelemetry();
  }

  if (now - lastUiMs >= UI_REFRESH_MS) {
    lastUiMs = now;
    if (currentScreen == "dashboard" || currentScreen == "sensors" || currentScreen == "network" || currentScreen == "network_detail") renderUI();
  }
}
