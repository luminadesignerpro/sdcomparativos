import * as THREE from 'three';
import { useMemo } from 'react';

// Textura procedural de granito
export const createGraniteTexture = (
  baseColor: string,
  speckleColor: string = '#333333',
  speckleIntensity: number = 0.5
): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  
  // Base color
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);
  
  // Speckles
  const baseColorObj = new THREE.Color(baseColor);
  const speckleColorObj = new THREE.Color(speckleColor);
  
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const size = 1 + Math.random() * 3;
    
    // Alternate between light and dark speckles
    const isLight = Math.random() > 0.5;
    const color = isLight 
      ? baseColorObj.clone().multiplyScalar(1.2)
      : speckleColorObj;
    
    ctx.globalAlpha = Math.random() * speckleIntensity;
    ctx.fillStyle = `#${color.getHexString()}`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Add some veining
  ctx.globalAlpha = 0.1;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * 512, Math.random() * 512);
    ctx.bezierCurveTo(
      Math.random() * 512, Math.random() * 512,
      Math.random() * 512, Math.random() * 512,
      Math.random() * 512, Math.random() * 512
    );
    ctx.stroke();
  }
  
  ctx.globalAlpha = 1;
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  
  return texture;
};

// Textura procedural de mármore
export const createMarbleTexture = (
  baseColor: string = '#f0f0f0',
  veinColor: string = '#888888'
): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  
  // Base color with subtle gradient
  const gradient = ctx.createLinearGradient(0, 0, 512, 512);
  const base = new THREE.Color(baseColor);
  gradient.addColorStop(0, baseColor);
  gradient.addColorStop(0.5, `#${base.clone().multiplyScalar(0.98).getHexString()}`);
  gradient.addColorStop(1, baseColor);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 512, 512);
  
  // Marble veins using perlin-like curves
  ctx.strokeStyle = veinColor;
  ctx.lineWidth = 0.5;
  
  for (let i = 0; i < 30; i++) {
    ctx.globalAlpha = 0.05 + Math.random() * 0.15;
    ctx.lineWidth = 0.3 + Math.random() * 2;
    
    ctx.beginPath();
    let x = Math.random() * 512;
    let y = Math.random() * 512;
    ctx.moveTo(x, y);
    
    for (let j = 0; j < 10; j++) {
      const dx = (Math.random() - 0.5) * 200;
      const dy = (Math.random() - 0.5) * 200;
      const cx = x + dx * 0.3;
      const cy = y + dy * 0.3;
      x += dx;
      y += dy;
      ctx.quadraticCurveTo(cx, cy, x, y);
    }
    ctx.stroke();
  }
  
  // Secondary veins
  ctx.strokeStyle = `#${new THREE.Color(veinColor).multiplyScalar(1.3).getHexString()}`;
  for (let i = 0; i < 15; i++) {
    ctx.globalAlpha = 0.03 + Math.random() * 0.08;
    ctx.lineWidth = 0.2 + Math.random() * 0.8;
    
    ctx.beginPath();
    ctx.moveTo(Math.random() * 512, Math.random() * 512);
    ctx.bezierCurveTo(
      Math.random() * 512, Math.random() * 512,
      Math.random() * 512, Math.random() * 512,
      Math.random() * 512, Math.random() * 512
    );
    ctx.stroke();
  }
  
  ctx.globalAlpha = 1;
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  
  return texture;
};

// Textura de silestone/quartzo
export const createQuartzTexture = (baseColor: string): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 256, 256);
  
  // Fine sparkle effect
  const base = new THREE.Color(baseColor);
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const brightness = 0.8 + Math.random() * 0.4;
    
    ctx.globalAlpha = 0.02 + Math.random() * 0.08;
    ctx.fillStyle = `#${base.clone().multiplyScalar(brightness).getHexString()}`;
    ctx.fillRect(x, y, 1, 1);
  }
  
  // Occasional larger sparkles
  for (let i = 0; i < 100; i++) {
    ctx.globalAlpha = 0.1 + Math.random() * 0.2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, 0.5 + Math.random(), 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.globalAlpha = 1;
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  
  return texture;
};

// Configurações de pedras
export interface StoneConfig {
  name: string;
  type: 'granite' | 'marble' | 'quartz' | 'ceramic';
  baseColor: string;
  secondaryColor?: string;
  roughness: number;
  metalness: number;
}

