import React from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  ContactShadows,
  Grid,
  Environment,
  Center,
  GizmoHelper,
  GizmoViewport,
  GizmoViewcube,
} from '@react-three/drei';
import { MiningEnvironment, type MiningSettings, type RockInfo } from './MiningEnvironment';
import { SunSkyEnvironment } from './SunSkyEnvironment';
import { UndergroundShaft } from './UndergroundShaft';
import { GeoNailAssembly } from './GeoNailAssembly';

export interface ViewportSettings {
  envMode: 'openPit' | 'undergroundShaft' | 'lithoPin';
  mineType: 'anthracite' | 'bituminous' | 'redClay';
  rockDensity: 'low' | 'medium' | 'high';
  wireframeTerrain: boolean;
  roughness: number;
  lightPreset: 'halogenWork' | 'sunsetShift' | 'nightFlood' | 'cyber';
  timeOfDay: number; // 0 to 24 hours
  fogDensity: number; // 0 to 1
  cameraPreset: 'aerial' | 'pitGround' | 'undergroundShaft' | 'productCloseUp' | 'productExploded' | 'bottom' | 'top' | 'front' | 'iso';

  autoRotate: boolean;
  rotateSpeed: number;
  showGrid: boolean;

  // LithoPin Specific Controls
  lithoPinLockProgress: number; // 0 (LOCKED) to 1 (RELEASED)
  lithoPinAttachStep: number; // 0 to 5
  lithoPinRemoveStep: number; // 0 to 6
  lithoPinCapRotation: number; // angle in radians
  lithoPinSpikeLock?: number; // -Math.PI/4 (-45° CCW), 0 (Neutral), +Math.PI/4 (+45° CW)
  lithoPinSpikeDetached?: boolean; // Free-fall gravitational drop disengagement
  lithoPinExploded: number; // 0 to 1
  lithoPinCutaway: boolean;
  lithoPinLoadPath: boolean;
  lithoPinDragMode: boolean; // Interactive 3D drag & translate components
  showComponentLabels?: boolean; // Dynamic 3D leader-line callout labels
  selectedComponent: string | null;

  // Real-time telemetry orientation & displacement props
  roll?: number;
  pitch?: number;
  yaw?: number;
  magDisplacementMm?: number;
}


interface CanvasViewportProps {
  settings: ViewportSettings;
  onSelectRock?: (rock: RockInfo) => void;
  onSelectComponent?: (compName: string, title: string, details: Record<string, string>) => void;
}

