import React from 'react';
import type { DashboardSection, ConnectionSource, ConnectionState } from './types';
import { ConnectionDropdown } from './ConnectionDropdown';
import { MapPin, Clock, Pause, Play } from 'lucide-react';

interface DashboardHeaderProps {
  currentSection: DashboardSection;
  connectionSource: ConnectionSource;
  connectionState: ConnectionState;
  errorMessage: string | null;
  onSelectSource: (source: ConnectionSource) => void;
  lastReceivedTimestamp: number;
  nodeId: string;
  location: string;
  isPaused: boolean;
  onTogglePause: () => void;
}

const SECTION_METADATA: Record<DashboardSection, { title: string; desc: string }> = {
  overview: {
    title: 'System Overview',
    desc: 'Real-time telemetry summary, key geotechnical metrics, and subterranean displacement trends.',
  },
  telemetry: {
    title: 'Live Telemetry Workspace',
    desc: 'Interactive high-frequency sensor signal observation, live time-series plotting, and raw packet inspection.',
  },
  analytics: {
    title: 'Descriptive Analytics & Statistics',
    desc: 'Statistical sample distributions, baseline drift variance, threshold crossings, and engineering event summaries.',
  },
  sensors: {
    title: 'Sensor Hardware & Diagnostics',
    desc: 'Reported interface state, sampling integrity, calibration offsets, and on-board diagnostic flags.',
  },
  alerts: {
    title: 'Incident Alerts & Brevo Integration',
    desc: 'Experimental threshold trigger management, cooldown controls, and transactional email alert dispatch.',
  },
  settings: {
    title: 'Device Settings & Calibration',
    desc: 'Hardware command execution, IMU auto-tare zeroing, network parameterization, and diagnostic logs.',
  },
};

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  currentSection,
  connectionSource,
  connectionState,
  errorMessage,
  onSelectSource,
  lastReceivedTimestamp,
  nodeId,
  location,
  isPaused,
  onTogglePause,
}) => {
  const meta = SECTION_METADATA[currentSection] || SECTION_METADATA.overview;

  const getFreshnessSeconds = () => {
    const sec = Math.floor((Date.now() - lastReceivedTimestamp) / 1000);
    if (sec <= 1) return 'Just now';
    if (sec < 60) return `${sec}s ago`;
    return `${Math.floor(sec / 60)}m ago`;
  };

  return (
    <header
      style={{
        height: 60,
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-glass)',
        backgroundColor: 'var(--bg-surface)',
        backdropFilter: 'blur(12px)',
        zIndex: 10,
        flexShrink: 0,
      }}
    >
      {/* Left: Section Title & Description */}
      <div>
        <h1
          style={{
            fontSize: '1rem',
            fontWeight: 800,
            color: 'var(--text-main)',
            letterSpacing: '-0.01em',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>{meta.title}</span>
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            lineHeight: 1.2,
            marginTop: 2,
          }}
        >
          {meta.desc}
        </p>
      </div>

      {/* Right: Controls & Dropdowns */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Node Selector (Compact badge style) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 10px',
            borderRadius: 6,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-glass)',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-main)',
          }}
          title={`Node: ${nodeId} (${location})`}
        >
          <MapPin size={13} style={{ color: 'var(--accent-cyan)' }} />
          <span>{nodeId}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>[{location}]</span>
        </div>

        {/* Connection Source Dropdown */}
        <ConnectionDropdown
          currentSource={connectionSource}
          connectionState={connectionState}
          errorMessage={errorMessage}
          onSelectSource={onSelectSource}
        />

        {/* Telemetry Stream Pause / Resume */}
        <button
          onClick={onTogglePause}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 10px',
            borderRadius: 6,
            background: isPaused ? '#ef444415' : 'var(--bg-card)',
            border: `1px solid ${isPaused ? '#ef444444' : 'var(--border-glass)'}`,
            color: isPaused ? '#ef4444' : 'var(--text-main)',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
          title={isPaused ? 'Resume live stream updates' : 'Pause telemetry stream for inspection'}
        >
          {isPaused ? <Play size={13} /> : <Pause size={13} />}
          <span>{isPaused ? 'Paused' : 'Live'}</span>
        </button>

        {/* Timestamp Freshness Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            borderLeft: '1px solid var(--border-glass)',
            paddingLeft: 12,
          }}
        >
          <Clock size={13} />
          <span>{getFreshnessSeconds()}</span>
        </div>
      </div>
    </header>
  );
};
