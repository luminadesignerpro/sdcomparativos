import React, { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface FloatingCardProps {
  position: [number, number, number];
  title: string;
  value: string;
  subtitle: string;
  color: string;
  icon: string;
  delay?: number;
}

export function FloatingCard({
  position,
  title,
  value,
  subtitle,
  color,
  icon,
  delay = 0,
}: FloatingCardProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime + delay;
    groupRef.current.position.y = position[1] + Math.sin(t * 0.8) * 0.15;
    groupRef.current.rotation.y = Math.sin(t * 0.3) * 0.05;
    groupRef.current.rotation.x = Math.sin(t * 0.5) * 0.02;

    const targetScale = hovered ? 1.05 : 1;
    groupRef.current.scale.lerp(
      new THREE.Vector3(targetScale, targetScale, targetScale),
      0.1
    );
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Card body */}
      <mesh>
        <boxGeometry args={[2.8, 1.6, 0.1]} />
        <meshPhysicalMaterial
          color={hovered ? "#3a3a4a" : "#1a1a2e"}
          metalness={0.2}
          roughness={0.1}
          transmission={0.6}
          thickness={1}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Glow border */}
      <mesh position={[0, 0, -0.02]}>
        <boxGeometry args={[2.86, 1.66, 0.06]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.35 : 0.12} />
      </mesh>

      {/* Accent line bottom */}
      <mesh position={[0, -0.72, 0.06]}>
        <boxGeometry args={[2.5, 0.03, 0.01]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* HTML overlay for text content */}
      <Html
        center
        transform
        distanceFactor={5}
        position={[0, 0, 0.07]}
        style={{
          width: "240px",
          pointerEvents: "none",
          userSelect: "none",
          transform: "none",
          WebkitTransform: "none",
        }}
        zIndexRange={[100, 0]}
      >
        <div style={{
          color: "white",
          fontFamily: "system-ui, sans-serif",
          padding: "12px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span style={{ fontSize: "20px" }}>{icon}</span>
            <span style={{ fontSize: "11px", color: "#a0a0b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>{title}</span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
          <div style={{ fontSize: "11px", color, marginTop: "6px", fontWeight: 600 }}>{subtitle}</div>
        </div>
      </Html>
    </group>
  );
}

