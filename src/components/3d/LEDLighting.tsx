import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

// Fita LED
export const LEDStrip: React.FC<{
  position: [number, number, number];
  length: number;
  color?: string;
  intensity?: number;
  direction?: 'horizontal' | 'vertical';
}> = ({ position, length, color = '#ffffff', intensity = 1, direction = 'horizontal' }) => {
  const lightRef = useRef<THREE.RectAreaLight>(null);
  
  const rotation: [number, number, number] = direction === 'horizontal' 
    ? [0, 0, 0] 
    : [0, 0, Math.PI / 2];
  
  return (
    <group position={position} rotation={rotation}>
      {/* LED housing/channel */}
      <mesh castShadow>
        <boxGeometry args={[length, 0.012, 0.015]} />
        <meshStandardMaterial color="#e0e0e0" metalness={0.5} roughness={0.3} />
      </mesh>
      
      {/* LED strip (emissive) */}
      <mesh position={[0, -0.003, 0]}>
        <boxGeometry args={[length - 0.01, 0.003, 0.01]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color} 
          emissiveIntensity={intensity * 2}
          transparent
          opacity={0.9}
        />
      </mesh>
      
      {/* Diffuser cover */}
      <mesh position={[0, -0.008, 0]}>
        <boxGeometry args={[length, 0.003, 0.012]} />
        <meshPhysicalMaterial 
          color="#ffffff"
          transmission={0.7}
          transparent
          opacity={0.6}
          roughness={0.1}
        />
      </mesh>
      
      {/* Light effect (simplified - real rect light) */}
      <pointLight 
        position={[0, -0.03, 0]}
        color={color}
        intensity={intensity * 0.5}
        distance={0.8}
        decay={2}
      />
    </group>
  );
};

// Spot embutido
export const SpotLight: React.FC<{
  position: [number, number, number];
  color?: string;
  intensity?: number;
  angle?: number;
  targetPosition?: [number, number, number];
}> = ({ 
  position, 
  color = '#fff5e6', 
  intensity = 1, 
  angle = 0.5,
  targetPosition = [position[0], 0, position[2]]
}) => {
  const spotRef = useRef<THREE.SpotLight>(null);
  
  return (
    <group position={position}>
      {/* Spot housing */}
      <mesh rotation={[Math.PI, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.03, 0.05, 16]} />
        <meshStandardMaterial color="#333333" metalness={0.7} roughness={0.3} />
      </mesh>
      
      {/* Trim ring */}
      <mesh position={[0, -0.02, 0]} rotation={[Math.PI/2, 0, 0]}>
        <torusGeometry args={[0.035, 0.005, 8, 24]} />
        <meshStandardMaterial color="#888888" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Light bulb (emissive) */}
      <mesh position={[0, -0.01, 0]}>
        <sphereGeometry args={[0.015, 16, 16]} />
        <meshStandardMaterial 
          color={color}
          emissive={color}
          emissiveIntensity={intensity * 3}
        />
      </mesh>
      
      {/* Actual spotlight */}
      <spotLight
        ref={spotRef}
        position={[0, 0, 0]}
        color={color}
        intensity={intensity * 2}
        angle={angle}
        penumbra={0.5}
        distance={3}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
      />
    </group>
  );
};

// Luz de nicho
export const NicheLight: React.FC<{
  position: [number, number, number];
  width: number;
  height: number;
  color?: string;
  intensity?: number;
}> = ({ position, width, height, color = '#fff8f0', intensity = 0.5 }) => {
  return (
    <group position={position}>
      {/* Back panel with glow */}
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial 
          color={color}
          emissive={color}
          emissiveIntensity={intensity}
          transparent
          opacity={0.3}
        />
      </mesh>
      
      {/* Ambient light */}
      <pointLight
        position={[0, 0, 0.1]}
        color={color}
        intensity={intensity * 0.3}
        distance={1}
        decay={2}
      />
    </group>
  );
};

