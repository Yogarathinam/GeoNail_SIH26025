import React, { useState } from 'react';
import type { TelemetrySample } from '../types';
import {
  Cpu,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  Database,
} from 'lucide-react';

interface SensorHealthViewProps {
  currentSample: TelemetrySample;
}

interface SensorRow {
  name: string;
  hardwareModel: string;
  interfaceBus: string;
  reportedStatus: string;
  calibrationState: string;
  currentReading: string;
  operationalRange: string;
  notes: string;
}

export const SensorHealthView: React.FC<SensorHealthViewProps> = ({ currentSample }) => {
  const [isRawDiagOpen, setIsRawDiagOpen] = useState(false);

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'HEALTHY' || s === 'OK') {
      return { color: '#10b981', bg: '#10b98115', border: '#10b98144', icon: CheckCircle, label: 'HEALTHY' };
    }
    if (s === 'UNCALIBRATED' || s === 'INITIALIZING' || s === 'READY' || s === 'NOT_TESTED') {
      return { color: '#f59e0b', bg: '#f59e0b15', border: '#f59e0b44', icon: AlertTriangle, label: s };
    }
    return { color: '#ef4444', bg: '#ef444415', border: '#ef444444', icon: XCircle, label: s || 'ERROR' };
  };

  const sensors: SensorRow[] = [
    {
      name: 'Inertial Measurement Unit (IMU)',
      hardwareModel: 'MPU-6050 / MPU-6886 6-DOF',
      interfaceBus: 'I2C Bus 0x68 (Pins 21/22)',
      reportedStatus: currentSample.mpuStatus,
      calibrationState: 'Tare Offset Applied (0.0°)',
      currentReading: `Roll: ${currentSample.roll.toFixed(1)}°, Pitch: ${currentSample.pitch.toFixed(1)}°, Vib: ${currentSample.vibrationRms.toFixed(3)}g`,
      operationalRange: '±2g / ±250 dps (Dynamic Range)',
      notes: 'Fused with complementary digital filter (α = 0.96) for gravity alignment.',
    },
    {
      name: 'Subsurface Magnetometer Array',
      hardwareModel: 'HMC5883L 3-Axis Magnetometer',
      interfaceBus: 'I2C Bus 0x1E (Pins 21/22)',
      reportedStatus: currentSample.hmcStatus,
      calibrationState: currentSample.magneticCalibrated ? 'Calibrated (Ref: 47.60 μT)' : 'Uncalibrated',
      currentReading: `${currentSample.magneticUt.toFixed(1)} μT → ${currentSample.displacementMm.toFixed(2)} mm Est.`,
      operationalRange: '±8 Gauss (73 μT Nominal Subsurface)',
      notes: 'Tracks linear displacement of the subterranean tungsten carbide bedrock spike.',
    },
    {
      name: 'Climate Temperature & Humidity',
      hardwareModel: 'DHT11 / DHT22 Digital Sensor',
      interfaceBus: '1-Wire Digital GPIO 26',
      reportedStatus: currentSample.dhtStatus,
      calibrationState: 'Factory Calibrated',
      currentReading: `${currentSample.temperatureC.toFixed(1)} °C, ${currentSample.humidityPercent.toFixed(0)}% RH`,
      operationalRange: '0 - 50 °C / 20 - 90% RH',
      notes: 'Monitors underground drift ambient and prevents condensation false triggers.',
    },
    {
      name: 'Ground Soil Moisture Probe',
      hardwareModel: 'Capacitive / Resistive Ground Stake',
      interfaceBus: 'ADC1 CH6 (GPIO 34)',
      reportedStatus: currentSample.soilStatus,
      calibrationState: '2-Point Cal (Dry: 3200, Wet: 1100)',
      currentReading: `${currentSample.soilPercent.toFixed(1)}% (ADC: ${currentSample.soilRaw})`,
      operationalRange: '0 - 100% Saturation',
      notes: 'Detects groundwater table shifts and soil shear liquefaction hazards.',
    },
    {
      name: 'Carbon Monoxide Mine Gas Sensor',
      hardwareModel: 'MQ-7 Electrochemical Sensor',
      interfaceBus: 'ADC1 CH0 (GPIO 36)',
      reportedStatus: currentSample.mq7Status,
      calibrationState: 'Linear Scaling (1024 ADC = 20 PPM)',
      currentReading: `${currentSample.mq7Ppm.toFixed(1)} PPM (ADC: ${currentSample.mq7Raw})`,
      operationalRange: '10 - 1000 PPM CO',
      notes: 'Subterranean fire and toxic gas containment alert system.',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. TOP OVERVIEW CARD */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          borderRadius: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cpu size={16} style={{ color: 'var(--accent-cyan)' }} />
            <span>Hardware Transducer & Sensor Integrity Matrix</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Direct hardware telemetry reported by ESP32-S3 firmware. Displays explicit health, interface buses, and calibration offsets.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            System Health Index:
          </div>
          <span
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              background: currentSample.healthScore >= 90 ? '#10b98118' : '#ef444418',
              border: `1px solid ${currentSample.healthScore >= 90 ? '#10b98144' : '#ef444444'}`,
              color: currentSample.healthScore >= 90 ? '#10b981' : '#ef4444',
              fontSize: '0.8rem',
              fontWeight: 800,
            }}
          >
            {currentSample.healthScore}% OPERATIONAL
          </span>
        </div>
      </div>

      {/* 2. SENSOR DIAGNOSTICS TABLE */}
      <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78125rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-glass)', textAlign: 'left', color: 'var(--text-muted)' }}>
              <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Sensor Subsystem</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Interface Bus</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Reported Status</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Calibration State</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Current Value</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Operational Range</th>
            </tr>
          </thead>
          <tbody>
            {sensors.map((s, idx) => {
              const badge = getStatusBadge(s.reportedStatus);
              const BadgeIcon = badge.icon;

              return (
                <tr key={idx} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                  <td style={{ padding: '12px 10px' }}>
                    <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{s.name}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.hardwareModel}</div>
                  </td>

                  <td style={{ padding: '12px 10px', color: 'var(--text-muted)', fontFamily: 'Consolas, monospace', fontSize: '0.72rem' }}>
                    {s.interfaceBus}
                  </td>

                  <td style={{ padding: '12px 10px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: badge.bg,
                        border: `1px solid ${badge.border}`,
                        color: badge.color,
                        fontSize: '0.7rem',
                        fontWeight: 800,
                      }}
                    >
                      <BadgeIcon size={12} />
                      {badge.label}
                    </span>
                  </td>

                  <td style={{ padding: '12px 10px', color: 'var(--text-main)', fontSize: '0.75rem' }}>
                    {s.calibrationState}
                  </td>

                  <td style={{ padding: '12px 10px', fontWeight: 700, color: 'var(--text-main)' }}>
                    {s.currentReading}
                  </td>

                  <td style={{ padding: '12px 10px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    {s.operationalRange}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 3. EXPANDABLE RAW MCU DIAGNOSTICS DRAWER */}
      <div className="glass-panel" style={{ borderRadius: 10, overflow: 'hidden' }}>
        <button
          onClick={() => setIsRawDiagOpen(!isRawDiagOpen)}
          style={{
            width: '100%',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card)',
            border: 'none',
            color: 'var(--text-main)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', fontWeight: 700 }}>
            <Database size={15} style={{ color: 'var(--accent-cyan)' }} />
            <span>Raw MCU Microcontroller Diagnostics & Heap Health</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {isRawDiagOpen ? 'Hide Internal Registers' : 'View Internal Registers'}
            </span>
            <ChevronDown
              size={15}
              style={{
                color: 'var(--text-muted)',
                transform: isRawDiagOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease',
              }}
            />
          </div>
        </button>

        {isRawDiagOpen && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-glass)', background: 'var(--bg-card)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
              <div style={{ padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 6, border: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>FREE HEAP MEMORY</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
                  {(currentSample.freeHeap / 1024).toFixed(1)} <span style={{ fontSize: '0.75rem' }}>KB</span>
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#10b981', marginTop: 2 }}>Heap Nominal (&gt; 120 KB)</div>
              </div>

              <div style={{ padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 6, border: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>SYSTEM UPTIME</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
                  {(currentSample.uptimeMs / 1000).toFixed(0)} <span style={{ fontSize: '0.75rem' }}>seconds</span>
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  ({(currentSample.uptimeMs / 60000).toFixed(1)} minutes continuous)
                </div>
              </div>

              <div style={{ padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 6, border: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>TRANSMITTED PACKETS</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
                  {currentSample.packetCount}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>Cadence: 1.0 Hz Nominal</div>
              </div>

              <div style={{ padding: '10px 12px', background: 'var(--bg-surface)', borderRadius: 6, border: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>EDGE BURST MODE</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: currentSample.isBurst ? '#ef4444' : '#10b981', marginTop: 4 }}>
                  {currentSample.isBurst ? 'ACTIVE' : 'STANDBY'}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>100Hz trigger on rockburst</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
