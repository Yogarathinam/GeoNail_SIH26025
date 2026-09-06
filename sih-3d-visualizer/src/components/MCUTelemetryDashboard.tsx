import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import { GeoNailAssembly } from './GeoNailAssembly';
import type { ViewportSettings } from './CanvasViewport';
import {
  Wifi,
  Activity,
  Thermometer,
  RefreshCw,
  Play,
  Sliders,
  Cpu,
  Radio,
  Bluetooth,
  Usb,
  Terminal,
  Eye,
  Navigation,
  Camera,
  RotateCcw,
  Maximize2,
  Box,
  Focus,
} from 'lucide-react';

const BLE_SERVICE_UUID = 'f2e50000-6c9b-4bd4-8c39-4f3c7e000001';
const BLE_TELEMETRY_UUID = 'f2e50001-6c9b-4bd4-8c39-4f3c7e000001';

export interface FirmwareV070TelemetryData {
  device: {
    node_id: string;
    name: string;
    location: string;
    firmware: string;
  };
  timestamp_ms: number;
  demo_mode: boolean;
  motion: {
    ax: number;
    ay: number;
    az: number;
    gx: number;
    gy: number;
    gz: number;
    roll: number;
    pitch: number;
    acceleration: number;
    vibration: number;
    vibration_level: string;
    vib_rms?: number;
    shock_peak_g?: number;
  };
  magnetic: {
    x_ut: number;
    y_ut: number;
    z_ut: number;
    magnitude_ut: number;
    calibrated: boolean;
  };
  environment: {
    temperature_c: number;
    humidity_percent: number;
    soil_raw: number;
    soil_percent: number;
    mq7_raw: number;
    mq7_ppm: number;
  };
  sensor_status: {
    mpu6500: string;
    hmc5883l: string;
    dht11: string;
    soil: string;
    mq7: string;
  };
  status: {
    overall: string;
    health_score?: number;
    anomaly?: string;
  };
  network: {
    wifi: {
      enabled: boolean;
      mode: string;
      status: string;
      ssid: string;
      ip: string;
      clients: number;
      api_url: string;
    };
    bluetooth: {
      enabled: boolean;
      name: string;
      status: string;
      connected: boolean;
    };
    serial: {
      enabled: boolean;
      status: string;
      baud: number;
      protocol: string;
    };
  };
  transports: {
    wifi_enabled: boolean;
    ble_enabled: boolean;
    serial_enabled: boolean;
  };
  system: {
    uptime_ms: number;
    free_heap: number;
    packet_count: number;
    last_tx_ms: number;
  };
  telemetry: {
    interval_ms: number;
  };
}

interface PacketLog {
  id: string;
  time: string;
  transport: 'WIFI' | 'BLE' | 'SERIAL' | 'SIM';
  bytes: number;
  payload: string;
}

interface MCUTelemetryDashboardProps {
  settings: ViewportSettings;
  setSettings?: React.Dispatch<React.SetStateAction<ViewportSettings>>;
}

