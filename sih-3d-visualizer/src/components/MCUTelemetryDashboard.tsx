import React, { useState, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { GeoNailAssembly } from './GeoNailAssembly';
import type { ViewportSettings } from './CanvasViewport';
import {
  Wifi,
  Activity,
  Compass,
  Thermometer,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Play,
  Sliders,
  Cpu,
  Radio,
  Bluetooth,
  Usb,
  Power,
  Terminal,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';

// Firmware v0.7.0 BLE UUID Constants
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
  const [packetLogs, setPacketLogs] = useState<PacketLog[]>([]);

  // Simulated Telemetry Sliders State
  const [simRoll, setSimRoll] = useState(0.0);
  const [simPitch, setSimPitch] = useState(0.0);
  const [simVib, setSimVib] = useState(0.02);
  const [simMagLevel, setSimMagLevel] = useState(47.6);

  // Compute relative axial displacement for Piece 2 based on Magnetometer (HMC5883L) reading
  const magDrivenSpikeOffset = (simMagLevel - 47.6) * -0.12;

  // Live Firmware v0.7.0 Telemetry Payload State
  const [telemetry, setTelemetry] = useState<FirmwareV070TelemetryData>({
    device: {
      node_id: 'GN-001',
      name: 'GeoNail Node 001',
      location: 'ZONE-A',
      firmware: '0.7.0',
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
    },
    magnetic: {
      x_ut: 18.5,
      y_ut: -12.4,
      z_ut: 42.1,
      magnitude_ut: 47.6,
      calibrated: true,
    },
    environment: {
      temperature_c: 24.5,
      humidity_percent: 55.0,
      soil_raw: 1850,
      soil_percent: 42.0,
      mq7_raw: 620,
      mq7_ppm: 12.5,
    },
    sensor_status: {
      mpu6500: 'HEALTHY',
      hmc5883l: 'HEALTHY',
      dht11: 'HEALTHY',
      soil: 'HEALTHY',
      mq7: 'NOT_TESTED',
    },
    status: {
      overall: 'NORMAL',
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

  // Web Serial & BLE Refs
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

  // Helper to safely parse JSON telemetry payload
  const handleIncomingJson = (jsonStr: string, transport: 'WIFI' | 'BLE' | 'SERIAL' | 'SIM') => {
    try {
      const data = JSON.parse(jsonStr);
      if (data && (data.motion || data.device)) {
        setTelemetry((prev) => ({
          ...prev,
          ...data,
          motion: { ...prev.motion, ...(data.motion || {}) },
          magnetic: { ...prev.magnetic, ...(data.magnetic || {}) },
          environment: { ...prev.environment, ...(data.environment || {}) },
          sensor_status: { ...prev.sensor_status, ...(data.sensor_status || {}) },
          status: { ...prev.status, ...(data.status || {}) },
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

  // 1. Wi-Fi REST Polling API Client (v0.7.0 Firmware REST API)
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

  // 2. Web Bluetooth (BLE GATT) Connection Client with MTU Chunk Reassembly
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

        // Check if full JSON object has arrived
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
      console.error('BLE connection error:', err);
      setConnectionStatus('disconnected');
    }
  };

  // Manual BLE Read Fallback Button Handler
  const readBLETelemetry = async () => {
    if (bleCharacteristicRef.current) {
      try {
        const value = await bleCharacteristicRef.current.readValue();
        const decoder = new TextDecoder('utf-8');
        const raw = decoder.decode(value);
        handleIncomingJson(raw, 'BLE');
      } catch (e) {
        console.error('Failed manual BLE read:', e);
      }
    }
  };

  // 3. Web Serial (USB/UART) Connection Client with Line Buffer Parser
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
      console.error('Serial connection error:', err);
      setConnectionStatus('disconnected');
    }
  };

  // 4. Interactive Simulation Loop
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
              gz: (Math.random() - 0.5) * 0.1,
              roll: simRoll,
              pitch: simPitch,
              acceleration: 1.0 + simVib * 0.5,
              vibration: simVib,
              vibration_level: vibLevel,
            },
            magnetic: {
              ...prev.magnetic,
              magnitude_ut: simMagLevel,
            },
            status: {
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
  }, [transportMode, simRoll, simPitch, simVib, simMagLevel]);

  // Command Trigger API Callers
  const triggerIMUCalibrate = async () => {
    if (transportMode === 'wifi') {
      try {
        await fetch(`http://${mcuIp}/api/v1/calibrate`, { method: 'POST' });
        alert('IMU Zero Calibration Triggered on MCU!');
      } catch (e) {
        alert('Failed to connect to MCU REST API at http://' + mcuIp + '/api/v1/calibrate');
      }
    } else {
      setSimRoll(0.0);
      setSimPitch(0.0);
      alert('Simulated IMU Calibration: Roll & Pitch reset to 0.0°');
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
      alert('Simulation Demo Scenario Triggered: High Tilt & Vibration Event');
    }
  };

  const triggerReboot = async () => {
    if (transportMode === 'wifi') {
      try {
        await fetch(`http://${mcuIp}/api/v1/reboot`, { method: 'POST' });
        alert('Reboot Command Sent to GeoNail MCU!');
      } catch (e) {
        alert('Failed to send reboot command to MCU REST API');
      }
    } else {
      alert('Simulated MCU Reboot Executed');
    }
  };

  const rollRad = (telemetry.motion.roll * Math.PI) / 180;
  const pitchRad = (telemetry.motion.pitch * Math.PI) / 180;

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 64px)', display: 'flex', background: 'var(--bg-surface)', color: 'var(--text-main)', overflow: 'hidden' }}>
      
      {/* LEFT PANEL: Live Sensor Gauges & MCU Controls (440px Width) */}
      <div
        style={{
          width: '440px',
          height: '100%',
          overflowY: 'auto',
          padding: '16px',
          background: 'var(--bg-surface)',
          borderRight: '1.5px solid var(--border-glass)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Connection & Transport Selector Card */}
        <div className="glass-panel" style={{ padding: '14px', borderRadius: '12px', border: '1.5px solid #0284c7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#38bdf8' }}>
              <Cpu size={18} />
              <span>GEONAIL OS v{telemetry.device.firmware} STREAM</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: 800,
                background: connectionStatus === 'connected' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(2, 132, 199, 0.2)',
                color: connectionStatus === 'connected' ? '#10b981' : '#38bdf8',
                border: `1px solid ${connectionStatus === 'connected' ? '#10b981' : '#38bdf8'}`,
              }}
            >
              {transportMode === 'wifi' && <Wifi size={13} />}
              {transportMode === 'ble' && <Bluetooth size={13} />}
              {transportMode === 'serial' && <Usb size={13} />}
              {transportMode === 'simulated' && <Radio size={13} />}
              <span>{transportMode.toUpperCase()} {connectionStatus.toUpperCase()}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <div><strong>Node ID:</strong> {telemetry.device.node_id}</div>
            <div><strong>Location:</strong> {telemetry.device.location}</div>
            <div><strong>AP IP:</strong> {telemetry.network.wifi.ip}</div>
            <div><strong>Firmware:</strong> v{telemetry.device.firmware}</div>
            <div><strong>Uptime:</strong> {(telemetry.system.uptime_ms / 1000).toFixed(0)}s</div>
            <div><strong>Packets:</strong> {packetCount}</div>
          </div>

          {/* Multi-Transport Selection Buttons Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 12 }}>
            <button
              className={`icon-btn ${transportMode === 'wifi' ? 'active' : ''}`}
              onClick={() => setTransportMode('wifi')}
              style={{ padding: '6px', fontSize: '0.72rem', fontWeight: 700, justifyContent: 'center', gap: 4 }}
            >
              <Wifi size={13} />
              <span>Wi-Fi REST</span>
            </button>
            <button
              className={`icon-btn ${transportMode === 'ble' ? 'active' : ''}`}
              onClick={connectBLE}
              style={{ padding: '6px', fontSize: '0.72rem', fontWeight: 700, justifyContent: 'center', gap: 4 }}
            >
              <Bluetooth size={13} />
              <span>Web BLE</span>
            </button>
            <button
              className={`icon-btn ${transportMode === 'serial' ? 'active' : ''}`}
              onClick={connectSerial}
              style={{ padding: '6px', fontSize: '0.72rem', fontWeight: 700, justifyContent: 'center', gap: 4 }}
            >
              <Usb size={13} />
              <span>Web Serial</span>
            </button>
            <button
              className={`icon-btn ${transportMode === 'simulated' ? 'active' : ''}`}
              onClick={() => setTransportMode('simulated')}
              style={{ padding: '6px', fontSize: '0.72rem', fontWeight: 700, justifyContent: 'center', gap: 4 }}
            >
              <Radio size={13} />
              <span>Simulator</span>
            </button>
          </div>

          {/* Fallback Manual BLE Characteristic Read Button */}
          {transportMode === 'ble' && (
            <button
              className="glow-btn"
              onClick={readBLETelemetry}
              style={{ width: '100%', marginTop: 8, padding: '6px', fontSize: '0.72rem', fontWeight: 800, justifyContent: 'center', gap: 6 }}
            >
              <Bluetooth size={13} />
              <span>Read BLE Characteristic Now</span>
            </button>
          )}
        </div>

        {/* System Overall Status Alert Banner */}
        <div
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            background: telemetry.status.overall === 'CRITICAL' ? 'rgba(239, 68, 68, 0.25)' : telemetry.status.overall === 'WARNING' ? 'rgba(234, 179, 8, 0.25)' : 'rgba(16, 185, 129, 0.25)',
            border: `1.5px solid ${telemetry.status.overall === 'CRITICAL' ? '#ef4444' : telemetry.status.overall === 'WARNING' ? '#eab308' : '#10b981'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {telemetry.status.overall === 'CRITICAL' ? <ShieldAlert size={18} color="#ef4444" /> : <ShieldCheck size={18} color="#10b981" />}
            <div>
              <div style={{ fontSize: '0.76rem', fontWeight: 800, color: telemetry.status.overall === 'CRITICAL' ? '#ef4444' : telemetry.status.overall === 'WARNING' ? '#eab308' : '#10b981' }}>
                SYSTEM STATUS: {telemetry.status.overall}
              </div>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>
                {telemetry.status.overall === 'CRITICAL' ? 'Tilt/Vibration Critical Limit Exceeded' : 'Normal Geotechnical Subterranean Monitoring Active'}
              </div>
            </div>
          </div>
        </div>

        {/* 1. MPU-6500 IMU Motion Deck */}
        <div className="glass-panel" style={{ padding: '12px', borderRadius: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 800, color: '#38bdf8' }}>
              <Activity size={16} />
              <span>MPU-6500 IMU MOTION & TILT</span>
            </div>
            <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '8px', background: '#10b98122', color: '#10b981', fontWeight: 700 }}>
              {telemetry.sensor_status.mpu6500}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: 'rgba(2, 132, 199, 0.1)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(2, 132, 199, 0.2)' }}>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>ROLL TILT</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: Math.abs(telemetry.motion.roll) > 5 ? '#ef4444' : '#38bdf8' }}>
                {telemetry.motion.roll.toFixed(2)}°
              </div>
            </div>
            <div style={{ background: 'rgba(2, 132, 199, 0.1)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(2, 132, 199, 0.2)' }}>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>PITCH TILT</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: Math.abs(telemetry.motion.pitch) > 5 ? '#ef4444' : '#38bdf8' }}>
                {telemetry.motion.pitch.toFixed(2)}°
              </div>
            </div>
            <div style={{ background: 'rgba(2, 132, 199, 0.1)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(2, 132, 199, 0.2)' }}>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>TOTAL ACCEL</div>
              <div style={{ fontSize: '1.0rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {telemetry.motion.acceleration.toFixed(2)} g
              </div>
            </div>
            <div style={{ background: 'rgba(2, 132, 199, 0.1)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(2, 132, 199, 0.2)' }}>
              <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>VIBRATION</div>
              <div style={{ fontSize: '1.0rem', fontWeight: 800, color: telemetry.motion.vibration_level === 'HIGH' ? '#ef4444' : '#10b981' }}>
                {telemetry.motion.vibration.toFixed(3)} g ({telemetry.motion.vibration_level})
              </div>
            </div>
          </div>
        </div>

        {/* 2. Magnetometer & Environmental Gauges */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {/* Magnetometer */}
          <div className="glass-panel" style={{ padding: '10px', borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', fontWeight: 800, color: '#eab308', marginBottom: 6 }}>
              <Compass size={14} />
              <span>HMC5883L MAG</span>
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {telemetry.magnetic.magnitude_ut.toFixed(1)} μT
            </div>
            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: 2 }}>
              X: {telemetry.magnetic.x_ut.toFixed(1)} | Y: {telemetry.magnetic.y_ut.toFixed(1)}
            </div>
          </div>

          {/* Environment */}
          <div className="glass-panel" style={{ padding: '10px', borderRadius: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', fontWeight: 800, color: '#10b981', marginBottom: 6 }}>
              <Thermometer size={14} />
              <span>DHT11 TEMP/HUM</span>
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {telemetry.environment.temperature_c.toFixed(1)}°C | {telemetry.environment.humidity_percent.toFixed(0)}%
            </div>
            <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Soil: {telemetry.environment.soil_percent.toFixed(0)}% | MQ-7: {telemetry.environment.mq7_ppm.toFixed(1)} PPM
            </div>
          </div>
        </div>

        {/* Mag Level Driven Spike Anchor Deployment Button & Controls */}
        <div className="glass-panel" style={{ padding: '12px', borderRadius: '10px', border: '1.5px solid #eab308' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#eab308', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Compass size={15} />
              <span>MAG LEVEL SPIKE DEPLOYMENT</span>
            </div>
            <button
              className="glow-btn"
              onClick={() => setSimMagLevel((m) => (m >= 70 ? 30 : m + 15))}
              style={{ padding: '4px 10px', fontSize: '0.7rem', fontWeight: 800 }}
            >
              <span>Shift Mag Level</span>
            </button>
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 6 }}>
            Spike Anchor Position: <strong style={{ color: '#38bdf8' }}>{magDrivenSpikeOffset < 0 ? `Extended ${Math.abs(magDrivenSpikeOffset).toFixed(2)}u Away from Piece 1` : magDrivenSpikeOffset > 0 ? `Retracted ${magDrivenSpikeOffset.toFixed(2)}u Towards Piece 1` : 'Seated Flush at Piece 1 Footing'}</strong>
          </div>
          <input
            type="range"
            min="20"
            max="80"
            step="1"
            value={simMagLevel}
            onChange={(e) => setSimMagLevel(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#eab308', cursor: 'pointer' }}
          />
        </div>

        {/* Live Raw Telemetry Packet Terminal Deck */}
        <div className="glass-panel" style={{ borderRadius: '10px', overflow: 'hidden' }}>
          <div
            onClick={() => setShowTerminal(!showTerminal)}
            style={{
              padding: '10px 12px',
              background: 'rgba(2, 132, 199, 0.15)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
            }}

          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.76rem', fontWeight: 800, color: '#38bdf8' }}>
              <Terminal size={15} />
              <span>LIVE PACKET STREAM TERMINAL ({packetLogs.length})</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {packetLogs.length > 0 && (
                <button
                  className="icon-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPacketLogs([]);
                  }}
                  style={{ width: 22, height: 22, padding: 0 }}
                  title="Clear Terminal Logs"
                >
                  <Trash2 size={12} color="#ef4444" />
                </button>
              )}
              {showTerminal ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
            </div>
          </div>

          {showTerminal && (
            <div
              style={{
                maxHeight: '180px',
                overflowY: 'auto',
                padding: '10px',
                background: '#090d16',
                fontFamily: 'monospace',
                fontSize: '0.66rem',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              {packetLogs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)' }}>Waiting for raw JSON packets...</div>
              ) : (
                packetLogs.map((log) => (
                  <div key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 4 }}>
                    <div style={{ display: 'flex', gap: 8, color: '#38bdf8', fontWeight: 700 }}>
                      <span>[{log.time}]</span>
                      <span
                        style={{
                          color:
                            log.transport === 'BLE'
                              ? '#38bdf8'
                              : log.transport === 'SERIAL'
                              ? '#eab308'
                              : log.transport === 'WIFI'
                              ? '#10b981'
                              : '#a855f7',
                        }}
                      >
                        [{log.transport}]
                      </span>
                      <span>{log.bytes} bytes</span>
                    </div>
                    <div style={{ color: '#cbd5e1', wordBreak: 'break-all', marginTop: 2 }}>{log.payload}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Hardware Control Actions */}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="glow-btn"
            onClick={triggerIMUCalibrate}
            style={{ flex: 1, padding: '8px', fontSize: '0.72rem', fontWeight: 800, justifyContent: 'center', gap: 4 }}
          >
            <RefreshCw size={13} />
            <span>Calibrate Zero</span>
          </button>
          <button
            className="glow-btn secondary"
            onClick={triggerHardwareDemo}
            style={{ flex: 1, padding: '8px', fontSize: '0.72rem', fontWeight: 800, justifyContent: 'center', gap: 4 }}
          >
            <Play size={13} />
            <span>Event Demo</span>
          </button>
          <button
            className="icon-btn"
            onClick={triggerReboot}
            style={{ padding: '8px 12px', fontSize: '0.72rem', fontWeight: 800, color: '#ef4444', borderColor: '#ef4444', gap: 4 }}
            title="Reboot MCU Node"
          >
            <Power size={13} />
            <span>Reboot</span>
          </button>
        </div>

        {/* Hardware Simulator Sliders Panel (When in Simulated Mode) */}
        {transportMode === 'simulated' && (
          <div className="glass-panel" style={{ padding: '12px', borderRadius: '10px', border: '1px solid #eab308' }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 800, color: '#eab308', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sliders size={14} />
              <span>LIVE HARDWARE SIMULATOR SLIDERS</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.7rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)' }}>
                  <span>Simulate Roll Tilt: {simRoll.toFixed(1)}°</span>
                </div>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  step="0.5"
                  value={simRoll}
                  onChange={(e) => setSimRoll(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#38bdf8' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)' }}>
                  <span>Simulate Pitch Tilt: {simPitch.toFixed(1)}°</span>
                </div>
                <input
                  type="range"
                  min="-15"
                  max="15"
                  step="0.5"
                  value={simPitch}
                  onChange={(e) => setSimPitch(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#38bdf8' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)' }}>
                  <span>Simulate Vibration: {simVib.toFixed(3)} g</span>
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="0.30"
                  step="0.01"
                  value={simVib}
                  onChange={(e) => setSimVib(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: '#ef4444' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANEL: Realtime Synchronized 3D Model Viewport in Deployed Subterranean State */}
      <div style={{ flex: 1, height: '100%', position: 'relative' }}>
        {/* Floating Top Overlay Banner */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            zIndex: 10,
            background: 'var(--bg-surface)',
            border: '1.5px solid #0284c7',
            borderRadius: '12px',
            padding: '10px 18px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ fontSize: '0.84rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} />
            <span>DEPLOYED SUBTERRANEAN REALTIME 3D GEONAIL MODEL</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Roll: <strong style={{ color: '#38bdf8' }}>{telemetry.motion.roll.toFixed(2)}°</strong> | Pitch: <strong style={{ color: '#38bdf8' }}>{telemetry.motion.pitch.toFixed(2)}°</strong> | Transport: <strong>{transportMode.toUpperCase()}</strong>
          </div>
        </div>

        {/* 3D Canvas with Realtime IMU Tilt & Subterranean Bedrock Grid */}
        <Canvas camera={{ position: [0, 5, 38], fov: 45 }} style={{ background: 'radial-gradient(circle, var(--bg-surface) 0%, #0b1329 100%)' }}>
          <ambientLight intensity={1.2} />
          <directionalLight position={[10, 20, 15]} intensity={2.0} castShadow />
          <directionalLight position={[-10, -10, -10]} intensity={0.5} color="#38bdf8" />
          <Environment preset="city" />

          {/* Synchronized Realtime IMU Rotation Group */}
          <group rotation={[pitchRad, rollRad, 0]}>
            <GeoNailAssembly
              attachStep={5} // Always rendered in Fully Assembled & Deployed Subterranean State
              removeStep={0}
              capRotationAngle={settings.lithoPinCapRotation}
              spikeLockAngle={settings.lithoPinSpikeLock}
              spikeDetached={settings.lithoPinSpikeDetached}
              magSpikeOffset={magDrivenSpikeOffset}
              explodedProgress={settings.lithoPinExploded}
              cutawayMode={settings.lithoPinCutaway}
              showLoadPath={settings.lithoPinLoadPath}
              dragModeEnabled={settings.lithoPinDragMode}
              showLabels={true}
              selectedComponent={settings.selectedComponent}
            />
          </group>

          <ContactShadows position={[0, -20, 0]} opacity={0.6} scale={40} blur={2} far={25} />
          <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} autoRotate={false} />
        </Canvas>
      </div>
    </div>
  );
};
