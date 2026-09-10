import React from 'react';
import { Box, Sphere, Cylinder } from '@react-three/drei';

export const Sofa3D = ({ color = '#888' }) => (
  <group>
    {/* Base */}
    <Box args={[3, 0.5, 1.5]} position={[0, 0.25, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} />
    </Box>
    {/* Backrest */}
    <Box args={[3, 1, 0.3]} position={[0, 0.75, -0.6]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} />
    </Box>
    {/* Arms */}
    <Box args={[0.3, 0.8, 1.5]} position={[-1.35, 0.65, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} />
    </Box>
    <Box args={[0.3, 0.8, 1.5]} position={[1.35, 0.65, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} />
    </Box>
  </group>
);

export const Table3D = ({ color = '#5D4037' }) => (
  <group>
    <Cylinder args={[1, 1, 0.1, 32]} position={[0, 0.75, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.1} metalness={0.2} />
    </Cylinder>
    <Cylinder args={[0.1, 0.1, 0.75, 16]} position={[0, 0.375, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.3} />
    </Cylinder>
    <Cylinder args={[0.4, 0.4, 0.05, 16]} position={[0, 0.025, 0]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.3} />
    </Cylinder>
  </group>
);

export const Plant3D = () => (
  <group>
    <Cylinder args={[0.3, 0.2, 0.4, 16]} position={[0, 0.2, 0]} castShadow receiveShadow>
      <meshStandardMaterial color="#4E342E" roughness={0.8} />
    </Cylinder>
    <Sphere args={[0.4, 16, 16]} position={[0, 0.7, 0]} scale={[1, 1.5, 1]} castShadow>
      <meshStandardMaterial color="#2E7D32" roughness={0.9} />
    </Sphere>
  </group>
);

export const Rug3D = ({ color = '#D7CCC8' }) => (
  <Box args={[4, 0.01, 3]} position={[0, 0.005, 0]} receiveShadow>
    <meshStandardMaterial color={color} roughness={1} metalness={0} />
  </Box>
);
