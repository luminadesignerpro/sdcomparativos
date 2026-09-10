import * as THREE from 'three';
import { useMemo } from 'react';

// Textura de laminado com padrão de madeira realista
export const createLaminateWoodTexture = (
  baseColor: string,
  grainColor: string,
  grainIntensity: number = 0.4,
  grainScale: number = 1
): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;
  
  // Base
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 1024, 1024);
  
  const base = new THREE.Color(baseColor);
  const grain = new THREE.Color(grainColor);
  
  // Main grain lines
  for (let i = 0; i < 150 * grainScale; i++) {
    const y = (Math.random() * 1024);
    const amplitude = 3 + Math.random() * 8;
    const frequency = 0.01 + Math.random() * 0.015;
    const width = 0.5 + Math.random() * 1.5;
    
    ctx.strokeStyle = `#${grain.clone().lerp(base, 0.3).getHexString()}`;
    ctx.lineWidth = width;
    ctx.globalAlpha = 0.1 + Math.random() * grainIntensity;
    
    ctx.beginPath();
    for (let x = 0; x < 1024; x++) {
      const yOffset = Math.sin(x * frequency + Math.random() * 0.5) * amplitude;
      if (x === 0) ctx.moveTo(x, y + yOffset);
      else ctx.lineTo(x, y + yOffset);
    }
    ctx.stroke();
  }
  
  // Secondary fine grain
  for (let i = 0; i < 300 * grainScale; i++) {
    const y = Math.random() * 1024;
    ctx.strokeStyle = `#${grain.getHexString()}`;
    ctx.lineWidth = 0.3;
    ctx.globalAlpha = 0.05 + Math.random() * 0.1;
    
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < 1024; x += 5) {
      ctx.lineTo(x, y + (Math.random() - 0.5) * 2);
    }
    ctx.stroke();
  }
  
  // Wood knots (occasional)
  for (let i = 0; i < 2; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const radius = 15 + Math.random() * 25;
    
    const knotGradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    knotGradient.addColorStop(0, `#${grain.clone().multiplyScalar(0.6).getHexString()}`);
    knotGradient.addColorStop(0.5, `#${grain.clone().multiplyScalar(0.8).getHexString()}`);
    knotGradient.addColorStop(1, 'transparent');
    
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = knotGradient;
    ctx.beginPath();
    ctx.ellipse(x, y, radius, radius * 0.6, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
    
    // Concentric rings
    for (let r = radius * 0.3; r < radius; r += 3) {
      ctx.globalAlpha = 0.1;
      ctx.strokeStyle = `#${grain.clone().multiplyScalar(0.5).getHexString()}`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.6, Math.random() * 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  
  ctx.globalAlpha = 1;
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  
  return texture;
};

// Textura de laminado sólido/unicolor
export const createSolidLaminateTexture = (baseColor: string): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 256, 256);
  
  // Subtle texture/grain for realism
  const imageData = ctx.getImageData(0, 0, 256, 256);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 6;
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

// Textura de laminado de alta pressão (HPL) com padrão
export const createHPLTexture = (
  pattern: 'brushed' | 'linen' | 'leather' | 'concrete',
  baseColor: string
): THREE.Texture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);
  
  const base = new THREE.Color(baseColor);
  
  switch (pattern) {
    case 'brushed':
      // Horizontal brushed lines
      for (let y = 0; y < 512; y++) {
        ctx.globalAlpha = 0.03 + Math.random() * 0.05;
        ctx.strokeStyle = Math.random() > 0.5 
          ? `#${base.clone().multiplyScalar(1.1).getHexString()}`
          : `#${base.clone().multiplyScalar(0.9).getHexString()}`;
        ctx.lineWidth = 0.5 + Math.random();
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(512, y);
        ctx.stroke();
      }
      break;
      
    case 'linen':
      // Crosshatch pattern
      for (let i = 0; i < 200; i++) {
        ctx.globalAlpha = 0.05 + Math.random() * 0.08;
        ctx.strokeStyle = `#${base.clone().multiplyScalar(0.85).getHexString()}`;
        ctx.lineWidth = 0.5;
        
        // Horizontal
        const y1 = Math.random() * 512;
        ctx.beginPath();
        ctx.moveTo(0, y1);
        ctx.lineTo(512, y1 + (Math.random() - 0.5) * 4);
        ctx.stroke();
        
        // Vertical
        const x1 = Math.random() * 512;
        ctx.beginPath();
        ctx.moveTo(x1, 0);
        ctx.lineTo(x1 + (Math.random() - 0.5) * 4, 512);
        ctx.stroke();
      }
      break;
      
    case 'leather':
      // Pebble pattern
      for (let i = 0; i < 500; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const radius = 2 + Math.random() * 6;
        
        ctx.globalAlpha = 0.08 + Math.random() * 0.12;
        ctx.fillStyle = Math.random() > 0.5
          ? `#${base.clone().multiplyScalar(1.08).getHexString()}`
          : `#${base.clone().multiplyScalar(0.92).getHexString()}`;
        
        ctx.beginPath();
        ctx.ellipse(x, y, radius, radius * (0.6 + Math.random() * 0.4), Math.random() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
      
    case 'concrete':
      // Speckled concrete look
      for (let i = 0; i < 2000; i++) {
        const x = Math.random() * 512;
        const y = Math.random() * 512;
        const size = 0.5 + Math.random() * 2;
        
        ctx.globalAlpha = 0.1 + Math.random() * 0.15;
        ctx.fillStyle = Math.random() > 0.7
          ? '#ffffff'
          : `#${base.clone().multiplyScalar(0.7 + Math.random() * 0.3).getHexString()}`;
        
        ctx.fillRect(x, y, size, size);
      }
      break;
  }
  
  ctx.globalAlpha = 1;
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  
  return texture;
};

// Catálogo de laminados comerciais
export interface LaminateConfig {
  name: string;
  brand: string;
  code: string;
  baseColor: string;
  grainColor?: string;
  type: 'wood' | 'solid' | 'pattern';
  pattern?: 'brushed' | 'linen' | 'leather' | 'concrete';
  roughness: number;
  grainIntensity?: number;
}

export const LAMINATE_CATALOG: Record<string, LaminateConfig> = {
  // Arauco
  'Carvalho Hanover': { name: 'Carvalho Hanover', brand: 'Arauco', code: 'AR001', baseColor: '#9a8570', grainColor: '#5c4a3a', type: 'wood', roughness: 0.45, grainIntensity: 0.4 },
  'Nogueira': { name: 'Nogueira', brand: 'Arauco', code: 'AR002', baseColor: '#5C4033', grainColor: '#3d2817', type: 'wood', roughness: 0.5, grainIntensity: 0.5 },
  'Freijó Puro': { name: 'Freijó Puro', brand: 'Arauco', code: 'AR003', baseColor: '#b5a089', grainColor: '#7a6a55', type: 'wood', roughness: 0.45, grainIntensity: 0.35 },
  'Carvalho Mel': { name: 'Carvalho Mel', brand: 'Arauco', code: 'AR004', baseColor: '#c9a86c', grainColor: '#8a7048', type: 'wood', roughness: 0.45, grainIntensity: 0.4 },
  
  // Duratex
  'Branco Tx': { name: 'Branco Tx', brand: 'Duratex', code: 'DT001', baseColor: '#f5f5f5', type: 'solid', roughness: 0.4 },
  'Preto Tx': { name: 'Preto Tx', brand: 'Duratex', code: 'DT002', baseColor: '#1a1a1a', type: 'solid', roughness: 0.4 },
  'Cinza Urbano': { name: 'Cinza Urbano', brand: 'Duratex', code: 'DT003', baseColor: '#6B6B6B', type: 'solid', roughness: 0.35 },
  'Off White': { name: 'Off White', brand: 'Duratex', code: 'DT004', baseColor: '#FAF0E6', type: 'solid', roughness: 0.38 },
  'Grafite': { name: 'Grafite', brand: 'Duratex', code: 'DT005', baseColor: '#4A4A4A', type: 'solid', roughness: 0.35 },
  
  // Fórmica
  'Nogal Sevilha': { name: 'Nogal Sevilha', brand: 'Fórmica', code: 'FM001', baseColor: '#6b5344', grainColor: '#3d2e24', type: 'wood', roughness: 0.5, grainIntensity: 0.45 },
  'Roble Santana': { name: 'Roble Santana', brand: 'Fórmica', code: 'FM002', baseColor: '#a89070', grainColor: '#6a5840', type: 'wood', roughness: 0.48, grainIntensity: 0.38 },
  'Concreto Metropolitan': { name: 'Concreto Metropolitan', brand: 'Fórmica', code: 'FM003', baseColor: '#808080', type: 'pattern', pattern: 'concrete', roughness: 0.55 },
  'Linho Champagne': { name: 'Linho Champagne', brand: 'Fórmica', code: 'FM004', baseColor: '#e8dcc8', type: 'pattern', pattern: 'linen', roughness: 0.45 },
  
  // Eucatex
  'Rústico': { name: 'Rústico', brand: 'Eucatex', code: 'EU001', baseColor: '#8B6914', grainColor: '#5a4510', type: 'wood', roughness: 0.55, grainIntensity: 0.6 },
  'Amendoa': { name: 'Amendoa', brand: 'Eucatex', code: 'EU002', baseColor: '#a08060', grainColor: '#6a5040', type: 'wood', roughness: 0.48, grainIntensity: 0.42 },
  
  // Lacquers
  'Champagne': { name: 'Champagne', brand: 'Lacca', code: 'LC001', baseColor: '#F7E7CE', type: 'solid', roughness: 0.2 },
  'Nude': { name: 'Nude', brand: 'Lacca', code: 'LC002', baseColor: '#E8D4C4', type: 'solid', roughness: 0.2 },
  'Azul Marinho': { name: 'Azul Marinho', brand: 'Lacca', code: 'LC003', baseColor: '#1a3a5c', type: 'solid', roughness: 0.22 },
  'Verde Musgo': { name: 'Verde Musgo', brand: 'Lacca', code: 'LC004', baseColor: '#4a5a40', type: 'solid', roughness: 0.22 },
  'Terracota': { name: 'Terracota', brand: 'Lacca', code: 'LC005', baseColor: '#c45c3c', type: 'solid', roughness: 0.25 },
};

// Hook para criar material de laminado
export const useLaminateMaterial = (laminateName: string) => {
  return useMemo(() => {
    const config = LAMINATE_CATALOG[laminateName] || LAMINATE_CATALOG['Branco Tx'];
    let texture: THREE.Texture | null = null;
    
    if (config.type === 'wood' && config.grainColor) {
      texture = createLaminateWoodTexture(
        config.baseColor, 
        config.grainColor, 
        config.grainIntensity || 0.4
      );
    } else if (config.type === 'pattern' && config.pattern) {
      texture = createHPLTexture(config.pattern, config.baseColor);
    } else {
      texture = createSolidLaminateTexture(config.baseColor);
    }
    
    return new THREE.MeshStandardMaterial({
      color: config.baseColor,
      roughness: config.roughness,
      metalness: 0.05,
      map: texture,
    });
  }, [laminateName]);
};

export default {
  createLaminateWoodTexture,
  createSolidLaminateTexture,
  createHPLTexture,
  LAMINATE_CATALOG,
  useLaminateMaterial,
};
