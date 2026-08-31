import React from 'react';
import * as THREE from 'three';

interface ApplianceProps {
  position: [number, number, number];
  rotation?: number;
  scale?: number;
}

// Geladeira / Refrigerator
export const Fridge: React.FC<ApplianceProps> = ({ position, rotation = 0, scale = 1 }) => {
  const width = 0.7 * scale;
  const height = 1.8 * scale;
  const depth = 0.65 * scale;
  
  return (
    <group position={position} rotation={[0, (rotation * Math.PI) / 180, 0]}>
      {/* Main body */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#e8e8e8" metalness={0.3} roughness={0.4} />
      </mesh>
      
      {/* Freezer door line */}
      <mesh position={[0, height * 0.75, depth / 2 + 0.005]}>
        <boxGeometry args={[width - 0.02, height * 0.35, 0.01]} />
        <meshStandardMaterial color="#d0d0d0" metalness={0.4} roughness={0.3} />
      </mesh>
      
      {/* Fridge door line */}
      <mesh position={[0, height * 0.35, depth / 2 + 0.005]}>
        <boxGeometry args={[width - 0.02, height * 0.55, 0.01]} />
        <meshStandardMaterial color="#d0d0d0" metalness={0.4} roughness={0.3} />
      </mesh>
      
      {/* Handle freezer */}
      <mesh position={[width * 0.35, height * 0.75, depth / 2 + 0.03]} castShadow>
        <boxGeometry args={[0.02, 0.15, 0.02]} />
        <meshStandardMaterial color="#a0a0a0" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Handle fridge */}
      <mesh position={[width * 0.35, height * 0.45, depth / 2 + 0.03]} castShadow>
        <boxGeometry args={[0.02, 0.25, 0.02]} />
        <meshStandardMaterial color="#a0a0a0" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Ice/water dispenser */}
      <mesh position={[-width * 0.1, height * 0.65, depth / 2 + 0.015]}>
        <boxGeometry args={[0.12, 0.08, 0.02]} />
        <meshStandardMaterial color="#333333" metalness={0.1} roughness={0.8} />
      </mesh>
    </group>
  );
};

