import React, { useRef, useMemo, useEffect, useState, useCallback } from "react";
import { useThree, ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { Text, Line } from "@react-three/drei";
import { FurnitureModule } from "@/types";
import { FINISH_CONFIGS, createWoodTexture, createMDFTexture } from "./textures/WoodTextures";
import { CabinetDoor, Drawer, GlassPanel, Handle } from "./FurnitureDetails";
import { Fridge, Stove, WashingMachine, Microwave, RangeHood, Sink } from "./Appliances";

interface RealisticModuleProps {
  module: FurnitureModule;
  isSelected: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<FurnitureModule>) => void;
  floorWidth: number;
  floorDepth: number;
  allModules: FurnitureModule[];
  showDimensions: boolean;
}

const SNAP_THRESHOLD = 50;
const DRAG_START_THRESHOLD = 8;

const calculateSnap = (
  targetX: number,
  targetZ: number,
  moduleWidth: number,
  moduleDepth: number,
  floorWidth: number,
  floorDepth: number,
  otherModules: FurnitureModule[],
  moduleId: string
) => {
  let x = targetX;
  let z = targetZ;
  let snappedToWall: 'left' | 'right' | 'back' | null = null;
  let snappedToModule: string | null = null;

  const walls = {
    left: -floorWidth / 2,
    right: floorWidth / 2,
    back: -floorDepth / 2,
  };

  const leftEdge = targetX - moduleWidth / 2;
  if (Math.abs(leftEdge - walls.left) < SNAP_THRESHOLD) {
    x = walls.left + moduleWidth / 2;
    snappedToWall = 'left';
  }

  const rightEdge = targetX + moduleWidth / 2;
  if (Math.abs(rightEdge - walls.right) < SNAP_THRESHOLD) {
    x = walls.right - moduleWidth / 2;
    snappedToWall = 'right';
  }

  const backEdge = targetZ - moduleDepth / 2;
  if (Math.abs(backEdge - walls.back) < SNAP_THRESHOLD) {
    z = walls.back + moduleDepth / 2;
    snappedToWall = 'back';
  }

  for (const other of otherModules) {
    if (other.id === moduleId) continue;

    const otherRightEdge = other.x + other.width / 2;
    const currentLeftEdge = x - moduleWidth / 2;
    if (Math.abs(otherRightEdge - currentLeftEdge) < SNAP_THRESHOLD && 
        Math.abs(other.z - z) < moduleDepth) {
      x = otherRightEdge + moduleWidth / 2;
      snappedToModule = other.id;
    }

    const otherLeftEdge = other.x - other.width / 2;
    const currentRightEdge = x + moduleWidth / 2;
    if (Math.abs(otherLeftEdge - currentRightEdge) < SNAP_THRESHOLD &&
        Math.abs(other.z - z) < moduleDepth) {
      x = otherLeftEdge - moduleWidth / 2;
      snappedToModule = other.id;
    }

    if (Math.abs(other.z - z) < 30) {
      z = other.z;
    }
  }

  return { x, z, snappedToWall, snappedToModule };
};

