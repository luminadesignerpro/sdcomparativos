import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Grid, Text } from '@react-three/drei';

interface RoomProps {
  floorWidth: number;
  floorDepth: number;
  wallHeight: number;
  showCeiling?: boolean;
  showGrid?: boolean;
  floorColor?: string;
  wallColor?: string;
  ceilingColor?: string;
}

// Create floor texture
const createFloorTexture = (type: 'tile' | 'wood' | 'concrete' = 'tile', color: string = '#e8e0d0'): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  
  // Base color
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 512, 512);
  
  if (type === 'tile') {
    // Draw tile pattern
    ctx.strokeStyle = '#c0b8a8';
    ctx.lineWidth = 2;
    
    const tileSize = 128;
    for (let x = 0; x <= 512; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y <= 512; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    
    // Add subtle variation to each tile
    for (let x = 0; x < 512; x += tileSize) {
      for (let y = 0; y < 512; y += tileSize) {
        const variation = (Math.random() - 0.5) * 20;
        ctx.fillStyle = `rgba(${128 + variation}, ${120 + variation}, ${100 + variation}, 0.1)`;
        ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
      }
    }
  } else if (type === 'wood') {
    // Wood plank pattern
    const plankWidth = 64;
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 1;
    
    for (let x = 0; x < 512; x += plankWidth) {
      const offset = (Math.floor(x / plankWidth) % 2) * 128;
      for (let y = offset; y < 512 + offset; y += 256) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, Math.min(y + 256, 512));
        ctx.stroke();
      }
      
      // Wood grain
      for (let i = 0; i < 10; i++) {
        const grainY = Math.random() * 512;
        ctx.strokeStyle = `rgba(139, 115, 85, ${0.1 + Math.random() * 0.2})`;
        ctx.beginPath();
        ctx.moveTo(x, grainY);
        ctx.bezierCurveTo(
          x + plankWidth * 0.3, grainY + 5,
          x + plankWidth * 0.7, grainY - 5,
          x + plankWidth, grainY
        );
        ctx.stroke();
      }
    }
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  
  return texture;
};

// Create wall texture
const createWallTexture = (color: string = '#fafafa'): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  
  // Base color
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  
  // Add subtle texture
  const imageData = ctx.getImageData(0, 0, 256, 256);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 6;
    imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
    imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
    imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  
  return texture;
};

export const Room: React.FC<RoomProps> = ({ 
  floorWidth, 
  floorDepth, 
  wallHeight,
  showCeiling = true,
  showGrid = true,
  floorColor = '#e8e0d0',
  wallColor = '#fafafa',
  ceilingColor = '#ffffff'
}) => {
  const fw = floorWidth / 1000;
  const fd = floorDepth / 1000;
  const wh = wallHeight / 1000;
  
  const floorTexture = useMemo(() => createFloorTexture('tile', floorColor), [floorColor]);
  const wallTexture = useMemo(() => createWallTexture(wallColor), [wallColor]);
  
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[fw, fd]} />
        <meshStandardMaterial 
          map={floorTexture}
          color={floorColor} 
          roughness={0.7} 
          metalness={0.1}
        />
      </mesh>

      {/* Back Wall */}
      <mesh position={[0, wh / 2, -fd / 2]} receiveShadow>
        <planeGeometry args={[fw, wh]} />
        <meshStandardMaterial 
          map={wallTexture}
          color={wallColor} 
          side={THREE.DoubleSide}
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      {/* Left Wall */}
      <mesh position={[-fw / 2, wh / 2, 0]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[fd, wh]} />
        <meshStandardMaterial 
          map={wallTexture}
          color={wallColor} 
          side={THREE.DoubleSide}
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      {/* Right Wall */}
      <mesh position={[fw / 2, wh / 2, 0]} rotation={[0, -Math.PI / 2, 0]} receiveShadow>
        <planeGeometry args={[fd, wh]} />
        <meshStandardMaterial 
          map={wallTexture}
          color={wallColor} 
          side={THREE.DoubleSide}
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      {/* Ceiling */}
      {showCeiling && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, wh, 0]}>
          <planeGeometry args={[fw, fd]} />
          <meshStandardMaterial 
            color={ceilingColor} 
            side={THREE.DoubleSide}
            roughness={0.95}
            metalness={0}
          />
        </mesh>
      )}

      {/* Baseboard / Rodapé */}
      <mesh position={[0, 0.04, -fd / 2 + 0.005]}>
        <boxGeometry args={[fw, 0.08, 0.01]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} />
      </mesh>
      <mesh position={[-fw / 2 + 0.005, 0.04, 0]}>
        <boxGeometry args={[0.01, 0.08, fd]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} />
      </mesh>
      <mesh position={[fw / 2 - 0.005, 0.04, 0]}>
        <boxGeometry args={[0.01, 0.08, fd]} />
        <meshStandardMaterial color="#ffffff" roughness={0.5} />
      </mesh>

      {/* Crown molding / Sanca (if ceiling visible) */}
      {showCeiling && (
        <>
          <mesh position={[0, wh - 0.03, -fd / 2 + 0.015]}>
            <boxGeometry args={[fw, 0.06, 0.03]} />
            <meshStandardMaterial color="#ffffff" roughness={0.5} />
          </mesh>
          <mesh position={[-fw / 2 + 0.015, wh - 0.03, 0]}>
            <boxGeometry args={[0.03, 0.06, fd]} />
            <meshStandardMaterial color="#ffffff" roughness={0.5} />
          </mesh>
          <mesh position={[fw / 2 - 0.015, wh - 0.03, 0]}>
            <boxGeometry args={[0.03, 0.06, fd]} />
            <meshStandardMaterial color="#ffffff" roughness={0.5} />
          </mesh>
        </>
      )}

      {/* Grid */}
      {showGrid && (
        <Grid
          position={[0, 0.001, 0]}
          args={[fw, fd]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#d0d0d0"
          sectionSize={1}
          sectionThickness={1}
          sectionColor="#b0b0b0"
          fadeDistance={30}
          infiniteGrid={false}
        />
      )}

      {/* Rulers on walls */}
      {/* Left wall ruler */}
      {Array.from({ length: Math.floor(fd) + 1 }).map((_, i) => (
        <group key={`ruler-left-${i}`} position={[-fw / 2 - 0.02, 0.05, -fd / 2 + i]}>
          <mesh>
            <boxGeometry args={[0.01, 0.02, 0.01]} />
            <meshBasicMaterial color="#666" />
          </mesh>
          {i % 1 === 0 && (
            <Text
              position={[-0.05, 0, 0]}
              fontSize={0.04}
              color="#666"
              anchorX="right"
              rotation={[0, Math.PI / 2, 0]}
            >
              {i}m
            </Text>
          )}
        </group>
      ))}

      {/* Back wall ruler */}
      {Array.from({ length: Math.floor(fw) + 1 }).map((_, i) => (
        <group key={`ruler-back-${i}`} position={[-fw / 2 + i, 0.05, -fd / 2 - 0.02]}>
          <mesh>
            <boxGeometry args={[0.01, 0.02, 0.01]} />
            <meshBasicMaterial color="#666" />
          </mesh>
          {i % 1 === 0 && (
            <Text
              position={[0, 0, -0.05]}
              fontSize={0.04}
              color="#666"
              anchorX="center"
            >
              {i}m
            </Text>
          )}
        </group>
      ))}
    </group>
  );
};

export default Room;