// Fogão / Stove
export const Stove: React.FC<ApplianceProps> = ({ position, rotation = 0, scale = 1 }) => {
  const width = 0.6 * scale;
  const height = 0.9 * scale;
  const depth = 0.6 * scale;
  
  return (
    <group position={position} rotation={[0, (rotation * Math.PI) / 180, 0]}>
      {/* Main body */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#f0f0f0" metalness={0.2} roughness={0.5} />
      </mesh>
      
      {/* Cooktop surface */}
      <mesh position={[0, height + 0.01, 0]}>
        <boxGeometry args={[width - 0.02, 0.02, depth - 0.02]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.1} roughness={0.3} />
      </mesh>
      
      {/* Burners */}
      {[[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]].map(([x, z], i) => (
        <group key={i} position={[x * scale, height + 0.025, z * scale]}>
          <mesh>
            <cylinderGeometry args={[0.06 * scale, 0.06 * scale, 0.01, 32]} />
            <meshStandardMaterial color="#333333" metalness={0.3} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.01, 0]}>
            <torusGeometry args={[0.04 * scale, 0.008 * scale, 8, 32]} />
            <meshStandardMaterial color="#666666" metalness={0.6} roughness={0.3} />
          </mesh>
        </group>
      ))}
      
      {/* Oven door */}
      <mesh position={[0, height * 0.4, depth / 2 + 0.01]}>
        <boxGeometry args={[width - 0.04, height * 0.45, 0.02]} />
        <meshStandardMaterial color="#e0e0e0" metalness={0.3} roughness={0.4} />
      </mesh>
      
      {/* Oven window */}
      <mesh position={[0, height * 0.4, depth / 2 + 0.025]}>
        <boxGeometry args={[width - 0.1, height * 0.25, 0.01]} />
        <meshPhysicalMaterial 
          color="#000000" 
          metalness={0} 
          roughness={0} 
          transmission={0.5}
          transparent
          opacity={0.8}
        />
      </mesh>
      
      {/* Oven handle */}
      <mesh position={[0, height * 0.7, depth / 2 + 0.04]} castShadow>
        <boxGeometry args={[width * 0.6, 0.02, 0.02]} />
        <meshStandardMaterial color="#a0a0a0" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Control knobs */}
      {[-0.2, -0.1, 0, 0.1, 0.2].map((x, i) => (
        <mesh key={i} position={[x * scale, height * 0.85, depth / 2 + 0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.015 * scale, 0.015 * scale, 0.02, 16]} />
          <meshStandardMaterial color="#333333" metalness={0.2} roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
};

// Máquina de Lavar / Washing Machine
export const WashingMachine: React.FC<ApplianceProps> = ({ position, rotation = 0, scale = 1 }) => {
  const width = 0.6 * scale;
  const height = 0.85 * scale;
  const depth = 0.6 * scale;
  
  return (
    <group position={position} rotation={[0, (rotation * Math.PI) / 180, 0]}>
      {/* Main body */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#f5f5f5" metalness={0.2} roughness={0.5} />
      </mesh>
      
      {/* Front panel */}
      <mesh position={[0, height * 0.4, depth / 2 + 0.01]}>
        <boxGeometry args={[width - 0.02, height * 0.6, 0.02]} />
        <meshStandardMaterial color="#e8e8e8" metalness={0.15} roughness={0.4} />
      </mesh>
      
      {/* Door ring */}
      <mesh position={[0, height * 0.4, depth / 2 + 0.03]}>
        <torusGeometry args={[0.18 * scale, 0.02 * scale, 16, 32]} />
        <meshStandardMaterial color="#d0d0d0" metalness={0.4} roughness={0.3} />
      </mesh>
      
      {/* Door glass */}
      <mesh position={[0, height * 0.4, depth / 2 + 0.025]}>
        <circleGeometry args={[0.16 * scale, 32]} />
        <meshPhysicalMaterial 
          color="#1a1a2e" 
          metalness={0} 
          roughness={0.1} 
          transmission={0.3}
          transparent
          opacity={0.6}
        />
      </mesh>
      
      {/* Control panel */}
      <mesh position={[0, height * 0.9, depth / 2 + 0.01]}>
        <boxGeometry args={[width - 0.04, height * 0.15, 0.02]} />
        <meshStandardMaterial color="#333333" metalness={0.1} roughness={0.7} />
      </mesh>
      
      {/* Display */}
      <mesh position={[-0.1 * scale, height * 0.9, depth / 2 + 0.025]}>
        <boxGeometry args={[0.08 * scale, 0.04 * scale, 0.005]} />
        <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.3} />
      </mesh>
      
      {/* Dial */}
      <mesh position={[0.12 * scale, height * 0.9, depth / 2 + 0.03]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03 * scale, 0.03 * scale, 0.02, 32]} />
        <meshStandardMaterial color="#666666" metalness={0.3} roughness={0.5} />
      </mesh>
    </group>
  );
};

// Microondas / Microwave
export const Microwave: React.FC<ApplianceProps> = ({ position, rotation = 0, scale = 1 }) => {
  const width = 0.5 * scale;
  const height = 0.3 * scale;
  const depth = 0.35 * scale;
  
  return (
    <group position={position} rotation={[0, (rotation * Math.PI) / 180, 0]}>
      {/* Main body */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color="#2d2d2d" metalness={0.3} roughness={0.4} />
      </mesh>
      
      {/* Door frame */}
      <mesh position={[-width * 0.15, height / 2, depth / 2 + 0.005]}>
        <boxGeometry args={[width * 0.6, height - 0.02, 0.01]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.2} roughness={0.5} />
      </mesh>
      
      {/* Door window */}
      <mesh position={[-width * 0.15, height / 2, depth / 2 + 0.01]}>
        <boxGeometry args={[width * 0.5, height - 0.06, 0.005]} />
        <meshPhysicalMaterial 
          color="#000000" 
          metalness={0} 
          roughness={0} 
          transmission={0.4}
          transparent
          opacity={0.7}
        />
      </mesh>
      
      {/* Control panel */}
      <mesh position={[width * 0.35, height / 2, depth / 2 + 0.005]}>
        <boxGeometry args={[width * 0.2, height - 0.02, 0.01]} />
        <meshStandardMaterial color="#333333" metalness={0.1} roughness={0.6} />
      </mesh>
      
      {/* Display */}
      <mesh position={[width * 0.35, height * 0.65, depth / 2 + 0.015]}>
        <boxGeometry args={[width * 0.12, 0.03, 0.005]} />
        <meshStandardMaterial color="#00ff00" emissive="#00ff00" emissiveIntensity={0.4} />
      </mesh>
      
      {/* Buttons */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[width * 0.35, height * (0.4 - i * 0.12), depth / 2 + 0.015]}>
          <boxGeometry args={[width * 0.1, 0.02, 0.01]} />
          <meshStandardMaterial color="#555555" metalness={0.2} roughness={0.5} />
        </mesh>
      ))}
      
      {/* Handle */}
      <mesh position={[width * 0.1, height / 2, depth / 2 + 0.02]} castShadow>
        <boxGeometry args={[0.01, height * 0.4, 0.01]} />
        <meshStandardMaterial color="#a0a0a0" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
};

