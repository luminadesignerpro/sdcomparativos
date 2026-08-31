import React, { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface ProjectBarProps {
  position: [number, number, number];
  label: string;
  value: number;
  maxValue: number;
  color: string;
  delay?: number;
}

export function ProjectBar({
  position,
  label,
  value,
  maxValue,
  color,
  delay = 0,
}: ProjectBarProps) {
  const barRef = useRef<THREE.Mesh>(null!);
  const groupRef = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);
  const targetHeight = (value / maxValue) * 2.5;

  useFrame((state) => {
    if (!barRef.current || !groupRef.current) return;
    const t = state.clock.elapsedTime;

    const progress = Math.min(1, (t - delay * 0.3) * 0.8);
    const eased = 1 - Math.pow(1 - Math.max(0, progress), 3);
    
    // Scale pulse and hover
    const hoverScale = hovered ? 1.2 : 1.0;
    barRef.current.scale.x = THREE.MathUtils.lerp(barRef.current.scale.x, hoverScale, 0.1);
    barRef.current.scale.z = THREE.MathUtils.lerp(barRef.current.scale.z, hoverScale, 0.1);
    barRef.current.scale.y = eased * (hovered ? 1.1 : 1.0);

    groupRef.current.position.y = position[1] + Math.sin(t * 0.6 + delay) * (hovered ? 0.1 : 0.05);
  });

  return (
    <group 
      ref={groupRef} 
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <mesh ref={barRef} position={[0, targetHeight / 2, 0]}>
        <boxGeometry args={[0.4, targetHeight, 0.4]} />
        <meshPhysicalMaterial
          color={color}
          metalness={0.4}
          roughness={0.2}
          transmission={0.4}
          thickness={0.5}
          transparent
          opacity={hovered ? 0.95 : 0.8}
          emissive={color}
          emissiveIntensity={hovered ? 0.5 : 0.2}
        />
      </mesh>

      {/* Label and value via Html */}
      <Html center position={[0, -0.3, 0.3]} distanceFactor={8} style={{ pointerEvents: "none" }}>
        <span style={{ fontSize: "10px", color: "#a0a0b8", fontFamily: "system-ui" }}>{label}</span>
      </Html>
      <Html center position={[0, targetHeight + 0.25, 0]} distanceFactor={8} style={{ pointerEvents: "none" }}>
        <span style={{ fontSize: "12px", color: "#fff", fontWeight: 700, fontFamily: "system-ui" }}>{value}</span>
      </Html>
    </group>
  );
}
