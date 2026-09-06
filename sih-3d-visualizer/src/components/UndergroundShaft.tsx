import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Lantern({ position }: { position: [number, number, number] }) {
  const lightRef = useRef<THREE.PointLight>(null!);

  useFrame(({ clock }) => {
    if (lightRef.current) {
      lightRef.current.intensity = 2.5 + Math.sin(clock.getElapsedTime() * 8 + position[2]) * 0.5;
    }
  });

  return (
    <group position={position}>
      {/* Lantern Chain */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.8]} />
        <meshStandardMaterial color="#334155" metalness={0.9} />
      </mesh>

      {/* Industrial Cage Lantern */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[0.2, 0.3, 0.2]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Light Bulb */}
      <mesh position={[0, -0.1, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>

      <pointLight ref={lightRef} position={[0, -0.15, 0]} color="#fb923c" distance={8} decay={2} />
    </group>
  );
}

export const UndergroundShaft: React.FC = () => {
  const archPositions = [-14, -8, -2, 4, 10];
  const tiePositions = Array.from({ length: 24 }, (_, i) => -14 + i * 1.2);

  return (
    <group>
      {/* Cavern Rock Tunnel Ceiling & Walls */}
      <mesh rotation={[0, 0, Math.PI]} position={[0, 1.5, 0]}>
        <cylinderGeometry args={[5, 5, 32, 24, 1, true, Math.PI * 0.1, Math.PI * 0.8]} />
        <meshStandardMaterial color="#18181b" roughness={0.95} metalness={0.1} side={2} />
      </mesh>

      {/* Cavern Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.8, 0]} receiveShadow>
        <planeGeometry args={[12, 32]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Timber & Steel Support Arches */}
      {archPositions.map((z, idx) => (
        <group key={idx} position={[0, 0, z]}>
          {/* Left Vertical Pillar */}
          <mesh position={[-2.4, 0, 0]}>
            <boxGeometry args={[0.25, 3.6, 0.25]} />
            <meshStandardMaterial color="#451a03" roughness={0.8} />
          </mesh>

          {/* Right Vertical Pillar */}
          <mesh position={[2.4, 0, 0]}>
            <boxGeometry args={[0.25, 3.6, 0.25]} />
            <meshStandardMaterial color="#451a03" roughness={0.8} />
          </mesh>

          {/* Overhead Crossbeam */}
          <mesh position={[0, 1.7, 0]}>
            <boxGeometry args={[5.0, 0.25, 0.25]} />
            <meshStandardMaterial color="#451a03" roughness={0.8} />
          </mesh>

          {/* Hanging Lantern on alternating arches */}
          {idx % 2 === 0 && <Lantern position={[0, 1.4, 0]} />}
        </group>
      ))}

      {/* Mine Railway Tracks */}
      {/* Left Rail */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[-0.7, -1.75, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 32]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Right Rail */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0.7, -1.75, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 32]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Wooden Ties */}
      {tiePositions.map((z, i) => (
        <mesh key={i} position={[0, -1.78, z]}>
          <boxGeometry args={[1.8, 0.06, 0.2]} />
          <meshStandardMaterial color="#271c19" roughness={0.9} />
        </mesh>
      ))}

      {/* Heavy Mining Rail Cart */}
      <group position={[0, -1.35, 1]}>
        {/* Cart Metal Body */}
        <mesh position={[0, 0.35, 0]}>
          <boxGeometry args={[1.5, 0.7, 2.2]} />
          <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.3} />
        </mesh>

        {/* Loaded Glossy Coal Ore in Cart */}
        <mesh position={[0, 0.75, 0]}>
          <dodecahedronGeometry args={[0.65, 1]} />
          <meshStandardMaterial color="#09090b" roughness={0.25} metalness={0.4} />
        </mesh>

        {/* Cart Steel Wheels */}
        <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.75, 0, 0.7]}>
          <cylinderGeometry args={[0.18, 0.18, 0.08, 16]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} position={[0.75, 0, 0.7]}>
          <cylinderGeometry args={[0.18, 0.18, 0.08, 16]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} position={[-0.75, 0, -0.7]}>
          <cylinderGeometry args={[0.18, 0.18, 0.08, 16]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]} position={[0.75, 0, -0.7]}>
          <cylinderGeometry args={[0.18, 0.18, 0.08, 16]} />
          <meshStandardMaterial color="#0f172a" metalness={0.9} />
        </mesh>
      </group>
    </group>
  );
};