export const STONE_CONFIGS: Record<string, StoneConfig> = {
  // Granitos
  'Preto São Gabriel': { name: 'Preto São Gabriel', type: 'granite', baseColor: '#1a1a1a', secondaryColor: '#333333', roughness: 0.3, metalness: 0.1 },
  'Preto Absoluto': { name: 'Preto Absoluto', type: 'granite', baseColor: '#0d0d0d', roughness: 0.2, metalness: 0.15 },
  'Branco Dallas': { name: 'Branco Dallas', type: 'granite', baseColor: '#e8e0d8', secondaryColor: '#8b8278', roughness: 0.35, metalness: 0.05 },
  'Cinza Andorinha': { name: 'Cinza Andorinha', type: 'granite', baseColor: '#6b6b6b', secondaryColor: '#404040', roughness: 0.3, metalness: 0.1 },
  'Marrom Imperial': { name: 'Marrom Imperial', type: 'granite', baseColor: '#5c4033', secondaryColor: '#3d2817', roughness: 0.35, metalness: 0.05 },
  
  // Mármores
  'Carrara': { name: 'Carrara', type: 'marble', baseColor: '#f5f5f5', secondaryColor: '#b0b0b0', roughness: 0.25, metalness: 0.1 },
  'Calacatta': { name: 'Calacatta', type: 'marble', baseColor: '#faf8f5', secondaryColor: '#a08060', roughness: 0.2, metalness: 0.1 },
  'Nero Marquina': { name: 'Nero Marquina', type: 'marble', baseColor: '#1a1a1a', secondaryColor: '#ffffff', roughness: 0.25, metalness: 0.1 },
  'Travertino': { name: 'Travertino', type: 'marble', baseColor: '#d4c4a8', secondaryColor: '#8b7355', roughness: 0.4, metalness: 0.05 },
  
  // Silestone/Quartzo
  'Branco Zeus': { name: 'Branco Zeus', type: 'quartz', baseColor: '#ffffff', roughness: 0.15, metalness: 0.1 },
  'Cinza Stellar': { name: 'Cinza Stellar', type: 'quartz', baseColor: '#707070', roughness: 0.15, metalness: 0.12 },
  'Preto Stellar': { name: 'Preto Stellar', type: 'quartz', baseColor: '#1a1a1a', roughness: 0.12, metalness: 0.15 },
  'Branco Estelar': { name: 'Branco Estelar', type: 'quartz', baseColor: '#f0f0f0', roughness: 0.18, metalness: 0.1 },
  
  // Porcelanato
  'Porcelanato Branco': { name: 'Porcelanato Branco', type: 'ceramic', baseColor: '#f8f8f8', roughness: 0.1, metalness: 0.05 },
  'Porcelanato Cinza': { name: 'Porcelanato Cinza', type: 'ceramic', baseColor: '#808080', roughness: 0.12, metalness: 0.05 },
};

// Hook para criar material de pedra
export const useStoneMaterial = (stoneName: string) => {
  return useMemo(() => {
    const config = STONE_CONFIGS[stoneName] || STONE_CONFIGS['Preto São Gabriel'];
    let texture: THREE.Texture | null = null;
    
    switch (config.type) {
      case 'granite':
        texture = createGraniteTexture(config.baseColor, config.secondaryColor);
        break;
      case 'marble':
        texture = createMarbleTexture(config.baseColor, config.secondaryColor);
        break;
      case 'quartz':
        texture = createQuartzTexture(config.baseColor);
        break;
      default:
        break;
    }
    
    return new THREE.MeshStandardMaterial({
      color: config.baseColor,
      roughness: config.roughness,
      metalness: config.metalness,
      map: texture,
    });
  }, [stoneName]);
};

// Componente de tampo de pedra
export const StoneCountertop: React.FC<{
  position: [number, number, number];
  width: number;
  depth: number;
  thickness?: number;
  stoneName?: string;
  hasEdge?: boolean;
  edgeProfile?: 'straight' | 'bullnose' | 'bevel' | 'ogee';
}> = ({ 
  position, 
  width, 
  depth, 
  thickness = 0.02, 
  stoneName = 'Preto São Gabriel',
  hasEdge = true,
  edgeProfile = 'straight'
}) => {
  const material = useStoneMaterial(stoneName);
  const edgeThickness = 0.04; // Total edge height with borda
  
  return (
    <group position={position}>
      {/* Main countertop */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, thickness, depth]} />
        <primitive object={material} attach="material" />
      </mesh>
      
      {/* Edge/borda (doubled edge for visual thickness) */}
      {hasEdge && (
        <mesh position={[0, -thickness/2 - (edgeThickness - thickness)/2, depth/2 - 0.01]} castShadow>
          <boxGeometry args={[width, edgeThickness, 0.02]} />
          <primitive object={material.clone()} attach="material" />
        </mesh>
      )}
      
      {/* Bullnose profile edge */}
      {edgeProfile === 'bullnose' && (
        <mesh 
          position={[0, -thickness/2, depth/2]} 
          rotation={[0, 0, Math.PI/2]}
          castShadow
        >
          <cylinderGeometry args={[thickness/2, thickness/2, width, 16, 1, false, 0, Math.PI]} />
          <primitive object={material.clone()} attach="material" />
        </mesh>
      )}
    </group>
  );
};

export default {
  createGraniteTexture,
  createMarbleTexture,
  createQuartzTexture,
  STONE_CONFIGS,
  useStoneMaterial,
  StoneCountertop,
};
