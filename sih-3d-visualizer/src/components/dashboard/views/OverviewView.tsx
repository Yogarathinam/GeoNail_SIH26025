import React, { useState } from 'react';
import type { TelemetrySample, ConnectionSource, ConnectionState } from '../types';
import {
  Compass,
  Activity,
  Zap,
  Navigation,
  HeartPulse,
  Thermometer,
  Droplets,
  Layers,
  Wind,
} from 'lucide-react';

interface OverviewViewProps {
  currentSample: TelemetrySample;
  history: TelemetrySample[];
  connectionSource: ConnectionSource;
  connectionState: ConnectionState;
}

// Compact SVG Sparkline helper
function Sparkline({
  data,
  color,
  width = 90,
  height = 24,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return <div style={{ width, height }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  currentSample,
  history,
  connectionSource,
  connectionState,
}) => {
  const [timeWindowSec, setTimeWindowSec] = useState<number>(60);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; sample: TelemetrySample } | null>(null);

  // Filter history for primary displacement chart based on time window
  const now = currentSample.timestamp;
  const filteredHistory = history.filter((s) => now - s.timestamp <= timeWindowSec * 1000);
  const chartData = filteredHistory.length > 0 ? filteredHistory : history.slice(-30);

  // Sparkline data buffers (last 20 samples)
  const last20 = history.slice(-20);
  const rollSpark = last20.map((s) => s.roll);
  const vibSpark = last20.map((s) => s.vibrationRms);
  const shockSpark = last20.map((s) => s.shockPeakG);
  const dispSpark = last20.map((s) => s.displacementMm);
  const healthSpark = last20.map((s) => s.healthScore);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CRITICAL':
        return { bg: '#ef444418', color: '#ef4444', border: '#ef444444', label: 'CRITICAL' };
      case 'WARNING':
        return { bg: '#f59e0b18', color: '#f59e0b', border: '#f59e0b44', label: 'WARNING' };
      case 'NORMAL':
      default:
        return { bg: '#10b98118', color: '#10b981', border: '#10b98144', label: 'NORMAL' };
    }
  };

  const overallBadge = getStatusBadge(currentSample.overallStatus);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. COMPACT STATUS STRIP */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          padding: '12px 18px',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-glass)',
          borderRadius: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
              Device Anchor ID
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 2 }}>
              {currentSample.nodeId} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>({currentSample.location})</span>
            </div>
          </div>

          <div style={{ height: 26, width: 1, background: 'var(--border-glass)' }} />

          <div>
            <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
              Active Transport Link
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
              {connectionSource.toUpperCase()} <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 600 }}>• {connectionState.toUpperCase()}</span>
            </div>
          </div>

          <div style={{ height: 26, width: 1, background: 'var(--border-glass)' }} />

          <div>
            <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
              Firmware Version
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginTop: 2 }}>
              GeoNail OS {currentSample.firmware}
            </div>
          </div>

          <div style={{ height: 26, width: 1, background: 'var(--border-glass)' }} />

          <div>
            <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
              Last Telemetry Packet
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', marginTop: 2 }}>
              {currentSample.formattedTime} <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({currentSample.packetCount} pkts)</span>
            </div>
          </div>
        </div>

        <div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: 6,
              background: overallBadge.bg,
              border: `1px solid ${overallBadge.border}`,
              color: overallBadge.color,
              fontSize: '0.75rem',
              fontWeight: 800,
              letterSpacing: '0.04em',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: overallBadge.color }} />
            SYSTEM: {overallBadge.label}
          </span>
        </div>
      </div>

      {/* 2. KEY METRIC CARDS GRID */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: 14,
        }}
      >
        {/* Card 1: Roll & Pitch */}
        <div className="glass-panel" style={{ padding: '14px 16px', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Incline (Roll / Pitch)
            </span>
            <Compass size={16} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: Math.abs(currentSample.roll) > 5 ? '#ef4444' : 'var(--text-main)' }}>
              {currentSample.roll.toFixed(1)}°
            </span>
            <span style={{ fontSize: '1rem', color: 'var(--text-muted)', fontWeight: 600 }}>/</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: Math.abs(currentSample.pitch) > 5 ? '#ef4444' : 'var(--text-main)' }}>
              {currentSample.pitch.toFixed(1)}°
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Limit: ±{2.0}° warn / ±{5.0}° crit
            </span>
            <Sparkline data={rollSpark} color="#0284c7" />
          </div>
        </div>

        {/* Card 2: Vibration RMS */}
        <div className="glass-panel" style={{ padding: '14px 16px', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Vibration RMS
            </span>
            <Activity size={16} style={{ color: '#10b981' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: currentSample.vibrationRms > 0.05 ? '#f59e0b' : 'var(--text-main)' }}>
              {currentSample.vibrationRms.toFixed(3)}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>g RMS</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span style={{ fontSize: '0.7rem', color: currentSample.vibrationLevel === 'HIGH' ? '#ef4444' : 'var(--text-muted)', fontWeight: 600 }}>
              Level: {currentSample.vibrationLevel}
            </span>
            <Sparkline data={vibSpark} color="#10b981" />
          </div>
        </div>

        {/* Card 3: Peak Shock */}
        <div className="glass-panel" style={{ padding: '14px 16px', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Transient Peak Shock
            </span>
            <Zap size={16} style={{ color: '#f59e0b' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: currentSample.shockPeakG > 1.8 ? '#ef4444' : 'var(--text-main)' }}>
              {currentSample.shockPeakG.toFixed(2)}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>peak g</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Gravity Baseline: 1.00g
            </span>
            <Sparkline data={shockSpark} color="#f59e0b" />
          </div>
        </div>

        {/* Card 4: Subterranean Displacement */}
        <div className="glass-panel" style={{ padding: '14px 16px', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Displacement (Est.)
            </span>
            <Navigation size={16} style={{ color: '#d97706' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: currentSample.displacementMm > 15 ? '#ef4444' : 'var(--text-main)' }}>
              {currentSample.displacementMm.toFixed(2)}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700 }}>mm</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              ({(currentSample.displacementMm / 10).toFixed(2)} cm)
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Flux: {currentSample.magneticUt.toFixed(1)} μT
            </span>
            <Sparkline data={dispSpark} color="#d97706" />
          </div>
        </div>

        {/* Card 5: Health & Anomaly */}
        <div className="glass-panel" style={{ padding: '14px 16px', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
              Node Health Score
            </span>
            <HeartPulse size={16} style={{ color: currentSample.healthScore < 80 ? '#ef4444' : '#10b981' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
            <span style={{ fontSize: '1.4rem', fontWeight: 800, color: currentSample.healthScore < 80 ? '#ef4444' : '#10b981' }}>
              {currentSample.healthScore}%
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Tag: {currentSample.anomaly}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Uptime: {(currentSample.uptimeMs / 1000).toFixed(0)}s
            </span>
            <Sparkline data={healthSpark} color="#10b981" />
          </div>
        </div>
      </div>

      {/* 3. PRIMARY VISUALIZATION: SUBTERRANEAN DISPLACEMENT & MAGNETIC FLUX CHART */}
      <div className="glass-panel" style={{ padding: '20px 22px', borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>
              Subterranean Linear Anchor Displacement & Magnetic Flux History
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Tracking axial spike extension into bedrock stratum. Displacement is calculated from calibrated magnetic flux drop (&Delta;B = 47.60 &mu;T - B_measured).
            </div>
          </div>

          {/* Time Window Buttons */}
          <div style={{ display: 'flex', gap: 6, background: 'var(--bg-card)', padding: '3px 4px', borderRadius: 6, border: '1px solid var(--border-glass)' }}>
            {[
              { label: '30s', val: 30 },
              { label: '1m', val: 60 },
              { label: '5m', val: 300 },
            ].map((btn) => (
              <button
                key={btn.val}
                onClick={() => setTimeWindowSec(btn.val)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  background: timeWindowSec === btn.val ? 'var(--bg-surface)' : 'transparent',
                  color: timeWindowSec === btn.val ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  boxShadow: timeWindowSec === btn.val ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* SVG Time-Series Chart */}
        <div style={{ position: 'relative', width: '100%', height: 260 }}>
          {chartData.length < 2 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Awaiting telemetry samples...
            </div>
          ) : (
            (() => {
              const W = 800;
              const H = 220;
              const padLeft = 45;
              const padRight = 50;
              const padTop = 15;
              const padBottom = 30;

              // Left Axis: Displacement mm
              const dispValues = chartData.map((d) => d.displacementMm);
              const maxDisp = Math.max(10, Math.ceil(Math.max(...dispValues) + 2));
              const minDisp = 0;

              // Right Axis: Magnetic Field uT
              const magValues = chartData.map((d) => d.magneticUt);
              const maxMag = 50;
              const minMag = Math.max(20, Math.floor(Math.min(...magValues) - 2));

              // Compute SVG path for Displacement
              const dispPoints = chartData.map((d, i) => {
                const x = padLeft + (i / (chartData.length - 1)) * (W - padLeft - padRight);
                const y = padTop + (H - padTop - padBottom) * (1 - (d.displacementMm - minDisp) / (maxDisp - minDisp));
                return { x, y, sample: d };
              });
              const dispPath = dispPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

              // Compute SVG path for Magnetic Flux
              const magPoints = chartData.map((d, i) => {
                const x = padLeft + (i / (chartData.length - 1)) * (W - padLeft - padRight);
                const y = padTop + (H - padTop - padBottom) * (1 - (d.magneticUt - minMag) / (maxMag - minMag));
                return { x, y };
              });
              const magPath = magPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

              // Threshold line at 15mm (Critical)
              const critY = padTop + (H - padTop - padBottom) * (1 - (15 - minDisp) / (maxDisp - minDisp));

              return (
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  style={{ width: '100%', height: '100%', overflow: 'visible' }}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  {/* Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                    const y = padTop + (H - padTop - padBottom) * pct;
                    const valLeft = (maxDisp - pct * (maxDisp - minDisp)).toFixed(1);
                    const valRight = (maxMag - pct * (maxMag - minMag)).toFixed(0);
                    return (
                      <g key={idx}>
                        <line x1={padLeft} y1={y} x2={W - padRight} y2={y} stroke="var(--border-glass)" strokeDasharray="3 3" opacity="0.6" />
                        <text x={padLeft - 6} y={y + 3} textAnchor="end" fontSize="10" fill="var(--text-muted)">
                          {valLeft} mm
                        </text>
                        <text x={W - padRight + 6} y={y + 3} textAnchor="start" fontSize="10" fill="#94a3b8">
                          {valRight} μT
                        </text>
                      </g>
                    );
                  })}

                  {/* Critical Threshold Reference Line (15mm) */}
                  {15 <= maxDisp && (
                    <g>
                      <line x1={padLeft} y1={critY} x2={W - padRight} y2={critY} stroke="#ef4444" strokeDasharray="4 4" strokeWidth="1.2" opacity="0.8" />
                      <text x={W - padRight - 8} y={critY - 4} textAnchor="end" fontSize="9" fill="#ef4444" fontWeight="700">
                        CRITICAL THRESHOLD (15.0 mm)
                      </text>
                    </g>
                  )}

                  {/* Curve 1: Displacement (Primary Orange-Cyan) */}
                  <path d={dispPath} fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

                  {/* Curve 2: Magnetic Flux (Secondary Blue Dashed) */}
                  <path d={magPath} fill="none" stroke="#0284c7" strokeWidth="1.6" strokeDasharray="4 2" strokeLinecap="round" opacity="0.75" />

                  {/* Interactive Crosshair & Hover Target */}
                  {dispPoints.map((p, i) => (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={hoveredPoint?.sample.id === p.sample.id ? 5 : 3}
                      fill="#d97706"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredPoint(p)}
                    />
                  ))}

                  {/* Time Axis Labels */}
                  {chartData.length > 1 && (
                    <>
                      <text x={padLeft} y={H - 8} fontSize="10" fill="var(--text-muted)">
                        {chartData[0].formattedTime}
                      </text>
                      <text x={W - padRight} y={H - 8} textAnchor="end" fontSize="10" fill="var(--text-muted)">
                        {chartData[chartData.length - 1].formattedTime}
                      </text>
                    </>
                  )}
                </svg>
              );
            })()
          )}

          {/* Hover Tooltip Card */}
          {hoveredPoint && (
            <div
              style={{
                position: 'absolute',
                top: Math.max(10, (hoveredPoint.y / 220) * 260 - 70),
                left: Math.min(window.innerWidth - 250, (hoveredPoint.x / 800) * 600),
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-glass)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: '0.75rem',
                zIndex: 20,
                pointerEvents: 'none',
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>
                {hoveredPoint.sample.formattedTime}
              </div>
              <div style={{ color: '#d97706', fontWeight: 600 }}>
                Displacement: <strong>{hoveredPoint.sample.displacementMm.toFixed(2)} mm</strong>
              </div>
              <div style={{ color: '#0284c7', fontSize: '0.7rem' }}>
                Magnetic Flux: <strong>{hoveredPoint.sample.magneticUt.toFixed(1)} μT</strong>
              </div>
            </div>
          )}
        </div>

        {/* Chart Legend */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-glass)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 600 }}>
              <span style={{ width: 14, height: 3, backgroundColor: '#d97706', borderRadius: 2 }} />
              <span>Displacement (mm, Left Axis)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-main)', fontWeight: 600 }}>
              <span style={{ width: 14, height: 2, borderBottom: '2px dashed #0284c7' }} />
              <span>Magnetic Flux (μT, Right Axis)</span>
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            *Estimated measurement based on baseline flux delta.
          </div>
        </div>
      </div>

      {/* 4. SECONDARY INFORMATION: UNDERGROUND ENVIRONMENTAL READINGS */}
      <div className="glass-panel" style={{ padding: '16px 20px', borderRadius: 10 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layers size={16} style={{ color: 'var(--accent-cyan)' }} />
          <span>Subsurface Ambient & Soil Environment</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          {/* Temperature */}
          <div style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>
              <Thermometer size={14} style={{ color: '#ef4444' }} />
              <span>TEMPERATURE</span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
              {currentSample.temperatureC.toFixed(1)} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>°C</span>
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Status: {currentSample.dhtStatus}
            </div>
          </div>

          {/* Humidity */}
          <div style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>
              <Droplets size={14} style={{ color: '#0284c7' }} />
              <span>RELATIVE HUMIDITY</span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
              {currentSample.humidityPercent.toFixed(0)} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>%</span>
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Strata: Stable Dewpoint
            </div>
          </div>

          {/* Soil Moisture */}
          <div style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>
              <Layers size={14} style={{ color: '#10b981' }} />
              <span>SOIL MOISTURE</span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
              {currentSample.soilPercent.toFixed(1)} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>%</span>
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
              ADC Raw: {currentSample.soilRaw}
            </div>
          </div>

          {/* Gas MQ-7 */}
          <div style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.72rem', fontWeight: 600 }}>
              <Wind size={14} style={{ color: '#f59e0b' }} />
              <span>CARBON MONOXIDE (CO)</span>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: currentSample.mq7Ppm > 25 ? '#ef4444' : 'var(--text-main)', marginTop: 4 }}>
              {currentSample.mq7Ppm.toFixed(1)} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>PPM</span>
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Threshold: &lt; 25.0 PPM
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