export const MCUTelemetryDashboard: React.FC<MCUTelemetryDashboardProps> = ({
  settings,
}) => {
  const [transportMode, setTransportMode] = useState<'simulated' | 'wifi' | 'ble' | 'serial'>('simulated');
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [mcuIp] = useState('192.168.4.1');
  const [packetCount, setPacketCount] = useState(0);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showSimControls, setShowSimControls] = useState(false);
  const [xrayMode, setXrayMode] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [packetLogs, setPacketLogs] = useState<PacketLog[]>([]);

  const orbitRef = useRef<any>(null);

  const setCameraPreset = (preset: 'iso' | 'front' | 'top' | 'side' | 'spike' | 'reset') => {
    if (!orbitRef.current) return;
    const controls = orbitRef.current;
    const cam = controls.object;

    switch (preset) {
      case 'iso':
        cam.position.set(12, 4, 16);
        controls.target.set(0, -4, 0);
        break;
      case 'front':
        cam.position.set(0, -4, 20);
        controls.target.set(0, -4, 0);
        break;
      case 'top':
        cam.position.set(0, 24, 0.01);
        controls.target.set(0, -4, 0);
        break;
      case 'side':
        cam.position.set(20, -4, 0);
        controls.target.set(0, -4, 0);
        break;
      case 'spike':
        cam.position.set(0, -12, 7);
        controls.target.set(0, -12, 0);
        break;
      case 'reset':
        cam.position.set(0, 2, 14.5);
        controls.target.set(0, -4, 0);
        break;
    }
    controls.update();
  };

  // Simulated Telemetry Sliders State
  const [simRoll, setSimRoll] = useState(0.0);
  const [simPitch, setSimPitch] = useState(0.0);
  const [simYaw, setSimYaw] = useState(0.0);
  const [simVib, setSimVib] = useState(0.02);
  const [simMagLevel, setSimMagLevel] = useState(42.6); // Default 42.6 uT gives ~14.25 mm displacement

  // Telemetry Payload State
  const [telemetry, setTelemetry] = useState<FirmwareV070TelemetryData>({
    device: {
      node_id: 'GN-001',
      name: 'GeoNail Node 001',
      location: 'ZONE-A',
      firmware: '0.8.0',
    },
    timestamp_ms: Date.now(),
    demo_mode: false,
    motion: {
      ax: 0.01,
      ay: 0.02,
      az: 0.99,
      gx: 0.0,
      gy: 0.0,
      gz: 0.0,
      roll: 0.0,
      pitch: 0.0,
      acceleration: 1.0,
      vibration: 0.02,
      vibration_level: 'LOW',
      vib_rms: 0.018,
      shock_peak_g: 1.02,
    },
    magnetic: {
      x_ut: 18.5,
      y_ut: -12.4,
      z_ut: 36.8,
      magnitude_ut: 42.6,
      calibrated: true,
    },
    environment: {
      temperature_c: 24.5,
      humidity_percent: 55.0,
      soil_raw: 1850,
      soil_percent: 42.5,
      mq7_raw: 620,
      mq7_ppm: 12.5,
    },
    sensor_status: {
      mpu6500: 'HEALTHY',
      hmc5883l: 'HEALTHY',
      dht11: 'HEALTHY',
      soil: 'HEALTHY',
      mq7: 'HEALTHY',
    },
    status: {
      overall: 'NORMAL',
      health_score: 100,
      anomaly: 'NONE',
    },
    network: {
      wifi: {
        enabled: true,
        mode: 'ACCESS_POINT',
        status: 'ACTIVE',
        ssid: 'GeoNail-AP',
        ip: '192.168.4.1',
        clients: 1,
        api_url: 'http://192.168.4.1/api/v1/telemetry',
      },
      bluetooth: {
        enabled: true,
        name: 'GeoNail Node 001',
        status: 'ADVERTISING',
        connected: false,
      },
      serial: {
        enabled: true,
        status: 'ACTIVE',
        baud: 115200,
        protocol: 'newline-delimited JSON',
      },
    },
    transports: {
      wifi_enabled: true,
      ble_enabled: true,
      serial_enabled: true,
    },
    system: {
      uptime_ms: 124500,
      free_heap: 184520,
      packet_count: 342,
      last_tx_ms: 1000,
    },
    telemetry: {
      interval_ms: 1000,
    },
  });

  const bleCharacteristicRef = useRef<any>(null);
  const bleBufferRef = useRef<string>('');

  const addPacketLog = (transport: 'WIFI' | 'BLE' | 'SERIAL' | 'SIM', raw: string) => {
    const timeStr = new Date().toLocaleTimeString();
    setPacketLogs((prev) => [
      {
        id: Math.random().toString(36).substr(2, 9),
        time: timeStr,
        transport,
        bytes: raw.length,
        payload: raw,
      },
      ...prev.slice(0, 19),
    ]);
  };

  const handleIncomingJson = (jsonStr: string, transport: 'WIFI' | 'BLE' | 'SERIAL' | 'SIM') => {
    try {
      const data = JSON.parse(jsonStr);
      if (data && (data.motion || data.device)) {
        const m = data.motion || {};
        const env = data.environment || {};
        const mag = data.magnetic || {};
        const st = data.status || {};
        const sen = data.sensor_status || {};

        setTelemetry((prev) => ({
          ...prev,
          ...data,
          motion: {
            ...prev.motion,
            ...m,
            acceleration: m.accel !== undefined ? m.accel : m.acceleration,
            vibration_level: m.vib_lvl !== undefined ? m.vib_lvl : m.vibration_level,
            vib_rms: m.vib_rms !== undefined ? m.vib_rms : prev.motion.vib_rms,
            shock_peak_g: m.shock !== undefined ? m.shock : (m.shock_peak_g !== undefined ? m.shock_peak_g : prev.motion.shock_peak_g),
          },
          magnetic: {
            ...prev.magnetic,
            ...mag,
            magnitude_ut: mag.mag_ut !== undefined ? mag.mag_ut : mag.magnitude_ut,
            calibrated: mag.cal !== undefined ? mag.cal : mag.calibrated,
          },
          environment: {
            ...prev.environment,
            ...env,
            temperature_c: env.temp_c !== undefined ? env.temp_c : env.temperature_c,
            humidity_percent: env.hum_pct !== undefined ? env.hum_pct : env.humidity_percent,
          },
          sensor_status: {
            ...prev.sensor_status,
            ...sen,
            mpu6500: sen.mpu !== undefined ? sen.mpu : sen.mpu6500,
            hmc5883l: sen.hmc !== undefined ? sen.hmc : sen.hmc5883l,
            dht11: sen.dht !== undefined ? sen.dht : sen.dht11,
          },
          status: {
            ...prev.status,
            ...st,
            health_score: st.health !== undefined ? st.health : st.health_score,
            anomaly: st.anomaly || prev.status.anomaly,
          },
        }));
        setPacketCount((p) => p + 1);
        addPacketLog(transport, jsonStr);
        return true;
      }
    } catch (e) {
      // Buffer chunk in progress
    }
    return false;
  };

  // Wi-Fi REST Polling Client
  useEffect(() => {
    if (transportMode === 'wifi') {
      setConnectionStatus('connecting');
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`http://${mcuIp}/api/v1/telemetry`);
          if (res.ok) {
            const raw = await res.text();
            if (handleIncomingJson(raw, 'WIFI')) {
              setConnectionStatus('connected');
            }
          } else {
            setConnectionStatus('disconnected');
          }
        } catch (err) {
          setConnectionStatus('disconnected');
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [transportMode, mcuIp]);

  // Web Bluetooth GATT Client
  const connectBLE = async () => {
    if (!('bluetooth' in navigator)) {
      alert('Web Bluetooth API is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      setConnectionStatus('connecting');
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ namePrefix: 'GeoNail' }],
        optionalServices: [BLE_SERVICE_UUID],
      });

      device.addEventListener('gattserverdisconnected', () => {
        setConnectionStatus('disconnected');
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(BLE_SERVICE_UUID);
      const characteristic = await service.getCharacteristic(BLE_TELEMETRY_UUID);
      bleCharacteristicRef.current = characteristic;

      await characteristic.startNotifications();
      bleBufferRef.current = '';

      characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        const decoder = new TextDecoder('utf-8');
        const chunk = decoder.decode(value);

        bleBufferRef.current += chunk;
        const buffer = bleBufferRef.current.trim();

        if (buffer.startsWith('{') && buffer.endsWith('}')) {
          if (handleIncomingJson(buffer, 'BLE')) {
            bleBufferRef.current = '';
          }
        } else if (buffer.includes('{') && buffer.includes('}')) {
          const start = buffer.indexOf('{');
          const end = buffer.lastIndexOf('}');
          if (end > start) {
            const candidate = buffer.substring(start, end + 1);
            if (handleIncomingJson(candidate, 'BLE')) {
              bleBufferRef.current = buffer.substring(end + 1);
            }
          }
        }
      });

      setConnectionStatus('connected');
      setTransportMode('ble');
    } catch (err) {
      console.error('BLE error:', err);
      setConnectionStatus('disconnected');
    }
  };

  // Web Serial Client
  const connectSerial = async () => {
    if (!('serial' in navigator)) {
      alert('Web Serial API is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      setConnectionStatus('connecting');
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });

      setConnectionStatus('connected');
      setTransportMode('serial');

      const textDecoder = new (window as any).TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();

      let lineBuffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          reader.releaseLock();
          break;
        }
        lineBuffer += value;
        const lines = lineBuffer.split(/\r?\n/);
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            handleIncomingJson(trimmed, 'SERIAL');
          }
        }
      }
    } catch (err) {
      console.error('Serial error:', err);
      setConnectionStatus('disconnected');
    }
  };

  // Interactive Simulation Loop
  useEffect(() => {
    if (transportMode === 'simulated') {
      const interval = setInterval(() => {
        const vibLevel = simVib > 0.15 ? 'HIGH' : simVib > 0.05 ? 'MEDIUM' : 'LOW';
        const overallStatus =
          Math.abs(simRoll) > 5.0 || Math.abs(simPitch) > 5.0 || simVib > 0.15
            ? 'CRITICAL'
            : Math.abs(simRoll) > 2.0 || Math.abs(simPitch) > 2.0 || simVib > 0.05
            ? 'WARNING'
            : 'NORMAL';

        setTelemetry((prev) => {
          const nextData = {
            ...prev,
            timestamp_ms: Date.now(),
            motion: {
              ax: Math.sin((simRoll * Math.PI) / 180),
              ay: Math.sin((simPitch * Math.PI) / 180),
              az: Math.cos((simRoll * Math.PI) / 180),
              gx: (Math.random() - 0.5) * 0.1,
              gy: (Math.random() - 0.5) * 0.1,
              gz: simYaw,
              roll: simRoll,
              pitch: simPitch,
              acceleration: 1.0 + simVib * 0.5,
              vibration: simVib,
              vibration_level: vibLevel,
              vib_rms: simVib,
              shock_peak_g: 1.0 + simVib * 2.5,
            },
            magnetic: {
              ...prev.magnetic,
              magnitude_ut: simMagLevel,
            },
            status: {
              ...prev.status,
              overall: overallStatus,
            },
            system: {
              ...prev.system,
              uptime_ms: prev.system.uptime_ms + 1000,
              packet_count: prev.system.packet_count + 1,
            },
          };
          addPacketLog('SIM', JSON.stringify(nextData));
          return nextData;
        });
        setPacketCount((p) => p + 1);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [transportMode, simRoll, simPitch, simYaw, simVib, simMagLevel]);

  // Hardware Command Triggers
  const triggerIMUCalibrate = async () => {
    if (transportMode === 'wifi') {
      try {
        await fetch(`http://${mcuIp}/api/v1/calibrate`, { method: 'POST' });
        alert('Auto-Tare IMU Triggered on MCU!');
      } catch (e) {
        alert('Failed to connect to MCU REST API at http://' + mcuIp + '/api/v1/calibrate');
      }
    } else {
      setSimRoll(0.0);
      setSimPitch(0.0);
      setSimYaw(0.0);
      alert('Simulated IMU Calibration: Roll, Pitch & Yaw reset to 0.0°');
    }
  };

  const triggerHardwareDemo = async () => {
    if (transportMode === 'wifi') {
      try {
        await fetch(`http://${mcuIp}/api/v1/demo`, { method: 'POST' });
        alert('Hardware Demo Mode Activated on MCU!');
      } catch (e) {
        alert('Failed to connect to MCU REST API at http://' + mcuIp + '/api/v1/demo');
      }
    } else {
      setSimRoll(6.8);
      setSimPitch(-4.2);
      setSimVib(0.18);
      setSimMagLevel(34.2);
      alert('Simulation Demo Event Triggered: High Tilt, Vibration & 36.8mm Spike Extension');
    }
  };

  // Sub-Surface Soil Displacement Physics Calculation
  // Baseline magnetic field magnitude when fully seated at top = 47.60 uT
  // Decreasing magnetic field indicates Piece 2 Spike Anchor extending downwards into soil bedrock layers!
  const magVal = transportMode === 'simulated' ? simMagLevel : (telemetry.magnetic.magnitude_ut || 47.60);
  const magneticDelta = Math.max(0, 47.60 - magVal);
  const displacementMm = magneticDelta * 2.85; // 1 uT drop ~ 2.85 mm displacement
  const displacementCm = displacementMm / 10.0;

  // 3D Motion Orientation Angle Values
  const rollVal = transportMode === 'simulated' ? simRoll : (telemetry.motion.roll || 0);
  const pitchVal = transportMode === 'simulated' ? simPitch : (telemetry.motion.pitch || 0);
  const yawVal = transportMode === 'simulated' ? simYaw : (telemetry.motion.gz || 0);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 64px)',
        overflow: 'hidden',
        backgroundColor: '#f8fafc',
        backgroundImage: `
          linear-gradient(rgba(148, 163, 184, 0.22) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148, 163, 184, 0.22) 1px, transparent 1px),
          linear-gradient(rgba(148, 163, 184, 0.45) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148, 163, 184, 0.45) 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px, 20px 20px, 100px 100px, 100px 100px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      
      {/* -------------------------------------------------------------
          1. CENTER STAGE: 3D REALTIME WEBGL CANVAS VISUALIZER
         ------------------------------------------------------------- */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Canvas camera={{ position: [0, 2.0, 14.5], fov: 45 }} gl={{ antialias: true, alpha: true }}>
          <ambientLight intensity={1.8} color="#ffffff" />
          <hemisphereLight args={['#ffffff', '#cbd5e1', 1.2]} />
          <directionalLight position={[12, 20, 15]} intensity={3.2} castShadow />
          <directionalLight position={[-12, 12, -15]} intensity={1.8} color="#e0f2fe" />
          <directionalLight position={[0, -10, 12]} intensity={1.0} color="#0284c7" />

          {/* 3D CAD Floor Measurement Grid */}
          <gridHelper args={[40, 40, '#0284c7', '#94a3b8']} position={[0, -14.5, 0]} />

          <OrbitControls
            ref={orbitRef}
            makeDefault
            enableDamping
            dampingFactor={0.05}
            minDistance={2}
            maxDistance={45}
            target={[0, -4, 0]}
            autoRotate={autoRotate}
            autoRotateSpeed={1.5}
          />

          <GeoNailAssembly
            attachStep={settings.lithoPinAttachStep}
            removeStep={settings.lithoPinRemoveStep}
            capRotationAngle={settings.lithoPinCapRotation}
            spikeLockAngle={settings.lithoPinSpikeLock}
            spikeDetached={settings.lithoPinSpikeDetached}
            explodedProgress={settings.lithoPinExploded}
            cutawayMode={xrayMode}
            showLoadPath={settings.lithoPinLoadPath}
            dragModeEnabled={settings.lithoPinDragMode}
            showLabels={settings.showComponentLabels}
            selectedComponent={settings.selectedComponent}
            roll={rollVal}
            pitch={pitchVal}
            yaw={yawVal}
            magDisplacementMm={displacementMm}
          />

          <ContactShadows position={[0, -14.5, 0]} opacity={0.65} scale={22} blur={2.0} far={6} color="#0f172a" />
        </Canvas>
      </div>

      {/* -------------------------------------------------------------
          1.5. FLOATING DEDICATED 3D CAD CAMERA CONTROL TOOLBAR
         ------------------------------------------------------------- */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 15,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          borderRadius: '30px',
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(2, 132, 199, 0.4)',
          boxShadow: '0 8px 32px rgba(15, 23, 42, 0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingRight: 8, borderRight: '1px solid rgba(203, 213, 225, 0.8)', fontSize: '0.72rem', fontWeight: 800, color: '#0284c7' }}>
          <Camera size={15} />
          <span>CAMERA</span>
        </div>

        <button
          onClick={() => setCameraPreset('iso')}
          title="Isometric 3D Perspective"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 11px',
            borderRadius: '16px',
            fontSize: '0.72rem',
            fontWeight: 800,
            background: 'rgba(240, 249, 255, 0.9)',
            color: '#0284c7',
            border: '1px solid rgba(186, 230, 253, 0.8)',
            cursor: 'pointer',
          }}
        >
          <Box size={13} />
          <span>ISO</span>
        </button>

        <button
          onClick={() => setCameraPreset('front')}
          title="Front Elevation View"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 11px',
            borderRadius: '16px',
            fontSize: '0.72rem',
            fontWeight: 800,
            background: 'rgba(241, 245, 249, 0.9)',
            color: '#334155',
            border: '1px solid rgba(203, 213, 225, 0.8)',
            cursor: 'pointer',
          }}
        >
          <span>FRONT</span>
        </button>

        <button
          onClick={() => setCameraPreset('top')}
          title="Top Plan View"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 11px',
            borderRadius: '16px',
            fontSize: '0.72rem',
            fontWeight: 800,
            background: 'rgba(241, 245, 249, 0.9)',
            color: '#334155',
            border: '1px solid rgba(203, 213, 225, 0.8)',
            cursor: 'pointer',
          }}
        >
          <span>TOP</span>
        </button>

        <button
          onClick={() => setCameraPreset('side')}
          title="Right Side Profile View"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 11px',
            borderRadius: '16px',
            fontSize: '0.72rem',
            fontWeight: 800,
            background: 'rgba(241, 245, 249, 0.9)',
            color: '#334155',
            border: '1px solid rgba(203, 213, 225, 0.8)',
            cursor: 'pointer',
          }}
        >
          <span>SIDE</span>
        </button>

        <button
          onClick={() => setCameraPreset('spike')}
          title="Focus Close-up on Sub-surface Spike Anchor Tip"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 11px',
            borderRadius: '16px',
            fontSize: '0.72rem',
            fontWeight: 800,
            background: 'rgba(254, 243, 199, 0.9)',
            color: '#b45309',
            border: '1px solid #d97706',
            cursor: 'pointer',
          }}
        >
          <Focus size={13} />
          <span>SPIKE TIP</span>
        </button>

        <button
          onClick={() => setAutoRotate(!autoRotate)}
          title="Toggle Smooth 360° Auto-Rotation"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 11px',
            borderRadius: '16px',
            fontSize: '0.72rem',
            fontWeight: 800,
            background: autoRotate ? 'rgba(236, 253, 245, 0.95)' : 'rgba(241, 245, 249, 0.9)',
            color: autoRotate ? '#059669' : '#334155',
            border: `1px solid ${autoRotate ? '#10b981' : 'rgba(203, 213, 225, 0.8)'}`,
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={13} />
          <span>360° ROTATE</span>
        </button>

        <button
          onClick={() => setCameraPreset('reset')}
          title="Reset Camera View to Default Position"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '5px 11px',
            borderRadius: '16px',
            fontSize: '0.72rem',
            fontWeight: 800,
            background: 'rgba(241, 245, 249, 0.9)',
            color: '#475569',
            border: '1px solid rgba(203, 213, 225, 0.8)',
            cursor: 'pointer',
          }}
        >
          <Maximize2 size={13} />
          <span>RESET</span>
        </button>
      </div>

      {/* -------------------------------------------------------------
          2. FLOATING TOP GLASSBAR: CONTROLS & TRANSPORT STATUS
         ------------------------------------------------------------- */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 18px',
          borderRadius: '16px',
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(148, 163, 184, 0.4)',
          boxShadow: '0 8px 32px rgba(15, 23, 42, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#0f172a', fontSize: '0.95rem', letterSpacing: '0.5px' }}>
            <Cpu size={20} color="#0284c7" />
            <span>GEONAIL OS v{telemetry.device.firmware} STREAM</span>
          </div>
          
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '0.74rem',
              fontWeight: 800,
              background: connectionStatus === 'connected' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(2, 132, 199, 0.15)',
              color: connectionStatus === 'connected' ? '#059669' : '#0284c7',
              border: `1.5px solid ${connectionStatus === 'connected' ? '#10b981' : '#0284c7'}`,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: connectionStatus === 'connected' ? '#10b981' : '#0284c7', boxShadow: `0 0 8px ${connectionStatus === 'connected' ? '#10b981' : '#0284c7'}` }} />
            <span>{transportMode.toUpperCase()} {connectionStatus.toUpperCase()}</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '0.74rem',
              fontWeight: 700,
              background: 'rgba(241, 245, 249, 0.9)',
              color: '#475569',
              border: '1px solid rgba(203, 213, 225, 0.8)',
            }}
          >
            <span>Packets: {packetCount}</span>
          </div>
        </div>

        {/* Transport Mode Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setTransportMode('simulated')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '0.76rem',
              fontWeight: 700,
              background: transportMode === 'simulated' ? '#0284c7' : 'rgba(241, 245, 249, 0.9)',
              color: transportMode === 'simulated' ? '#ffffff' : '#334155',
              border: `1px solid ${transportMode === 'simulated' ? '#0284c7' : 'rgba(203, 213, 225, 0.8)'}`,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Radio size={14} />
            <span>Simulated</span>
          </button>
          <button
            onClick={() => setTransportMode('wifi')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '0.76rem',
              fontWeight: 700,
              background: transportMode === 'wifi' ? '#0284c7' : 'rgba(241, 245, 249, 0.9)',
              color: transportMode === 'wifi' ? '#ffffff' : '#334155',
              border: `1px solid ${transportMode === 'wifi' ? '#0284c7' : 'rgba(203, 213, 225, 0.8)'}`,
              cursor: 'pointer',
            }}
          >
            <Wifi size={14} />
            <span>Wi-Fi REST</span>
          </button>
          <button
            onClick={connectBLE}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '0.76rem',
              fontWeight: 700,
              background: transportMode === 'ble' ? '#0284c7' : 'rgba(241, 245, 249, 0.9)',
              color: transportMode === 'ble' ? '#ffffff' : '#334155',
              border: `1px solid ${transportMode === 'ble' ? '#0284c7' : 'rgba(203, 213, 225, 0.8)'}`,
              cursor: 'pointer',
            }}
          >
            <Bluetooth size={14} />
            <span>Web BLE</span>
          </button>
          <button
            onClick={connectSerial}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '0.76rem',
              fontWeight: 700,
              background: transportMode === 'serial' ? '#0284c7' : 'rgba(241, 245, 249, 0.9)',
              color: transportMode === 'serial' ? '#ffffff' : '#334155',
              border: `1px solid ${transportMode === 'serial' ? '#0284c7' : 'rgba(203, 213, 225, 0.8)'}`,
              cursor: 'pointer',
            }}
          >
            <Usb size={14} />
            <span>Web Serial</span>
          </button>
        </div>

        {/* Quick Action Toggles */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setXrayMode(!xrayMode)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '0.76rem',
              fontWeight: 800,
              background: xrayMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(241, 245, 249, 0.9)',
              color: xrayMode ? '#059669' : '#475569',
              border: `1.5px solid ${xrayMode ? '#10b981' : 'rgba(203, 213, 225, 0.8)'}`,
              cursor: 'pointer',
            }}
          >
            <Eye size={14} />
            <span>{xrayMode ? '🧪 X-Ray ON' : 'Solid Mesh'}</span>
          </button>

          <button
            onClick={() => setShowSimControls(!showSimControls)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '0.76rem',
              fontWeight: 800,
              background: showSimControls ? 'rgba(217, 119, 6, 0.2)' : 'rgba(241, 245, 249, 0.9)',
              color: showSimControls ? '#d97706' : '#475569',
              border: `1.5px solid ${showSimControls ? '#d97706' : 'rgba(203, 213, 225, 0.8)'}`,
              cursor: 'pointer',
            }}
          >
            <Sliders size={14} />
            <span>Sim Sliders</span>
          </button>

          <button
            onClick={() => setShowTerminal(!showTerminal)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '0.76rem',
              fontWeight: 800,
              background: showTerminal ? 'rgba(2, 132, 199, 0.2)' : 'rgba(241, 245, 249, 0.9)',
              color: showTerminal ? '#0284c7' : '#475569',
              border: `1.5px solid ${showTerminal ? '#0284c7' : 'rgba(203, 213, 225, 0.8)'}`,
              cursor: 'pointer',
            }}
          >
            <Terminal size={14} />
            <span>Terminal</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          3. LEFT FLOATING GLASS CARD: 3D MOTION & ORIENTATION
         ------------------------------------------------------------- */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: 16,
          width: '320px',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: '16px',
          borderRadius: '16px',
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(2, 132, 199, 0.3)',
          boxShadow: '0 12px 36px rgba(15, 23, 42, 0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 800, color: '#0284c7' }}>
            <Activity size={16} />
            <span>3D INERTIAL MOTION</span>
          </div>
          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '8px', background: '#10b98122', color: '#059669', fontWeight: 800 }}>
            {telemetry.sensor_status.mpu6500}
          </span>
        </div>

        {/* Euler 3D Rotation Gauges */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <div style={{ background: 'rgba(240, 249, 255, 0.9)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(186, 230, 253, 0.8)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700 }}>ROLL (X)</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: Math.abs(rollVal) > 5 ? '#dc2626' : '#0284c7' }}>
              {rollVal.toFixed(1)}°
            </div>
          </div>

          <div style={{ background: 'rgba(240, 249, 255, 0.9)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(186, 230, 253, 0.8)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700 }}>PITCH (Z)</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: Math.abs(pitchVal) > 5 ? '#dc2626' : '#0284c7' }}>
              {pitchVal.toFixed(1)}°
            </div>
          </div>

          <div style={{ background: 'rgba(240, 249, 255, 0.9)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(186, 230, 253, 0.8)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700 }}>YAW (Y)</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0284c7' }}>
              {yawVal.toFixed(1)}°
            </div>
          </div>
        </div>

        {/* Acceleration & Vibration Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div style={{ background: 'rgba(241, 245, 249, 0.9)', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(203, 213, 225, 0.8)' }}>
            <div style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: 700 }}>VIBRATION RMS</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: telemetry.motion.vibration_level === 'HIGH' ? '#dc2626' : '#059669' }}>
              {(telemetry.motion.vib_rms || telemetry.motion.vibration).toFixed(3)} g
            </div>
          </div>

          <div style={{ background: 'rgba(241, 245, 249, 0.9)', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(203, 213, 225, 0.8)' }}>
            <div style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: 700 }}>PEAK SHOCK</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: (telemetry.motion.shock_peak_g || 1.0) > 1.8 ? '#dc2626' : '#0284c7' }}>
              {(telemetry.motion.shock_peak_g || 1.0).toFixed(2)} g
            </div>
          </div>
        </div>

        {/* Node Health Score & Anomaly Alert */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: '10px', background: 'rgba(236, 253, 245, 0.9)', border: '1.5px solid #10b981' }}>
          <div>
            <div style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 700 }}>NODE HEALTH</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#059669' }}>{telemetry.status.health_score || 100}%</div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 700 }}>ANOMALY TAG</div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: telemetry.status.anomaly === 'NONE' || !telemetry.status.anomaly ? '#059669' : '#dc2626' }}>
              {telemetry.status.anomaly || 'NONE'}
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          4. RIGHT FLOATING GLASS CARD: SOIL ANCHOR DISPLACEMENT & ENVIRONMENT
         ------------------------------------------------------------- */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          right: 16,
          width: '340px',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: '16px',
          borderRadius: '16px',
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(217, 119, 6, 0.4)',
          boxShadow: '0 12px 36px rgba(15, 23, 42, 0.08)',
        }}
      >
        {/* SUB-SURFACE SOIL ANCHOR EXTENSION CARD */}
        <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(254, 243, 199, 0.6)', border: '1.5px solid #d97706' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#b45309', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Navigation size={16} />
              <span>SOIL ANCHOR DISPLACEMENT</span>
            </div>
            <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '8px', background: '#fef3c7', color: '#b45309', fontWeight: 800, border: '1px solid #fde68a' }}>
              {telemetry.sensor_status.hmc5883l}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '8px 0' }}>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#0f172a' }}>
              {displacementMm.toFixed(2)} <span style={{ fontSize: '0.9rem', color: '#b45309' }}>mm</span>
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0284c7' }}>
              ({displacementCm.toFixed(2)} cm)
            </div>
          </div>

          {/* Depth Extension Progress Bar */}
          <div style={{ width: '100%', height: '8px', background: 'rgba(203, 213, 225, 0.6)', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(217, 119, 6, 0.4)', margin: '6px 0' }}>
            <div style={{ width: `${Math.min(100, (displacementMm / 50.0) * 100)}%`, height: '100%', background: '#d97706', transition: 'width 0.3s' }} />
          </div>

          <div style={{ fontSize: '0.66rem', color: '#475569', display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span>Mag Field: <strong>{magVal.toFixed(1)} μT</strong></span>
            <span>Ref Base: <strong>47.60 μT</strong></span>
          </div>
        </div>

        {/* CLIMATE & SOIL ENVIRONMENT CARD */}
        <div style={{ padding: '10px 12px', borderRadius: '12px', background: 'rgba(236, 253, 245, 0.8)', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 800, color: '#059669', marginBottom: 6 }}>
            <Thermometer size={15} />
            <span>CLIMATE & SOIL ENVIRONMENT</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.76rem', color: '#334155' }}>
            <div>Temp: <strong style={{ color: '#0f172a' }}>{telemetry.environment.temperature_c.toFixed(1)}°C</strong></div>
            <div>Humidity: <strong style={{ color: '#0f172a' }}>{telemetry.environment.humidity_percent.toFixed(0)}%</strong></div>
            <div>Soil Moisture: <strong style={{ color: '#0284c7' }}>{telemetry.environment.soil_percent.toFixed(1)}%</strong></div>
            <div>MQ-7 Gas: <strong style={{ color: '#b45309' }}>{telemetry.environment.mq7_ppm.toFixed(1)} PPM</strong></div>
          </div>
        </div>

        {/* NODE CONTROL ACTION BUTTONS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            onClick={triggerIMUCalibrate}
            style={{
              padding: '8px',
              borderRadius: '10px',
              fontSize: '0.74rem',
              fontWeight: 800,
              background: '#0284c7',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
            }}
          >
            <RefreshCw size={13} />
            <span>Auto-Tare IMU</span>
          </button>
          <button
            onClick={triggerHardwareDemo}
            style={{
              padding: '8px',
              borderRadius: '10px',
              fontSize: '0.74rem',
              fontWeight: 800,
              background: 'rgba(254, 243, 199, 0.9)',
              color: '#b45309',
              border: '1.5px solid #d97706',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}
          >
            <Play size={13} />
            <span>Demo Event</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          5. FLOATING HARDWARE SIMULATOR SLIDERS (WHEN TOGGLED)
         ------------------------------------------------------------- */}
      {showSimControls && (
        <div
          style={{
            position: 'absolute',
            bottom: 80,
            left: 16,
            width: '320px',
            zIndex: 10,
            padding: '14px',
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(16px)',
            border: '1.5px solid #d97706',
            boxShadow: '0 12px 36px rgba(15, 23, 42, 0.12)',
          }}
        >
          <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#b45309', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sliders size={15} />
            <span>3D ORIENTATION & MAGNETIC SLIDERS</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.72rem' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
                <span>Roll Tilt (X): <strong>{simRoll.toFixed(1)}°</strong></span>
              </div>
              <input
                type="range"
                min="-20"
                max="20"
                step="0.5"
                value={simRoll}
                onChange={(e) => setSimRoll(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#0284c7' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
                <span>Pitch Tilt (Z): <strong>{simPitch.toFixed(1)}°</strong></span>
              </div>
              <input
                type="range"
                min="-20"
                max="20"
                step="0.5"
                value={simPitch}
                onChange={(e) => setSimPitch(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#0284c7' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
                <span>Yaw Heading (Y): <strong>{simYaw.toFixed(1)}°</strong></span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={simYaw}
                onChange={(e) => setSimYaw(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#0284c7' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
                <span>Mag Flux: <strong>{simMagLevel.toFixed(1)} μT</strong> ({displacementMm.toFixed(1)} mm)</span>
              </div>
              <input
                type="range"
                min="20"
                max="47.6"
                step="0.5"
                value={simMagLevel}
                onChange={(e) => setSimMagLevel(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: '#d97706' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          6. FLOATING LIVE PACKET TERMINAL DRAWER (WHEN TOGGLED)
         ------------------------------------------------------------- */}
      {showTerminal && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            right: 16,
            maxHeight: '200px',
            zIndex: 10,
            borderRadius: '16px',
            background: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(16px)',
            border: '1.5px solid #0284c7',
            overflow: 'hidden',
            boxShadow: '0 12px 36px rgba(15, 23, 42, 0.15)',
          }}
        >
          <div style={{ padding: '8px 14px', background: 'rgba(224, 242, 254, 0.9)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 800, color: '#0284c7' }}>
              <Terminal size={15} />
              <span>LIVE PACKET STREAM TERMINAL ({packetLogs.length})</span>
            </div>
            <button
              onClick={() => setPacketLogs([])}
              style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.68rem', background: 'rgba(254, 226, 226, 0.9)', color: '#dc2626', border: '1px solid #fca5a5', cursor: 'pointer' }}
            >
              Clear Logs
            </button>
          </div>

          <div style={{ maxHeight: '160px', overflowY: 'auto', padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', gap: 6, background: '#0f172a', color: '#f8fafc' }}>
            {packetLogs.length === 0 ? (
              <div style={{ color: '#94a3b8' }}>Waiting for raw JSON telemetry packets...</div>
            ) : (
              packetLogs.map((log) => (
                <div key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 4 }}>
                  <div style={{ display: 'flex', gap: 8, color: '#38bdf8', fontWeight: 700 }}>
                    <span>[{log.time}]</span>
                    <span style={{ color: log.transport === 'BLE' ? '#38bdf8' : log.transport === 'SERIAL' ? '#eab308' : '#10b981' }}>
                      [{log.transport}]
                    </span>
                    <span>{log.bytes} bytes</span>
                  </div>
                  <div style={{ color: '#cbd5e1', wordBreak: 'break-all', marginTop: 2 }}>{log.payload}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
};
