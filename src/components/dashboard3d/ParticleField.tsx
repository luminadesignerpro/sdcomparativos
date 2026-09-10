import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function ParticleField({ count = 200 }) {
  const meshRef = useRef<THREE.Points>(null!);

  const particles = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 15 - 5;

      // More vibrant blue/purple/cyan tones
      const type = Math.random();
      if (type > 0.6) {
        colors[i * 3] = 0.38; // Cyan-ish
        colors[i * 3 + 1] = 0.82;
        colors[i * 3 + 2] = 0.93;
      } else {
        colors[i * 3] = 0.45; // Purple-ish
        colors[i * 3 + 1] = 0.35;
        colors[i * 3 + 2] = 0.95;
      }
    }
    return { positions, colors };
  }, [count]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.elapsedTime;
    meshRef.current.rotation.y = t * 0.03;
    meshRef.current.rotation.x = Math.sin(t * 0.1) * 0.05;
    meshRef.current.position.y = Math.sin(t * 0.2) * 0.2;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={particles.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={count}
          array={particles.colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        vertexColors
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}
