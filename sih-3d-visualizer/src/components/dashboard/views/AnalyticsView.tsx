import React, { useState, useMemo } from 'react';
import type { TelemetrySample, ExperimentalThresholds, SignalStatistic } from '../types';
import {
  TrendingUp,
  FileText,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

interface AnalyticsViewProps {
  history: TelemetrySample[];
  thresholds: ExperimentalThresholds;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  history,
  thresholds,
}) => {
  const [windowSamples, setWindowSamples] = useState<number>(100);

  // Take the target slice of history
  const sampleSlice = useMemo(() => {
    return history.slice(-windowSamples);
  }, [history, windowSamples]);

  const N = sampleSlice.length;

  // Compute actual descriptive statistics for each signal
  const stats: SignalStatistic[] = useMemo(() => {
    if (N === 0) return [];

    const signals: Array<{
      key: string;
      label: string;
      unit: string;
      category: 'direct' | 'calculated' | 'estimate';
      baseline: number;
      getter: (s: TelemetrySample) => number;
      isThresholdViolated: (val: number) => boolean;
    }> = [
      {
        key: 'roll',
        label: 'Roll Angle (X)',
        unit: '°',
        category: 'direct',
        baseline: 0.0,
        getter: (s) => s.roll,
        isThresholdViolated: (v) => Math.abs(v) >= thresholds.tiltWarning,
      },
      {
        key: 'pitch',
        label: 'Pitch Angle (Z)',
        unit: '°',
        category: 'direct',
        baseline: 0.0,
        getter: (s) => s.pitch,
        isThresholdViolated: (v) => Math.abs(v) >= thresholds.tiltWarning,
      },
      {
        key: 'vibrationRms',
        label: 'Vibration RMS',
        unit: 'g',
        category: 'direct',
        baseline: 0.02,
        getter: (s) => s.vibrationRms,
        isThresholdViolated: (v) => v >= thresholds.vibrationWarning,
      },
      {
        key: 'shockPeakG',
        label: 'Peak Shock',
        unit: 'g',
        category: 'direct',
        baseline: 1.0,
        getter: (s) => s.shockPeakG,
        isThresholdViolated: (v) => v >= 1.8,
      },
      {
        key: 'displacementMm',
        label: 'Displacement (Est)',
        unit: 'mm',
        category: 'estimate',
        baseline: 0.0,
        getter: (s) => s.displacementMm,
        isThresholdViolated: (v) => v >= thresholds.displacementWarning,
      },
      {
        key: 'magneticUt',
        label: 'Magnetic Field',
        unit: 'μT',
        category: 'direct',
        baseline: 47.6,
        getter: (s) => s.magneticUt,
        isThresholdViolated: (v) => v <= 35.0,
      },
      {
        key: 'temperatureC',
        label: 'Temperature',
        unit: '°C',
        category: 'direct',
        baseline: 24.0,
        getter: (s) => s.temperatureC,
        isThresholdViolated: (v) => v > 45.0,
      },
      {
        key: 'soilPercent',
        label: 'Soil Moisture',
        unit: '%',
        category: 'calculated',
        baseline: 40.0,
        getter: (s) => s.soilPercent,
        isThresholdViolated: (v) => v > 80.0,
      },
      {
        key: 'mq7Ppm',
        label: 'CO Gas Concentration',
        unit: 'PPM',
        category: 'calculated',
        baseline: 10.0,
        getter: (s) => s.mq7Ppm,
        isThresholdViolated: (v) => v >= thresholds.mq7WarningPpm,
      },
    ];

    return signals.map((sig) => {
      const vals = sampleSlice.map(sig.getter);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const sum = vals.reduce((a, b) => a + b, 0);
      const mean = sum / N;

      // Sample Standard Deviation: sqrt(sum((x - mean)^2) / (N - 1))
      const variance = N > 1 ? vals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (N - 1) : 0;
      const stdDev = Math.sqrt(variance);

      // Baseline deviation
      const baselineDev = Math.abs(mean - sig.baseline);

      // Rate of change (d/dt between last and first in window)
      const timeSpanSec = Math.max(1, (sampleSlice[N - 1].timestamp - sampleSlice[0].timestamp) / 1000);
      const rateOfChange = (vals[vals.length - 1] - vals[0]) / timeSpanSec;

      // Threshold crossings count
      const crossings = vals.filter(sig.isThresholdViolated).length;

      return {
        key: sig.key,
        label: sig.label,
        unit: sig.unit,
        category: sig.category,
        min,
        max,
        mean,
        stdDev,
        baseline: sig.baseline,
        baselineDeviation: baselineDev,
        rateOfChange,
        thresholdCrossings: crossings,
        current: vals[vals.length - 1],
      };
    });
  }, [sampleSlice, N, thresholds]);

  // Construct Factual Engineering Analysis Summary Statements
  const engineeringObservations = useMemo(() => {
    if (N < 5) {
      return ['Insufficient sample volume collected to generate verified geotechnical statistical trends. Minimum 5 samples required.'];
    }

    const obs: string[] = [];
    const rollStat = stats.find((s) => s.key === 'roll');
    const vibStat = stats.find((s) => s.key === 'vibrationRms');
    const dispStat = stats.find((s) => s.key === 'displacementMm');
    const coStat = stats.find((s) => s.key === 'mq7Ppm');

    // 1. Tilt observation
    if (rollStat) {
      if (rollStat.thresholdCrossings > 0) {
        obs.push(
          `Subsurface Roll Angle exceeded the configured experimental warning threshold (±${thresholds.tiltWarning}°) in ${rollStat.thresholdCrossings} of ${N} samples (Max excursion: ${rollStat.max.toFixed(1)}°, Min: ${rollStat.min.toFixed(1)}°).`
        );
      } else {
        obs.push(
          `Subsurface Roll Angle remained stable within nominal limits (Mean: ${rollStat.mean.toFixed(2)}°, SD: ±${rollStat.stdDev.toFixed(2)}°) with zero threshold crossings across ${N} samples.`
        );
      }
    }

    // 2. Vibration observation
    if (vibStat) {
      if (vibStat.thresholdCrossings > 0) {
        obs.push(
          `Dynamic Vibration RMS exceeded the ${thresholds.vibrationWarning}g experimental threshold for ${vibStat.thresholdCrossings} consecutive/intermittent intervals, reaching a maximum recorded level of ${vibStat.max.toFixed(3)}g.`
        );
      } else {
        obs.push(
          `Vibration RMS averaged ${vibStat.mean.toFixed(3)}g (Standard Deviation: ${vibStat.stdDev.toFixed(4)}g), indicating absence of significant micro-seismic or mechanical excitation.`
        );
      }
    }

    // 3. Subterranean displacement observation
    if (dispStat) {
      if (dispStat.thresholdCrossings > 0) {
        obs.push(
          `Derived anchor displacement exceeded the ${thresholds.displacementWarning}mm warning threshold (${dispStat.thresholdCrossings} readings), with maximum extension reaching ${dispStat.max.toFixed(2)}mm.`
        );
      } else {
        obs.push(
          `Subterranean anchor linear displacement averaged ${dispStat.mean.toFixed(2)}mm with a stable drift rate of ${dispStat.rateOfChange.toFixed(3)} mm/s.`
        );
      }
    }

    // 4. Gas observation
    if (coStat && coStat.thresholdCrossings > 0) {
      obs.push(
        `Carbon Monoxide concentration crossed the ${thresholds.mq7WarningPpm} PPM threshold (${coStat.max.toFixed(1)} PPM peak). Geotechnical safety ventilation verification recommended.`
      );
    }

    return obs;
  }, [stats, N, thresholds]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. TOP STATISTICAL HEADER & WINDOW SELECTION */}
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
            <TrendingUp size={16} style={{ color: 'var(--accent-cyan)' }} />
            <span>Descriptive In-Memory Telemetry Statistics</span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
            Computed exclusively from real sample buffers in memory. No synthetic extrapolation or uncalibrated estimates.
          </div>
        </div>

        {/* Window Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            Analysis Window:
          </span>
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-card)', padding: '2px 4px', borderRadius: 6, border: '1px solid var(--border-glass)' }}>
            {[
              { label: '30 Samples', val: 30 },
              { label: '100 Samples', val: 100 },
              { label: '300 Samples (Max)', val: 300 },
            ].map((btn) => (
              <button
                key={btn.val}
                onClick={() => setWindowSamples(btn.val)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                  background: windowSamples === btn.val ? 'var(--bg-surface)' : 'transparent',
                  color: windowSamples === btn.val ? 'var(--accent-cyan)' : 'var(--text-muted)',
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. STATISTICAL BREAKDOWN TABLE */}
      <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: 12, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78125rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-glass)', textAlign: 'left', color: 'var(--text-muted)' }}>
              <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Signal Metric</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Classification</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Current</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Min</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Max</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Mean (x̄)</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Std Dev (σ)</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Rate (d/dt)</th>
              <th style={{ padding: '8px 10px', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase' }}>Crossings</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => {
              const isWarning = s.thresholdCrossings > 0;
              return (
                <tr
                  key={s.key}
                  style={{
                    borderBottom: '1px solid var(--border-glass)',
                    transition: 'background 0.1s',
                  }}
                >
                  <td style={{ padding: '10px 10px', fontWeight: 700, color: 'var(--text-main)' }}>
                    {s.label}
                  </td>
                  <td style={{ padding: '10px 10px' }}>
                    <span
                      style={{
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background:
                          s.category === 'direct'
                            ? '#0284c715'
                            : s.category === 'estimate'
                            ? '#d9770615'
                            : '#10b98115',
                        color:
                          s.category === 'direct'
                            ? '#0284c7'
                            : s.category === 'estimate'
                            ? '#d97706'
                            : '#10b981',
                        border: `1px solid ${
                          s.category === 'direct'
                            ? '#0284c733'
                            : s.category === 'estimate'
                            ? '#d9770633'
                            : '#10b98133'
                        }`,
                      }}
                    >
                      {s.category === 'direct'
                        ? 'Direct Sensor'
                        : s.category === 'estimate'
                        ? 'Flux Estimate'
                        : 'Calculated'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 10px', fontWeight: 700, color: isWarning ? '#ef4444' : 'var(--text-main)' }}>
                    {s.current.toFixed(s.unit === 'g' ? 3 : 2)} {s.unit}
                  </td>
                  <td style={{ padding: '10px 10px', color: 'var(--text-muted)' }}>
                    {s.min.toFixed(s.unit === 'g' ? 3 : 2)} {s.unit}
                  </td>
                  <td style={{ padding: '10px 10px', color: 'var(--text-muted)' }}>
                    {s.max.toFixed(s.unit === 'g' ? 3 : 2)} {s.unit}
                  </td>
                  <td style={{ padding: '10px 10px', fontWeight: 600, color: 'var(--text-main)' }}>
                    {s.mean.toFixed(s.unit === 'g' ? 3 : 2)} {s.unit}
                  </td>
                  <td style={{ padding: '10px 10px', color: 'var(--text-muted)' }}>
                    ±{s.stdDev.toFixed(s.unit === 'g' ? 4 : 2)}
                  </td>
                  <td style={{ padding: '10px 10px', color: Math.abs(s.rateOfChange) > 0.05 ? '#f59e0b' : 'var(--text-muted)' }}>
                    {s.rateOfChange > 0 ? '+' : ''}{s.rateOfChange.toFixed(3)}/s
                  </td>
                  <td style={{ padding: '10px 10px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        background: isWarning ? '#ef444415' : '#10b98115',
                        color: isWarning ? '#ef4444' : '#10b981',
                        border: `1px solid ${isWarning ? '#ef444444' : '#10b98144'}`,
                      }}
                    >
                      {s.thresholdCrossings}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 3. FACTUAL ENGINEERING ANALYSIS SUMMARY */}
      <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <FileText size={16} style={{ color: 'var(--accent-cyan)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)' }}>
            Engineering Analysis Summary ({N} samples evaluated)
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {engineeringObservations.map((obs, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 8,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-glass)',
                fontSize: '0.78125rem',
                color: 'var(--text-main)',
                lineHeight: 1.5,
              }}
            >
              <div style={{ marginTop: 2 }}>
                {obs.includes('exceeded') ? (
                  <AlertTriangle size={15} style={{ color: '#f59e0b' }} />
                ) : (
                  <CheckCircle size={15} style={{ color: '#10b981' }} />
                )}
              </div>
              <div>{obs}</div>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 14,
            padding: '10px 14px',
            borderRadius: 6,
            background: 'var(--bg-card)',
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            lineHeight: 1.4,
          }}
        >
          <strong>Methodology Note:</strong> Calculations utilize sample mean (x̄) and Bessel-corrected standard deviation (σ). Threshold indicators reference configured experimental safety limits. No uncalibrated AI confidence scores or extrapolated curves are applied.
        </div>
      </div>
    </div>
  );
};
