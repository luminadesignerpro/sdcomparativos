import React from 'react';
import { Text, Line } from '@react-three/drei';
import * as THREE from 'three';
import { FurnitureModule } from '@/types';

interface DimensionLinesProps {
  modules: FurnitureModule[];
  floorWidth: number;
  floorDepth: number;
  wallHeight: number;
  selectedId: string | null;
}

// Linha de cota com setas
const DimensionLine: React.FC<{
  start: [number, number, number];
  end: [number, number, number];
  offset?: number;
  label: string;
  color?: string;
  labelOffset?: [number, number, number];
}> = ({ start, end, offset = 0.1, label, color = '#ff6600', labelOffset = [0, 0.05, 0] }) => {
  const direction = new THREE.Vector3(end[0] - start[0], end[1] - start[1], end[2] - start[2]);
  const length = direction.length();
  direction.normalize();
  
  // Perpendicular direction for offset
  const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
  
  const startOffset: [number, number, number] = [
    start[0] + perpendicular.x * offset,
    start[1] + perpendicular.y * offset,
    start[2] + perpendicular.z * offset
  ];
  const endOffset: [number, number, number] = [
    end[0] + perpendicular.x * offset,
    end[1] + perpendicular.y * offset,
    end[2] + perpendicular.z * offset
  ];
  
  const midPoint: [number, number, number] = [
    (startOffset[0] + endOffset[0]) / 2 + labelOffset[0],
    (startOffset[1] + endOffset[1]) / 2 + labelOffset[1],
    (startOffset[2] + endOffset[2]) / 2 + labelOffset[2]
  ];
  
  // Arrow size
  const arrowSize = 0.03;
  
  return (
    <group>
      {/* Main line */}
      <Line
        points={[startOffset, endOffset]}
        color={color}
        lineWidth={1.5}
      />
      
      {/* Start extension line */}
      <Line
        points={[start, startOffset]}
        color={color}
        lineWidth={1}
        dashed
        dashSize={0.02}
        gapSize={0.01}
      />
      
      {/* End extension line */}
      <Line
        points={[end, endOffset]}
        color={color}
        lineWidth={1}
        dashed
        dashSize={0.02}
        gapSize={0.01}
      />
      
      {/* Start arrow */}
      <mesh position={startOffset} rotation={[0, Math.atan2(direction.x, direction.z), 0]}>
        <coneGeometry args={[arrowSize * 0.3, arrowSize, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      
      {/* End arrow */}
      <mesh position={endOffset} rotation={[0, Math.atan2(direction.x, direction.z) + Math.PI, 0]}>
        <coneGeometry args={[arrowSize * 0.3, arrowSize, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      
      {/* Label with background */}
      <group position={midPoint}>
        <mesh position={[0, 0, -0.001]}>
          <planeGeometry args={[0.15, 0.04]} />
          <meshBasicMaterial color="#1a1a2e" transparent opacity={0.9} />
        </mesh>
        <Text
          fontSize={0.025}
          color={color}
          anchorX="center"
          anchorY="middle"
          font="/fonts/Inter-Bold.woff"
        >
          {label}
        </Text>
      </group>
    </group>
  );
};

// Cotas automáticas para um módulo
export const ModuleDimensions: React.FC<{
  module: FurnitureModule;
  isSelected: boolean;
  floorWidth: number;
  floorDepth: number;
}> = ({ module, isSelected, floorWidth, floorDepth }) => {
  if (!isSelected) return null;
  
  const x = module.x / 1000;
  const y = module.y / 1000;
  const z = module.z / 1000;
  const w = module.width / 1000;
  const h = module.height / 1000;
  const d = module.depth / 1000;
  
  // Distâncias para paredes
  const distToLeftWall = module.x - module.width / 2 + floorWidth / 2;
  const distToRightWall = floorWidth / 2 - (module.x + module.width / 2);
  const distToBackWall = module.z - module.depth / 2 + floorDepth / 2;
  const distToFrontWall = floorDepth / 2 - (module.z + module.depth / 2);
  
  return (
    <group>
      {/* Largura do módulo */}
      <DimensionLine
        start={[x - w/2, y + h/2 + 0.05, z + d/2]}
        end={[x + w/2, y + h/2 + 0.05, z + d/2]}
        offset={0.08}
        label={`${module.width}mm`}
        color="#00ff88"
      />
      
      {/* Altura do módulo */}
      <DimensionLine
        start={[x + w/2 + 0.05, y, z + d/2]}
        end={[x + w/2 + 0.05, y + h, z + d/2]}
        offset={0.08}
        label={`${module.height}mm`}
        color="#00ff88"
        labelOffset={[0.05, 0, 0]}
      />
      
      {/* Profundidade do módulo */}
      <DimensionLine
        start={[x + w/2, y - 0.02, z - d/2]}
        end={[x + w/2, y - 0.02, z + d/2]}
        offset={0.08}
        label={`${module.depth}mm`}
        color="#00ff88"
      />
      
      {/* Distância para parede esquerda */}
      {distToLeftWall > 50 && (
        <DimensionLine
          start={[-floorWidth/2000, 0.02, z]}
          end={[x - w/2, 0.02, z]}
          offset={0.05}
          label={`${Math.round(distToLeftWall)}mm`}
          color="#ff6600"
        />
      )}
      
      {/* Distância para parede traseira */}
      {distToBackWall > 50 && (
        <DimensionLine
          start={[x, 0.02, -floorDepth/2000]}
          end={[x, 0.02, z - d/2]}
          offset={0.05}
          label={`${Math.round(distToBackWall)}mm`}
          color="#ff6600"
        />
      )}
    </group>
  );
};

// Cotas entre módulos adjacentes
export const InterModuleDimensions: React.FC<{
  modules: FurnitureModule[];
  selectedId: string | null;
}> = ({ modules, selectedId }) => {
  if (!selectedId) return null;
  
  const selectedModule = modules.find(m => m.id === selectedId);
  if (!selectedModule) return null;
  
  const dimensions: React.ReactNode[] = [];
  
  modules.forEach((other, index) => {
    if (other.id === selectedId) return;
    
    const sx = selectedModule.x / 1000;
    const sz = selectedModule.z / 1000;
    const sw = selectedModule.width / 1000;
    const sd = selectedModule.depth / 1000;
    
    const ox = other.x / 1000;
    const oz = other.z / 1000;
    const ow = other.width / 1000;
    const od = other.depth / 1000;
    
    // Verifica se estão na mesma linha (Z similar)
    if (Math.abs(sz - oz) < 0.3) {
      // Módulo à esquerda
      if (ox + ow/2 < sx - sw/2) {
        const gap = (sx - sw/2) - (ox + ow/2);
        if (gap > 0.01 && gap < 2) {
          dimensions.push(
            <DimensionLine
              key={`gap-${index}`}
              start={[ox + ow/2, 0.05, oz]}
              end={[sx - sw/2, 0.05, sz]}
              offset={0.03}
              label={`${Math.round(gap * 1000)}mm`}
              color="#ffaa00"
            />
          );
        }
      }
      // Módulo à direita
      if (ox - ow/2 > sx + sw/2) {
        const gap = (ox - ow/2) - (sx + sw/2);
        if (gap > 0.01 && gap < 2) {
          dimensions.push(
            <DimensionLine
              key={`gap-r-${index}`}
              start={[sx + sw/2, 0.05, sz]}
              end={[ox - ow/2, 0.05, oz]}
              offset={0.03}
              label={`${Math.round(gap * 1000)}mm`}
              color="#ffaa00"
            />
          );
        }
      }
    }
  });
  
  return <>{dimensions}</>;
};

// Réguas nas paredes
export const WallRulers: React.FC<{
  floorWidth: number;
  floorDepth: number;
  wallHeight: number;
}> = ({ floorWidth, floorDepth, wallHeight }) => {
  const w = floorWidth / 1000;
  const d = floorDepth / 1000;
  const h = wallHeight / 1000;
  
  const rulerMarks: React.ReactNode[] = [];
  const step = 0.5; // 500mm marks
  
  // Parede traseira - régua horizontal
  for (let x = -w/2; x <= w/2; x += step) {
    const isMajor = Math.abs(x * 2) % 1 < 0.01;
    rulerMarks.push(
      <group key={`back-h-${x}`} position={[x, h - 0.02, -d/2 + 0.001]}>
        <mesh>
          <boxGeometry args={[0.002, isMajor ? 0.04 : 0.02, 0.001]} />
          <meshBasicMaterial color="#666" />
        </mesh>
        {isMajor && (
          <Text
            position={[0, 0.05, 0]}
            fontSize={0.02}
            color="#888"
            anchorX="center"
          >
            {Math.round((x + w/2) * 1000)}
          </Text>
        )}
      </group>
    );
  }
  
  // Parede lateral - régua vertical
  for (let y = 0; y <= h; y += step) {
    const isMajor = Math.abs(y * 2) % 1 < 0.01;
    rulerMarks.push(
      <group key={`side-v-${y}`} position={[-w/2 + 0.001, y, -d/2 + 0.1]}>
        <mesh>
          <boxGeometry args={[0.001, 0.002, isMajor ? 0.04 : 0.02]} />
          <meshBasicMaterial color="#666" />
        </mesh>
        {isMajor && (
          <Text
            position={[-0.03, 0, 0]}
            fontSize={0.018}
            color="#888"
            anchorX="right"
            rotation={[0, Math.PI/2, 0]}
          >
            {Math.round(y * 1000)}
          </Text>
        )}
      </group>
    );
  }
  
  return <>{rulerMarks}</>;
};

// Componente principal de cotas
export const DimensionSystem: React.FC<DimensionLinesProps> = ({
  modules,
  floorWidth,
  floorDepth,
  wallHeight,
  selectedId
}) => {
  const selectedModule = modules.find(m => m.id === selectedId);
  
  return (
    <group>
      {/* Réguas nas paredes */}
      <WallRulers 
        floorWidth={floorWidth} 
        floorDepth={floorDepth} 
        wallHeight={wallHeight} 
      />
      
      {/* Cotas do módulo selecionado */}
      {selectedModule && (
        <ModuleDimensions
          module={selectedModule}
          isSelected={true}
          floorWidth={floorWidth}
          floorDepth={floorDepth}
        />
      )}
      
      {/* Cotas entre módulos */}
      <InterModuleDimensions 
        modules={modules} 
        selectedId={selectedId} 
      />
    </group>
  );
};

export default DimensionSystem;
