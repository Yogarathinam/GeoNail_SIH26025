import React, { useState } from 'react';
import type { TelemetrySample, ConnectionSource, ConnectionState } from '../types';
import {
  RefreshCw,
  Play,
  Download,
  Cpu,
  Terminal,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';

interface DeviceSettingsViewProps {
  currentSample: TelemetrySample;
  connectionSource: ConnectionSource;
  connectionState: ConnectionState;
  onTriggerCalibrate: () => Promise<{ success: boolean; message: string }>;
  onTriggerDemo: () => Promise<{ success: boolean; message: string }>;
  onExportCsv: () => void;
}

export const DeviceSettingsView: React.FC<DeviceSettingsViewProps> = ({
  currentSample,
  connectionSource,
  connectionState,
  onTriggerCalibrate,
  onTriggerDemo,
  onExportCsv,
}) => {
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [isDemoing, setIsDemoing] = useState(false);

  const handleCalibrate = async () => {
    if (!window.confirm('Confirm IMU Auto-Tare? This will re-zero the physical pitch and roll offsets on node ' + currentSample.nodeId + '.')) {
      return;
    }
    setIsCalibrating(true);
    setActionStatus(null);
    const res = await onTriggerCalibrate();
    setActionStatus(res.message);
    setIsCalibrating(false);
  };

  const handleDemo = async () => {
    if (!window.confirm('Confirm hardware/simulation demonstration rockburst event? This will inject temporary anomaly readings into the telemetry stream.')) {
      return;
    }
    setIsDemoing(true);
    setActionStatus(null);
    const res = await onTriggerDemo();
    setActionStatus(res.message);
    setIsDemoing(false);
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(currentSample, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geonail_${currentSample.nodeId}_snapshot_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Action Status Notification */}
      {actionStatus && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            background: '#10b98115',
            border: '1px solid #10b98144',
            color: '#10b981',
            fontSize: '0.8125rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle2 size={16} />
          <span>{actionStatus}</span>
        </div>
      )}

      {/* 1. HARDWARE CALIBRATION & COMMANDS */}
      <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: 12 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <RotateCcw size={16} style={{ color: 'var(--accent-cyan)' }} />
          <span>Hardware Commands & Transducer Calibration</span>
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 16 }}>
          Direct actuator commands transmitted over active transport link ({connectionSource.toUpperCase()}). Prompts user confirmation prior to execution.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {/* Action 1: Auto-Tare IMU */}
          <div style={{ padding: '14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Auto-Tare IMU Orientation
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '6px 0 12px' }}>
              Samples the current physical resting angle and sets roll and pitch offsets to 0.0°. Triggers <code>POST /api/v1/calibrate</code> on ESP32-S3.
            </div>
            <button
              onClick={handleCalibrate}
              disabled={isCalibrating}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 6,
                background: '#0284c7',
                color: '#ffffff',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.78125rem',
                cursor: isCalibrating ? 'not-allowed' : 'pointer',
              }}
            >
              <RefreshCw size={13} className={isCalibrating ? 'spin' : ''} />
              <span>{isCalibrating ? 'Applying Tare...' : 'Auto-Tare IMU (0.0°)'}</span>
            </button>
          </div>

          {/* Action 2: Trigger Demo Event */}
          <div style={{ padding: '14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Demonstration Incident Injection
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '6px 0 12px' }}>
              Initiates an experimental rockburst demonstration scenario. Simulates sustained high tilt, vibration spikes, and spike anchor extension.
            </div>
            <button
              onClick={handleDemo}
              disabled={isDemoing}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 6,
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#d97706',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                fontWeight: 700,
                fontSize: '0.78125rem',
                cursor: isDemoing ? 'not-allowed' : 'pointer',
              }}
            >
              <Play size={13} />
              <span>{isDemoing ? 'Injecting...' : 'Trigger Demo Incident'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. DEVICE METADATA & PHYSICAL SPECIFICATIONS */}
      <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: 12 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Cpu size={16} style={{ color: 'var(--accent-cyan)' }} />
          <span>Device Metadata & Firmware Profile</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>NODE IDENTIFIER</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>{currentSample.nodeId}</div>
          </div>

          <div style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>LOCATION ZONE</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>{currentSample.location}</div>
          </div>

          <div style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>FIRMWARE RELEASE</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>v{currentSample.firmware}</div>
          </div>

          <div style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>ACTIVE LINK</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>{connectionSource.toUpperCase()} ({connectionState.toUpperCase()})</div>
          </div>
          <div style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>MCU ARCHITECTURE</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>ESP32-S3 (Xtensa LX7 @ 240MHz)</div>
          </div>
        </div>
      </div>

      {/* 3. DATA EXPORT & DIAGNOSTICS DUMP */}
      <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: 12 }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Download size={16} style={{ color: 'var(--accent-cyan)' }} />
          <span>Telemetry Data Export & Archival</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <button
            onClick={onExportCsv}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 6,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-glass)',
              color: 'var(--text-main)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Download size={14} />
            <span>Export Complete History (CSV)</span>
          </button>

          <button
            onClick={handleExportJson}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 6,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-glass)',
              color: 'var(--text-main)',
              fontSize: '0.8125rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Terminal size={14} />
            <span>Export Current State (JSON)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
