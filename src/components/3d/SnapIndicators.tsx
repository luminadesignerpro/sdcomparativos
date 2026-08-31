import React from 'react';
import { Text } from '@react-three/drei';

interface SnapIndicatorsProps {
  snappedToWall: 'left' | 'right' | 'back' | null;
  snappedToModule: string | null;
  modulePosition: { x: number; y: number; z: number };
  floorWidth: number;
  floorDepth: number;
}

const SnapIndicators: React.FC<SnapIndicatorsProps> = ({
  snappedToWall,
  snappedToModule,
  modulePosition,
  floorWidth,
  floorDepth,
}) => {
  const fw = floorWidth / 1000;
  const fd = floorDepth / 1000;

  if (!snappedToWall && !snappedToModule) return null;

  const posX = modulePosition.x / 1000;
  const posY = modulePosition.y / 1000 + 0.5;
  const posZ = modulePosition.z / 1000;

  return (
    <group>
      {/* Indicador visual de snap na parede */}
      {snappedToWall === 'left' && (
        <mesh position={[-fw / 2 + 0.01, posY, posZ]}>
          <planeGeometry args={[0.02, 0.3]} />
          <meshBasicMaterial color="#4CAF50" opacity={0.8} transparent />
        </mesh>
      )}
      
      {snappedToWall === 'right' && (
        <mesh position={[fw / 2 - 0.01, posY, posZ]}>
          <planeGeometry args={[0.02, 0.3]} />
          <meshBasicMaterial color="#4CAF50" opacity={0.8} transparent />
        </mesh>
      )}
      
      {snappedToWall === 'back' && (
        <mesh position={[posX, posY, -fd / 2 + 0.01]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.02, 0.3]} />
          <meshBasicMaterial color="#4CAF50" opacity={0.8} transparent />
        </mesh>
      )}

      {/* Texto indicando snap */}
      {(snappedToWall || snappedToModule) && (
        <Text
          position={[posX, posY + 0.3, posZ]}
          fontSize={0.06}
          color="#4CAF50"
          anchorX="center"
          anchorY="bottom"
          outlineWidth={0.002}
          outlineColor="#ffffff"
        >
          {snappedToWall ? `⚡ Encaixado na parede ${snappedToWall === 'left' ? 'esquerda' : snappedToWall === 'right' ? 'direita' : 'fundo'}` : '⚡ Encaixado'}
        </Text>
      )}
    </group>
  );
};

export default SnapIndicators;