// Luminária pendente (para ilhas)
export const PendantLight: React.FC<{
  position: [number, number, number];
  color?: string;
  intensity?: number;
  style?: 'dome' | 'cylinder' | 'cone';
  shadeColor?: string;
}> = ({ 
  position, 
  color = '#fff5e6', 
  intensity = 1,
  style = 'dome',
  shadeColor = '#333333'
}) => {
  const cableLength = 0.5;
  
  return (
    <group position={position}>
      {/* Cable */}
      <mesh position={[0, cableLength / 2, 0]}>
        <cylinderGeometry args={[0.003, 0.003, cableLength, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      
      {/* Canopy (ceiling mount) */}
      <mesh position={[0, cableLength, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.02, 16]} />
        <meshStandardMaterial color="#333333" metalness={0.7} roughness={0.3} />
      </mesh>
      
      {/* Shade */}
      {style === 'dome' && (
        <mesh>
          <sphereGeometry args={[0.12, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={shadeColor} side={THREE.DoubleSide} metalness={0.3} roughness={0.5} />
        </mesh>
      )}
      
      {style === 'cylinder' && (
        <mesh>
          <cylinderGeometry args={[0.08, 0.08, 0.2, 24, 1, true]} />
          <meshStandardMaterial color={shadeColor} side={THREE.DoubleSide} metalness={0.3} roughness={0.5} />
        </mesh>
      )}
      
      {style === 'cone' && (
        <mesh rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.12, 0.15, 24, 1, true]} />
          <meshStandardMaterial color={shadeColor} side={THREE.DoubleSide} metalness={0.3} roughness={0.5} />
        </mesh>
      )}
      
      {/* Bulb */}
      <mesh position={[0, -0.05, 0]}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshStandardMaterial 
          color={color}
          emissive={color}
          emissiveIntensity={intensity * 2}
          transparent
          opacity={0.9}
        />
      </mesh>
      
      {/* Light */}
      <pointLight
        position={[0, -0.1, 0]}
        color={color}
        intensity={intensity}
        distance={3}
        decay={2}
        castShadow
      />
    </group>
  );
};

// Under cabinet LED (para baixo de aéreos)
export const UnderCabinetLED: React.FC<{
  position: [number, number, number];
  width: number;
  color?: string;
  intensity?: number;
}> = ({ position, width, color = '#fff8f0', intensity = 0.8 }) => {
  return (
    <group position={position}>
      {/* LED channel */}
      <mesh>
        <boxGeometry args={[width, 0.015, 0.025]} />
        <meshStandardMaterial color="#e8e8e8" metalness={0.4} roughness={0.4} />
      </mesh>
      
      {/* LED strip */}
      <mesh position={[0, -0.005, 0]}>
        <boxGeometry args={[width - 0.01, 0.004, 0.015]} />
        <meshStandardMaterial 
          color={color}
          emissive={color}
          emissiveIntensity={intensity * 1.5}
        />
      </mesh>
      
      {/* Light cone */}
      <spotLight
        position={[0, -0.01, 0]}
        color={color}
        intensity={intensity * 0.5}
        angle={Math.PI / 3}
        penumbra={0.8}
        distance={1.5}
        decay={2}
      />
    </group>
  );
};

// RGB LED com animação
export const RGBLEDStrip: React.FC<{
  position: [number, number, number];
  length: number;
  intensity?: number;
  mode?: 'static' | 'rainbow' | 'pulse';
  staticColor?: string;
}> = ({ position, length, intensity = 1, mode = 'rainbow', staticColor = '#ff0000' }) => {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  useFrame(({ clock }) => {
    if (materialRef.current && mode !== 'static') {
      const t = clock.getElapsedTime();
      
      if (mode === 'rainbow') {
        const hue = (t * 0.1) % 1;
        const color = new THREE.Color().setHSL(hue, 1, 0.5);
        materialRef.current.emissive = color;
        materialRef.current.color = color;
      } else if (mode === 'pulse') {
        const pulse = (Math.sin(t * 3) + 1) / 2;
        materialRef.current.emissiveIntensity = pulse * intensity * 2;
      }
    }
  });
  
  return (
    <group position={position}>
      {/* Housing */}
      <mesh>
        <boxGeometry args={[length, 0.012, 0.015]} />
        <meshStandardMaterial color="#333333" metalness={0.6} roughness={0.3} />
      </mesh>
      
      {/* RGB LEDs */}
      <mesh position={[0, -0.004, 0]}>
        <boxGeometry args={[length - 0.01, 0.004, 0.01]} />
        <meshStandardMaterial 
          ref={materialRef}
          color={mode === 'static' ? staticColor : '#ff0000'}
          emissive={mode === 'static' ? staticColor : '#ff0000'}
          emissiveIntensity={intensity * 2}
        />
      </mesh>
      
      {/* Diffuser */}
      <mesh position={[0, -0.009, 0]}>
        <boxGeometry args={[length, 0.004, 0.013]} />
        <meshPhysicalMaterial 
          color="#ffffff"
          transmission={0.8}
          transparent
          opacity={0.4}
          roughness={0.05}
        />
      </mesh>
    </group>
  );
};

export default {
  LEDStrip,
  SpotLight,
  NicheLight,
  PendantLight,
  UnderCabinetLED,
  RGBLEDStrip,
};
