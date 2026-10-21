import React, { useState } from 'react';
import type { TelemetrySample, ConnectionState } from '../types';
import {
  Download,
  Pause,
  Play,
  Terminal,
  Copy,
  Check,
  AlertCircle,
  Radio,
  Clock,
  ChevronDown,
} from 'lucide-react';

interface LiveTelemetryViewProps {
  currentSample: TelemetrySample;
  history: TelemetrySample[];
  connectionState: ConnectionState;
  isPaused: boolean;
  onTogglePause: () => void;
  onExportCsv: () => void;
}

interface SignalConfig {
  id: string;
  label: string;
  unit: string;
  color: string;
  getter: (s: TelemetrySample) => number;
}

const AVAILABLE_SIGNALS: SignalConfig[] = [
  { id: 'roll', label: 'Roll Angle (X)', unit: '°', color: '#0284c7', getter: (s) => s.roll },
  { id: 'pitch', label: 'Pitch Angle (Z)', unit: '°', color: '#0ea5e9', getter: (s) => s.pitch },
  { id: 'vibrationRms', label: 'Vibration RMS', unit: 'g', color: '#10b981', getter: (s) => s.vibrationRms },
  { id: 'shockPeakG', label: 'Peak Shock', unit: 'g', color: '#f59e0b', getter: (s) => s.shockPeakG },
  { id: 'displacementMm', label: 'Displacement (Est)', unit: 'mm', color: '#d97706', getter: (s) => s.displacementMm },
  { id: 'magneticUt', label: 'Magnetic Flux', unit: 'μT', color: '#8b5cf6', getter: (s) => s.magneticUt },
  { id: 'temperatureC', label: 'Temperature', unit: '°C', color: '#ef4444', getter: (s) => s.temperatureC },
  { id: 'humidityPercent', label: 'Humidity', unit: '%', color: '#06b6d4', getter: (s) => s.humidityPercent },
  { id: 'soilPercent', label: 'Soil Moisture', unit: '%', color: '#84cc16', getter: (s) => s.soilPercent },
  { id: 'mq7Ppm', label: 'CO Gas PPM', unit: 'PPM', color: '#f97316', getter: (s) => s.mq7Ppm },
];

