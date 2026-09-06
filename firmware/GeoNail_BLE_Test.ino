/*
 * GEONAIL OS - Minimal Standalone BLE Test Firmware (ESP32 / M5Stack)
 * Target: Verify Web Bluetooth (BLE GATT) notification payload reception with debug dashboard
 */

#include <M5Unified.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define BLE_SERVICE_UUID        "f2e50000-6c9b-4bd4-8c39-4f3c7e000001"
#define BLE_TELEMETRY_UUID      "f2e50001-6c9b-4bd4-8c39-4f3c7e000001"

BLEServer* pServer = NULL;
BLECharacteristic* pTelemetryChar = NULL;
bool deviceConnected = false;
uint32_t packetCount = 0;

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
    Serial.println("[BLE] Client Connected!");
  }

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    Serial.println("[BLE] Client Disconnected! Restarting Advertising...");
    delay(100);
    BLEDevice::startAdvertising();
  }
};

void setup() {
  auto config = M5.config();
  M5.begin(config);
  Serial.begin(115200);
  delay(500);

  Serial.println("==========================================");
  Serial.println("   GEONAIL BLE TEST FIRMWARE STARTING     ");
  Serial.println("==========================================");

  // 1. Initialize BLE Device
  BLEDevice::init("GeoNail Node 001");

  // 2. Create BLE Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  // 3. Create BLE Service
  BLEService *pService = pServer->createService(BLE_SERVICE_UUID);

  // 4. Create Telemetry Characteristic (READ + NOTIFY)
  pTelemetryChar = pService->createCharacteristic(
                      BLE_TELEMETRY_UUID,
                      BLECharacteristic::PROPERTY_READ |
                      BLECharacteristic::PROPERTY_NOTIFY
                    );

  // 5. Add 2902 Descriptor for Notifications
  pTelemetryChar->addDescriptor(new BLE2902());

  // 6. Set Initial Value BEFORE starting service
  String initPayload = "{\"device\":{\"node_id\":\"GN-TEST\",\"name\":\"GeoNail Node 001\"},\"motion\":{\"roll\":0.0,\"pitch\":0.0,\"vibration\":0.02,\"vibration_level\":\"LOW\"},\"status\":{\"overall\":\"NORMAL\"}}";
  pTelemetryChar->setValue(initPayload.c_str());

  // 7. Start Service
  pService->start();

  // 8. Start Advertising
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(BLE_SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();

  Serial.println("[BLE] Advertising started as 'GeoNail Node 001'");
}

void loop() {
  M5.update();
  static uint32_t lastTx = 0;
  if (millis() - lastTx >= 1000) {
    lastTx = millis();
    packetCount++;

    // Generate test JSON payload
    float roll = sin(millis() / 1000.0) * 5.0;
    float pitch = cos(millis() / 1000.0) * 3.0;

    String json = "{\"device\":{\"node_id\":\"GN-TEST\",\"name\":\"GeoNail Node 001\",\"firmware\":\"0.7.1-TEST\"},\"timestamp_ms\":" + String(millis()) +
                  ",\"motion\":{\"roll\":" + String(roll, 2) + ",\"pitch\":" + String(pitch, 2) + ",\"acceleration\":1.02,\"vibration\":0.02,\"vibration_level\":\"LOW\"}" +
                  ",\"magnetic\":{\"magnitude_ut\":47.6,\"calibrated\":true}" +
                  ",\"environment\":{\"temperature_c\":24.5,\"humidity_percent\":55.0}" +
                  ",\"sensor_status\":{\"mpu6500\":\"HEALTHY\",\"hmc5883l\":\"HEALTHY\",\"dht11\":\"HEALTHY\"}" +
                  ",\"status\":{\"overall\":\"NORMAL\"}" +
                  ",\"system\":{\"uptime_ms\":" + String(millis()) + ",\"packet_count\":" + String(packetCount) + "}}";

    // Set value and notify
    pTelemetryChar->setValue(json.c_str());
    if (deviceConnected) {
      pTelemetryChar->notify();
      Serial.printf("[BLE TX #%u] %u bytes: %s\n", packetCount, json.length(), json.c_str());
    } else {
      Serial.printf("[BLE IDLE #%u] Waiting for client connection...\n", packetCount);
    }
  }
}
