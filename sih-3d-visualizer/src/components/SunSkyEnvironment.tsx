import React, { useMemo } from 'react';
import { Sparkles } from '@react-three/drei';

interface SunSkyEnvironmentProps {
  timeOfDay: number; // 0 to 24 hours
  fogDensity: number; // 0 to 1
}

export const SunSkyEnvironment: React.FC<SunSkyEnvironmentProps> = ({
  timeOfDay,
  fogDensity,
}) => {
  // Calculate Sun position based on timeOfDay (0 - 24)
  const { sunPosition, sunColor, ambientColor, fogColor, lightIntensity } = useMemo(() => {
    // 6:00 = Dawn (Y=0), 12:00 = Midday (Y=30), 18:00 = Sunset (Y=0), 24:00 = Midnight (Y=-30)
    const angle = ((timeOfDay - 6) / 24) * Math.PI * 2;
    const x = Math.cos(angle) * 35;
    const y = Math.sin(angle) * 28;
    const z = 12;

    const isNight = timeOfDay < 5 || timeOfDay > 19;
    const isDawnOrDusk = (timeOfDay >= 5 && timeOfDay <= 7) || (timeOfDay >= 17 && timeOfDay <= 19);

    if (isNight) {
      return {
        sunPosition: [x, Math.min(y, -2), z] as [number, number, number],
        sunColor: '#38bdf8',
        ambientColor: '#090d16',
        fogColor: '#050b14',
        lightIntensity: 0.15,
      };
    } else if (isDawnOrDusk) {
      return {
        sunPosition: [x, Math.max(y, 1), z] as [number, number, number],
        sunColor: '#f97316',
        ambientColor: '#7c2d12',
        fogColor: '#2a0a00',
        lightIntensity: 2.2,
      };
    } else {
      // Daytime
      return {
        sunPosition: [x, y, z] as [number, number, number],
        sunColor: '#fef08a',
        ambientColor: '#fef3c7',
        fogColor: '#1e293b',
        lightIntensity: 2.8,
      };
    }
  }, [timeOfDay]);

  const nearFog = 15 - fogDensity * 10;
  const farFog = 55 - fogDensity * 25;

  return (
    <group>
      {/* Volumetric Atmosphere Fog */}
      <fog attach="fog" args={[fogColor, nearFog, farFog]} />

      {/* 3D Sun Orb (visible during day/twilight) */}
      {timeOfDay >= 5 && timeOfDay <= 19 && (
        <group position={sunPosition}>
          {/* Main Glowing Sun Sphere */}
          <mesh>
            <sphereGeometry args={[1.6, 32, 32]} />
            <meshBasicMaterial color={sunColor} />
          </mesh>

          {/* Sun Corona Halo Ring */}
          <mesh>
            <ringGeometry args={[1.8, 3.2, 32]} />
            <meshBasicMaterial color={sunColor} transparent opacity={0.35} side={2} />
          </mesh>

          {/* Primary Sun Direct Light */}
          <directionalLight
            castShadow
            intensity={lightIntensity}
            color={sunColor}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-near={0.5}
            shadow-camera-far={60}
            shadow-camera-left={-20}
            shadow-camera-right={20}
            shadow-camera-top={20}
            shadow-camera-bottom={-20}
          />
        </group>
      )}

      {/* Ambient Fill Light */}
      <ambientLight intensity={lightIntensity * 0.4} color={ambientColor} />

      {/* Night Sky Stars */}
      {(timeOfDay < 6 || timeOfDay > 18) && (
        <Sparkles
          count={250}
          scale={[50, 40, 50]}
          size={3}
          speed={0.1}
          color="#ffffff"
          position={[0, 15, 0]}
        />
      )}
    </group>
  );
};