// Coifa / Range Hood
export const RangeHood: React.FC<ApplianceProps> = ({ position, rotation = 0, scale = 1 }) => {
  const width = 0.6 * scale;
  const height = 0.4 * scale;
  const depth = 0.5 * scale;
  
  return (
    <group position={position} rotation={[0, (rotation * Math.PI) / 180, 0]}>
      {/* Main hood */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height * 0.3, depth]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.7} roughness={0.3} />
      </mesh>
      
      {/* Chimney */}
      <mesh position={[0, height * 0.5, -depth * 0.2]} castShadow>
        <boxGeometry args={[width * 0.5, height, depth * 0.3]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.7} roughness={0.3} />
      </mesh>
      
      {/* Filter grille */}
      <mesh position={[0, -height * 0.12, 0]}>
        <boxGeometry args={[width - 0.04, 0.02, depth - 0.04]} />
        <meshStandardMaterial color="#888888" metalness={0.5} roughness={0.4} />
      </mesh>
      
      {/* Lights */}
      {[-0.1, 0.1].map((x, i) => (
        <mesh key={i} position={[x * scale, -height * 0.1, depth * 0.2]}>
          <cylinderGeometry args={[0.015 * scale, 0.015 * scale, 0.01, 16]} />
          <meshStandardMaterial color="#ffff00" emissive="#ffff00" emissiveIntensity={0.3} />
        </mesh>
      ))}
      
      {/* Controls */}
      <mesh position={[0, -height * 0.05, depth / 2 + 0.01]}>
        <boxGeometry args={[0.15 * scale, 0.03, 0.01]} />
        <meshStandardMaterial color="#333333" metalness={0.2} roughness={0.6} />
      </mesh>
    </group>
  );
};

// Pia / Sink
export const Sink: React.FC<ApplianceProps> = ({ position, rotation = 0, scale = 1 }) => {
  const width = 0.8 * scale;
  const depth = 0.5 * scale;
  
  return (
    <group position={position} rotation={[0, (rotation * Math.PI) / 180, 0]}>
      {/* Sink basin */}
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[width, 0.02, depth]} />
        <meshStandardMaterial color="#e0e0e0" metalness={0.6} roughness={0.3} />
      </mesh>
      
      {/* Basin interior (inset) */}
      <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[width - 0.08, 0.15, depth - 0.08]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.7} roughness={0.2} side={THREE.BackSide} />
      </mesh>
      
      {/* Faucet base */}
      <mesh position={[0, 0.02, -depth * 0.35]} castShadow>
        <cylinderGeometry args={[0.02 * scale, 0.03 * scale, 0.04, 16]} />
        <meshStandardMaterial color="#a0a0a0" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Faucet spout */}
      <mesh position={[0, 0.15, -depth * 0.2]} rotation={[Math.PI / 4, 0, 0]} castShadow>
        <cylinderGeometry args={[0.01 * scale, 0.01 * scale, 0.15, 16]} />
        <meshStandardMaterial color="#a0a0a0" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Faucet neck */}
      <mesh position={[0, 0.08, -depth * 0.35]} castShadow>
        <cylinderGeometry args={[0.01 * scale, 0.01 * scale, 0.12, 16]} />
        <meshStandardMaterial color="#a0a0a0" metalness={0.8} roughness={0.2} />
      </mesh>
      
      {/* Handles */}
      {[-0.06, 0.06].map((x, i) => (
        <mesh key={i} position={[x * scale, 0.06, -depth * 0.35]} castShadow>
          <cylinderGeometry args={[0.015 * scale, 0.01 * scale, 0.03, 16]} />
          <meshStandardMaterial color="#a0a0a0" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
};
