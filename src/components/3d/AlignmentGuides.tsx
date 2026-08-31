import React from 'react';
import { Line } from '@react-three/drei';

interface AlignmentGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  axis: 'x' | 'z';
}

interface AlignmentGuidesProps {
  guides: AlignmentGuide[];
  floorWidth: number;
  floorDepth: number;
  wallHeight: number;
}

const AlignmentGuides: React.FC<AlignmentGuidesProps> = ({
  guides,
  floorWidth,
  floorDepth,
  wallHeight,
}) => {
  const fw = floorWidth / 1000;
  const fd = floorDepth / 1000;
  const wh = wallHeight / 1000;

  return (
    <group>
      {guides.map((guide, index) => {
        const pos = guide.position / 1000;
        
        if (guide.axis === 'x') {
          // Linha vertical ao longo do eixo Z
          return (
            <Line
              key={`guide-${index}`}
              points={[
                [pos, 0.01, -fd / 2],
                [pos, 0.01, fd / 2],
              ]}
              color="#FFD700"
              lineWidth={2}
              dashed
              dashSize={0.1}
              gapSize={0.05}
            />
          );
        } else {
          // Linha horizontal ao longo do eixo X
          return (
            <Line
              key={`guide-${index}`}
              points={[
                [-fw / 2, 0.01, pos],
                [fw / 2, 0.01, pos],
              ]}
              color="#FFD700"
              lineWidth={2}
              dashed
              dashSize={0.1}
              gapSize={0.05}
            />
          );
        }
      })}
    </group>
  );
};

export default AlignmentGuides;
