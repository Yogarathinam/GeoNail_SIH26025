import React, { useState, useEffect } from 'react';
import type { ViewportSettings } from './CanvasViewport';
import { GEONAIL_COMPONENTS } from './GeoNailAssembly';

import {
  RotateCw,
  Eye,
  Box,
  Move,
  Play,
  Pause,
  ShieldCheck,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Maximize2,
  Lock,
  Settings,
  X,
  Download,
  Upload,
  Target,
  Circle,
  Zap,
} from 'lucide-react';


interface HUDOverlayProps {
  settings: ViewportSettings;
  setSettings: React.Dispatch<React.SetStateAction<ViewportSettings>>;
}

export const HUDOverlay: React.FC<HUDOverlayProps> = ({ settings, setSettings }) => {
  const [activeTab, setActiveTab] = useState<'attach' | 'remove' | 'spin' | 'spikeLock'>('attach');

  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isTopBarOpen, setIsTopBarOpen] = useState(true);
  const [isDrawerHovered, setIsDrawerHovered] = useState(false);
  const [isDrawerLocked, setIsDrawerLocked] = useState(false);
  const isDrawerExpanded = isDrawerHovered || isDrawerLocked;



  // Auto-play interval timer for smooth sequence animation
  useEffect(() => {
    let interval: any = null;
    if (isAutoPlaying && settings.envMode === 'lithoPin') {
      interval = setInterval(() => {
        setSettings((s) => {
          if (activeTab === 'attach') {
            const nextStep = (s.lithoPinAttachStep % 5) + 1;
            return {
              ...s,
              lithoPinRemoveStep: 0,
              lithoPinAttachStep: nextStep,
            };
          } else if (activeTab === 'remove') {
            const nextStep = (s.lithoPinRemoveStep % 5) + 1;
            return {
              ...s,
              lithoPinAttachStep: 0,
              lithoPinRemoveStep: nextStep,
            };
          }
          return s;
        });
      }, 1800);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isAutoPlaying, activeTab, setSettings, settings.envMode]);

  // Phase Definitions for Stepper Timeline Pills
  const attachSteps = [
    { step: 0, title: 'Step 0: Separated', desc: 'Cap floating in mid-air above main shaft' },
    { step: 1, title: 'Step 1: Align 0°', desc: 'Hover just above shaft aligned at 0°' },
    { step: 2, title: 'Step 2: Push Level 1', desc: 'Push down vertical slot to reach Level 1' },
    { step: 3, title: 'Step 3: Rotate 90°', desc: 'Rotate 90° CW along track to hard stop' },
    { step: 4, title: 'Step 4: Push Level 2', desc: 'Push down transfer slot into Level 2' },
    { step: 5, title: 'Step 5: Captive Level 2', desc: 'Captive in Level 2 groove (Infinite 360° Spin)' },
  ];

  const removeSteps = [
    { step: 1, title: 'Step 1: Rotate to 0°', desc: 'Rotate cap back to 0° OPEN alignment mark' },
    { step: 2, title: 'Step 2: Pull to Level 1', desc: 'Pull UP through transfer slot to Level 1' },
    { step: 3, title: 'Step 3: Rotate CCW 90°', desc: 'Rotate 90° CCW back to vertical entry slot' },
    { step: 4, title: 'Step 4: Pull to Rim', desc: 'Pull UP through vertical slot to hover' },
    { step: 5, title: 'Step 5: Detached', desc: 'Cap lifted high into mid-air separated' },
  ];

  // Helper for current Mechanical Status Card Text
  const getMechanicalStatusText = () => {
    if (activeTab === 'spikeLock') {
      if (settings.lithoPinSpikeDetached) {
        return '⚡ PIECE 2: SPIKE ANCHOR FREE-FALL DETACHED! Dropped under gravity to bedrock surface (Y=-18.00)';
      }
      const lock = settings.lithoPinSpikeLock || 0;
      if (lock < -0.1) {
        return '🔒 PIECE 2: LEFT LOCK ENGAGED (Tab A -> Groove 1, Tab B -> Groove 4 Hard-Stop Pockets)';
      } else if (lock > 0.1) {
        return '🔒 PIECE 2: RIGHT LOCK ENGAGED (Tab A -> Groove 2, Tab B -> Groove 3 Hard-Stop Pockets)';
      }
      return '⭕ PIECE 2: CENTERED / NEUTRAL (Tabs floating in neutral clearance zone — Ready to Detach)';
    }


    if (settings.lithoPinRemoveStep > 0) {

      switch (settings.lithoPinRemoveStep) {
        case 1:
          return '🔒 REMOVAL STEP 1: Cap Rotated back to 0° OPEN Alignment Mark';
        case 2:
          return '⬆️ REMOVAL STEP 2: Cap Pulled UP through Transfer Slot into Level 1 Track';
        case 3:
          return '🔄 REMOVAL STEP 3: Cap Rotated CCW 90° back to Vertical Entry Slot';
        case 4:
          return '⬆️ REMOVAL STEP 4: Cap Pulled UP through Vertical Entry Slot (Hovering Above Rim)';
        case 5:
        default:
          return '🔓 REMOVAL STEP 5: Cap Completely Detached & Floating in Mid-Air';
      }
    }
    switch (settings.lithoPinAttachStep) {
      case 0:
        return '☁️ STEP 0: Top Cap & Main Shaft Completely Separated (Floating Mid-Air View)';
      case 1:
        return '🎯 STEP 1: Cap Hovering Just Above Shaft Rim Aligned at 0° OPEN (Zero Shaft Contact)';
      case 2:
        return '⬇️ STEP 2: Cap Pushed Down 1.5 units into Vertical Entry Slots to Level 1 Cyan Blue Track';
      case 3:
        return '🔄 STEP 3: Cap Rotated CW 90° along Level 1 Track to Hard Stop Index';
      case 4:
        return '⬇️ STEP 4: Cap Pushed Down 0.6 units through Yellow Transfer Slot into Level 2 Green Groove';
      case 5:
      default: {
        const depthMm = Math.min(300, Math.max(0, Math.round(settings.lithoPinCapRotation * 45)));
        const forceN = Math.round(depthMm * 18.5);
        const isAnchored = depthMm >= 250;
        return `🛡️ STEP 5: Seated in Level 2 Groove | ⚙️ THREADED DRIVE: Rotation Drives 13.5u Screw Rod Downward (Depth: ${depthMm} mm ${isAnchored ? '⚡ BEDROCK ANCHOR LOCKED' : ''} | Thrust: ${forceN} N)`;
      }
    }
  };





  return (
    <>
      {/* Top-Left Corner Component Inspector Card (100% Zoom-Immune & Screen-Space) */}
      {settings.envMode === 'lithoPin' && settings.selectedComponent && GEONAIL_COMPONENTS[settings.selectedComponent] && (
        <div
          className="glass-panel"
          style={{
            position: 'fixed',
            top: 75,
            left: 20,
            width: 310,
            padding: '12px 16px',
            zIndex: 20,
            pointerEvents: 'auto',
            borderRadius: '12px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
            border: '1.5px solid var(--accent-cyan)',
            background: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#38bdf8' }}>
              🔍 {GEONAIL_COMPONENTS[settings.selectedComponent].title}
            </span>
            <button
              onClick={() => setSettings((s) => ({ ...s, selectedComponent: null }))}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700 }}
              title="Close Component Inspector"
            >
              ✕
            </button>
          </div>

          <div style={{ fontSize: '0.74rem', color: '#cbd5e1', marginBottom: 6, lineHeight: 1.4 }}>
            {GEONAIL_COMPONENTS[settings.selectedComponent].functionality}
          </div>

          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 3 }}>
            <strong style={{ color: '#e2e8f0' }}>Material:</strong> {GEONAIL_COMPONENTS[settings.selectedComponent].material}
          </div>

          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 3 }}>
            <strong style={{ color: '#e2e8f0' }}>Dimensions:</strong> {GEONAIL_COMPONENTS[settings.selectedComponent].dimensions}
          </div>

          <div style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 700, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
            <ShieldCheck size={14} color="#10b981" />
            <span>Rating: {GEONAIL_COMPONENTS[settings.selectedComponent].ipRating}</span>
          </div>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          right: 20,
          zIndex: 5,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          pointerEvents: 'none',
        }}
      >
        {/* Top Floating Utility Strip (3D Tools & Camera Angles) */}

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
        {/* 3D Action Tools & Camera Angles (Minimizable) */}

        {settings.envMode === 'lithoPin' && (
          isTopBarOpen ? (
            <div
              className="glass-panel"
              style={{
                pointerEvents: 'auto',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {/* Camera View Angle Presets (including Bottom, Top, Front, Full Stake) */}
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className={`icon-btn ${settings.cameraPreset === 'productCloseUp' ? 'active' : ''}`}
                  onClick={() => setSettings((s) => ({ ...s, cameraPreset: 'productCloseUp' }))}
                  style={{ width: 'auto', padding: '0 8px', fontSize: '0.74rem' }}
                  title="Full Stake Assembly View"
                >
                  Full Assembly
                </button>
                <button
                  className={`icon-btn ${settings.cameraPreset === 'front' ? 'active' : ''}`}
                  onClick={() => setSettings((s) => ({ ...s, cameraPreset: 'front' }))}
                  style={{ width: 'auto', padding: '0 8px', fontSize: '0.74rem' }}
                  title="Front View Close-Up"
                >
                  Front
                </button>
                <button
                  className={`icon-btn ${settings.cameraPreset === 'bottom' ? 'active' : ''}`}
                  onClick={() => setSettings((s) => ({ ...s, cameraPreset: 'bottom' }))}
                  style={{ width: 'auto', padding: '0 8px', fontSize: '0.74rem' }}
                  title="View Assembly from Bottom Underneath"
                >
                  Bottom View
                </button>
                <button
                  className={`icon-btn ${settings.cameraPreset === 'top' ? 'active' : ''}`}
                  onClick={() => setSettings((s) => ({ ...s, cameraPreset: 'top' }))}
                  style={{ width: 'auto', padding: '0 8px', fontSize: '0.74rem' }}
                  title="View Assembly from Top Above"
                >
                  Top View
                </button>
                <button
                  className={`icon-btn ${settings.cameraPreset === 'iso' ? 'active' : ''}`}
                  onClick={() => setSettings((s) => ({ ...s, cameraPreset: 'iso' }))}
                  style={{ width: 'auto', padding: '0 8px', fontSize: '0.74rem' }}
                  title="3D Isometric View"
                >
                  3D ISO
                </button>
              </div>

              {/* Cutaway Toggle */}
              <button
                className={`icon-btn ${settings.lithoPinCutaway ? 'active' : ''}`}
                onClick={() => setSettings((s) => ({ ...s, lithoPinCutaway: !s.lithoPinCutaway }))}
                style={{ width: 'auto', padding: '0 10px', fontSize: '0.75rem', gap: 5 }}
                title="Toggle X-Ray Cutaway Mode"
              >
                <Eye size={15} color="#0284c7" />
                <span>X-Ray Cutaway</span>
              </button>

              {/* Exploded View Slider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px' }}>
                <Box size={15} color="#eab308" />
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Exploded: {(settings.lithoPinExploded * 100).toFixed(0)}%
                </span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.lithoPinExploded}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, lithoPinExploded: parseFloat(e.target.value) }))
                  }
                  style={{ width: 75, accentColor: '#eab308', cursor: 'pointer' }}
                />
              </div>

              {/* 3D Drag Mode */}
              <button
                className={`icon-btn ${settings.lithoPinDragMode ? 'active' : ''}`}
                onClick={() => setSettings((s) => ({ ...s, lithoPinDragMode: !s.lithoPinDragMode }))}
                style={{ width: 'auto', padding: '0 10px', fontSize: '0.75rem', gap: 5 }}
                title="Toggle 3D Interactive Component Drag Mode"
              >
                <Move size={15} color="#f59e0b" />
                <span>3D Drag</span>
              </button>

              {/* Show Component Labels Toggle */}
              <button
                className={`icon-btn ${settings.showComponentLabels ? 'active' : ''}`}
                onClick={() => setSettings((s) => ({ ...s, showComponentLabels: !s.showComponentLabels }))}
                style={{ width: 'auto', padding: '0 10px', fontSize: '0.75rem', gap: 5 }}
                title="Toggle Dynamic 3D CAD Leader-Line Callout Labels"
              >
                <span>🏷️ Show Labels</span>
              </button>

              {/* Reset View Button */}
              <button
                className="icon-btn"
                onClick={() =>
                  setSettings((s) => ({
                    ...s,
                    lithoPinAttachStep: 0,
                    lithoPinRemoveStep: 0,
                    lithoPinExploded: 0,
                    lithoPinCutaway: false,
                    lithoPinDragMode: false,
                  }))
                }
                style={{ width: 'auto', padding: '0 8px', fontSize: '0.75rem', gap: 4 }}
                title="Reset Assembly to Initial Separated Position"
              >
                <RefreshCw size={14} />
                <span>Reset</span>
              </button>

              {/* Minimize Button */}
              <button
                className="icon-btn"
                onClick={() => setIsTopBarOpen(false)}
                style={{ width: 28, height: 28, padding: 0 }}
                title="Minimize Utility Toolbar"
              >
                <ChevronUp size={16} color="#94a3b8" />
              </button>
            </div>
          ) : (
            <button
              className="glass-panel icon-btn"
              onClick={() => setIsTopBarOpen(true)}
              style={{
                pointerEvents: 'auto',
                padding: '6px 14px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#38bdf8',
                gap: 6,
              }}
              title="Expand Utility Toolbar"
            >
              <Maximize2 size={14} />
              <span>📷 TOOLBAR & VIEWS</span>
              <ChevronDown size={16} />
            </button>
          )
        )}

      </div>


      {/* GeoNail Left-Side Hover-Expand Sequence Controller Drawer */}
      {settings.envMode === 'lithoPin' && (
        <div
          className="geonail-left-drawer"
          onMouseEnter={() => setIsDrawerHovered(true)}
          onMouseLeave={() => setIsDrawerHovered(false)}
        >
          {!isDrawerExpanded ? (
            <div
              className="geonail-drawer-collapsed"
              onClick={() => setIsDrawerLocked(true)}
              title="Click or Hover to Expand GeoNail Controller"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Settings size={16} color="#38bdf8" />
                <span>⚙️ GEONAIL CONTROLLER</span>
              </div>
              <ChevronRight size={16} color="#94a3b8" />
            </div>
          ) : (
            <div className="geonail-drawer-expanded">
              {/* Header Strip & Pin/Lock Button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(2,132,199,0.25)', paddingBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', fontWeight: 800, color: '#38bdf8' }}>
                  <Settings size={16} color="#38bdf8" />
                  <span>⚙️ GEONAIL CONTROLLER</span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="icon-btn"
                    onClick={() => setIsDrawerLocked(!isDrawerLocked)}
                    style={{ width: 26, height: 26, padding: 0 }}
                    title={isDrawerLocked ? 'Unlock Drawer (Auto-Collapse on Leave)' : 'Lock Drawer Open'}
                  >
                    <Lock size={13} color={isDrawerLocked ? '#10b981' : '#94a3b8'} />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => {
                      setIsDrawerLocked(false);
                      setIsDrawerHovered(false);
                    }}
                    style={{ width: 26, height: 26, padding: 0 }}
                    title="Collapse Drawer"
                  >
                    <X size={13} color="#94a3b8" />
                  </button>
                </div>
              </div>

              {/* Mode Selector Tabs Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <button
                  className={`icon-btn ${activeTab === 'attach' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('attach');
                    setSettings((s) => ({ ...s, lithoPinRemoveStep: 0, lithoPinAttachStep: 1 }));
                  }}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '0.72rem', fontWeight: 700, justifyContent: 'center', gap: 4 }}
                >
                  <Download size={13} />
                  <span>ATTACH (5P)</span>
                </button>

                <button
                  className={`icon-btn ${activeTab === 'remove' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('remove');
                    setSettings((s) => ({ ...s, lithoPinAttachStep: 0, lithoPinRemoveStep: 1 }));
                  }}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '0.72rem', fontWeight: 700, justifyContent: 'center', gap: 4 }}
                >
                  <Upload size={13} />
                  <span>REMOVE (6P)</span>
                </button>

                <button
                  className={`icon-btn ${activeTab === 'spin' ? 'active' : ''}`}
                  onClick={() => setActiveTab('spin')}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '0.72rem', fontWeight: 700, justifyContent: 'center', gap: 4 }}
                >
                  <RotateCw size={13} />
                  <span>360° SPIN</span>
                </button>

                <button
                  className={`icon-btn ${activeTab === 'spikeLock' ? 'active' : ''}`}
                  onClick={() => setActiveTab('spikeLock')}
                  style={{ width: '100%', padding: '6px 8px', fontSize: '0.72rem', fontWeight: 700, justifyContent: 'center', gap: 4 }}
                >
                  <Target size={13} />
                  <span>ROTARY LOCK</span>
                </button>
              </div>

              {/* Auto Animate Toggle */}
              <button
                className="glow-btn"
                onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  justifyContent: 'center',
                  background: isAutoPlaying ? '#ef4444' : undefined,
                }}
              >
                {isAutoPlaying ? <Pause size={14} /> : <Play size={14} />}
                <span>{isAutoPlaying ? 'PAUSE AUTO ANIMATION' : 'AUTO ANIMATE SEQUENCE'}</span>
              </button>

              {/* Vertical Step Selector List */}
              {activeTab === 'attach' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {attachSteps.map((s) => (
                    <button
                      key={s.step}
                      className={`stepper-pill ${settings.lithoPinAttachStep === s.step ? 'stepper-pill-active' : ''}`}
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          lithoPinRemoveStep: 0,
                          lithoPinAttachStep: s.step,
                        }))
                      }
                      style={{ textAlign: 'left', alignItems: 'flex-start', padding: '6px 10px' }}
                    >
                      <div style={{ fontWeight: 800 }}>{s.title}</div>
                      <div style={{ fontSize: '0.64rem', opacity: 0.8, fontWeight: 400 }}>{s.desc}</div>
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'remove' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {removeSteps.map((s) => {
                    const isActive = settings.lithoPinRemoveStep === s.step;
                    const isCompleted = settings.lithoPinRemoveStep > s.step;
                    return (
                      <button
                        key={s.step}
                        className={`stepper-pill ${isActive ? 'stepper-pill-active' : isCompleted ? 'stepper-pill-completed' : ''}`}
                        onClick={() =>
                          setSettings((st) => ({
                            ...st,
                            lithoPinAttachStep: 0,
                            lithoPinRemoveStep: s.step,
                          }))
                        }
                        style={{ textAlign: 'left', alignItems: 'flex-start', padding: '6px 10px' }}
                      >
                        <div style={{ fontWeight: 800 }}>{s.title}</div>
                        <div style={{ fontSize: '0.64rem', opacity: 0.8, fontWeight: 400 }}>{s.desc}</div>
                      </button>
                    );
                  })}
                </div>
              )}

              {activeTab === 'spin' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    <RotateCw size={16} color="#0284c7" />
                    <span>Free Spin Angle: {((settings.lithoPinCapRotation * 180) / Math.PI).toFixed(0)}°</span>
                  </div>
                  <input
                    type="range"
                    min="-6.28"
                    max="6.28"
                    step="0.05"
                    value={settings.lithoPinCapRotation}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, lithoPinCapRotation: parseFloat(e.target.value) }))
                    }
                    style={{ width: '100%', accentColor: '#0284c7', cursor: 'pointer' }}
                  />
                </div>
              )}

              {activeTab === 'spikeLock' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
                  <button
                    className={`icon-btn ${(settings.lithoPinSpikeLock || 0) < -0.1 ? 'active' : ''}`}
                    onClick={() =>
                      setSettings((s) => ({
                        ...s,
                        lithoPinSpikeLock: -Math.PI / 4,
                        lithoPinSpikeDetached: false,
                      }))
                    }
                    style={{ width: '100%', padding: '6px 10px', fontSize: '0.74rem', fontWeight: 800, justifyContent: 'flex-start', gap: 6 }}
                  >
                    <Lock size={13} color="#ef4444" />
                    <span>-45° CCW LOCK (Grooves 1 + 4)</span>
                  </button>

                  <button
                    className={`icon-btn ${Math.abs(settings.lithoPinSpikeLock || 0) <= 0.1 && !settings.lithoPinSpikeDetached ? 'active' : ''}`}
                    onClick={() =>
                      setSettings((s) => ({
                        ...s,
                        lithoPinSpikeLock: 0,
                        lithoPinSpikeDetached: false,
                      }))
                    }
                    style={{ width: '100%', padding: '6px 10px', fontSize: '0.74rem', fontWeight: 800, justifyContent: 'flex-start', gap: 6 }}
                  >
                    <Circle size={13} color="#eab308" />
                    <span>0° NEUTRAL (Clearance Zone)</span>
                  </button>

                  <button
                    className={`icon-btn ${(settings.lithoPinSpikeLock || 0) > 0.1 ? 'active' : ''}`}
                    onClick={() =>
                      setSettings((s) => ({
                        ...s,
                        lithoPinSpikeLock: Math.PI / 4,
                        lithoPinSpikeDetached: false,
                      }))
                    }
                    style={{ width: '100%', padding: '6px 10px', fontSize: '0.74rem', fontWeight: 800, justifyContent: 'flex-start', gap: 6 }}
                  >
                    <Lock size={13} color="#10b981" />
                    <span>+45° CW LOCK (Grooves 2 + 3)</span>
                  </button>

                  {/* Free-Fall Detachment Action Button */}
                  <button
                    className={`glow-btn ${settings.lithoPinSpikeDetached ? 'active' : ''}`}
                    onClick={() =>
                      setSettings((s) => ({
                        ...s,
                        lithoPinSpikeLock: 0,
                        lithoPinSpikeDetached: !s.lithoPinSpikeDetached,
                      }))
                    }
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      justifyContent: 'center',
                      background: settings.lithoPinSpikeDetached
                        ? 'linear-gradient(135deg, #0284c7, #38bdf8)'
                        : 'linear-gradient(135deg, #eab308, #ca8a04)',
                      color: '#0f172a',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      gap: 6,
                    }}
                  >
                    <Zap size={14} />
                    <span>{settings.lithoPinSpikeDetached ? 'SPIKE ANCHOR DETACHED — RE-ENGAGE' : 'FREE-FALL DROP TO BEDROCK'}</span>
                  </button>
                </div>
              )}


              {/* Status Banner */}
              <div className="status-banner" style={{ fontSize: '0.7rem', padding: '6px 10px' }}>
                <span>{getMechanicalStatusText()}</span>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  </>
);
};


