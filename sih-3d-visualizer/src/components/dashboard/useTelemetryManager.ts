import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  ConnectionSource,
  ConnectionState,
  TelemetrySample,
  ExperimentalThresholds,
  IncidentAlertLog,
} from './types';

const BLE_SERVICE_UUID = 'f2e50000-6c9b-4bd4-8c39-4f3c7e000001';
const BLE_TELEMETRY_UUID = 'f2e50001-6c9b-4bd4-8c39-4f3c7e000001';
const MAX_HISTORY_SAMPLES = 300;
const STALE_TIMEOUT_MS = 4500;

function createDefaultSample(): TelemetrySample {
  const now = Date.now();
  return {
    id: String(now),
    timestamp: now,
    formattedTime: new Date(now).toLocaleTimeString(),
    nodeId: 'GN-001',
    nodeName: 'GeoNail Anchor 001',
    location: 'Zone A - Slope Face',
    firmware: '0.8.0-RELEASE',
    roll: 0.2,
    pitch: -0.1,
    yaw: 0.0,
    ax: 0.01,
    ay: -0.01,
    az: 1.0,
    accel: 1.0,
    vibrationRms: 0.018,
    shockPeakG: 1.02,
    vibrationLevel: 'LOW',
    magneticUt: 46.2,
    magneticCalibrated: true,
    displacementMm: 3.99, // (47.60 - 46.2) * 2.85
    temperatureC: 23.8,
    humidityPercent: 54.0,
    soilRaw: 1820,
    soilPercent: 43.2,
    mq7Raw: 580,
    mq7Ppm: 11.2,
    mpuStatus: 'HEALTHY',
    hmcStatus: 'HEALTHY',
    dhtStatus: 'HEALTHY',
    soilStatus: 'HEALTHY',
    mq7Status: 'HEALTHY',
    overallStatus: 'NORMAL',
    healthScore: 100,
    anomaly: 'NONE',
    isBurst: false,
    uptimeMs: 142000,
    freeHeap: 186400,
    packetCount: 1,
    transportSource: 'simulated',
  };
}

