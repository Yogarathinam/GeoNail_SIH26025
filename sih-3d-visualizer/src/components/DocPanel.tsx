import React, { useState } from 'react';
import type { ViewportSettings } from './CanvasViewport';
import type { RockInfo } from './MiningEnvironment';
import { GEONAIL_COMPONENTS } from './GeoNailAssembly';
import {
  FileText,
  ChevronRight,
  ChevronLeft,
  UploadCloud,
  Sliders,
  Flame,
  Search,
  CheckCircle,
  Cpu,
  Layers,
  ShieldCheck,
} from 'lucide-react';

interface DocPanelProps {
  settings: ViewportSettings;
  setSettings: React.Dispatch<React.SetStateAction<ViewportSettings>>;
  selectedRock: RockInfo | null;
}

export const DocPanel: React.FC<DocPanelProps> = ({
  settings,
  setSettings,
  selectedRock,
}) => {

  const [isOpen, setIsOpen] = useState(false);


  const activeLithoPinSpec = settings.selectedComponent
    ? GEONAIL_COMPONENTS[settings.selectedComponent]
    : null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 24,
        right: 24,
        zIndex: 5,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
      }}
    >
      <button
        className="icon-btn glass-panel"
        onClick={() => setIsOpen(!isOpen)}
        style={{ marginTop: 8 }}
        title={isOpen ? 'Collapse Panel' : 'Expand Documentation Panel'}
      >
        {isOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>

      {isOpen && (
        <div
          className="glass-panel"
          style={{
            width: 340,
            maxHeight: 'calc(100vh - 120px)',
            overflowY: 'auto',
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {settings.envMode === 'lithoPin' ? (
                <Cpu size={20} color="#00f2fe" />
              ) : (
                <FileText size={20} color="#00f2fe" />
              )}
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                {settings.envMode === 'lithoPin' ? 'GeoNail CAD Inspector' : 'Coal Mine Specs'}
              </span>
            </div>
            <span className="badge" style={{ background: 'rgba(0, 242, 254, 0.15)', color: '#00f2fe' }}>
              {settings.envMode === 'openPit'
                ? 'Open-Pit'
                : settings.envMode === 'undergroundShaft'
                ? 'Underground'
                : 'GeoNail Node'}
            </span>
          </div>

          {/* LithoPin Mode Active Content */}
          {settings.envMode === 'lithoPin' ? (
            <>
              {/* Component Detailed Spec Card */}
              {activeLithoPinSpec ? (
                <div
                  className="glass-card"
                  style={{
                    padding: 16,
                    border: '1px solid rgba(0, 242, 254, 0.5)',
                    background: 'rgba(0, 242, 254, 0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#00f2fe', fontWeight: 700, fontSize: '0.88rem' }}>
                    <CheckCircle size={16} />
                    <span>{activeLithoPinSpec.title}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Material:</span>{' '}
                      <strong style={{ color: '#e2e8f0' }}>{activeLithoPinSpec.material}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Dimensions:</span>{' '}
                      <strong>{activeLithoPinSpec.dimensions}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Function:</span>{' '}
                      {activeLithoPinSpec.functionality}
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Rating:</span>{' '}
                      <span className="badge" style={{ fontSize: '0.7rem', background: '#10b98122', color: '#10b981' }}>
                        {activeLithoPinSpec.ipRating}
                      </span>
                    </div>
                    <div style={{ marginTop: 4, padding: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 6, fontSize: '0.72rem', borderLeft: '3px solid #ef4444' }}>
                      <span style={{ color: '#ef4444', fontWeight: 700 }}>Structural Path:</span> {activeLithoPinSpec.loadPath}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="glass-card"
                  style={{
                    padding: 14,
                    textAlign: 'center',
                    border: '1px dashed rgba(0, 242, 254, 0.3)',
                    background: 'rgba(0, 242, 254, 0.02)',
                  }}
                >
                  <Search size={22} color="#00f2fe" style={{ margin: '0 auto 6px' }} />
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Click any GeoNail component mesh in 3D scene to inspect engineering specifications.
                  </p>
                </div>
              )}

              {/* 8 Component Quick Selection List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  <Layers size={14} color="#00f2fe" />
                  <span>Assembly Components ({Object.keys(GEONAIL_COMPONENTS).length} Named Meshes)</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
                  {Object.values(GEONAIL_COMPONENTS).map((comp, idx) => {
                    const isSelected = settings.selectedComponent === comp.name;
                    return (
                      <button
                        key={comp.name}
                        onClick={() =>
                          setSettings((s) => ({
                            ...s,
                            selectedComponent: comp.name,
                          }))
                        }
                        style={{
                          textAlign: 'left',
                          padding: '6px 10px',
                          borderRadius: 6,
                          fontSize: '0.75rem',
                          background: isSelected ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                          border: isSelected ? '1px solid #00f2fe' : '1px solid transparent',
                          color: isSelected ? '#00f2fe' : 'var(--text-main)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>
                          {idx + 1}. {comp.title}
                        </span>
                        {isSelected && <CheckCircle size={12} color="#00f2fe" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* LithoPin Mechanical Design Specs Summary */}
              <div className="glass-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600 }}>
                  <ShieldCheck size={14} color="#10b981" />
                  <span>Geotechnical Specs</span>
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div>Main Shaft: 44mm Ø</div>
                  <div>Grip Cap: 58mm Ø</div>
                  <div>Strike Plate: 42mm Ø</div>
                  <div>Lead Screw: M12×5</div>
                  <div>Twist Angle: 90° CCW</div>
                  <div>IP Rating: IP67 / IP68</div>
                </div>
              </div>
            </>
          ) : (
            /* Open Pit & Underground Shaft Content */
            <>
              {/* Interactive Mineral Inspector Card (when user clicks a rock) */}
              {selectedRock ? (
                <div
                  className="glass-card"
                  style={{
                    padding: 16,
                    border: '1px solid rgba(0, 242, 254, 0.4)',
                    background: 'rgba(0, 242, 254, 0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#00f2fe', fontWeight: 700, fontSize: '0.85rem' }}>
                    <CheckCircle size={16} />
                    <span>Selected Ore Chunk #{selectedRock.id}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-main)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Type:</span>{' '}
                      <strong style={{ textTransform: 'capitalize' }}>{selectedRock.type}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Carbon:</span>{' '}
                      <strong style={{ color: '#eab308' }}>{selectedRock.carbonContent}% C</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Mass:</span> {selectedRock.massKg} kg
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Density:</span> {selectedRock.density} g/cm³
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className="glass-card"
                  style={{
                    padding: 12,
                    textAlign: 'center',
                    border: '1px dashed rgba(255, 255, 255, 0.15)',
                    background: 'rgba(255, 255, 255, 0.02)',
                  }}
                >
                  <Search size={20} color="#00f2fe" style={{ margin: '0 auto 6px' }} />
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Click on any coal chunk or rock in 3D scene to inspect mineral specs.
                  </p>
                </div>
              )}

              {/* Mining Site Documentation Dropzone */}
              <div
                className="glass-card"
                style={{
                  padding: 16,
                  textAlign: 'center',
                  border: '1px dashed rgba(234, 179, 8, 0.4)',
                  background: 'rgba(234, 179, 8, 0.03)',
                }}
              >
                <UploadCloud size={28} color="#eab308" style={{ margin: '0 auto 8px' }} />
                <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Awaiting Coal Mine Documentation
                </p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Upload coal seam surveys, tunnel maps, or excavation specs.
                </p>
              </div>

              {/* Geology Stats */}
              <div className="glass-card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600 }}>
                  <Flame size={14} color="#eab308" />
                  <span>Mine Geology Stats</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div>Mode: {settings.envMode}</div>
                  <div>Sun Time: {settings.timeOfDay.toFixed(0)}:00</div>
                  <div>Seam Depth: -45m</div>
                  <div>Carbon: 88% C</div>
                </div>
              </div>
            </>
          )}

          {/* Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sliders size={16} color="#a855f7" />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                View & Orbit Controls
              </span>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
                <span>Orbit Speed</span>
                <span>{settings.rotateSpeed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={settings.rotateSpeed}
                onChange={(e) => setSettings((s) => ({ ...s, rotateSpeed: parseFloat(e.target.value) }))}
                style={{ width: '100%', accentColor: '#00f2fe', cursor: 'pointer' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

