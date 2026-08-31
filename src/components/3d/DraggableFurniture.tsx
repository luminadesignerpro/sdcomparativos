import React, { useRef, useState, useMemo } from 'react';
import { useThree, ThreeEvent } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { FurnitureModule } from '@/types';

interface DraggableFurnitureProps {
  module: FurnitureModule;
  isSelected: boolean;
  isDragging: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnd: (newPosition: { x: number; y: number; z: number }) => void;
  onDrag: (position: { x: number; y: number; z: number }) => void;
  showDimensions: boolean;
  snapIndicator?: { snappedToWall: string | null; snappedToModule: string | null };
}

const DraggableFurniture: React.FC<DraggableFurnitureProps> = ({
  module,
  isSelected,
  isDragging,
  onSelect,
  onDragStart,
  onDragEnd,
  onDrag,
  showDimensions,
  snapIndicator,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { raycaster } = useThree();
  const [localDragging, setLocalDragging] = useState(false);
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const dragOffset = useRef(new THREE.Vector3());

  const color = useMemo(() => {
    if (isDragging || localDragging) return '#4a90d9';
    if (snapIndicator?.snappedToWall || snapIndicator?.snappedToModule) return '#4CAF50';
    switch (module.category) {
      case 'Cozinha': return '#8B5A2B';
      case 'Dormitório': return '#654321';
      case 'Sala': return '#A0522D';
      default: return '#D2691E';
    }
  }, [module.category, isDragging, localDragging, snapIndicator]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onSelect();
    
    // Iniciar arrasto
    setLocalDragging(true);
    onDragStart();
    
    // Captura o pointer
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    
    // Calcula o offset do clique em relação ao centro do objeto
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane.current, intersection);
    dragOffset.current.copy(intersection).sub(
      new THREE.Vector3(module.x / 1000, module.y / 1000, module.z / 1000)
    );
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!localDragging) return;
    e.stopPropagation();

    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane.current, intersection);
    
    const newX = (intersection.x - dragOffset.current.x) * 1000;
    const newZ = (intersection.z - dragOffset.current.z) * 1000;
    
    onDrag({ x: newX, y: module.y, z: newZ });
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!localDragging) return;
    e.stopPropagation();
    
    setLocalDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    onDragEnd({ x: module.x, y: module.y, z: module.z });
  };

  // Posição do módulo em metros
  const position: [number, number, number] = [
    module.x / 1000,
    module.y / 1000 + module.height / 2000,
    module.z / 1000,
  ];

  const size: [number, number, number] = [
    module.width / 1000,
    module.height / 1000,
    module.depth / 1000,
  ];

  return (
    <group>
      <mesh
        ref={meshRef}
        position={position}
        rotation={[0, (module.rotation * Math.PI) / 180, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        castShadow
        receiveShadow
      >
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          roughness={0.4}
          metalness={0.1}
          emissive={isSelected ? '#d4af37' : '#000000'}
          emissiveIntensity={isSelected ? 0.3 : 0}
          transparent={isDragging || localDragging}
          opacity={isDragging || localDragging ? 0.8 : 1}
        />
      </mesh>

      {/* Borda de seleção */}
      {isSelected && (
        <lineSegments position={position} rotation={[0, (module.rotation * Math.PI) / 180, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(
            size[0] + 0.02,
            size[1] + 0.02,
            size[2] + 0.02
          )]} />
          <lineBasicMaterial color="#d4af37" linewidth={2} />
        </lineSegments>
      )}

      {/* Indicador de snap */}
      {(snapIndicator?.snappedToWall || snapIndicator?.snappedToModule) && (
        <mesh position={[position[0], position[1] + size[1] / 2 + 0.1, position[2]]}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial color="#4CAF50" />
        </mesh>
      )}

      {/* Cotas - Dimensões do módulo quando selecionado */}
      {isSelected && showDimensions && (
        <>
          {/* Largura */}
          <group position={[position[0], position[1] - size[1] / 2 - 0.15, position[2] + size[2] / 2 + 0.1]}>
            <Text
              fontSize={0.08}
              color="#0a246a"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.003}
              outlineColor="#ffffff"
            >
              {module.width}mm
            </Text>
            {/* Linha da cota */}
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[new Float32Array([
                    -size[0] / 2, 0, 0,
                    size[0] / 2, 0, 0
                  ]), 3]}
                />
              </bufferGeometry>
              <lineBasicMaterial color="#0a246a" />
            </line>
          </group>

          {/* Altura */}
          <group position={[position[0] + size[0] / 2 + 0.15, position[1], position[2]]}>
            <Text
              fontSize={0.08}
              color="#0a246a"
              anchorX="center"
              anchorY="middle"
              rotation={[0, 0, Math.PI / 2]}
              outlineWidth={0.003}
              outlineColor="#ffffff"
            >
              {module.height}mm
            </Text>
          </group>

          {/* Profundidade */}
          <group position={[position[0] - size[0] / 2 - 0.1, position[1] - size[1] / 2 - 0.15, position[2]]}>
            <Text
              fontSize={0.08}
              color="#0a246a"
              anchorX="center"
              anchorY="middle"
              rotation={[0, Math.PI / 2, 0]}
              outlineWidth={0.003}
              outlineColor="#ffffff"
            >
              {module.depth}mm
            </Text>
          </group>
        </>
      )}
    </group>
  );
};

export default DraggableFurniture;