export const CanvasViewport: React.FC<CanvasViewportProps> = ({
  settings,
  onSelectRock,
  onSelectComponent,
}) => {
  const [isDraggingComponent, setIsDraggingComponent] = React.useState(false);

  const getCameraPos = (): [number, number, number] => {
    if (settings.envMode === 'lithoPin') {
      switch (settings.cameraPreset) {
        case 'bottom':
          return [0, -14.0, 0.1]; // Direct bottom view looking up
        case 'top':
          return [0, 16.0, 0.1]; // Direct top view looking down
        case 'front':
          return [0, 1.5, 14.5]; // Front view framing long stake
        case 'iso':
          return [9.5, 7.5, 11.5]; // 3D Isometric view
        case 'productExploded':
          return [0, 6, 22];
        case 'productCloseUp':
        default:
          return [0, 2.0, 14.5];
      }
    }
    if (settings.envMode === 'undergroundShaft') {
      return [0, -0.2, 5.5];
    }
    switch (settings.cameraPreset) {
      case 'aerial':
        return [0, 20, 22];
      case 'pitGround':
        return [0, 3, 10];
      case 'undergroundShaft':
      default:
        return [0, 7, 16];
    }
  };

  const miningSettings: MiningSettings = {
    envMode: settings.envMode === 'lithoPin' ? 'openPit' : settings.envMode,
    mineType: settings.mineType,
    rockDensity: settings.rockDensity,
    wireframeTerrain: settings.wireframeTerrain,
    roughness: settings.roughness,
  };

  return (
    <div className="webgl-canvas">
      <Canvas
        shadows
        camera={{ position: getCameraPos(), fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        {/* Dynamic 3D Sun & Sky Environment for Open-Pit Mode */}
        {settings.envMode === 'openPit' && (
          <SunSkyEnvironment
            timeOfDay={settings.timeOfDay}
            fogDensity={settings.fogDensity}
          />
        )}

        {/* Underground Cavern Light (when underground) */}
        {settings.envMode === 'undergroundShaft' && (
          <>
            <ambientLight intensity={0.2} color="#0f172a" />
            <fog attach="fog" args={['#050b14', 6, 25]} />
          </>
        )}

        {/* Industrial Studio Lighting for LithoPin Product Mode */}
        {settings.envMode === 'lithoPin' && (
          <>
            <ambientLight intensity={1.1} color="#ffffff" />
            <hemisphereLight args={['#ffffff', '#94a3b8', 0.9]} />
            <directionalLight
              position={[10, 16, 10]}
              intensity={2.4}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
            />
            <directionalLight position={[-10, 10, -10]} intensity={1.4} color="#38bdf8" />
            <directionalLight position={[0, -8, 10]} intensity={0.8} color="#0284c7" />
          </>
        )}

        <Center>
          {settings.envMode === 'openPit' ? (
            <MiningEnvironment settings={miningSettings} onSelectRock={onSelectRock} />
          ) : settings.envMode === 'undergroundShaft' ? (
            <UndergroundShaft />
          ) : (
            <GeoNailAssembly
              attachStep={settings.lithoPinAttachStep}
              removeStep={settings.lithoPinRemoveStep}
              capRotationAngle={settings.lithoPinCapRotation}
              spikeLockAngle={settings.lithoPinSpikeLock}
              spikeDetached={settings.lithoPinSpikeDetached}
              explodedProgress={settings.lithoPinExploded}
              cutawayMode={settings.lithoPinCutaway}
              showLoadPath={settings.lithoPinLoadPath}
              dragModeEnabled={settings.lithoPinDragMode}
              showLabels={settings.showComponentLabels}
              selectedComponent={settings.selectedComponent}
              roll={settings.roll}
              pitch={settings.pitch}
              yaw={settings.yaw}
              magDisplacementMm={settings.magDisplacementMm}
              onSelectComponent={onSelectComponent}
              onDragStateChange={(isDragging: boolean) => setIsDraggingComponent(isDragging)}
            />
          )}
        </Center>

        {(settings.envMode === 'openPit' || settings.envMode === 'lithoPin') && (
          <ContactShadows
            position={[0, settings.envMode === 'lithoPin' ? -14.5 : -2.85, 0]}
            opacity={0.85}
            scale={22}
            blur={2.5}
            far={6}
            color="#000000"
          />
        )}

        {settings.showGrid && (
          <Grid
            position={[
              0,
              settings.envMode === 'lithoPin'
                ? -14.52
                : settings.envMode === 'openPit'
                ? -2.86
                : -1.79,
              0,
            ]}


            args={[32, 32]}
            cellSize={1}
            cellThickness={0.5}
            cellColor={settings.envMode === 'lithoPin' ? '#00f2fe' : '#334155'}
            sectionSize={4}
            sectionThickness={1.2}
            sectionColor="#eab308"
            fadeDistance={100}
            fadeStrength={1}
          />
        )}

        <Environment preset="city" background={false} />

        {/* AutoCAD 3D ViewCube & Coordinate Axis Orientation Gizmo */}
        <GizmoHelper alignment="top-right" margin={[80, 80]}>
          <GizmoViewcube
            color="#1e293b"
            strokeColor="#0284c7"
            textColor="#ffffff"
            hoverColor="#0284c7"
            opacity={0.9}
          />
          <GizmoViewport
            axisColors={['#ef4444', '#10b981', '#0284c7']}
            labelColor="#ffffff"
          />
        </GizmoHelper>

        <OrbitControls
          makeDefault
          enabled={!isDraggingComponent}
          enablePan={!isDraggingComponent}
          enableZoom={!isDraggingComponent}
          enableRotate={!isDraggingComponent}
          screenSpacePanning={true} // Smooth 2D camera panning (up/down/left/right)
          panSpeed={1.5}
          target={[0, 1.5, 0]}
          autoRotate={false}
          autoRotateSpeed={0}

          maxPolarAngle={Math.PI - 0.05} // Unlocked full 360° vertical bottom camera orbit
          minPolarAngle={0.05}
          minDistance={1.0}
          maxDistance={250} // Expanded max zoom distance up to 250 units
        />

      </Canvas>
    </div>
  );
};




