import React, { useState, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, Sparkles, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { GeoNailAssembly } from './GeoNailAssembly';
import type { ViewportSettings } from './CanvasViewport';
import {
  Activity,
  AlertTriangle,
  Compass,
  Eye,
  Maximize2,
  RotateCcw,
  Box,
  MapPin,
  TrendingDown,
  Layers3,
} from 'lucide-react';

export interface NodeDigitalTwinData {
  id: string;
  name: string;
  zone: string;
  position: [number, number, number];
  roll: number;
  pitch: number;
  yaw: number;
  displacementMm: number;
  vibrationRms: number;
  healthScore: number;
  anomaly: string;
  soilMoisture: number;
  temperatureC: number;
}

interface DigitalTwinMinefieldProps {
  settings: ViewportSettings;
  setSettings?: React.Dispatch<React.SetStateAction<ViewportSettings>>;
}

// ----------------------------------------------------------------------
// 1. PROCEDURAL SLOPE TERRAIN & GEOLOGICAL LAYERS
// ----------------------------------------------------------------------
function SlopeTerraceTerrain({
  isFailureActive,
  showCutaway,
}: {
  isFailureActive: boolean;
  showCutaway: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);

  // Generate terraced mine pit geometry with procedural deformation
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(50, 50, 60, 60);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colorArray = new Float32Array(pos.count * 3);

    const colorTopsoil = new THREE.Color('#78350f');
    const colorWeathered = new THREE.Color('#475569');
    const colorBedrock = new THREE.Color('#1e293b');
    const colorDeformed = new THREE.Color('#b91c1c');

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      const dist = Math.sqrt(x * x + z * z);
      const benchLevel = Math.floor(dist / 4.5);
      let y = benchLevel * 1.6 - 6.0;

      // Add terrain surface texture noise
      const noise =
        Math.sin(x * 0.25) * 0.4 +
        Math.cos(z * 0.25) * 0.4 +
        Math.sin(x * 0.6 + z * 0.6) * 0.2;

      y += noise;

      // If simulated failure active, sag slope zone A (X: -12 to 2, Z: -12 to 2)
      if (isFailureActive && x > -14 && x < 4 && z > -14 && z < 4) {
        const dropFactor = Math.cos(((x + 5) / 10) * Math.PI) * Math.cos(((z + 5) / 10) * Math.PI);
        y -= Math.max(0, dropFactor * 2.8);
      }

      pos.setY(i, y);

      // Color assignment based on elevation height
      let vertexColor = colorBedrock;
      if (y > -2.0) {
        vertexColor = colorTopsoil;
      } else if (y > -4.5) {
        vertexColor = colorWeathered;
      }

      if (isFailureActive && x > -12 && x < 2 && z > -12 && z < 2) {
        vertexColor = vertexColor.clone().lerp(colorDeformed, 0.45);
      }

      colorArray[i * 3] = vertexColor.r;
      colorArray[i * 3 + 1] = vertexColor.g;
      colorArray[i * 3 + 2] = vertexColor.b;
    }

    geo.computeVertexNormals();
    geo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
    return geo;
  }, [isFailureActive]);

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial
          vertexColors
          roughness={0.85}
          metalness={0.15}
          wireframe={false}
          clipShadows
          transparent={showCutaway}
          opacity={showCutaway ? 0.65 : 1.0}
        />
      </mesh>

      {/* Sub-surface Geological Layers Cutaway Visualization */}
      {showCutaway && (
        <group position={[0, -7.5, 0]}>
          <mesh position={[0, -2, 0]} receiveShadow>
            <boxGeometry args={[48, 4, 48]} />
            <meshStandardMaterial color="#0f172a" roughness={0.9} metalness={0.2} transparent opacity={0.8} />
          </mesh>
          <mesh position={[0, -4.5, 0]}>
            <boxGeometry args={[48, 1, 48]} />
            <meshBasicMaterial color="#0284c7" transparent opacity={0.3} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// ----------------------------------------------------------------------
// 2. DYNAMIC DEFORMATION STRAIN HEATMAP RING
// ----------------------------------------------------------------------
function StrainHeatmapRing({
  position,
  status,
  displacementMm,
}: {
  position: [number, number, number];
  status: 'nominal' | 'warning' | 'critical';
  displacementMm: number;
}) {
  const ringRef = useRef<THREE.Mesh>(null!);

  const color = status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#10b981';
  const scaleMultiplier = 1.0 + Math.min(2.5, displacementMm / 12.0);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const pulse = 1.0 + Math.sin(clock.getElapsedTime() * (status === 'critical' ? 8 : 3)) * 0.12;
      ringRef.current.scale.set(scaleMultiplier * pulse, scaleMultiplier * pulse, 1);
    }
  });

  return (
    <group position={[position[0], position[1] + 0.1, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={ringRef}>
        <ringGeometry args={[1.2, 2.4, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <ringGeometry args={[2.4, 2.6, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ----------------------------------------------------------------------
// 3. MAIN DIGITAL TWIN MINEFIELD COMPONENT
// ----------------------------------------------------------------------
export const DigitalTwinMinefield: React.FC<DigitalTwinMinefieldProps> = ({ settings: _settings }) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('GN-001');
  const [simulatedLandslide, setSimulatedLandslide] = useState<boolean>(false);
  const [showCutaway, setShowCutaway] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showHeatmap, setShowHeatmap] = useState<boolean>(true);

  const orbitRef = useRef<any>(null);

  // Live node states (Node GN-001 reacts dynamically to landslide simulation or MCU telemetry!)
  const nodes: Record<string, NodeDigitalTwinData> = useMemo(() => {
    return {
      'GN-001': {
        id: 'GN-001',
        name: 'GeoNail Probe #001 (Live Stream)',
        zone: 'Zone A - Primary Escarpment Slope',
        position: [-6.0, -1.8, -4.0],
        roll: simulatedLandslide ? 16.4 : 1.2,
        pitch: simulatedLandslide ? -12.8 : 0.8,
        yaw: 42.0,
        displacementMm: simulatedLandslide ? 34.5 : 2.4,
        vibrationRms: simulatedLandslide ? 0.842 : 0.022,
        healthScore: simulatedLandslide ? 62 : 98,
        anomaly: simulatedLandslide ? 'TILT_CRITICAL & DISPLACEMENT_SPIKE' : 'NONE',
        soilMoisture: simulatedLandslide ? 78.5 : 44.2,
        temperatureC: 28.4,
      },
      'GN-002': {
        id: 'GN-002',
        name: 'GeoNail Probe #002',
        zone: 'Zone B - North Highwall Crest',
        position: [8.0, 1.2, -10.0],
        roll: 0.6,
        pitch: -0.4,
        yaw: 15.0,
        displacementMm: 1.1,
        vibrationRms: 0.015,
        healthScore: 100,
        anomaly: 'NONE',
        soilMoisture: 38.0,
        temperatureC: 27.8,
      },
      'GN-003': {
        id: 'GN-003',
        name: 'GeoNail Probe #003',
        zone: 'Zone C - Haul Road Interface',
        position: [-10.0, -4.2, 8.0],
        roll: -2.1,
        pitch: 1.8,
        yaw: 88.0,
        displacementMm: simulatedLandslide ? 14.2 : 4.8,
        vibrationRms: simulatedLandslide ? 0.285 : 0.038,
        healthScore: simulatedLandslide ? 85 : 95,
        anomaly: simulatedLandslide ? 'TILT_WARNING' : 'NONE',
        soilMoisture: simulatedLandslide ? 65.0 : 42.1,
        temperatureC: 29.1,
      },
      'GN-004': {
        id: 'GN-004',
        name: 'GeoNail Probe #004',
        zone: 'Zone D - Overburden Baseline',
        position: [10.0, -3.8, 10.0],
        roll: 0.2,
        pitch: 0.1,
        yaw: 120.0,
        displacementMm: 0.5,
        vibrationRms: 0.012,
        healthScore: 100,
        anomaly: 'NONE',
        soilMoisture: 35.4,
        temperatureC: 28.0,
      },
    };
  }, [simulatedLandslide]);

  const activeNode = nodes[selectedNodeId] || nodes['GN-001'];

  // Camera Presets for Digital Twin Mine Site
  const setCameraPreset = (preset: 'site' | 'gn001' | 'gn002' | 'gn003' | 'gn004' | 'cutaway' | 'reset') => {
    if (!orbitRef.current) return;
    const controls = orbitRef.current;
    const cam = controls.object;

    switch (preset) {
      case 'site':
      case 'reset':
        cam.position.set(24, 18, 36);
        controls.target.set(0, -3, 0);
        break;
      case 'gn001':
        cam.position.set(-6, 4, 8);
        controls.target.set(-6, -1.8, -4);
        setSelectedNodeId('GN-001');
        break;
      case 'gn002':
        cam.position.set(8, 7, 2);
        controls.target.set(8, 1.2, -10);
        setSelectedNodeId('GN-002');
        break;
      case 'gn003':
        cam.position.set(-10, 2, 20);
        controls.target.set(-10, -4.2, 8);
        setSelectedNodeId('GN-003');
        break;
      case 'gn004':
        cam.position.set(10, 2, 22);
        controls.target.set(10, -3.8, 10);
        setSelectedNodeId('GN-004');
        break;
      case 'cutaway':
        setShowCutaway(true);
        cam.position.set(0, 2, 38);
        controls.target.set(0, -6, 0);
        break;
    }
    controls.update();
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 64px)',
        overflow: 'hidden',
        backgroundColor: '#f8fafc',
        backgroundImage: `
          linear-gradient(rgba(148, 163, 184, 0.22) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148, 163, 184, 0.22) 1px, transparent 1px),
          linear-gradient(rgba(148, 163, 184, 0.45) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148, 163, 184, 0.45) 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px, 20px 20px, 100px 100px, 100px 100px',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* -------------------------------------------------------------
          1. CENTER STAGE: 3D DIGITAL TWIN REALTIME CANVAS
         ------------------------------------------------------------- */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Canvas camera={{ position: [24, 18, 36], fov: 45 }} gl={{ antialias: true, alpha: true }}>
          <ambientLight intensity={1.6} color="#ffffff" />
          <directionalLight position={[20, 30, 20]} intensity={3.0} castShadow />
          <directionalLight position={[-20, 15, -20]} intensity={1.5} color="#e0f2fe" />

          {/* 3D Floor CAD Grid */}
          <gridHelper args={[60, 60, '#0284c7', '#94a3b8']} position={[0, -12.0, 0]} />

          <OrbitControls
            ref={orbitRef}
            makeDefault
            enableDamping
            dampingFactor={0.05}
            minDistance={4}
            maxDistance={140}
            zoomSpeed={1.5}
            target={[0, -3, 0]}
            autoRotate={autoRotate}
            autoRotateSpeed={1.2}
          />

          {/* Procedural Terraced Slope Terrain Mesh */}
          <SlopeTerraceTerrain isFailureActive={simulatedLandslide} showCutaway={showCutaway} />

          {/* Landslide Dust Particles when Failure Active */}
          {simulatedLandslide && (
            <Sparkles count={180} scale={[18, 8, 18]} position={[-5, -1, -3]} color="#ef4444" size={4} speed={2} />
          )}

          {/* Render Deployed GeoNail Node Probes */}
          {Object.values(nodes).map((node) => {
            const isSelected = selectedNodeId === node.id;
            const status: 'nominal' | 'warning' | 'critical' =
              node.anomaly.includes('CRITICAL') ? 'critical' : node.anomaly.includes('WARNING') ? 'warning' : 'nominal';

            return (
              <group key={node.id} position={node.position}>
                {/* Embedded 3D Probe Model */}
                <group scale={0.22}>
                  <GeoNailAssembly
                    attachStep={5}
                    removeStep={0}
                    capRotationAngle={0}
                    spikeLockAngle={Math.PI / 4}
                    explodedProgress={0}
                    cutawayMode={false}
                    showLoadPath={false}
                    selectedComponent={isSelected ? 'top_cap' : null}
                    roll={node.roll}
                    pitch={node.pitch}
                    yaw={node.yaw}
                    magDisplacementMm={node.displacementMm}
                  />
                </group>

                {/* Strain Heatmap Ring */}
                {showHeatmap && (
                  <StrainHeatmapRing
                    position={[0, 0, 0]}
                    status={status}
                    displacementMm={node.displacementMm}
                  />
                )}

                {/* Interactive 3D HTML Leader Label */}
                <Html position={[0, 3.2, 0]} center distanceFactor={25}>
                  <div
                    onClick={() => setSelectedNodeId(node.id)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '12px',
                      background: isSelected ? 'rgba(2, 132, 199, 0.95)' : 'rgba(255, 255, 255, 0.9)',
                      color: isSelected ? '#ffffff' : '#0f172a',
                      border: `1.5px solid ${status === 'critical' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#0284c7'}`,
                      boxShadow: '0 6px 20px rgba(15, 23, 42, 0.15)',
                      cursor: 'pointer',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.2s',
                    }}
                  >
                    <MapPin size={14} color={status === 'critical' ? '#ef4444' : '#0284c7'} />
                    <span>{node.id}</span>
                    <span style={{ padding: '2px 6px', borderRadius: '6px', fontSize: '0.66rem', background: status === 'critical' ? '#ef444422' : '#10b98122', color: status === 'critical' ? '#dc2626' : '#059669' }}>
                      {node.displacementMm.toFixed(1)} mm
                    </span>
                  </div>
                </Html>
              </group>
            );
          })}

          <ContactShadows position={[0, -12.0, 0]} opacity={0.6} scale={40} blur={2.0} far={8} color="#0f172a" />
        </Canvas>
      </div>

      {/* -------------------------------------------------------------
          2. FLOATING TOP GLASSBAR: DIGITAL TWIN CONTROLS
         ------------------------------------------------------------- */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          right: 16,
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 18px',
          borderRadius: '16px',
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(148, 163, 184, 0.4)',
          boxShadow: '0 8px 32px rgba(15, 23, 42, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#0f172a', fontSize: '0.95rem', letterSpacing: '0.5px' }}>
            <Layers3 size={20} color="#0284c7" />
            <span>DIGITAL TWIN MINE FIELD LANDSLIDE MONITORING</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '0.74rem',
              fontWeight: 800,
              background: simulatedLandslide ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              color: simulatedLandslide ? '#dc2626' : '#059669',
              border: `1.5px solid ${simulatedLandslide ? '#ef4444' : '#10b981'}`,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: simulatedLandslide ? '#ef4444' : '#10b981', boxShadow: `0 0 8px ${simulatedLandslide ? '#ef4444' : '#10b981'}` }} />
            <span>{simulatedLandslide ? '⚠️ SLOPE FAILURE CRITICAL' : 'NOMINAL STABILITY'}</span>
          </div>

          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#475569', padding: '4px 12px', background: 'rgba(241, 245, 249, 0.9)', borderRadius: '20px', border: '1px solid rgba(203, 213, 225, 0.8)' }}>
            Active Nodes: <strong>4 Deployed</strong>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setSimulatedLandslide(!simulatedLandslide)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '0.76rem',
              fontWeight: 800,
              background: simulatedLandslide ? 'rgba(239, 68, 68, 0.2)' : 'rgba(254, 243, 199, 0.9)',
              color: simulatedLandslide ? '#dc2626' : '#b45309',
              border: `1.5px solid ${simulatedLandslide ? '#ef4444' : '#d97706'}`,
              cursor: 'pointer',
            }}
          >
            <AlertTriangle size={14} />
            <span>{simulatedLandslide ? 'Reset Slope Stability' : '⚡ SIMULATE SLOPE FAILURE'}</span>
          </button>

          <button
            onClick={() => setShowCutaway(!showCutaway)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '0.76rem',
              fontWeight: 800,
              background: showCutaway ? 'rgba(2, 132, 199, 0.2)' : 'rgba(241, 245, 249, 0.9)',
              color: showCutaway ? '#0284c7' : '#475569',
              border: `1.5px solid ${showCutaway ? '#0284c7' : 'rgba(203, 213, 225, 0.8)'}`,
              cursor: 'pointer',
            }}
          >
            <Eye size={14} />
            <span>{showCutaway ? '✂️ Terrain Cutaway ON' : 'Full Surface'}</span>
          </button>

          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '0.76rem',
              fontWeight: 800,
              background: showHeatmap ? 'rgba(16, 185, 129, 0.2)' : 'rgba(241, 245, 249, 0.9)',
              color: showHeatmap ? '#059669' : '#475569',
              border: `1.5px solid ${showHeatmap ? '#10b981' : 'rgba(203, 213, 225, 0.8)'}`,
              cursor: 'pointer',
            }}
          >
            <Activity size={14} />
            <span>Heatmap Rings</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------
          3. FLOATING CAMERA TOOLBAR
         ------------------------------------------------------------- */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 15,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          borderRadius: '30px',
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(2, 132, 199, 0.4)',
          boxShadow: '0 8px 32px rgba(15, 23, 42, 0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, paddingRight: 8, borderRight: '1px solid rgba(203, 213, 225, 0.8)', fontSize: '0.72rem', fontWeight: 800, color: '#0284c7' }}>
          <Compass size={15} />
          <span>SITE CAMERA</span>
        </div>

        <button onClick={() => setCameraPreset('site')} style={presetBtnStyle}>
          <Box size={13} />
          <span>FULL SITE</span>
        </button>

        <button onClick={() => setCameraPreset('gn001')} style={activeNode.id === 'GN-001' ? activePresetBtnStyle : presetBtnStyle}>
          <span>FOCUS GN-001</span>
        </button>

        <button onClick={() => setCameraPreset('gn002')} style={activeNode.id === 'GN-002' ? activePresetBtnStyle : presetBtnStyle}>
          <span>FOCUS GN-002</span>
        </button>

        <button onClick={() => setCameraPreset('gn003')} style={activeNode.id === 'GN-003' ? activePresetBtnStyle : presetBtnStyle}>
          <span>FOCUS GN-003</span>
        </button>

        <button onClick={() => setCameraPreset('gn004')} style={activeNode.id === 'GN-004' ? activePresetBtnStyle : presetBtnStyle}>
          <span>FOCUS GN-004</span>
        </button>

        <button onClick={() => setAutoRotate(!autoRotate)} style={autoRotate ? activePresetBtnStyle : presetBtnStyle}>
          <RotateCcw size={13} />
          <span>360° SITE</span>
        </button>

        <button onClick={() => setCameraPreset('reset')} style={presetBtnStyle}>
          <Maximize2 size={13} />
          <span>RESET</span>
        </button>
      </div>

      {/* -------------------------------------------------------------
          4. LEFT FLOATING INSPECTOR CARD: SELECTED NODE TELEMETRY
         ------------------------------------------------------------- */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          left: 16,
          width: '330px',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: '16px',
          borderRadius: '16px',
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(2, 132, 199, 0.3)',
          boxShadow: '0 12px 36px rgba(15, 23, 42, 0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem', fontWeight: 800, color: '#0284c7' }}>
            <MapPin size={16} />
            <span>{activeNode.id} INSPECTOR</span>
          </div>
          <span style={{ fontSize: '0.68rem', padding: '2px 8px', borderRadius: '8px', background: activeNode.anomaly === 'NONE' ? '#10b98122' : '#ef444422', color: activeNode.anomaly === 'NONE' ? '#059669' : '#dc2626', fontWeight: 800 }}>
            {activeNode.anomaly === 'NONE' ? 'ONLINE' : 'ALERT'}
          </span>
        </div>

        <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{activeNode.name}</div>
        <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 700 }}>📍 {activeNode.zone}</div>

        {/* 3D Motion Euler Gauges */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <div style={{ background: 'rgba(240, 249, 255, 0.9)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(186, 230, 253, 0.8)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700 }}>ROLL</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: Math.abs(activeNode.roll) > 5 ? '#dc2626' : '#0284c7' }}>
              {activeNode.roll.toFixed(1)}°
            </div>
          </div>

          <div style={{ background: 'rgba(240, 249, 255, 0.9)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(186, 230, 253, 0.8)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700 }}>PITCH</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: Math.abs(activeNode.pitch) > 5 ? '#dc2626' : '#0284c7' }}>
              {activeNode.pitch.toFixed(1)}°
            </div>
          </div>

          <div style={{ background: 'rgba(240, 249, 255, 0.9)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(186, 230, 253, 0.8)', textAlign: 'center' }}>
            <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 700 }}>YAW</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0284c7' }}>
              {activeNode.yaw.toFixed(1)}°
            </div>
          </div>
        </div>

        {/* Displacement & Vibration */}
        <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(254, 243, 199, 0.7)', border: '1px solid #d97706' }}>
          <div style={{ fontSize: '0.66rem', color: '#b45309', fontWeight: 700 }}>SOIL ANCHOR DISPLACEMENT</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', margin: '2px 0' }}>
            {activeNode.displacementMm.toFixed(2)} <span style={{ fontSize: '0.85rem', color: '#b45309' }}>mm</span>
            <span style={{ fontSize: '0.95rem', color: '#0284c7', marginLeft: 8 }}>({(activeNode.displacementMm / 10).toFixed(2)} cm)</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(203, 213, 225, 0.6)', borderRadius: '3px', overflow: 'hidden', marginTop: 4 }}>
            <div style={{ width: `${Math.min(100, (activeNode.displacementMm / 40.0) * 100)}%`, height: '100%', background: activeNode.displacementMm > 15 ? '#ef4444' : '#d97706' }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <div style={{ background: 'rgba(241, 245, 249, 0.9)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(203, 213, 225, 0.8)' }}>
            <div style={{ fontSize: '0.62rem', color: '#64748b' }}>VIBRATION RMS</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: activeNode.vibrationRms > 0.1 ? '#dc2626' : '#059669' }}>
              {activeNode.vibrationRms.toFixed(3)} g
            </div>
          </div>
          <div style={{ background: 'rgba(241, 245, 249, 0.9)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(203, 213, 225, 0.8)' }}>
            <div style={{ fontSize: '0.62rem', color: '#64748b' }}>HEALTH SCORE</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 800, color: activeNode.healthScore < 80 ? '#dc2626' : '#059669' }}>
              {activeNode.healthScore}%
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------
          5. RIGHT FLOATING CARD: SLOPE STABILITY ANALYTICS
         ------------------------------------------------------------- */}
      <div
        style={{
          position: 'absolute',
          top: 80,
          right: 16,
          width: '320px',
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: '16px',
          borderRadius: '16px',
          background: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'blur(16px)',
          border: '1.5px solid rgba(217, 119, 6, 0.3)',
          boxShadow: '0 12px 36px rgba(15, 23, 42, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 800, color: '#b45309' }}>
          <TrendingDown size={16} />
          <span>SLOPE STABILITY ANALYTICS</span>
        </div>

        <div style={{ padding: '10px', borderRadius: '10px', background: simulatedLandslide ? 'rgba(254, 226, 226, 0.9)' : 'rgba(236, 253, 245, 0.9)', border: `1.5px solid ${simulatedLandslide ? '#ef4444' : '#10b981'}` }}>
          <div style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: 700 }}>FACTOR OF SAFETY (Fs)</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: simulatedLandslide ? '#dc2626' : '#059669' }}>
            Fs = {simulatedLandslide ? '0.82 (UNSTABLE)' : '1.48 (SAFE)'}
          </div>
          <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: 2 }}>
            {simulatedLandslide ? 'Critical shear plane sliding detected on Zone A escarpment!' : 'Slopes within structural safety limits.'}
          </div>
        </div>

        <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(240, 249, 255, 0.9)', border: '1px solid rgba(186, 230, 253, 0.8)', fontSize: '0.74rem' }}>
          <div style={{ fontWeight: 800, color: '#0284c7', marginBottom: 4 }}>NODE DEPLOYMENT LOCATIONS</div>
          {Object.values(nodes).map((n) => (
            <div
              key={n.id}
              onClick={() => setSelectedNodeId(n.id)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '4px 6px',
                borderRadius: '6px',
                background: selectedNodeId === n.id ? 'rgba(2, 132, 199, 0.15)' : 'transparent',
                color: selectedNodeId === n.id ? '#0284c7' : '#334155',
                cursor: 'pointer',
                fontWeight: selectedNodeId === n.id ? 800 : 500,
                marginTop: 2,
              }}
            >
              <span>{n.id}: {n.zone.split(' - ')[1] || n.zone}</span>
              <span>{n.displacementMm.toFixed(1)} mm</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const presetBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '5px 11px',
  borderRadius: '16px',
  fontSize: '0.72rem',
  fontWeight: 800,
  background: 'rgba(241, 245, 249, 0.9)',
  color: '#334155',
  border: '1px solid rgba(203, 213, 225, 0.8)',
  cursor: 'pointer',
};

const activePresetBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  padding: '5px 11px',
  borderRadius: '16px',
  fontSize: '0.72rem',
  fontWeight: 800,
  background: 'rgba(240, 249, 255, 0.95)',
  color: '#0284c7',
  border: '1.5px solid #0284c7',
  cursor: 'pointer',
};
