import React from 'react';
import { Text, Line } from '@react-three/drei';
import { FurnitureModule } from '@/types';

interface DimensionLinesProps {
  module: FurnitureModule;
  floorWidth: number;
  floorDepth: number;
  wallHeight: number;
}

const DimensionLines: React.FC<DimensionLinesProps> = ({
  module,
  floorWidth,
  floorDepth,
  wallHeight,
}) => {
  const fw = floorWidth / 1000;
  const fd = floorDepth / 1000;

  // Posições em metros
  const pos = {
    x: module.x / 1000,
    y: module.y / 1000,
    z: module.z / 1000,
  };

  const size = {
    w: module.width / 1000,
    h: module.height / 1000,
    d: module.depth / 1000,
  };

  // Distâncias para as paredes em mm
  const distToLeftWall = Math.round(module.x - module.width / 2 + floorWidth / 2);
  const distToRightWall = Math.round(floorWidth / 2 - (module.x + module.width / 2));
  const distToBackWall = Math.round(module.z - module.depth / 2 + floorDepth / 2);

  // Só mostra distâncias maiores que 50mm
  const showLeftDist = distToLeftWall > 50;
  const showRightDist = distToRightWall > 50;
  const showBackDist = distToBackWall > 50;

  return (
    <group>
      {/* Distância para parede esquerda */}
      {showLeftDist && (
        <group position={[(-fw / 2 + pos.x - size.w / 2) / 2, 0.05, pos.z]}>
          <Line
            points={[
              [-fw / 2 + pos.x - size.w / 2 - ((-fw / 2 + pos.x - size.w / 2) / 2), 0, 0],
              [0, 0, 0],
            ]}
            color="#ff6b6b"
            lineWidth={2}
            dashed
            dashSize={0.05}
            gapSize={0.03}
          />
          <Text
            position={[0, 0.1, 0]}
            fontSize={0.06}
            color="#ff6b6b"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.002}
            outlineColor="#ffffff"
          >
            {distToLeftWall}mm
          </Text>
        </group>
      )}

      {/* Distância para parede de fundo */}
      {showBackDist && (
        <group position={[pos.x, 0.05, (-fd / 2 + pos.z - size.d / 2) / 2]}>
          <Line
            points={[
              [0, 0, -fd / 2 + pos.z - size.d / 2 - ((-fd / 2 + pos.z - size.d / 2) / 2)],
              [0, 0, 0],
            ]}
            color="#4ecdc4"
            lineWidth={2}
            dashed
            dashSize={0.05}
            gapSize={0.03}
          />
          <Text
            position={[0.15, 0.1, 0]}
            fontSize={0.06}
            color="#4ecdc4"
            anchorX="center"
            anchorY="bottom"
            rotation={[0, Math.PI / 2, 0]}
            outlineWidth={0.002}
            outlineColor="#ffffff"
          >
            {distToBackWall}mm
          </Text>
        </group>
      )}

      {/* Marcadores nas paredes */}
      <mesh position={[-fw / 2 + 0.02, pos.y + size.h / 2, pos.z]}>
        <boxGeometry args={[0.02, size.h, 0.02]} />
        <meshBasicMaterial color="#ff6b6b" opacity={0.5} transparent />
      </mesh>

      <mesh position={[pos.x, pos.y + size.h / 2, -fd / 2 + 0.02]}>
        <boxGeometry args={[0.02, size.h, 0.02]} />
        <meshBasicMaterial color="#4ecdc4" opacity={0.5} transparent />
      </mesh>
    </group>
  );
};

export default DimensionLines;