export const LiveTelemetryView: React.FC<LiveTelemetryViewProps> = ({
  currentSample,
  history,
  connectionState,
  isPaused,
  onTogglePause,
  onExportCsv,
}) => {
  const [selectedSignalIds, setSelectedSignalIds] = useState<string[]>(['roll', 'pitch', 'vibrationRms']);
  const [windowSec, setWindowSec] = useState<number>(30);
  const [isInspectorOpen, setIsInspectorOpen] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const toggleSignal = (id: string) => {
    setSelectedSignalIds((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((s) => s !== id) : prev) : [...prev, id]
    );
  };

  const now = currentSample.timestamp;
  const filteredHistory = history.filter((s) => now - s.timestamp <= windowSec * 1000);
  const chartSamples = filteredHistory.length > 0 ? filteredHistory : history.slice(-25);

  const handleCopyJson = () => {
    const text = currentSample.rawJson || JSON.stringify(currentSample, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeSignals = AVAILABLE_SIGNALS.filter((s) => selectedSignalIds.includes(s.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* 1. TOP SIGNAL SELECTION & CONTROL TOOLBAR */}
      <div
        className="glass-panel"
        style={{
          padding: '14px 18px',
          borderRadius: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Radio size={16} style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Active Telemetry Signals
            </span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              ({activeSignals.length} plotted / {chartSamples.length} samples)
            </span>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Time Window */}
            <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', padding: '2px 4px', borderRadius: 6, border: '1px solid var(--border-glass)' }}>
              {[
                { label: '15s', val: 15 },
                { label: '30s', val: 30 },
                { label: '1m', val: 60 },
                { label: '3m', val: 180 },
              ].map((w) => (
                <button
                  key={w.val}
                  onClick={() => setWindowSec(w.val)}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: windowSec === w.val ? 'var(--bg-surface)' : 'transparent',
                    color: windowSec === w.val ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  }}
                >
                  {w.label}
                </button>
              ))}
            </div>

            {/* Pause/Resume */}
            <button
              onClick={onTogglePause}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 12px',
                borderRadius: 6,
                background: isPaused ? '#ef444415' : 'var(--bg-card)',
                border: `1px solid ${isPaused ? '#ef444444' : 'var(--border-glass)'}`,
                color: isPaused ? '#ef4444' : 'var(--text-main)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {isPaused ? <Play size={13} /> : <Pause size={13} />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={onExportCsv}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 12px',
                borderRadius: 6,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-main)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Download in-memory samples as CSV"
            >
              <Download size={13} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Signal Filter Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {AVAILABLE_SIGNALS.map((sig) => {
            const isSelected = selectedSignalIds.includes(sig.id);
            const currentVal = sig.getter(currentSample);

            return (
              <button
                key={sig.id}
                onClick={() => toggleSignal(sig.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: `1px solid ${isSelected ? sig.color : 'var(--border-glass)'}`,
                  background: isSelected ? `${sig.color}15` : 'var(--bg-card)',
                  color: isSelected ? 'var(--text-main)' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: isSelected ? 700 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: isSelected ? sig.color : 'transparent',
                    border: `1.5px solid ${sig.color}`,
                  }}
                />
                <span>{sig.label}:</span>
                <span style={{ fontWeight: 800, color: isSelected ? sig.color : 'var(--text-main)' }}>
                  {currentVal.toFixed(1)} {sig.unit}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. DEDICATED LIVE TIME-SERIES CANVAS / SVG */}
      <div className="glass-panel" style={{ padding: '20px 22px', borderRadius: 12 }}>
        {connectionState === 'disconnected' ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <AlertCircle size={28} style={{ color: '#ef4444', margin: '0 auto 10px' }} />
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Hardware Disconnected
            </div>
            <div style={{ fontSize: '0.75rem', marginTop: 4 }}>
              Select a valid connection source (Wi-Fi REST, Bluetooth LE, or USB Serial) from the header to resume streaming.
            </div>
          </div>
        ) : chartSamples.length < 2 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Clock size={28} style={{ color: 'var(--accent-cyan)', margin: '0 auto 10px' }} />
            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Awaiting live telemetry packets...</div>
          </div>
        ) : (
          (() => {
            const W = 860;
            const H = 280;
            const padLeft = 45;
            const padRight = 30;
            const padTop = 20;
            const padBottom = 30;

            // Find universal normalized or multi-range
            // For multi-signal clarity, normalize each signal to its own min/max or plot absolute
            return (
              <div style={{ width: '100%', height: 300, position: 'relative' }}>
                <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  {/* Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                    const y = padTop + (H - padTop - padBottom) * pct;
                    return (
                      <line
                        key={idx}
                        x1={padLeft}
                        y1={y}
                        x2={W - padRight}
                        y2={y}
                        stroke="var(--border-glass)"
                        strokeDasharray="3 3"
                        opacity="0.6"
                      />
                    );
                  })}

                  {/* Draw Curves for each selected signal */}
                  {activeSignals.map((sig) => {
                    const values = chartSamples.map(sig.getter);
                    const min = Math.min(...values);
                    const max = Math.max(...values);
                    const range = max - min || 1;

                    const points = chartSamples.map((s, i) => {
                      const x = padLeft + (i / (chartSamples.length - 1)) * (W - padLeft - padRight);
                      const normY = (sig.getter(s) - min) / range;
                      const y = padTop + (H - padTop - padBottom) * (1 - normY);
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    });

                    return (
                      <g key={sig.id}>
                        <polyline
                          fill="none"
                          stroke={sig.color}
                          strokeWidth="2.0"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          points={points.join(' ')}
                        />
                        {/* Current value dot at the end */}
                        {chartSamples.length > 0 && (
                          <circle
                            cx={W - padRight}
                            cy={padTop + (H - padTop - padBottom) * (1 - (sig.getter(chartSamples[chartSamples.length - 1]) - min) / range)}
                            r={4}
                            fill={sig.color}
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                        )}
                      </g>
                    );
                  })}

                  {/* Time Stamps */}
                  <text x={padLeft} y={H - 8} fontSize="10" fill="var(--text-muted)">
                    {chartSamples[0].formattedTime}
                  </text>
                  <text x={W - padRight} y={H - 8} textAnchor="end" fontSize="10" fill="var(--text-muted)">
                    {chartSamples[chartSamples.length - 1].formattedTime}
                  </text>
                </svg>
              </div>
            );
          })()
        )}

        {/* Legend Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-glass)' }}>
          {activeSignals.map((sig) => (
            <div key={sig.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
              <span style={{ width: 12, height: 3, backgroundColor: sig.color, borderRadius: 2 }} />
              <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{sig.label}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>({sig.unit})</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. COLLAPSIBLE RAW JSON INSPECTOR */}
      <div className="glass-panel" style={{ borderRadius: 10, overflow: 'hidden' }}>
        <button
          onClick={() => setIsInspectorOpen(!isInspectorOpen)}
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
            <Terminal size={15} style={{ color: 'var(--accent-cyan)' }} />
            <span>Raw Telemetry Packet Inspector</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              (Source: {currentSample.transportSource.toUpperCase()} • Packet #{currentSample.packetCount})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {isInspectorOpen ? 'Collapse' : 'Expand JSON'}
            </span>
            <ChevronDown
              size={15}
              style={{
                color: 'var(--text-muted)',
                transform: isInspectorOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease',
              }}
            />
          </div>
        </button>

        {isInspectorOpen && (
          <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border-glass)', background: 'rgba(10, 13, 20, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Payload Size: {currentSample.rawJson ? currentSample.rawJson.length : 320} bytes
              </span>
              <button
                onClick={handleCopyJson}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 8px',
                  borderRadius: 4,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-main)',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {copied ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                <span>{copied ? 'Copied' : 'Copy Payload'}</span>
              </button>
            </div>

            <pre
              style={{
                margin: 0,
                padding: '12px',
                borderRadius: 6,
                background: '#0a0d14',
                color: '#38bdf8',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: '0.75rem',
                lineHeight: 1.45,
                overflowX: 'auto',
                maxHeight: 220,
              }}
            >
              {currentSample.rawJson
                ? JSON.stringify(JSON.parse(currentSample.rawJson), null, 2)
                : JSON.stringify(currentSample, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
