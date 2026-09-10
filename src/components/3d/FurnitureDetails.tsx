import React, { useState, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface HandleProps {
  position: [number, number, number];
  type?: 'bar' | 'knob' | 'pull' | 'shell';
  size?: number;
  color?: string;
  horizontal?: boolean;
}

// Puxador
export const Handle: React.FC<HandleProps> = ({ 
  position, 
  type = 'bar', 
  size = 0.1, 
  color = '#a0a0a0',
  horizontal = true 
}) => {
  const rotation: [number, number, number] = horizontal ? [0, 0, Math.PI / 2] : [0, 0, 0];
  
  switch (type) {
    case 'bar':
      return (
        <group position={position}>
          {/* Bar */}
          <mesh castShadow rotation={rotation}>
            <cylinderGeometry args={[0.006, 0.006, size, 16]} />
            <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Mounting points */}
          {[-size / 2 + 0.01, size / 2 - 0.01].map((offset, i) => (
            <mesh key={i} position={horizontal ? [offset, 0, -0.01] : [0, offset, -0.01]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.008, 0.008, 0.02, 16]} />
              <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
            </mesh>
          ))}
        </group>
      );
    
    case 'knob':
      return (
        <group position={position}>
          <mesh castShadow>
            <sphereGeometry args={[size * 0.15, 16, 16]} />
            <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, -0.01]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[size * 0.08, size * 0.08, 0.02, 16]} />
            <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      );
    
    case 'pull':
      return (
        <group position={position}>
          {/* U-shaped pull */}
          <mesh castShadow position={[0, 0, 0.01]}>
            <boxGeometry args={[size, 0.015, 0.015]} />
            <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
          </mesh>
          {[-size / 2 + 0.008, size / 2 - 0.008].map((x, i) => (
            <mesh key={i} position={[x, 0, 0]} castShadow>
              <boxGeometry args={[0.015, 0.015, 0.025]} />
              <meshStandardMaterial color={color} metalness={0.8} roughness={0.2} />
            </mesh>
          ))}
        </group>
      );
    
    case 'shell':
      return (
        <group position={position}>
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[size * 0.3, size * 0.4, 0.02, 16, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color={color} metalness={0.7} roughness={0.3} side={THREE.DoubleSide} />
          </mesh>
        </group>
      );
    
    default:
      return null;
  }
};

interface DoorProps {
  width: number;
  height: number;
  depth: number;
  position: [number, number, number];
  color: string;
  handleType?: 'bar' | 'knob' | 'pull' | 'shell';
  handlePosition?: 'left' | 'right';
  isOpen?: boolean;
  onToggle?: () => void;
  hingePosition?: 'left' | 'right';
}

// Porta de armário com animação
export const CabinetDoor: React.FC<DoorProps> = ({
  width,
  height,
  depth,
  position,
  color,
  handleType = 'bar',
  handlePosition = 'right',
  isOpen = false,
  onToggle,
  hingePosition = 'left'
}) => {
  const doorRef = useRef<THREE.Group>(null);
  const [currentAngle, setCurrentAngle] = useState(0);
  const targetAngle = isOpen ? (hingePosition === 'left' ? -Math.PI / 2 : Math.PI / 2) : 0;
  
  useFrame((_, delta) => {
    if (Math.abs(currentAngle - targetAngle) > 0.01) {
      const newAngle = THREE.MathUtils.lerp(currentAngle, targetAngle, delta * 5);
      setCurrentAngle(newAngle);
      if (doorRef.current) {
        doorRef.current.rotation.y = newAngle;
      }
    }
  });
  
  const pivotOffset = hingePosition === 'left' ? -width / 2 : width / 2;
  const handleX = handlePosition === 'left' ? -width / 2 + 0.03 : width / 2 - 0.03;
  
  return (
    <group position={position}>
      {/* Pivot point */}
      <group position={[pivotOffset, 0, 0]}>
        <group ref={doorRef}>
          <group position={[-pivotOffset, 0, 0]}>
            {/* Door panel */}
            <mesh 
              castShadow 
              receiveShadow 
              onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
              onPointerOver={() => document.body.style.cursor = 'pointer'}
              onPointerOut={() => document.body.style.cursor = 'default'}
            >
              <boxGeometry args={[width, height, depth]} />
              <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
            </mesh>
            
            {/* Handle */}
            <Handle 
              position={[handleX, 0, depth / 2 + 0.01]} 
              type={handleType}
              size={height * 0.15}
              horizontal={false}
            />
            
            {/* Edge detail */}
            <mesh position={[0, 0, depth / 2 + 0.001]}>
              <boxGeometry args={[width - 0.01, height - 0.01, 0.002]} />
              <meshStandardMaterial color={color} roughness={0.35} metalness={0.1} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  );
};

