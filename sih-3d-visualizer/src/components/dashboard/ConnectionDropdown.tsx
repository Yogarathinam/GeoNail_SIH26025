import React, { useState, useRef, useEffect } from 'react';
import type { ConnectionSource, ConnectionState } from './types';
import { Wifi, Bluetooth, Usb, Radio, ChevronDown, Check, AlertCircle } from 'lucide-react';

interface ConnectionDropdownProps {
  currentSource: ConnectionSource;
  connectionState: ConnectionState;
  errorMessage: string | null;
  onSelectSource: (source: ConnectionSource) => void;
}

export const ConnectionDropdown: React.FC<ConnectionDropdownProps> = ({
  currentSource,
  connectionState,
  errorMessage,
  onSelectSource,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasBleSupport = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const hasSerialSupport = typeof navigator !== 'undefined' && 'serial' in navigator;

  const options: Array<{
    id: ConnectionSource;
    label: string;
    sublabel: string;
    icon: React.ReactNode;
    supported: boolean;
    unsupportedReason?: string;
  }> = [
    {
      id: 'wifi',
      label: 'Wi-Fi REST',
      sublabel: 'http://192.168.4.1/api/v1',
      icon: <Wifi size={14} />,
      supported: true,
    },
    {
      id: 'ble',
      label: 'Bluetooth LE',
      sublabel: 'Web BLE GATT (2.4 GHz)',
      icon: <Bluetooth size={14} />,
      supported: hasBleSupport,
      unsupportedReason: 'Web Bluetooth requires Chrome, Edge, or Opera.',
    },
    {
      id: 'serial',
      label: 'USB Serial',
      sublabel: 'Web Serial UART (115200)',
      icon: <Usb size={14} />,
      supported: hasSerialSupport,
      unsupportedReason: 'Web Serial requires Chrome or Edge.',
    },
    {
      id: 'simulated',
      label: 'Simulated Stream',
      sublabel: 'Synthetic 1Hz geotechnical baseline',
      icon: <Radio size={14} />,
      supported: true,
    },
  ];

  const currentOption = options.find((o) => o.id === currentSource) || options[3];

  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected':
        return '#10b981'; // subtle green
      case 'connecting':
        return '#f59e0b'; // amber
      case 'stale':
        return '#f59e0b'; // amber
      case 'error':
        return '#ef4444'; // red
      case 'disconnected':
      default:
        return '#94a3b8'; // grey
    }
  };

  const getStatusLabel = () => {
    switch (connectionState) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'stale':
        return 'Stale Telemetry';
      case 'error':
        return 'Error';
      case 'disconnected':
        return 'Disconnected';
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-glass)',
          borderRadius: 8,
          padding: '6px 12px',
          color: 'var(--text-main)',
          fontSize: '0.8125rem',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        title={errorMessage || `Source: ${currentOption.label} (${getStatusLabel()})`}
      >
        <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 500 }}>
          Connection:
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--accent-cyan)' }}>{currentOption.icon}</span>
          <span>{currentOption.label}</span>
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 7px',
            borderRadius: 999,
            background: `${getStatusColor()}18`,
            border: `1px solid ${getStatusColor()}44`,
            fontSize: '0.7rem',
            color: getStatusColor(),
            fontWeight: 700,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: getStatusColor(),
            }}
          />
          {getStatusLabel()}
        </span>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            width: 280,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-glass)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
            borderRadius: 10,
            zIndex: 100,
            padding: '6px',
            backdropFilter: 'blur(16px)',
          }}
        >
          <div style={{ padding: '6px 8px 4px', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 700 }}>
            Select Telemetry Source
          </div>

          {options.map((opt) => {
            const isSelected = opt.id === currentSource;
            return (
              <div
                key={opt.id}
                onClick={() => {
                  if (opt.supported) {
                    onSelectSource(opt.id);
                    setIsOpen(false);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 6,
                  cursor: opt.supported ? 'pointer' : 'not-allowed',
                  opacity: opt.supported ? 1 : 0.5,
                  background: isSelected ? 'var(--bg-surface-hover)' : 'transparent',
                  transition: 'background 0.1s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: isSelected ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                    {opt.icon}
                  </span>
                  <div>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {opt.supported ? opt.sublabel : opt.unsupportedReason}
                    </div>
                  </div>
                </div>
                {isSelected && <Check size={14} style={{ color: 'var(--accent-cyan)' }} />}
              </div>
            );
          })}

          {errorMessage && (
            <div
              style={{
                marginTop: 6,
                padding: '8px 10px',
                borderRadius: 6,
                background: '#ef444415',
                border: '1px solid #ef444433',
                fontSize: '0.72rem',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6,
              }}
            >
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
