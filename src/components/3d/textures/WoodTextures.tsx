import * as THREE from 'three';
import { useMemo } from 'react';

// Texturas procedurais de madeira
export const createWoodTexture = (color: string, grainIntensity: number = 0.3): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  
  // Base color
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 512, 512);
  
  // Wood grain lines
  const baseColor = new THREE.Color(color);
  const darkerColor = baseColor.clone().multiplyScalar(0.7);
  const lighterColor = baseColor.clone().multiplyScalar(1.15);
  
  ctx.strokeStyle = `#${darkerColor.getHexString()}`;
  ctx.lineWidth = 1;
  
  for (let i = 0; i < 100; i++) {
    const y = Math.random() * 512;
    const amplitude = 2 + Math.random() * 4;
    const frequency = 0.02 + Math.random() * 0.02;
    
    ctx.beginPath();
    ctx.globalAlpha = 0.1 + Math.random() * grainIntensity;
    
    for (let x = 0; x < 512; x++) {
      const yOffset = Math.sin(x * frequency) * amplitude;
      if (x === 0) {
        ctx.moveTo(x, y + yOffset);
      } else {
        ctx.lineTo(x, y + yOffset);
      }
    }
    ctx.stroke();
  }
  
  // Add some knots
  for (let i = 0; i < 3; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const radius = 5 + Math.random() * 15;
    
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `#${darkerColor.getHexString()}`);
    gradient.addColorStop(1, 'transparent');
    
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  
  ctx.globalAlpha = 1;
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  
  return texture;
};

// MDF texture (more uniform)
export const createMDFTexture = (color: string): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  
  // Add subtle noise for MDF look
  const imageData = ctx.getImageData(0, 0, 256, 256);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 10;
    imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise));
    imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise));
    imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  
  return texture;
};

// Glass material config
export const createGlassMaterial = (): THREE.MeshPhysicalMaterial => {
  return new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0,
    transmission: 0.9,
    transparent: true,
    opacity: 0.3,
    reflectivity: 0.9,
    ior: 1.5,
  });
};

// Metal/handle material
export const createMetalMaterial = (color: string = '#c0c0c0'): THREE.MeshStandardMaterial => {
  return new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.9,
    roughness: 0.2,
  });
};

// Finish configurations
export interface FinishConfig {
  name: string;
  baseColor: string;
  type: 'wood' | 'mdf' | 'lacquer' | 'glass';
  roughness: number;
  metalness: number;
  grainIntensity?: number;
}

export const FINISH_CONFIGS: Record<string, FinishConfig> = {
  'Branco Tx': { name: 'Branco Tx', baseColor: '#f5f5f5', type: 'mdf', roughness: 0.4, metalness: 0 },
  'Preto Tx': { name: 'Preto Tx', baseColor: '#2d2d2d', type: 'mdf', roughness: 0.4, metalness: 0 },
  'Carvalho Hanover': { name: 'Carvalho Hanover', baseColor: '#8B7355', type: 'wood', roughness: 0.5, metalness: 0, grainIntensity: 0.4 },
  'Nogueira': { name: 'Nogueira', baseColor: '#5C4033', type: 'wood', roughness: 0.5, metalness: 0, grainIntensity: 0.5 },
  'Cinza Urbano': { name: 'Cinza Urbano', baseColor: '#6B6B6B', type: 'mdf', roughness: 0.3, metalness: 0.1 },
  'Amadeirado': { name: 'Amadeirado', baseColor: '#A0522D', type: 'wood', roughness: 0.5, metalness: 0, grainIntensity: 0.4 },
  'Freijó': { name: 'Freijó', baseColor: '#8B7765', type: 'wood', roughness: 0.5, metalness: 0, grainIntensity: 0.35 },
  'Rústico': { name: 'Rústico', baseColor: '#8B6914', type: 'wood', roughness: 0.6, metalness: 0, grainIntensity: 0.6 },
  'Champagne': { name: 'Champagne', baseColor: '#F7E7CE', type: 'lacquer', roughness: 0.2, metalness: 0.1 },
  'Off White': { name: 'Off White', baseColor: '#FAF0E6', type: 'mdf', roughness: 0.35, metalness: 0 },
  'Grafite': { name: 'Grafite', baseColor: '#4A4A4A', type: 'lacquer', roughness: 0.25, metalness: 0.15 },
};

// Hook to get material for finish
export const useFinishMaterial = (finish: string) => {
  return useMemo(() => {
    const config = FINISH_CONFIGS[finish] || FINISH_CONFIGS['Branco Tx'];
    
    let texture: THREE.Texture | null = null;
    
    if (config.type === 'wood') {
      texture = createWoodTexture(config.baseColor, config.grainIntensity);
    } else if (config.type === 'mdf') {
      texture = createMDFTexture(config.baseColor);
    }
    
    const material = new THREE.MeshStandardMaterial({
      color: config.baseColor,
      roughness: config.roughness,
      metalness: config.metalness,
      map: texture,
    });
    
    return material;
  }, [finish]);
};