interface DrawerProps {
  width: number;
  height: number;
  depth: number;
  position: [number, number, number];
  color: string;
  handleType?: 'bar' | 'knob' | 'pull' | 'shell';
  isOpen?: boolean;
  onToggle?: () => void;
}

// Gaveta com animação
export const Drawer: React.FC<DrawerProps> = ({
  width,
  height,
  depth,
  position,
  color,
  handleType = 'pull',
  isOpen = false,
  onToggle
}) => {
  const drawerRef = useRef<THREE.Group>(null);
  const [currentZ, setCurrentZ] = useState(0);
  const targetZ = isOpen ? depth * 0.6 : 0;
  
  useFrame((_, delta) => {
    if (Math.abs(currentZ - targetZ) > 0.001) {
      const newZ = THREE.MathUtils.lerp(currentZ, targetZ, delta * 5);
      setCurrentZ(newZ);
      if (drawerRef.current) {
        drawerRef.current.position.z = newZ;
      }
    }
  });
  
  return (
    <group position={position}>
      <group ref={drawerRef}>
        {/* Drawer front */}
        <mesh 
          position={[0, 0, depth / 2]}
          castShadow 
          receiveShadow
          onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
          onPointerOver={() => document.body.style.cursor = 'pointer'}
          onPointerOut={() => document.body.style.cursor = 'default'}
        >
          <boxGeometry args={[width, height, 0.018]} />
          <meshStandardMaterial color={color} roughness={0.4} metalness={0.1} />
        </mesh>
        
        {/* Handle */}
        <Handle 
          position={[0, 0, depth / 2 + 0.02]} 
          type={handleType}
          size={width * 0.3}
          horizontal={true}
        />
        
        {/* Drawer box (visible when open) */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[width - 0.02, height - 0.02, depth - 0.02]} />
          <meshStandardMaterial color="#f5f0e6" roughness={0.7} metalness={0} side={THREE.BackSide} />
        </mesh>
        
        {/* Drawer sides */}
        {[-width / 2 + 0.008, width / 2 - 0.008].map((x, i) => (
          <mesh key={i} position={[x, 0, 0]}>
            <boxGeometry args={[0.015, height - 0.03, depth - 0.03]} />
            <meshStandardMaterial color="#d4c9b9" roughness={0.6} metalness={0} />
          </mesh>
        ))}
        
        {/* Bottom */}
        <mesh position={[0, -height / 2 + 0.008, 0]}>
          <boxGeometry args={[width - 0.04, 0.012, depth - 0.03]} />
          <meshStandardMaterial color="#d4c9b9" roughness={0.6} metalness={0} />
        </mesh>
      </group>
    </group>
  );
};

interface GlassPanelProps {
  width: number;
  height: number;
  position: [number, number, number];
  frameColor?: string;
  frameWidth?: number;
}

// Painel de vidro para armários
export const GlassPanel: React.FC<GlassPanelProps> = ({
  width,
  height,
  position,
  frameColor = '#5C4033',
  frameWidth = 0.015
}) => {
  return (
    <group position={position}>
      {/* Glass */}
      <mesh>
        <boxGeometry args={[width - frameWidth * 2, height - frameWidth * 2, 0.004]} />
        <meshPhysicalMaterial 
          color="#ffffff"
          metalness={0}
          roughness={0}
          transmission={0.9}
          transparent
          opacity={0.3}
          reflectivity={0.5}
          ior={1.5}
        />
      </mesh>
      
      {/* Frame */}
      {/* Top */}
      <mesh position={[0, height / 2 - frameWidth / 2, 0]}>
        <boxGeometry args={[width, frameWidth, 0.012]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Bottom */}
      <mesh position={[0, -height / 2 + frameWidth / 2, 0]}>
        <boxGeometry args={[width, frameWidth, 0.012]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Left */}
      <mesh position={[-width / 2 + frameWidth / 2, 0, 0]}>
        <boxGeometry args={[frameWidth, height - frameWidth * 2, 0.012]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.1} />
      </mesh>
      {/* Right */}
      <mesh position={[width / 2 - frameWidth / 2, 0, 0]}>
        <boxGeometry args={[frameWidth, height - frameWidth * 2, 0.012]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.1} />
      </mesh>
    </group>
  );
};
