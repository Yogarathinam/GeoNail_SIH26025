import React, { useMemo, useState, useRef } from 'react';
import { Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface MiningSettings {
  envMode: 'openPit' | 'undergroundShaft';
  mineType: 'anthracite' | 'bituminous' | 'redClay';
  rockDensity: 'low' | 'medium' | 'high';
  wireframeTerrain: boolean;
  roughness: number;
}

export interface RockInfo {
  id: number;
  type: 'coalChunk' | 'shaleRock' | 'gravel';
  carbonContent: number;
  massKg: number;
  density: number;
  color: string;
  position: [number, number, number];
}

interface MiningEnvironmentProps {
  settings: MiningSettings;
  onSelectRock?: (rock: RockInfo) => void;
}

interface RockData extends RockInfo {
  scale: [number, number, number];
  rotation: [number, number, number];
  roughness: number;
  metalness: number;
}

export function getTerrainHeight(x: number, z: number): number {
  const dist = Math.sqrt(x * x + z * z);
  const pitDepth = 2.8;

  const rawRadius = Math.min(dist, 13);
  const benchLevel = Math.floor(rawRadius / 2.6);
  const benchBaseY = benchLevel * 0.7 - pitDepth;

  const noise =
    Math.sin(x * 0.35) * 0.22 +
    Math.cos(z * 0.35) * 0.22 +
    Math.sin(x * 0.8 + z * 0.8) * 0.12;

  return benchBaseY + noise;
}

function HazardBeacon({ position, color }: { position: [number, number, number]; color: string }) {
  const lightRef = useRef<THREE.PointLight>(null!);

  useFrame(({ clock }) => {
    if (lightRef.current) {
      lightRef.current.intensity = 1.5 + Math.sin(clock.getElapsedTime() * 5) * 1.0;
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.04, 0.05, 0.8, 12]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <pointLight ref={lightRef} position={[0, 0.9, 0]} color={color} distance={4} />
    </group>
  );
}

export const MiningEnvironment: React.FC<MiningEnvironmentProps> = ({ settings, onSelectRock }) => {
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [blastingPos, setBlastingPos] = useState<[number, number, number] | null>(null);

  const { groundColor, coalColor, rockColors, sootColor } = useMemo(() => {
    switch (settings.mineType) {
      case 'bituminous':
        return {
          groundColor: '#3f3f46',
          coalColor: '#18181b',
          rockColors: ['#27272a', '#3f3f46', '#52525b', '#18181b'],
          sootColor: '#f59e0b',
        };
      case 'redClay':
        return {
          groundColor: '#7c2d12',
          coalColor: '#0f172a',
          rockColors: ['#451a03', '#78350f', '#1c1917', '#292524'],
          sootColor: '#fb923c',
        };
      case 'anthracite':
      default:
        return {
          groundColor: '#262626',
          coalColor: '#09090b',
          rockColors: ['#18181b', '#09090b', '#27272a', '#3f3f46'],
          sootColor: '#38bdf8',
        };
    }
  }, [settings.mineType]);

  const terrainGeometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(32, 32, 100, 100);
    const posAttr = geo.attributes.position;

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const y = posAttr.getY(i);
      const elevation = getTerrainHeight(x, -y);
      posAttr.setZ(i, elevation);
    }

    geo.computeVertexNormals();
    return geo;
  }, []);

  const rocks = useMemo<RockData[]>(() => {
    const rockCount = settings.rockDensity === 'low' ? 24 : settings.rockDensity === 'medium' ? 48 : 80;
    const result: RockData[] = [];

    let seed = 108;
    const pseudoRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    for (let i = 0; i < rockCount; i++) {
      const angle = pseudoRandom() * Math.PI * 2;
      const radius = 1.8 + pseudoRandom() * 12;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const terrainY = getTerrainHeight(x, z);

      const typeVal = pseudoRandom();
      const type: 'coalChunk' | 'shaleRock' | 'gravel' =
        typeVal > 0.5 ? 'coalChunk' : typeVal > 0.2 ? 'shaleRock' : 'gravel';

      const baseScale =
        type === 'coalChunk'
          ? 0.5 + pseudoRandom() * 0.8
          : type === 'shaleRock'
          ? 0.4 + pseudoRandom() * 0.7
          : 0.15 + pseudoRandom() * 0.25;

      const scaleX = baseScale * (0.8 + pseudoRandom() * 0.5);
      const scaleY = baseScale * (0.6 + pseudoRandom() * 0.5);
      const scaleZ = baseScale * (0.8 + pseudoRandom() * 0.5);

      const posY = terrainY + scaleY * 0.3 - 0.12;

      const color =
        type === 'coalChunk'
          ? coalColor
          : rockColors[Math.floor(pseudoRandom() * rockColors.length)];

      const roughness = type === 'coalChunk' ? 0.25 : 0.85;
      const metalness = type === 'coalChunk' ? 0.35 : 0.08;

      const carbonContent =
        type === 'coalChunk'
          ? 84 + Math.floor(pseudoRandom() * 12)
          : type === 'shaleRock'
          ? 12 + Math.floor(pseudoRandom() * 18)
          : 5;

      const massKg = Number((baseScale * 14.2).toFixed(1));
      const density = Number((1.3 + pseudoRandom() * 0.4).toFixed(2));

      result.push({
        id: i,
        position: [x, posY, z],
        scale: [scaleX, scaleY, scaleZ],
        rotation: [
          pseudoRandom() * Math.PI,
          pseudoRandom() * Math.PI,
          pseudoRandom() * Math.PI,
        ],
        color,
        type,
        roughness,
        metalness,
        carbonContent,
        massKg,
        density,
      });
    }

    return result;
  }, [settings.rockDensity, coalColor, rockColors]);

  const hazardBeacons = useMemo(() => {
    const result: Array<{ id: number; pos: [number, number, number]; color: string }> = [];
    const beaconCount = 6;
    for (let i = 0; i < beaconCount; i++) {
      const angle = (i / beaconCount) * Math.PI * 2;
      const r = 11.5;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = getTerrainHeight(x, z);
      result.push({
        id: i,
        pos: [x, y, z],
        color: i % 2 === 0 ? '#ef4444' : '#f59e0b',
      });
    }
    return result;
  }, []);

  const handleRockClick = (rock: RockData) => {
    setBlastingPos(rock.position);
    setTimeout(() => setBlastingPos(null), 1200);
    if (onSelectRock) {
      onSelectRock({
        id: rock.id,
        type: rock.type,
        carbonContent: rock.carbonContent,
        massKg: rock.massKg,
        density: rock.density,
        color: rock.color,
        position: rock.position,
      });
    }
  };

  return (
    <group>
      {/* Terraced Open-Pit Coal Mine Ground */}
      <mesh
        geometry={terrainGeometry}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial
          color={groundColor}
          wireframe={settings.wireframeTerrain}
          roughness={settings.roughness}
          metalness={0.1}
          flatShading
        />
      </mesh>

      {/* Grounded Coal Ore Chunks & Rocks */}
      {rocks.map((rock) => {
        const isHovered = hoveredId === rock.id;
        return (
          <mesh
            key={rock.id}
            position={rock.position}
            scale={isHovered ? [rock.scale[0] * 1.15, rock.scale[1] * 1.15, rock.scale[2] * 1.15] : rock.scale}
            rotation={rock.rotation}
            castShadow
            receiveShadow
            onClick={(e) => {
              e.stopPropagation();
              handleRockClick(rock);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredId(rock.id);
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              setHoveredId(null);
              document.body.style.cursor = 'auto';
            }}
          >
            {rock.type === 'coalChunk' ? (
              <dodecahedronGeometry args={[1, 1]} />
            ) : rock.type === 'shaleRock' ? (
              <icosahedronGeometry args={[1, 0]} />
            ) : (
              <dodecahedronGeometry args={[0.8, 0]} />
            )}
            <meshStandardMaterial
              color={isHovered ? '#00f2fe' : rock.color}
              roughness={rock.roughness}
              metalness={rock.metalness}
              emissive={isHovered ? '#00f2fe' : '#000000'}
              emissiveIntensity={isHovered ? 0.3 : 0}
              flatShading
            />
          </mesh>
        );
      })}

      {/* Click-to-Mine Sparkle Blast Effect */}
      {blastingPos && (
        <Sparkles
          count={100}
          scale={[3, 3, 3]}
          size={5}
          speed={2}
          color="#f59e0b"
          position={blastingPos}
        />
      )}

      {/* Hazard Survey Beacons */}
      {hazardBeacons.map((b) => (
        <HazardBeacon key={b.id} position={b.pos} color={b.color} />
      ))}

      {/* Atmospheric Soot & Floating Coal Dust */}
      <Sparkles
        count={150}
        scale={[25, 10, 25]}
        size={2.5}
        speed={0.3}
        color={sootColor}
        position={[0, 2, 0]}
      />
    </group>
  );
};