export function useTelemetryManager() {
  const [connectionSource, setConnectionSourceState] = useState<ConnectionSource>('simulated');
  const [connectionState, setConnectionState] = useState<ConnectionState>('connected');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastReceivedTimestamp, setLastReceivedTimestamp] = useState<number>(Date.now());

  const [currentSample, setCurrentSample] = useState<TelemetrySample>(createDefaultSample);
  const [history, setHistory] = useState<TelemetrySample[]>([createDefaultSample()]);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const [thresholds, setThresholds] = useState<ExperimentalThresholds>({
    tiltWarning: 2.0,
    tiltCritical: 5.0,
    vibrationWarning: 0.05,
    vibrationCritical: 0.15,
    displacementWarning: 5.0,
    displacementCritical: 15.0,
    mq7WarningPpm: 25.0,
    cooldownSeconds: 60,
    emailAlertsEnabled: true,
    recipientEmail: '23104177@rmd.ac.in',
  });

  const [alertLogs, setAlertLogs] = useState<IncidentAlertLog[]>([]);

  // Internal connection refs to ensure clean teardown
  const bleDeviceRef = useRef<any>(null);
  const bleCharRef = useRef<any>(null);
  const bleBufferRef = useRef<string>('');

  const serialPortRef = useRef<any>(null);
  const serialReaderRef = useRef<any>(null);
  const serialAbortControllerRef = useRef<AbortController | null>(null);

  const pollIntervalRef = useRef<any>(null);
  const simIntervalRef = useRef<any>(null);
  const staleTimerRef = useRef<any>(null);

  const lastAlertSentTimeRef = useRef<number>(0);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const thresholdsRef = useRef(thresholds);
  thresholdsRef.current = thresholds;

  // Stale detection
  useEffect(() => {
    staleTimerRef.current = setInterval(() => {
      if (connectionState === 'connected' && connectionSource !== 'simulated') {
        const diff = Date.now() - lastReceivedTimestamp;
        if (diff > STALE_TIMEOUT_MS) {
          setConnectionState('stale');
        }
      }
    }, 2000);
    return () => clearInterval(staleTimerRef.current);
  }, [connectionState, connectionSource, lastReceivedTimestamp]);

  // Alert evaluator
  const evaluateAlertConditions = useCallback(
    async (sample: TelemetrySample) => {
      const th = thresholdsRef.current;
      const now = Date.now();
      const cooldownMs = (th.cooldownSeconds || 60) * 1000;

      let severity: 'CRITICAL' | 'WARNING' | null = null;
      let alertType = '';
      let reason = '';

      if (Math.abs(sample.roll) >= th.tiltCritical || Math.abs(sample.pitch) >= th.tiltCritical) {
        severity = 'CRITICAL';
        alertType = 'TILT_CRITICAL';
        reason = `Subsurface anchor tilt exceeded critical threshold (${Math.max(Math.abs(sample.roll), Math.abs(sample.pitch)).toFixed(1)}° >= ${th.tiltCritical}°).`;
      } else if (sample.vibrationRms >= th.vibrationCritical) {
        severity = 'CRITICAL';
        alertType = 'VIBRATION_CRITICAL';
        reason = `High dynamic vibration RMS detected (${sample.vibrationRms.toFixed(3)}g >= ${th.vibrationCritical}g). Possible rockburst or drilling impact.`;
      } else if (sample.displacementMm >= th.displacementCritical) {
        severity = 'CRITICAL';
        alertType = 'DISPLACEMENT_CRITICAL';
        reason = `Subterranean anchor linear displacement exceeded critical threshold (${sample.displacementMm.toFixed(2)}mm >= ${th.displacementCritical}mm). Ground subsidence event.`;
      } else if (Math.abs(sample.roll) >= th.tiltWarning || Math.abs(sample.pitch) >= th.tiltWarning) {
        severity = 'WARNING';
        alertType = 'TILT_WARNING';
        reason = `Anchor tilt exceeded cautionary warning threshold (${Math.max(Math.abs(sample.roll), Math.abs(sample.pitch)).toFixed(1)}° >= ${th.tiltWarning}°).`;
      } else if (sample.vibrationRms >= th.vibrationWarning) {
        severity = 'WARNING';
        alertType = 'VIBRATION_WARNING';
        reason = `Elevated vibration detected (${sample.vibrationRms.toFixed(3)}g >= ${th.vibrationWarning}g).`;
      } else if (sample.displacementMm >= th.displacementWarning) {
        severity = 'WARNING';
        alertType = 'DISPLACEMENT_WARNING';
        reason = `Moderate anchor linear displacement observed (${sample.displacementMm.toFixed(2)}mm >= ${th.displacementWarning}mm).`;
      } else if (sample.mq7Ppm >= th.mq7WarningPpm) {
        severity = 'WARNING';
        alertType = 'GAS_CO_WARNING';
        reason = `Subterranean Carbon Monoxide gas concentration elevated (${sample.mq7Ppm.toFixed(1)} PPM >= ${th.mq7WarningPpm} PPM).`;
      }

      if (!severity) return;

      // Rate limit / cooldown
      if (now - lastAlertSentTimeRef.current < cooldownMs) {
        return;
      }
      lastAlertSentTimeRef.current = now;

      const newAlert: IncidentAlertLog = {
        id: `alert-${now}`,
        timestamp: now,
        formattedTime: new Date(now).toLocaleTimeString(),
        severity,
        alertType,
        reason,
        metricSnapshot: {
          roll: sample.roll,
          pitch: sample.pitch,
          vibrationRms: sample.vibrationRms,
          shockPeakG: sample.shockPeakG,
          displacementMm: sample.displacementMm,
          temperatureC: sample.temperatureC,
        },
        deliveryStatus: th.emailAlertsEnabled && th.recipientEmail ? 'PENDING' : 'SIMULATED',
      };

      setAlertLogs((prev) => [newAlert, ...prev.slice(0, 49)]);

      if (th.emailAlertsEnabled && th.recipientEmail) {
        try {
          const res = await fetch('/api/alert/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: th.recipientEmail,
              subject: `[${severity}] GeoNail ${sample.nodeId}: ${alertType}`,
              severity,
              alertType,
              nodeId: sample.nodeId,
              location: sample.location,
              reason,
              telemetry: {
                roll: sample.roll,
                pitch: sample.pitch,
                vibrationRms: sample.vibrationRms,
                shockPeakG: sample.shockPeakG,
                displacementMm: sample.displacementMm,
                temperatureC: sample.temperatureC,
                humidityPercent: sample.humidityPercent,
                soilPercent: sample.soilPercent,
                mq7Ppm: sample.mq7Ppm,
                overallStatus: sample.overallStatus,
              },
              healthScore: sample.healthScore,
              timestamp: now,
            }),
          });

          const data = await res.json();
          setAlertLogs((prev) =>
            prev.map((a) =>
              a.id === newAlert.id
                ? {
                    ...a,
                    deliveryStatus: data.success ? 'SENT' : 'FAILED',
                    messageId: data.messageId,
                    errorMessage: data.error,
                  }
                : a
            )
          );
        } catch (e: any) {
          setAlertLogs((prev) =>
            prev.map((a) =>
              a.id === newAlert.id
                ? {
                    ...a,
                    deliveryStatus: 'FAILED',
                    errorMessage: e.message || 'Network dispatch error',
                  }
                : a
            )
          );
        }
      }
    },
    []
  );

  // Ingest parsed telemetry payload from any transport
  const ingestRawPacket = useCallback(
    (rawJson: string, source: ConnectionSource) => {
      try {
        const data = JSON.parse(rawJson);
        const now = Date.now();
        setLastReceivedTimestamp(now);
        setConnectionState('connected');
        setErrorMessage(null);

        const m = data.motion || {};
        const mag = data.magnetic || {};
        const env = data.environment || {};
        const sen = data.sensor_status || {};
        const dev = data.device || {};
        const st = data.status || {};
        const sys = data.system || {};

        // Derived Subterranean Soil Displacement: Baseline = 47.60 uT
        const magUt = Number(mag.mag_ut ?? mag.magnitude_ut ?? 46.2);
        const magneticDelta = Math.max(0, 47.60 - magUt);
        const displacementMm = Number((magneticDelta * 2.85).toFixed(2));

        const rollVal = Number(m.roll ?? 0);
        const pitchVal = Number(m.pitch ?? 0);
        const vibRmsVal = Number(m.vib_rms ?? m.vibration ?? 0.02);
        const shockVal = Number(m.shock ?? m.shock_peak_g ?? 1.02);

        const sample: TelemetrySample = {
          id: String(now),
          timestamp: now,
          formattedTime: new Date(now).toLocaleTimeString(),
          nodeId: dev.node_id || 'GN-001',
          nodeName: dev.name || 'GeoNail Anchor 001',
          location: dev.location || 'Zone A - Slope Face',
          firmware: dev.firmware || '0.8.0-RELEASE',

          roll: rollVal,
          pitch: pitchVal,
          yaw: Number(m.gz ?? 0),
          ax: Number(m.ax ?? 0),
          ay: Number(m.ay ?? 0),
          az: Number(m.az ?? 1),
          accel: Number(m.accel ?? m.acceleration ?? 1.0),
          vibrationRms: vibRmsVal,
          shockPeakG: shockVal,
          vibrationLevel: (m.vib_lvl || m.vibration_level || (vibRmsVal > 0.15 ? 'HIGH' : vibRmsVal > 0.05 ? 'MEDIUM' : 'LOW')) as any,

          magneticUt: magUt,
          magneticCalibrated: Boolean(mag.cal ?? mag.calibrated ?? true),
          displacementMm,

          temperatureC: Number(env.temp_c ?? env.temperature_c ?? 24.0),
          humidityPercent: Number(env.hum_pct ?? env.humidity_percent ?? 52.0),
          soilRaw: Number(env.soil_raw ?? 1800),
          soilPercent: Number(env.soil_percent ?? (env.soil_raw ? Math.max(0, Math.min(100, ((3200 - env.soil_raw) / 2100) * 100)) : 42)),
          mq7Raw: Number(env.mq7_raw ?? 600),
          mq7Ppm: Number(env.mq7_ppm ?? (env.mq7_raw ? (env.mq7_raw / 1024) * 20 : 12.0)),

          mpuStatus: sen.mpu || sen.mpu6500 || 'HEALTHY',
          hmcStatus: sen.hmc || sen.hmc5883l || 'HEALTHY',
          dhtStatus: sen.dht || sen.dht11 || 'HEALTHY',
          soilStatus: sen.soil || 'HEALTHY',
          mq7Status: sen.mq7 || 'HEALTHY',

          overallStatus: (st.overall || 'NORMAL') as any,
          healthScore: Number(st.health ?? st.health_score ?? 100),
          anomaly: st.anomaly || 'NONE',
          isBurst: Boolean(st.burst),

          uptimeMs: Number(sys.uptime_ms ?? (data.timestamp_ms || 120000)),
          freeHeap: Number(sys.free_heap ?? 184000),
          packetCount: Number(sys.packet_count ?? 1),

          rawJson,
          transportSource: source,
        };

        if (!isPausedRef.current) {
          setCurrentSample(sample);
          setHistory((prev) => [...prev.slice(-(MAX_HISTORY_SAMPLES - 1)), sample]);
        }

        evaluateAlertConditions(sample);
        return true;
      } catch (err: any) {
        return false;
      }
    },
    [evaluateAlertConditions]
  );

  // Teardown any running connection
  const cleanupCurrentConnection = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }

    // BLE disconnect
    if (bleCharRef.current) {
      try {
        bleCharRef.current.removeEventListener('characteristicvaluechanged', () => {});
      } catch {}
      bleCharRef.current = null;
    }
    if (bleDeviceRef.current && bleDeviceRef.current.gatt && bleDeviceRef.current.gatt.connected) {
      try {
        bleDeviceRef.current.gatt.disconnect();
      } catch {}
      bleDeviceRef.current = null;
    }

    // Serial disconnect
    if (serialAbortControllerRef.current) {
      serialAbortControllerRef.current.abort();
      serialAbortControllerRef.current = null;
    }
    if (serialReaderRef.current) {
      try {
        serialReaderRef.current.cancel();
      } catch {}
      serialReaderRef.current = null;
    }
    if (serialPortRef.current) {
      try {
        serialPortRef.current.close();
      } catch {}
      serialPortRef.current = null;
    }
  }, []);

  // Connect BLE
  const connectBluetooth = useCallback(async () => {
    if (!('bluetooth' in navigator)) {
      setConnectionState('error');
      setErrorMessage('Web Bluetooth API is not supported in this browser. Please use Chrome or Edge.');
      return false;
    }

    cleanupCurrentConnection();
    setConnectionState('connecting');
    setErrorMessage(null);

    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ namePrefix: 'GeoNail' }],
        optionalServices: [BLE_SERVICE_UUID],
      });

      bleDeviceRef.current = device;
      device.addEventListener('gattserverdisconnected', () => {
        setConnectionState('disconnected');
        setErrorMessage('Bluetooth connection terminated by device.');
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(BLE_TELEMETRY_UUID);
      bleCharRef.current = characteristic;

      await characteristic.startNotifications();
      bleBufferRef.current = '';

      characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        const decoder = new TextDecoder('utf-8');
        const chunk = decoder.decode(value);

        bleBufferRef.current += chunk;
        const buffer = bleBufferRef.current.trim();

        if (buffer.startsWith('{') && buffer.endsWith('}')) {
          if (ingestRawPacket(buffer, 'ble')) {
            bleBufferRef.current = '';
          }
        } else if (buffer.includes('{') && buffer.includes('}')) {
          const start = buffer.indexOf('{');
          const end = buffer.lastIndexOf('}');
          if (end > start) {
            const candidate = buffer.substring(start, end + 1);
            if (ingestRawPacket(candidate, 'ble')) {
              bleBufferRef.current = buffer.substring(end + 1);
            }
          }
        }
      });

      setConnectionState('connected');
      setConnectionSourceState('ble');
      return true;
    } catch (err: any) {
      setConnectionState('disconnected');
      setErrorMessage(err.message || 'Failed to establish Web Bluetooth connection.');
      return false;
    }
  }, [cleanupCurrentConnection, ingestRawPacket]);

  // Connect Serial
  const connectSerial = useCallback(async () => {
    if (!('serial' in navigator)) {
      setConnectionState('error');
      setErrorMessage('Web Serial API is not supported in this browser. Please use Chrome or Edge.');
      return false;
    }

    cleanupCurrentConnection();
    setConnectionState('connecting');
    setErrorMessage(null);

    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      serialPortRef.current = port;

      setConnectionState('connected');
      setConnectionSourceState('serial');

      const textDecoder = new (window as any).TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      serialReaderRef.current = reader;

      (async () => {
        let lineBuffer = '';
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            lineBuffer += value;
            const lines = lineBuffer.split(/\r?\n/);
            lineBuffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
                ingestRawPacket(trimmed, 'serial');
              }
            }
          }
        } catch (e: any) {
          // Port closed or read cancelled
        } finally {
          reader.releaseLock();
        }
      })();

      return true;
    } catch (err: any) {
      setConnectionState('disconnected');
      setErrorMessage(err.message || 'Web Serial port access cancelled or failed.');
      return false;
    }
  }, [cleanupCurrentConnection, ingestRawPacket]);

  // Connect Wi-Fi REST
  const connectWifiRest = useCallback(
    (mcuIp = '192.168.4.1') => {
      cleanupCurrentConnection();
      setConnectionState('connecting');
      setErrorMessage(null);
      setConnectionSourceState('wifi');

      const fetchEndpoint = async () => {
        try {
          const res = await fetch(`http://${mcuIp}/api/v1/telemetry`, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(2000),
          });
          if (res.ok) {
            const raw = await res.text();
            ingestRawPacket(raw, 'wifi');
          } else {
            setConnectionState('disconnected');
            setErrorMessage(`MCU HTTP error: ${res.status} ${res.statusText}`);
          }
        } catch (err: any) {
          setConnectionState('disconnected');
          setErrorMessage(`Wi-Fi REST unreachable at http://${mcuIp}. Ensure connection to 'GeoNail-AP'.`);
        }
      };

      fetchEndpoint();
      pollIntervalRef.current = setInterval(fetchEndpoint, 1000);
    },
    [cleanupCurrentConnection, ingestRawPacket]
  );

  // Simulated Telemetry Stream
  const startSimulated = useCallback(() => {
    cleanupCurrentConnection();
    setConnectionState('connected');
    setErrorMessage(null);
    setConnectionSourceState('simulated');

    let simIndex = 0;
    simIntervalRef.current = setInterval(() => {
      simIndex++;
      const now = Date.now();
      const wave = Math.sin(simIndex * 0.15);
      const noise = (Math.random() - 0.5) * 0.08;

      const roll = Number((wave * 0.9 + noise).toFixed(2));
      const pitch = Number((Math.cos(simIndex * 0.12) * 0.7 + noise).toFixed(2));
      const vibRms = Number((0.02 + Math.abs(Math.sin(simIndex * 0.3)) * 0.015).toFixed(3));
      const shockPeak = Number((1.01 + vibRms * 1.5).toFixed(2));

      // Magnetic flux around 45.8 - 46.8 uT
      const magUt = Number((46.5 - Math.sin(simIndex * 0.08) * 0.8).toFixed(1));

      const payload = {
        device: {
          node_id: 'GN-001',
          name: 'GeoNail Anchor 001',
          location: 'Zone A - Slope Face',
          firmware: '0.8.0-RELEASE',
        },
        timestamp_ms: now,
        motion: {
          roll,
          pitch,
          accel: 1.0,
          vib_rms: vibRms,
          shock: shockPeak,
          vib_lvl: 'LOW',
        },
        magnetic: {
          mag_ut: magUt,
          cal: true,
        },
        environment: {
          temp_c: Number((24.2 + wave * 0.3).toFixed(1)),
          hum_pct: Number((54.0 + Math.cos(simIndex * 0.1) * 2.0).toFixed(0)),
          soil_raw: 1810,
          mq7_raw: 590,
        },
        sensor_status: {
          mpu: 'OK',
          hmc: 'OK',
          dht: 'OK',
        },
        status: {
          overall: 'NORMAL',
          health: 100,
          anomaly: 'NONE',
          burst: false,
        },
      };

      ingestRawPacket(JSON.stringify(payload), 'simulated');
    }, 1000);
  }, [cleanupCurrentConnection, ingestRawPacket]);

  // Handle source change from dropdown
  const handleSourceChange = useCallback(
    async (newSource: ConnectionSource) => {
      if (newSource === connectionSource && connectionState === 'connected') return;

      if (newSource === 'simulated') {
        startSimulated();
      } else if (newSource === 'ble') {
        await connectBluetooth();
      } else if (newSource === 'serial') {
        await connectSerial();
      } else if (newSource === 'wifi') {
        connectWifiRest();
      }
    },
    [connectionSource, connectionState, startSimulated, connectBluetooth, connectSerial, connectWifiRest]
  );

  // Initialize with simulation
  useEffect(() => {
    startSimulated();
    return () => cleanupCurrentConnection();
  }, []);

  // Hardware Calibration
  const triggerIMUCalibrate = useCallback(async () => {
    if (connectionSource === 'wifi') {
      try {
        await fetch('http://192.168.4.1/api/v1/calibrate', { method: 'POST' });
        return { success: true, message: 'IMU Tare command accepted by hardware.' };
      } catch (e: any) {
        return { success: false, message: `Wi-Fi command failed: ${e.message}` };
      }
    }
    // Simulated Tare
    setCurrentSample((prev) => ({ ...prev, roll: 0.0, pitch: 0.0 }));
    return { success: true, message: 'IMU tare applied: Roll and Pitch calibrated to 0.0°.' };
  }, [connectionSource]);

  // Hardware Demo Event Trigger
  const triggerHardwareDemo = useCallback(async () => {
    if (connectionSource === 'wifi') {
      try {
        await fetch('http://192.168.4.1/api/v1/demo', { method: 'POST' });
        return { success: true, message: 'Hardware demo event initiated.' };
      } catch (e: any) {
        return { success: false, message: `Demo command failed: ${e.message}` };
      }
    }
    // Inject demo anomalous sample
    const now = Date.now();
    const demoSample: TelemetrySample = {
      ...currentSample,
      id: String(now),
      timestamp: now,
      formattedTime: new Date(now).toLocaleTimeString(),
      roll: 6.8,
      pitch: -5.4,
      vibrationRms: 0.185,
      shockPeakG: 2.45,
      vibrationLevel: 'HIGH',
      magneticUt: 38.2,
      displacementMm: Number(((47.60 - 38.2) * 2.85).toFixed(2)),
      overallStatus: 'CRITICAL',
      healthScore: 72,
      anomaly: 'HIGH_TILT_SHEAR_SLIP',
    };
    setCurrentSample(demoSample);
    setHistory((prev) => [...prev.slice(-(MAX_HISTORY_SAMPLES - 1)), demoSample]);
    evaluateAlertConditions(demoSample);
    return { success: true, message: 'Demo rockburst anomaly injected (Roll: 6.8°, Vib: 0.185g, Disp: 26.8mm).' };
  }, [connectionSource, currentSample, evaluateAlertConditions]);

  // Export CSV
  const exportHistoryCsv = useCallback(() => {
    if (history.length === 0) return;
    const headers = [
      'Timestamp_Epoch',
      'Time_Local',
      'Node_ID',
      'Location',
      'Roll_deg',
      'Pitch_deg',
      'Yaw_deg',
      'Vibration_RMS_g',
      'Shock_Peak_g',
      'Vibration_Level',
      'Magnetic_Flux_uT',
      'Displacement_Est_mm',
      'Temperature_C',
      'Humidity_pct',
      'Soil_Moisture_pct',
      'MQ7_Gas_PPM',
      'System_Status',
      'Health_Score',
      'Anomaly_Tag',
    ];

    const rows = history.map((s) => [
      s.timestamp,
      `"${s.formattedTime}"`,
      `"${s.nodeId}"`,
      `"${s.location}"`,
      s.roll.toFixed(2),
      s.pitch.toFixed(2),
      s.yaw.toFixed(2),
      s.vibrationRms.toFixed(4),
      s.shockPeakG.toFixed(2),
      `"${s.vibrationLevel}"`,
      s.magneticUt.toFixed(2),
      s.displacementMm.toFixed(2),
      s.temperatureC.toFixed(1),
      s.humidityPercent.toFixed(1),
      s.soilPercent.toFixed(1),
      s.mq7Ppm.toFixed(1),
      `"${s.overallStatus}"`,
      s.healthScore,
      `"${s.anomaly}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `geonail_telemetry_${currentSample.nodeId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [history, currentSample.nodeId]);

  return {
    connectionSource,
    connectionState,
    errorMessage,
    lastReceivedTimestamp,
    currentSample,
    history,
    isPaused,
    togglePause: () => setIsPaused((p) => !p),
    thresholds,
    setThresholds,
    alertLogs,
    handleSourceChange,
    triggerIMUCalibrate,
    triggerHardwareDemo,
    exportHistoryCsv,
  };
}
