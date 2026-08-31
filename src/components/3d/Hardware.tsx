import React from 'react';
import * as THREE from 'three';

// Dobradiça de caneco
export const CupHinge: React.FC<{
  position: [number, number, number];
  rotation?: [number, number, number];
  isOpen?: boolean;
}> = ({ position, rotation = [0, 0, 0], isOpen = false }) => {
  const hingeAngle = isOpen ? -Math.PI / 4 : 0;
  
  return (
    <group position={position} rotation={rotation}>
      {/* Base plate */}
      <mesh castShadow>
        <boxGeometry args={[0.05, 0.01, 0.03]} />
        <meshStandardMaterial color="#888888" metalness={0.8} roughness={0.3} />
      </mesh>
      
      {/* Cup (caneco) */}
      <mesh position={[0, -0.008, 0.025]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.015, 16]} />
        <meshStandardMaterial color="#a0a0a0" metalness={0.9} roughness={0.2} />
      </mesh>
      
      {/* Arm */}
      <group rotation={[0, hingeAngle, 0]}>
        <mesh position={[0.03, 0, 0.015]} castShadow>
          <boxGeometry args={[0.03, 0.008, 0.012]} />
          <meshStandardMaterial color="#909090" metalness={0.85} roughness={0.25} />
        </mesh>
      </group>
      
      {/* Mounting screws */}
      {[-0.015, 0.015].map((x, i) => (
        <mesh key={i} position={[x, 0.006, 0]} castShadow>
          <cylinderGeometry args={[0.003, 0.003, 0.003, 8]} />
          <meshStandardMaterial color="#666666" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
};

// Corrediça telescópica
export const TelescopicSlide: React.FC<{
  position: [number, number, number];
  length: number;
  extended?: number; // 0 to 1
  side: 'left' | 'right';
}> = ({ position, length, extended = 0, side }) => {
  const extensionLength = length * extended * 0.8;
  const sideMultiplier = side === 'left' ? 1 : -1;
  
  return (
    <group position={position}>
      {/* Outer rail (fixed) */}
      <mesh castShadow>
        <boxGeometry args={[0.012, 0.008, length]} />
        <meshStandardMaterial color="#666666" metalness={0.85} roughness={0.3} />
      </mesh>
      
      {/* Middle rail */}
      <mesh position={[sideMultiplier * 0.002, 0, extensionLength * 0.3]} castShadow>
        <boxGeometry args={[0.008, 0.006, length * 0.9]} />
        <meshStandardMaterial color="#888888" metalness={0.85} roughness={0.25} />
      </mesh>
      
      {/* Inner rail (moves) */}
      <mesh position={[sideMultiplier * 0.004, 0, extensionLength]} castShadow>
        <boxGeometry args={[0.006, 0.004, length * 0.85]} />
        <meshStandardMaterial color="#aaaaaa" metalness={0.9} roughness={0.2} />
      </mesh>
      
      {/* Ball bearings (simplified) */}
      {[0.2, 0.5, 0.8].map((pos, i) => (
        <mesh key={i} position={[sideMultiplier * 0.003, 0, -length/2 + length * pos + extensionLength * 0.3]} castShadow>
          <sphereGeometry args={[0.002, 8, 8]} />
          <meshStandardMaterial color="#cccccc" metalness={0.95} roughness={0.1} />
        </mesh>
      ))}
    </group>
  );
};

// Articulador (flap stay)
export const FlapStay: React.FC<{
  position: [number, number, number];
  isOpen?: boolean;
}> = ({ position, isOpen = false }) => {
  const armAngle = isOpen ? Math.PI / 3 : 0;
  
  return (
    <group position={position}>
      {/* Base bracket */}
      <mesh castShadow>
        <boxGeometry args={[0.03, 0.02, 0.015]} />
        <meshStandardMaterial color="#707070" metalness={0.8} roughness={0.3} />
      </mesh>
      
      {/* Arm 1 */}
      <group rotation={[armAngle, 0, 0]}>
        <mesh position={[0, 0.04, 0]} castShadow>
          <boxGeometry args={[0.008, 0.08, 0.008]} />
          <meshStandardMaterial color="#888888" metalness={0.85} roughness={0.25} />
        </mesh>
        
        {/* Arm 2 */}
        <group position={[0, 0.08, 0]} rotation={[-armAngle * 0.5, 0, 0]}>
          <mesh position={[0, 0.03, 0]} castShadow>
            <boxGeometry args={[0.008, 0.06, 0.008]} />
            <meshStandardMaterial color="#888888" metalness={0.85} roughness={0.25} />
          </mesh>
        </group>
      </group>
      
      {/* Gas spring */}
      <mesh position={[0.015, 0.05, 0]} rotation={[armAngle * 0.7, 0, 0]} castShadow>
        <cylinderGeometry args={[0.004, 0.004, 0.1, 8]} />
        <meshStandardMaterial color="#444444" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
};

// Trilho de correr
export const SlidingRail: React.FC<{
  position: [number, number, number];
  width: number;
  isTop?: boolean;
}> = ({ position, width, isTop = true }) => {
  return (
    <group position={position}>
      {/* Rail profile */}
      <mesh castShadow>
        <boxGeometry args={[width, 0.015, 0.025]} />
        <meshStandardMaterial color="#a0a0a0" metalness={0.85} roughness={0.3} />
      </mesh>
      
      {/* Channel */}
      <mesh position={[0, isTop ? -0.005 : 0.005, 0]}>
        <boxGeometry args={[width - 0.02, 0.008, 0.018]} />
        <meshStandardMaterial color="#666666" metalness={0.8} roughness={0.4} />
      </mesh>
      
      {/* End caps */}
      {[-width/2 + 0.005, width/2 - 0.005].map((x, i) => (
        <mesh key={i} position={[x, 0, 0]} castShadow>
          <boxGeometry args={[0.008, 0.02, 0.03]} />
          <meshStandardMaterial color="#888888" metalness={0.85} roughness={0.25} />
        </mesh>
      ))}
    </group>
  );
};

// Rodinha de correr
export const SlidingWheel: React.FC<{
  position: [number, number, number];
}> = ({ position }) => {
  return (
    <group position={position}>
      {/* Wheel housing */}
      <mesh castShadow>
        <boxGeometry args={[0.025, 0.03, 0.015]} />
        <meshStandardMaterial color="#707070" metalness={0.8} roughness={0.3} />
      </mesh>
      
      {/* Wheel */}
      <mesh position={[0, -0.01, 0]} rotation={[0, 0, Math.PI/2]} castShadow>
        <cylinderGeometry args={[0.008, 0.008, 0.006, 16]} />
        <meshStandardMaterial color="#333333" metalness={0.2} roughness={0.8} />
      </mesh>
    </group>
  );
};

// Aramado organizador
export const WireBasket: React.FC<{
  position: [number, number, number];
  width: number;
  height: number;
  depth: number;
}> = ({ position, width, height, depth }) => {
  const wireThickness = 0.003;
  const spacing = 0.03;
  
  const wires: React.ReactNode[] = [];
  
  // Bottom wires (horizontal grid)
  for (let x = -width/2 + spacing; x < width/2; x += spacing) {
    wires.push(
      <mesh key={`bx-${x}`} position={[x, 0, 0]}>
        <cylinderGeometry args={[wireThickness, wireThickness, depth, 6]} />
        <meshStandardMaterial color="#a0a0a0" metalness={0.9} roughness={0.2} />
      </mesh>
    );
  }
  for (let z = -depth/2 + spacing; z < depth/2; z += spacing) {
    wires.push(
      <mesh key={`bz-${z}`} position={[0, 0, z]} rotation={[0, 0, Math.PI/2]}>
        <cylinderGeometry args={[wireThickness, wireThickness, width, 6]} />
        <meshStandardMaterial color="#a0a0a0" metalness={0.9} roughness={0.2} />
      </mesh>
    );
  }
  
  // Side frames
  const framePositions = [
    { pos: [-width/2, height/2, 0] as [number, number, number], size: [wireThickness*2, height, depth] as [number, number, number] },
    { pos: [width/2, height/2, 0] as [number, number, number], size: [wireThickness*2, height, depth] as [number, number, number] },
    { pos: [0, height/2, -depth/2] as [number, number, number], size: [width, height, wireThickness*2] as [number, number, number] },
    { pos: [0, height/2, depth/2] as [number, number, number], size: [width, height, wireThickness*2] as [number, number, number] },
  ];
  
  return (
    <group position={position}>
      {wires}
      {/* Frame */}
      {framePositions.map((f, i) => (
        <mesh key={`frame-${i}`} position={f.pos}>
          <boxGeometry args={f.size} />
          <meshStandardMaterial color="#909090" metalness={0.85} roughness={0.3} />
        </mesh>
      ))}
      {/* Top rail */}
      <mesh position={[0, height, 0]} rotation={[Math.PI/2, 0, 0]}>
        <torusGeometry args={[Math.min(width, depth)/2 * 0.95, wireThickness * 1.5, 8, 32]} />
        <meshStandardMaterial color="#888888" metalness={0.85} roughness={0.25} />
      </mesh>
    </group>
  );
};

// Divisor de gaveta
export const DrawerDivider: React.FC<{
  position: [number, number, number];
  width: number;
  height: number;
  slots?: number;
}> = ({ position, width, height, slots = 4 }) => {
  const slotWidth = width / slots;
  
  return (
    <group position={position}>
      {/* Base */}
      <mesh>
        <boxGeometry args={[width, 0.003, height]} />
        <meshStandardMaterial color="#f5f0e6" roughness={0.7} />
      </mesh>
      
      {/* Dividers */}
      {Array.from({ length: slots - 1 }).map((_, i) => (
        <mesh key={i} position={[-width/2 + slotWidth * (i + 1), 0.02, 0]}>
          <boxGeometry args={[0.003, 0.04, height * 0.9]} />
          <meshStandardMaterial color="#d4c9b9" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
};

// Prateleira ajustável com suportes
export const AdjustableShelf: React.FC<{
  position: [number, number, number];
  width: number;
  depth: number;
  color?: string;
}> = ({ position, width, depth, color = '#e8e0d5' }) => {
  return (
    <group position={position}>
      {/* Shelf */}
      <mesh castShadow>
        <boxGeometry args={[width, 0.018, depth]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      
      {/* Shelf supports (4 corners) */}
      {[
        [-width/2 + 0.02, -depth/2 + 0.02],
        [width/2 - 0.02, -depth/2 + 0.02],
        [-width/2 + 0.02, depth/2 - 0.02],
        [width/2 - 0.02, depth/2 - 0.02],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, -0.015, z]} castShadow>
          <cylinderGeometry args={[0.004, 0.004, 0.015, 8]} />
          <meshStandardMaterial color="#a0a0a0" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
    </group>
  );
};

export default {
  CupHinge,
  TelescopicSlide,
  FlapStay,
  SlidingRail,
  SlidingWheel,
  WireBasket,
  DrawerDivider,
  AdjustableShelf,
};
