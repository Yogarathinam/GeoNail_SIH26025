import { useState, useEffect } from 'react';
import { CanvasViewport, type ViewportSettings } from './components/CanvasViewport';
import { HUDOverlay } from './components/HUDOverlay';
import { MCUTelemetryDashboard } from './components/MCUTelemetryDashboard';
import { DigitalTwinMinefield } from './components/DigitalTwinMinefield';
import { DocPanel } from './components/DocPanel';
import type { RockInfo } from './components/MiningEnvironment';
import { Flame, Sun, Moon, Layers, Cpu, Layers3 } from 'lucide-react';

export interface AppThemeSettings {
  themeMode: 'light' | 'dark';
  setThemeMode: (mode: 'light' | 'dark') => void;
}

export default function App() {
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const [viewWindow, setViewWindow] = useState<'cad' | 'mcuDashboard' | 'digitalTwin'>('mcuDashboard');

  const [settings, setSettings] = useState<ViewportSettings>({
    envMode: 'lithoPin',
    mineType: 'anthracite',
    rockDensity: 'medium',
    wireframeTerrain: false,
    roughness: 0.85,
    lightPreset: 'halogenWork',
    timeOfDay: 14, // 14:00 Midday Sun
    fogDensity: 0.2,
    cameraPreset: 'productCloseUp',
    autoRotate: false,
    rotateSpeed: 0,
    showGrid: true,

    // LithoPin Stake Settings
    lithoPinLockProgress: 0, // 0 = LOCKED (0°), 1 = RELEASED (90° CCW)
    lithoPinAttachStep: 5, // Fully Seated & Locked Cap View by default
    lithoPinRemoveStep: 0,
    lithoPinCapRotation: 0,
    lithoPinExploded: 0,
    lithoPinCutaway: false,
    lithoPinLoadPath: false,
    lithoPinDragMode: false,
    selectedComponent: null,
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  const [selectedRock, setSelectedRock] = useState<RockInfo | null>(null);

  const handleComponentSelect = (compName: string) => {
    setSettings((s) => ({
      ...s,
      selectedComponent: compName,
    }));
  };

  return (
    <div
      data-theme={themeMode}
      style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <header className="app-header">
        <div className="app-title">
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #0284c7, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
            }}
          >
            <Flame size={20} color="#ffffff" />
          </div>
          <div>
            <span className="gradient-text">GeoNail 3D Visualizer</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 8 }}>
              v3.5.0 Digital Twin & MCU
            </span>
          </div>
        </div>

        {/* View Mode Switcher: 3D CAD vs MCU Telemetry Dashboard vs Digital Twin Minefield */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--bg-card)',
            padding: '4px 8px',
            borderRadius: 12,
            border: '1px solid var(--border-glass)',
          }}
        >
          <button
            className={`icon-btn ${viewWindow === 'mcuDashboard' ? 'active' : ''}`}
            onClick={() => setViewWindow('mcuDashboard')}
            style={{ width: 'auto', padding: '4px 16px', fontSize: '0.82rem', fontWeight: 800, gap: 6 }}
          >
            <Cpu size={15} color="#10b981" />
            <span>MCU TELEMETRY DASHBOARD</span>
          </button>

          <button
            className={`icon-btn ${viewWindow === 'digitalTwin' ? 'active' : ''}`}
            onClick={() => setViewWindow('digitalTwin')}
            style={{ width: 'auto', padding: '4px 16px', fontSize: '0.82rem', fontWeight: 800, gap: 6 }}
          >
            <Layers3 size={15} color="#eab308" />
            <span>DIGITAL TWIN MINE FIELD</span>
          </button>

          <button
            className={`icon-btn ${viewWindow === 'cad' ? 'active' : ''}`}
            onClick={() => setViewWindow('cad')}
            style={{ width: 'auto', padding: '4px 16px', fontSize: '0.82rem', fontWeight: 800, gap: 6 }}
          >
            <Layers size={15} color="#0284c7" />
            <span>GEONAIL 3D CAD</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Theme Toggle Button */}
          <button
            className="icon-btn"
            onClick={() => setThemeMode(themeMode === 'light' ? 'dark' : 'light')}
            title={`Switch to ${themeMode === 'light' ? 'Dark' : 'Light'} Mode`}
            style={{ width: 'auto', padding: '0 12px', gap: 6, fontSize: '0.8rem', fontWeight: 600 }}
          >
            {themeMode === 'light' ? (
              <>
                <Moon size={16} color="#0284c7" />
                <span>Dark Theme</span>
              </>
            ) : (
              <>
                <Sun size={16} color="#eab308" />
                <span>Classic Light</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Viewport Container */}
      <main className="main-viewport-container">
        {viewWindow === 'digitalTwin' ? (
          <DigitalTwinMinefield settings={settings} setSettings={setSettings} />
        ) : viewWindow === 'mcuDashboard' ? (
          <MCUTelemetryDashboard settings={settings} setSettings={setSettings} />
        ) : (
          <>
            <CanvasViewport
              settings={settings}
              onSelectRock={(rock) => setSelectedRock(rock)}
              onSelectComponent={(compName) => handleComponentSelect(compName)}
            />
            <HUDOverlay settings={settings} setSettings={setSettings} />
            <DocPanel settings={settings} setSettings={setSettings} selectedRock={selectedRock} />
          </>
        )}
      </main>
    </div>
  );
}



