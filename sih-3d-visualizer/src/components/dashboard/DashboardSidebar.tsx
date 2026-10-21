import React from 'react';
import type { DashboardSection, ConnectionState } from './types';
import {
  LayoutDashboard,
  Radio,
  TrendingUp,
  Cpu,
  BellRing,
  Sliders,
  Flame,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

interface DashboardSidebarProps {
  currentSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  nodeId: string;
  overallStatus: 'NORMAL' | 'WARNING' | 'CRITICAL';
  connectionState: ConnectionState;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  currentSection,
  onSelectSection,
  isCollapsed,
  onToggleCollapse,
  nodeId,
  overallStatus,
  connectionState,
}) => {
  const navItems: Array<{
    id: DashboardSection;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    badge?: string;
  }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'telemetry', label: 'Live Telemetry', icon: Radio },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'sensors', label: 'Sensor Health', icon: Cpu },
    { id: 'alerts', label: 'Alerts & Email', icon: BellRing },
    { id: 'settings', label: 'Device Settings', icon: Sliders },
  ];

  const getStatusColor = () => {
    if (overallStatus === 'CRITICAL') return '#ef4444';
    if (overallStatus === 'WARNING') return '#f59e0b';
    return '#10b981';
  };

  return (
    <aside
      style={{
        width: isCollapsed ? 68 : 240,
        height: '100%',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-glass)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        flexShrink: 0,
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
        zIndex: 20,
      }}
    >
      {/* Top Brand & Navigation */}
      <div>
        {/* Brand Area */}
        <div
          style={{
            height: 60,
            padding: isCollapsed ? '0 14px' : '0 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            borderBottom: '1px solid var(--border-glass)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                flexShrink: 0,
              }}
            >
              <Flame size={18} />
            </div>
            {!isCollapsed && (
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  GeoNail™
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 500, letterSpacing: '0.02em' }}>
                  Monitoring System
                </div>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              onClick={onToggleCollapse}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Collapse sidebar"
            >
              <ChevronLeft size={16} />
            </button>
          )}
        </div>

        {/* Navigation Section */}
        <nav style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentSection === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onSelectSection(item.id)}
                title={isCollapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: isCollapsed ? '10px 0' : '9px 12px',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  borderRadius: 8,
                  border: isActive ? '1px solid var(--border-glow)' : '1px solid transparent',
                  background: isActive ? 'var(--bg-surface-hover)' : 'transparent',
                  color: isActive ? 'var(--accent-cyan)' : 'var(--text-main)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                }}
              >
                <Icon size={18} />
                {!isCollapsed && <span>{item.label}</span>}
                {isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '20%',
                      bottom: '20%',
                      width: 3,
                      borderRadius: '0 3px 3px 0',
                      backgroundColor: 'var(--accent-cyan)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Node Status & Collapse Toggle */}
      <div
        style={{
          padding: '12px 10px',
          borderTop: '1px solid var(--border-glass)',
          background: 'var(--bg-card)',
        }}
      >
        {!isCollapsed ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>MONITORED NODE</span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 800,
                  color: getStatusColor(),
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {overallStatus === 'NORMAL' ? <ShieldCheck size={12} /> : <AlertTriangle size={12} />}
                {overallStatus}
              </span>
            </div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.01em' }}>
              {nodeId}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Link: {connectionState.toUpperCase()}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={onToggleCollapse}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: 6,
                borderRadius: 4,
              }}
              title="Expand sidebar"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
