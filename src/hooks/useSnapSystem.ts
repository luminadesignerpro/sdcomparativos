import { useMemo, useCallback } from 'react';
import { FurnitureModule } from '@/types';

interface SnapResult {
  x: number;
  y: number;
  z: number;
  snappedToWall: 'left' | 'right' | 'back' | null;
  snappedToModule: string | null;
  alignmentGuides: AlignmentGuide[];
}

interface AlignmentGuide {
  type: 'vertical' | 'horizontal';
  position: number;
  axis: 'x' | 'z';
}

const SNAP_THRESHOLD = 50; // mm - distância para ativar snap
const ALIGNMENT_THRESHOLD = 30; // mm - distância para mostrar guia de alinhamento

export function useSnapSystem(
  modules: FurnitureModule[],
  floorWidth: number,
  floorDepth: number,
  wallHeight: number
) {
  // Calcula as posições das paredes
  const walls = useMemo(() => ({
    left: -floorWidth / 2,
    right: floorWidth / 2,
    back: -floorDepth / 2,
    front: floorDepth / 2,
  }), [floorWidth, floorDepth]);

  // Função principal de snap
  const calculateSnap = useCallback((
    moduleId: string,
    targetX: number,
    targetY: number,
    targetZ: number,
    moduleWidth: number,
    moduleHeight: number,
    moduleDepth: number
  ): SnapResult => {
    let x = targetX;
    let y = targetY;
    let z = targetZ;
    let snappedToWall: 'left' | 'right' | 'back' | null = null;
    let snappedToModule: string | null = null;
    const alignmentGuides: AlignmentGuide[] = [];

    // Snap para parede esquerda
    const leftEdge = targetX - moduleWidth / 2;
    if (Math.abs(leftEdge - walls.left) < SNAP_THRESHOLD) {
      x = walls.left + moduleWidth / 2;
      snappedToWall = 'left';
    }

    // Snap para parede direita
    const rightEdge = targetX + moduleWidth / 2;
    if (Math.abs(rightEdge - walls.right) < SNAP_THRESHOLD) {
      x = walls.right - moduleWidth / 2;
      snappedToWall = 'right';
    }

    // Snap para parede de fundo
    const backEdge = targetZ - moduleDepth / 2;
    if (Math.abs(backEdge - walls.back) < SNAP_THRESHOLD) {
      z = walls.back + moduleDepth / 2;
      snappedToWall = 'back';
    }

    // Snap para chão (Y = 0)
    if (Math.abs(targetY) < SNAP_THRESHOLD) {
      y = 0;
    }

    // Snap para outros módulos
    const otherModules = modules.filter(m => m.id !== moduleId);
    
    for (const other of otherModules) {
      // Snap lateral (eixo X)
      // Borda direita do outro módulo com borda esquerda do atual
      const otherRightEdge = other.x + other.width / 2;
      const currentLeftEdge = x - moduleWidth / 2;
      if (Math.abs(otherRightEdge - currentLeftEdge) < SNAP_THRESHOLD && 
          Math.abs(other.y - y) < 100 &&
          Math.abs(other.z - z) < moduleDepth) {
        x = otherRightEdge + moduleWidth / 2;
        snappedToModule = other.id;
      }

      // Borda esquerda do outro módulo com borda direita do atual
      const otherLeftEdge = other.x - other.width / 2;
      const currentRightEdge = x + moduleWidth / 2;
      if (Math.abs(otherLeftEdge - currentRightEdge) < SNAP_THRESHOLD &&
          Math.abs(other.y - y) < 100 &&
          Math.abs(other.z - z) < moduleDepth) {
        x = otherLeftEdge - moduleWidth / 2;
        snappedToModule = other.id;
      }

      // Alinhamento vertical (mesmo X)
      if (Math.abs(other.x - x) < ALIGNMENT_THRESHOLD) {
        alignmentGuides.push({
          type: 'vertical',
          position: other.x,
          axis: 'x'
        });
        x = other.x; // Força o alinhamento
      }

      // Alinhamento em Z (mesma profundidade)
      if (Math.abs(other.z - z) < ALIGNMENT_THRESHOLD) {
        alignmentGuides.push({
          type: 'horizontal',
          position: other.z,
          axis: 'z'
        });
        z = other.z;
      }
    }

    return { x, y, z, snappedToWall, snappedToModule, alignmentGuides };
  }, [modules, walls]);

  // Calcula distâncias para cotas
  const calculateDimensions = useCallback((module: FurnitureModule) => {
    const dimensions = {
      toLeftWall: module.x - module.width / 2 - walls.left,
      toRightWall: walls.right - (module.x + module.width / 2),
      toBackWall: module.z - module.depth / 2 - walls.back,
      toFrontWall: walls.front - (module.z + module.depth / 2),
      toFloor: module.y,
      toCeiling: wallHeight - (module.y + module.height),
      width: module.width,
      height: module.height,
      depth: module.depth,
    };
    return dimensions;
  }, [walls, wallHeight]);

  return {
    calculateSnap,
    calculateDimensions,
    walls,
    SNAP_THRESHOLD,
  };
}