export const RealisticModule: React.FC<RealisticModuleProps> = ({
  module,
  isSelected,
  onSelect,
  onUpdate,
  floorWidth,
  floorDepth,
  allModules,
  showDimensions,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const { raycaster, gl, camera } = useThree();
  const [isDragging, setIsDragging] = useState(false);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [snapInfo, setSnapInfo] = useState<{ snappedToWall: string | null; snappedToModule: string | null }>({ snappedToWall: null, snappedToModule: null });
  const dragPlane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const dragOffset = useRef(new THREE.Vector3());
  const pointerStartPos = useRef<{ x: number; y: number } | null>(null);
  const dragStarted = useRef(false);
  
  // Estado para portas/gavetas abertas
  const [openDoors, setOpenDoors] = useState<Set<number>>(new Set());

  // Determina número de portas/gavetas baseado no tipo - MUST be before any conditional returns
  const moduleConfig = useMemo(() => {
    const type = module.type.toLowerCase();
    const w = module.width / 1000;
    
    // Balcões base
    if (type.includes('1p')) return { doors: 1, drawers: 0, hasTop: true, hasGlass: false, flaps: 0, sliding: false };
    if (type.includes('2p')) return { doors: 2, drawers: 0, hasTop: true, hasGlass: false, flaps: 0, sliding: false };
    if (type.includes('3p')) return { doors: 3, drawers: 0, hasTop: true, hasGlass: false, flaps: 0, sliding: false };
    if (type.includes('gaveta') || type.includes('4 gavetas')) return { doors: 0, drawers: 4, hasTop: true, hasGlass: false, flaps: 0, sliding: false };
    
    // Aéreos
    if (type.includes('aéreo') || type.includes('aereo')) {
      if (type.includes('basculante')) return { doors: 0, drawers: 0, flaps: 1, hasTop: false, hasGlass: false, sliding: false };
      if (type.includes('vidro')) return { doors: 2, drawers: 0, hasGlass: true, hasTop: false, flaps: 0, sliding: false };
      return { doors: Math.max(1, Math.floor(w / 0.4)), drawers: 0, hasTop: false, hasGlass: false, flaps: 0, sliding: false };
    }
    
    // Torres/Paneleiros
    if (type.includes('torre') || type.includes('paneleiro')) {
      return { doors: 2, drawers: 0, hasTop: true, hasGlass: false, flaps: 0, sliding: false };
    }
    
    // Cômoda
    if (type.includes('cômoda') || type.includes('comoda')) {
      return { doors: 0, drawers: parseInt(type.match(/\d/)?.[0] || '5'), hasTop: true, hasGlass: false, flaps: 0, sliding: false };
    }
    
    // Criado
    if (type.includes('criado')) {
      return { doors: 0, drawers: 2, hasTop: true, hasGlass: false, flaps: 0, sliding: false };
    }
    
    // Roupeiros
    if (type.includes('roupeiro')) {
      const numDoors = parseInt(type.match(/\d/)?.[0] || '2');
      return { doors: numDoors, drawers: 0, hasTop: true, sliding: type.includes('correr'), hasGlass: false, flaps: 0 };
    }
    
    // Default - simples
    return { doors: 0, drawers: 0, hasTop: true, hasGlass: false, flaps: 0, sliding: false };
  }, [module.type, module.width]);

  const finishConfig = FINISH_CONFIGS[module.finish] || FINISH_CONFIGS['Branco Tx'];
  const baseColor = finishConfig.baseColor;

  // Material baseado no acabamento
  const material = useMemo(() => {
    if (module.isAppliance) return null;
    
    const config = FINISH_CONFIGS[module.finish] || FINISH_CONFIGS['Branco Tx'];
    let texture: THREE.Texture | null = null;
    
    if (config.type === 'wood') {
      texture = createWoodTexture(config.baseColor, config.grainIntensity);
    } else if (config.type === 'mdf') {
      texture = createMDFTexture(config.baseColor);
    }
    
    return new THREE.MeshStandardMaterial({
      color: config.baseColor,
      roughness: config.roughness,
      metalness: config.metalness,
      map: texture,
    });
  }, [module.finish, module.isAppliance]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onSelect();
    
    pointerStartPos.current = { x: e.clientX, y: e.clientY };
    dragStarted.current = false;
    setIsPointerDown(true);
    gl.domElement.style.cursor = 'grabbing';
    
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane.current, intersection);
    dragOffset.current.copy(intersection).sub(
      new THREE.Vector3(module.x / 1000, 0, module.z / 1000)
    );
  };

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!isPointerDown) return;
    e.stopPropagation();

    if (!dragStarted.current && pointerStartPos.current) {
      const dx = e.clientX - pointerStartPos.current.x;
      const dy = e.clientY - pointerStartPos.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < DRAG_START_THRESHOLD) {
        return;
      }
      dragStarted.current = true;
      setIsDragging(true);
    }

    if (!isDragging) return;

    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragPlane.current, intersection);
    
    let newX = (intersection.x - dragOffset.current.x) * 1000;
    let newZ = (intersection.z - dragOffset.current.z) * 1000;

    const snap = calculateSnap(
      newX, newZ, 
      module.width, module.depth,
      floorWidth, floorDepth,
      allModules, module.id
    );

    newX = snap.x;
    newZ = snap.z;
    setSnapInfo({ snappedToWall: snap.snappedToWall, snappedToModule: snap.snappedToModule });

    const halfW = module.width / 2;
    const halfD = module.depth / 2;
    newX = Math.max(-floorWidth / 2 + halfW, Math.min(floorWidth / 2 - halfW, newX));
    newZ = Math.max(-floorDepth / 2 + halfD, Math.min(floorDepth / 2 - halfD, newZ));

    onUpdate({ x: newX, z: newZ });
  }, [isPointerDown, isDragging, raycaster, module, floorWidth, floorDepth, allModules, onUpdate]);

  const handlePointerUp = useCallback(() => {
    if (isPointerDown) {
      setIsPointerDown(false);
      setIsDragging(false);
      dragStarted.current = false;
      pointerStartPos.current = null;
      setSnapInfo({ snappedToWall: null, snappedToModule: null });
      gl.domElement.style.cursor = 'default';
    }
  }, [isPointerDown, gl]);

  useEffect(() => {
    if (isPointerDown) {
      const canvas = gl.domElement;
      
      const onMove = (e: PointerEvent) => {
        if (!dragStarted.current && pointerStartPos.current) {
          const dx = e.clientX - pointerStartPos.current.x;
          const dy = e.clientY - pointerStartPos.current.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < DRAG_START_THRESHOLD) {
            return;
          }
          dragStarted.current = true;
          setIsDragging(true);
        }

        if (!dragStarted.current) return;

        const rect = canvas.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
        
        const intersection = new THREE.Vector3();
        raycaster.ray.intersectPlane(dragPlane.current, intersection);
        
        let newX = (intersection.x - dragOffset.current.x) * 1000;
        let newZ = (intersection.z - dragOffset.current.z) * 1000;

        const snap = calculateSnap(
          newX, newZ, 
          module.width, module.depth,
          floorWidth, floorDepth,
          allModules, module.id
        );

        newX = snap.x;
        newZ = snap.z;
        setSnapInfo({ snappedToWall: snap.snappedToWall, snappedToModule: snap.snappedToModule });

        const halfW = module.width / 2;
        const halfD = module.depth / 2;
        newX = Math.max(-floorWidth / 2 + halfW, Math.min(floorWidth / 2 - halfW, newX));
        newZ = Math.max(-floorDepth / 2 + halfD, Math.min(floorDepth / 2 - halfD, newZ));

        onUpdate({ x: newX, z: newZ });
      };

      const onUp = () => {
        setIsPointerDown(false);
        setIsDragging(false);
        dragStarted.current = false;
        pointerStartPos.current = null;
        setSnapInfo({ snappedToWall: null, snappedToModule: null });
        gl.domElement.style.cursor = 'default';
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      
      return () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
    }
  }, [isPointerDown, gl, raycaster, camera, module, floorWidth, floorDepth, allModules, onUpdate]);

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

  const distToLeftWall = Math.round(module.x - module.width / 2 + floorWidth / 2);
  const distToBackWall = Math.round(module.z - module.depth / 2 + floorDepth / 2);

  // Renderiza eletrodoméstico se for um
  if (module.isAppliance && module.applianceType) {
    const appliancePosition: [number, number, number] = [
      module.x / 1000,
      module.y / 1000,
      module.z / 1000,
    ];
    
    return (
      <group>
        <group 
          onPointerDown={handlePointerDown}
          onPointerOver={() => { if (!isDragging) gl.domElement.style.cursor = 'grab'; }}
          onPointerOut={() => { if (!isDragging) gl.domElement.style.cursor = 'default'; }}
        >
          {module.applianceType === 'fridge' && <Fridge position={appliancePosition} rotation={module.rotation} />}
          {module.applianceType === 'stove' && <Stove position={appliancePosition} rotation={module.rotation} />}
          {module.applianceType === 'washing_machine' && <WashingMachine position={appliancePosition} rotation={module.rotation} />}
          {module.applianceType === 'microwave' && <Microwave position={appliancePosition} rotation={module.rotation} />}
          {module.applianceType === 'range_hood' && <RangeHood position={appliancePosition} rotation={module.rotation} />}
          {module.applianceType === 'sink' && <Sink position={appliancePosition} rotation={module.rotation} />}
        </group>
        
        {/* Selection border */}
        {isSelected && (
          <lineSegments position={position} rotation={[0, (module.rotation * Math.PI) / 180, 0]}>
            <edgesGeometry args={[new THREE.BoxGeometry(size[0] + 0.02, size[1] + 0.02, size[2] + 0.02)]} />
            <lineBasicMaterial color="#d4af37" linewidth={2} />
          </lineSegments>
        )}
      </group>
    );
  }

  const toggleDoor = (index: number) => {
    setOpenDoors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <group>
      <group
        position={position}
        rotation={[0, (module.rotation * Math.PI) / 180, 0]}
        onPointerDown={handlePointerDown}
        onPointerOver={() => { if (!isDragging) gl.domElement.style.cursor = 'grab'; }}
        onPointerOut={() => { if (!isDragging) gl.domElement.style.cursor = 'default'; }}
      >
        {/* Corpo principal do móvel */}
        <mesh
          ref={meshRef}
          castShadow
          receiveShadow
        >
          <boxGeometry args={size} />
          {material ? (
            <primitive object={material} attach="material" />
          ) : (
            <meshStandardMaterial 
              color={isDragging ? '#4a90d9' : (snapInfo.snappedToWall || snapInfo.snappedToModule ? '#4CAF50' : baseColor)}
              roughness={0.4}
              metalness={0.1}
              emissive={isSelected ? "#d4af37" : "#000000"}
              emissiveIntensity={isSelected ? 0.3 : 0}
              transparent={isDragging}
              opacity={isDragging ? 0.85 : 1}
            />
          )}
        </mesh>

        {/* Tampo superior (para balcões) */}
        {moduleConfig.hasTop && module.category === 'Cozinha' && (
          <mesh position={[0, size[1] / 2 + 0.01, 0]} castShadow>
            <boxGeometry args={[size[0] + 0.02, 0.02, size[2] + 0.02]} />
            <meshStandardMaterial color="#404040" roughness={0.3} metalness={0.2} />
          </mesh>
        )}

        {/* Portas */}
        {moduleConfig.doors > 0 && Array.from({ length: moduleConfig.doors }).map((_, i) => {
          const doorWidth = size[0] / moduleConfig.doors;
          const doorHeight = size[1] - 0.04;
          const doorX = -size[0] / 2 + doorWidth / 2 + i * doorWidth;
          
          return (
            <CabinetDoor
              key={`door-${i}`}
              width={doorWidth - 0.01}
              height={doorHeight}
              depth={0.018}
              position={[doorX, 0, size[2] / 2]}
              color={baseColor}
              handleType={module.handleType || 'bar'}
              handlePosition={i % 2 === 0 ? 'right' : 'left'}
              hingePosition={i % 2 === 0 ? 'left' : 'right'}
              isOpen={openDoors.has(i)}
              onToggle={() => toggleDoor(i)}
            />
          );
        })}

        {/* Gavetas */}
        {moduleConfig.drawers > 0 && Array.from({ length: moduleConfig.drawers }).map((_, i) => {
          const drawerHeight = (size[1] - 0.04) / moduleConfig.drawers;
          const drawerY = size[1] / 2 - 0.02 - drawerHeight / 2 - i * drawerHeight;
          
          return (
            <Drawer
              key={`drawer-${i}`}
              width={size[0] - 0.02}
              height={drawerHeight - 0.01}
              depth={size[2] - 0.04}
              position={[0, drawerY, 0]}
              color={baseColor}
              handleType={module.handleType || 'pull'}
              isOpen={openDoors.has(100 + i)}
              onToggle={() => toggleDoor(100 + i)}
            />
          );
        })}

        {/* Painel de vidro para armários com vidro */}
        {moduleConfig.hasGlass && (
          <GlassPanel
            width={size[0] - 0.06}
            height={size[1] - 0.06}
            position={[0, 0, size[2] / 2 + 0.01]}
            frameColor={baseColor}
          />
        )}

        {/* Puxadores para móveis simples sem portas/gavetas */}
        {moduleConfig.doors === 0 && moduleConfig.drawers === 0 && (
          <Handle
            position={[0, 0, size[2] / 2 + 0.02]}
            type={module.handleType || 'bar'}
            size={0.1}
          />
        )}
      </group>

      {/* Borda de seleção */}
      {isSelected && (
        <lineSegments position={position} rotation={[0, (module.rotation * Math.PI) / 180, 0]}>
          <edgesGeometry args={[new THREE.BoxGeometry(size[0] + 0.02, size[1] + 0.02, size[2] + 0.02)]} />
          <lineBasicMaterial color="#d4af37" linewidth={2} />
        </lineSegments>
      )}

      {/* Cotas */}
      {isSelected && showDimensions && (
        <>
          <Text
            position={[position[0], 0.02, position[2] + size[2] / 2 + 0.15]}
            fontSize={0.08}
            color="#0a246a"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.004}
            outlineColor="#ffffff"
          >
            {module.width}mm
          </Text>

          {distToLeftWall > 50 && (
            <>
              <Line
                points={[
                  [-floorWidth / 2000, 0.02, position[2]],
                  [position[0] - size[0] / 2, 0.02, position[2]],
                ]}
                color="#ff6b6b"
                lineWidth={2}
                dashed
                dashSize={0.05}
                gapSize={0.03}
              />
              <Text
                position={[(-floorWidth / 2000 + position[0] - size[0] / 2) / 2, 0.1, position[2]]}
                fontSize={0.07}
                color="#ff6b6b"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.003}
                outlineColor="#ffffff"
              >
                {distToLeftWall}mm
              </Text>
            </>
          )}

          {distToBackWall > 50 && (
            <>
              <Line
                points={[
                  [position[0], 0.02, -floorDepth / 2000],
                  [position[0], 0.02, position[2] - size[2] / 2],
                ]}
                color="#4ecdc4"
                lineWidth={2}
                dashed
                dashSize={0.05}
                gapSize={0.03}
              />
              <Text
                position={[position[0] + 0.15, 0.1, (-floorDepth / 2000 + position[2] - size[2] / 2) / 2]}
                fontSize={0.07}
                color="#4ecdc4"
                anchorX="center"
                anchorY="middle"
                rotation={[0, Math.PI / 2, 0]}
                outlineWidth={0.003}
                outlineColor="#ffffff"
              >
                {distToBackWall}mm
              </Text>
            </>
          )}
        </>
      )}

      {/* Indicador de snap */}
      {(snapInfo.snappedToWall || snapInfo.snappedToModule) && (
        <Text
          position={[position[0], position[1] + size[1] / 2 + 0.15, position[2]]}
          fontSize={0.06}
          color="#4CAF50"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.003}
          outlineColor="#ffffff"
        >
          ⚡ SNAP
        </Text>
      )}
    </group>
  );
};

export default RealisticModule;
