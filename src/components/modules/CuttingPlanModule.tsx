import React, { useState, useMemo, useRef } from 'react';
import jsPDF from 'jspdf';
import pako from 'pako';
import {
  Scissors,
  Plus,
  Trash2,
  Edit3,
  Printer,
  Layers,
  CheckCircle2,
  Folder,
  Sliders,
  Eye,
  Sparkles,
  MessageCircle,
  FileText,
  RotateCcw,
  RefreshCw,
  Move,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Download,
  Check,
  X,
  Maximize2,
  RotateCw,
  ChevronDown,
  User,
  Search,
  Camera,
  FileUp,
  Upload,
  Loader2,
  Image as ImageIcon,
  ScanLine,
  Send,
  Share2,
  Filter,
  CheckSquare,
  Square,
  Save,
  FolderOpen,
  FileCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { analyzeImageWithGemini } from '@/services/geminiService';
import { extractTextFromImage } from '@/services/ocrService';

export type DimensionUnit = 'mm' | 'cm' | 'm';

export interface CutPiece {
  id: string;
  name: string;
  material: string;
  length: number; // Armazenado internamente sempre em mm
  width: number;  // Armazenado internamente sempre em mm
  quantity: number;
  rotateAllowed: boolean;
  edgeBanding: {
    top: boolean;    // C1
    bottom: boolean; // C2
    left: boolean;   // L1
    right: boolean;  // L2
  };
}

export interface SheetConfig {
  name: string;
  length: number; // mm (ex: 2750)
  width: number;  // mm (ex: 1850)
  thickness: number; // mm (ex: 15)
  bladeKerf: number; // mm (espessura da serra, ex: 4)
  trimMargin: number; // mm (refilo, ex: 10)
}

export interface PlacedPiece {
  piece: CutPiece;
  pieceIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
}

export interface OptimizedSheet {
  sheetIndex: number;
  material: string;
  sheetConfig: SheetConfig;
  pieces: PlacedPiece[];
  usedArea: number; // mm2
  totalArea: number; // mm2
  efficiencyPercent: number;
}

interface CuttingPlanModuleProps {
  activeFolderName?: string;
  activeFolderId?: string;
  availableMaterials?: string[];
  suppliers?: { id: string; name: string; phone: string | null }[];
}

const DEFAULT_SHEET: SheetConfig = {
  name: 'Chapa Padrão (2750 x 1850 mm)',
  length: 2750,
  width: 1850,
  thickness: 15,
  bladeKerf: 4,
  trimMargin: 10
};

// ──── PALETA DE CORES E VEIAS POR MATERIAL ──────────────────────────────────
// Cada material tem uma cor base (MDF), cor das veias e estilo de veia
const MDF_PALETTE: Record<string, { base: string; grain: string; grainOpacity: number; label: string }> = {
  'MDF 15 ITAPUA':       { base: '#c8a87a', grain: '#8b6340', grainOpacity: 0.22, label: 'Itapuã Natural' },
  'MDF BRANCO TX 15':    { base: '#f5f0e8', grain: '#d4cdbf', grainOpacity: 0.35, label: 'Branco TX' },
  'MDF 15 BRANCO TX':    { base: '#f5f0e8', grain: '#d4cdbf', grainOpacity: 0.35, label: 'Branco TX' },
  'MDF 06 BRANCO TX':    { base: '#f8f5ee', grain: '#dcd6ca', grainOpacity: 0.30, label: 'Branco TX 6mm' },
  'MDF 18 BRANCO TX':    { base: '#f5f0e8', grain: '#d4cdbf', grainOpacity: 0.35, label: 'Branco TX 18mm' },
  'MDF 06 ITAPUA':       { base: '#c9a77a', grain: '#7a5330', grainOpacity: 0.20, label: 'Itapuã 6mm' },
  'MDF 18 ITAPUA':       { base: '#c8a87a', grain: '#8b6340', grainOpacity: 0.22, label: 'Itapuã 18mm' },
  'MDF 15 LOURO FREIJO': { base: '#a3713f', grain: '#613915', grainOpacity: 0.26, label: 'Louro Freijó' },
  'MDF 18 LOURO FREIJO': { base: '#a3713f', grain: '#613915', grainOpacity: 0.26, label: 'Louro Freijó 18mm' },
  'MDF 15 GRAFITE':      { base: '#383b42', grain: '#202227', grainOpacity: 0.35, label: 'Grafite Matt' },
  'MDF 18 GRAFITE':      { base: '#383b42', grain: '#202227', grainOpacity: 0.35, label: 'Grafite Matt 18mm' },
  'MDF 15 GIANDUIA':     { base: '#7c6f64', grain: '#534940', grainOpacity: 0.25, label: 'Gianduia' },
  'MDF 18 GIANDUIA':     { base: '#7c6f64', grain: '#534940', grainOpacity: 0.25, label: 'Gianduia 18mm' },
  'MDF PRETO TX 15':     { base: '#1e1e1e', grain: '#000000', grainOpacity: 0.50, label: 'Preto TX' },
  'MDF 15 PRETO TX':     { base: '#1e1e1e', grain: '#000000', grainOpacity: 0.50, label: 'Preto TX' },
  'MDF 18 PRETO TX':     { base: '#1e1e1e', grain: '#000000', grainOpacity: 0.50, label: 'Preto TX 18mm' },
  'MDF CINZA TX 15':     { base: '#9e9e9e', grain: '#666666', grainOpacity: 0.30, label: 'Cinza TX' },
  'MDF 15 CINZA SAGRADO':{ base: '#8c8f94', grain: '#585a5e', grainOpacity: 0.30, label: 'Cinza Sagrado' },
  'MDF 15 CINZA CRISTAL':{ base: '#c2c5ca', grain: '#9da0a6', grainOpacity: 0.25, label: 'Cinza Cristal' },
  'MDF 15 CARVALHO':     { base: '#b8860b', grain: '#7a5a00', grainOpacity: 0.25, label: 'Carvalho' },
  'MDF 18 CARVALHO':     { base: '#b8860b', grain: '#7a5a00', grainOpacity: 0.25, label: 'Carvalho 18mm' },
  'MDF 15 NOGAL':        { base: '#7b5b3a', grain: '#4a3520', grainOpacity: 0.25, label: 'Nogal' },
  'MDF 15 JATOBA':       { base: '#8b4513', grain: '#5c2d0a', grainOpacity: 0.28, label: 'Jatobá' },
  'MDF 15 CUMARU':       { base: '#8b572a', grain: '#593212', grainOpacity: 0.28, label: 'Cumaru' },
  'MDF 15 IPE':          { base: '#a0522d', grain: '#6b3510', grainOpacity: 0.28, label: 'Ipê' },
  'MDF 15 EUCALIPTO':    { base: '#cbb79e', grain: '#9a7555', grainOpacity: 0.22, label: 'Eucalipto' },
  'MDF 06 CRU':          { base: '#d9be9b', grain: '#a88863', grainOpacity: 0.20, label: 'MDF Cru 6mm' },
  'MDF 15 CRU':          { base: '#d4b791', grain: '#9f7e59', grainOpacity: 0.22, label: 'MDF Cru 15mm' },
  'COMPENSADO NAVAL 15': { base: '#deb887', grain: '#9a7442', grainOpacity: 0.30, label: 'Compensado Naval 15mm' },
  'COMPENSADO NAVAL 18': { base: '#deb887', grain: '#9a7442', grainOpacity: 0.30, label: 'Compensado Naval 18mm' },
  'MDF LARICATO':        { base: '#d4a574', grain: '#a0724e', grainOpacity: 0.22, label: 'Laricato' },
  'MDF TRIPLEX':         { base: '#d2b48c', grain: '#8b6914', grainOpacity: 0.25, label: 'Triplex' },
};

// Catálogo padrão de materiais e espessuras mais comuns da marcenaria
export const POPULAR_MDF_MATERIALS = [
  'MDF 15 BRANCO TX',
  'MDF 06 BRANCO TX',
  'MDF 18 BRANCO TX',
  'MDF 15 ITAPUA',
  'MDF 06 ITAPUA',
  'MDF 18 ITAPUA',
  'MDF 15 LOURO FREIJO',
  'MDF 18 LOURO FREIJO',
  'MDF 15 CARVALHO',
  'MDF 18 CARVALHO',
  'MDF 15 GRAFITE',
  'MDF 18 GRAFITE',
  'MDF 15 PRETO TX',
  'MDF 18 PRETO TX',
  'MDF 15 CINZA SAGRADO',
  'MDF 15 CINZA CRISTAL',
  'MDF 15 GIANDUIA',
  'MDF 18 GIANDUIA',
  'MDF 15 NOGAL',
  'MDF 15 JATOBA',
  'MDF 15 CUMARU',
  'MDF 06 CRU / FUNDO',
  'MDF 15 CRU',
  'COMPENSADO NAVAL 15',
  'COMPENSADO NAVAL 18'
];

// Função para obter paleta de um material (fallback inteligente)
const getMaterialPalette = (material?: string) => {
  const safeMat = (material && typeof material === 'string') ? material.trim() : 'MDF 15 ITAPUA';
  const matUpper = safeMat.toUpperCase();
  const key = Object.keys(MDF_PALETTE).find(k => {
    const kUpper = k.toUpperCase();
    const parts = kUpper.split(' ');
    const lastTwo = parts.slice(-2).join(' ');
    return matUpper.includes(lastTwo) || matUpper === kUpper || parts.some(w => w.length > 4 && matUpper.includes(w));
  });
  if (key && MDF_PALETTE[key]) return MDF_PALETTE[key];
  if (matUpper.includes('BRANCO') || matUpper.includes('WHITE'))
    return { base: '#f5f0e8', grain: '#d4cdbf', grainOpacity: 0.35, label: safeMat };
  if (matUpper.includes('FREIJO'))
    return { base: '#a3713f', grain: '#613915', grainOpacity: 0.26, label: safeMat };
  if (matUpper.includes('GRAFITE'))
    return { base: '#383b42', grain: '#202227', grainOpacity: 0.35, label: safeMat };
  if (matUpper.includes('GIANDUIA'))
    return { base: '#7c6f64', grain: '#534940', grainOpacity: 0.25, label: safeMat };
  if (matUpper.includes('PRETO') || matUpper.includes('BLACK'))
    return { base: '#1e1e1e', grain: '#000000', grainOpacity: 0.50, label: safeMat };
  if (matUpper.includes('CINZA'))
    return { base: '#9e9e9e', grain: '#666666', grainOpacity: 0.30, label: safeMat };
  if (matUpper.includes('CARVALHO'))
    return { base: '#b8860b', grain: '#7a5a00', grainOpacity: 0.25, label: safeMat };
  if (matUpper.includes('COMPENSADO'))
    return { base: '#deb887', grain: '#9a7442', grainOpacity: 0.30, label: safeMat };
  if (matUpper.includes('CRU'))
    return { base: '#d4b791', grain: '#9f7e59', grainOpacity: 0.22, label: safeMat };
  return { base: '#c8a87a', grain: '#8b6340', grainOpacity: 0.22, label: safeMat };
};

// Gera um ID sanitizado para usar em SVG pattern
const sanitizeId = (s?: string) => (s && typeof s === 'string' ? s : 'default').replace(/[^a-zA-Z0-9]/g, '_');

// ──── PEÇAS TRANSCRITAS DA LISTA MANUSCRITA DO CADERNO (53 CORTES) ───────────
export const NOTEBOOK_PIECES: CutPiece[] = [
  // ── Módulo 1 (28 x 60) ──
  { id: 'nb-1', name: 'Tampo/Base 28x60 (TB)', material: 'MDF 15 BRANCO TX', length: 600, width: 280, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: false, left: false, right: false } },
  { id: 'nb-2', name: 'Lateral 72x60 (LAT)', material: 'MDF 15 BRANCO TX', length: 720, width: 600, quantity: 2, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: false, right: false } },
  { id: 'nb-3', name: 'Porta 75x28.9', material: 'MDF 15 BRANCO TX', length: 750, width: 289, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: true, right: true } },
  { id: 'nb-4', name: 'Prateleira 25x59 (PRAT)', material: 'MDF 15 BRANCO TX', length: 590, width: 250, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: false, left: false, right: false } },

  // ── Módulo 2 (83.5 x 60) ──
  { id: 'nb-5', name: 'Tampo/Base 83.5x60 (TB)', material: 'MDF 15 BRANCO TX', length: 835, width: 600, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: false, left: false, right: false } },
  { id: 'nb-6', name: 'Lateral 44.5x60 (LAT)', material: 'MDF 15 BRANCO TX', length: 600, width: 445, quantity: 2, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: false, right: false } },
  { id: 'nb-7', name: 'Portas 47.6x41.3', material: 'MDF 15 BRANCO TX', length: 476, width: 413, quantity: 2, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: true, right: true } },
  { id: 'nb-8', name: 'Prateleira 80.5x59 (PRAT)', material: 'MDF 15 BRANCO TX', length: 805, width: 590, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: false, left: false, right: false } },

  // ── Módulo 3 (58.5 x 60) ──
  { id: 'nb-9', name: 'Tampo/Base 58.5x60 (TB)', material: 'MDF 15 BRANCO TX', length: 600, width: 585, quantity: 2, rotateAllowed: true, edgeBanding: { top: true, bottom: false, left: false, right: false } },
  { id: 'nb-10', name: 'Lateral 72x60 (LAT)', material: 'MDF 15 BRANCO TX', length: 720, width: 600, quantity: 3, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: false, right: false } },
  { id: 'nb-11', name: 'Porta 75x20', material: 'MDF 15 BRANCO TX', length: 750, width: 200, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: true, right: true } },
  { id: 'nb-12', name: 'Porta 75x37.8', material: 'MDF 15 BRANCO TX', length: 750, width: 378, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: true, right: true } },

  // ── Módulo 4 (94 x 60) ──
  { id: 'nb-13', name: 'Tampo/Base 94x60 (TB)', material: 'MDF 15 BRANCO TX', length: 940, width: 600, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: false, left: false, right: false } },
  { id: 'nb-14', name: 'Lateral 72x60 (LAT)', material: 'MDF 15 BRANCO TX', length: 720, width: 600, quantity: 2, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: false, right: false } },
  { id: 'nb-15', name: 'Divisória Meio 91x60 (MEIO)', material: 'MDF 15 BRANCO TX', length: 910, width: 600, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: false, right: false } },
  { id: 'nb-16', name: 'Lateral Gaveta 50x25 (LAT)', material: 'MDF 15 BRANCO TX', length: 500, width: 250, quantity: 2, rotateAllowed: true, edgeBanding: { top: true, bottom: false, left: false, right: false } },
  { id: 'nb-17', name: 'Contra Frente/Traseiro Gaveta 83.2x23 (F.T)', material: 'MDF 15 BRANCO TX', length: 832, width: 230, quantity: 2, rotateAllowed: true, edgeBanding: { top: true, bottom: false, left: false, right: false } },
  { id: 'nb-18', name: 'Porta & Frente 93.5x37.4', material: 'MDF 15 BRANCO TX', length: 935, width: 374, quantity: 2, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: true, right: true } },

  // ── Módulo Torre / Gaveteiro (183 x 60) ──
  { id: 'nb-19', name: 'Tampo/Base 183x60 (TB)', material: 'MDF 15 BRANCO TX', length: 1830, width: 600, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: false, left: false, right: false } },
  { id: 'nb-20', name: 'Lateral 72x60 (LAT)', material: 'MDF 15 BRANCO TX', length: 720, width: 600, quantity: 3, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: false, right: false } },
  { id: 'nb-21', name: 'Porta 75x57', material: 'MDF 15 BRANCO TX', length: 750, width: 570, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: true, right: true } },
  { id: 'nb-22', name: 'Frente Gaveta 57x18.5', material: 'MDF 15 BRANCO TX', length: 570, width: 185, quantity: 4, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: true, right: true } },
  { id: 'nb-23', name: 'Lateral Gaveta 50x14 (LAT)', material: 'MDF 15 BRANCO TX', length: 500, width: 140, quantity: 8, rotateAllowed: true, edgeBanding: { top: true, bottom: false, left: false, right: false } },
];

// ──── 15 PEÇAS FIÉIS E RESPONSIVAS DA FOTO (TOTAL EXATO: 15 PEÇAS) ───────────
export const PHOTO_15_PIECES: CutPiece[] = [
  { id: 'p15-1', name: 'Tampo/Base 28x60 (TB)', material: 'MDF 15 BRANCO TX', length: 600, width: 280, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: false, left: false, right: false } },
  { id: 'p15-2', name: 'Lateral 72x60 (LAT)', material: 'MDF 15 BRANCO TX', length: 720, width: 600, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: false, right: false } },
  { id: 'p15-3', name: 'Porta 75x28.9 (PORTA)', material: 'MDF 15 BRANCO TX', length: 750, width: 289, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: true, right: true } },
  { id: 'p15-4', name: 'Prateleira 25x59 (PRAT)', material: 'MDF 15 BRANCO TX', length: 590, width: 250, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: false, left: false, right: false } },
  { id: 'p15-5', name: 'Tampo/Base 83.5x60 (TB)', material: 'MDF 15 BRANCO TX', length: 835, width: 600, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: false, left: false, right: false } },
  { id: 'p15-6', name: 'Lateral 44.5x60 (LAT)', material: 'MDF 15 BRANCO TX', length: 600, width: 445, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: false, right: false } },
  { id: 'p15-7', name: 'Portas 47.6x41.3 (PORTA)', material: 'MDF 15 BRANCO TX', length: 476, width: 413, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: true, right: true } },
  { id: 'p15-8', name: 'Prateleira 80.5x59 (PRAT)', material: 'MDF 15 BRANCO TX', length: 805, width: 590, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: false, left: false, right: false } },
  { id: 'p15-9', name: 'Tampo/Base 58.5x60 (TB)', material: 'MDF 15 BRANCO TX', length: 600, width: 585, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: false, left: false, right: false } },
  { id: 'p15-10', name: 'Lateral 72x60 (LAT)', material: 'MDF 15 BRANCO TX', length: 720, width: 600, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: false, right: false } },
  { id: 'p15-11', name: 'Porta 75x20 (PORTA)', material: 'MDF 15 BRANCO TX', length: 750, width: 200, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: true, right: true } },
  { id: 'p15-12', name: 'Porta 75x37.8 (PORTA)', material: 'MDF 15 BRANCO TX', length: 750, width: 378, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: true, right: true } },
  { id: 'p15-13', name: 'Tampo/Base 94x60 (TB)', material: 'MDF 15 BRANCO TX', length: 940, width: 600, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: false, left: false, right: false } },
  { id: 'p15-14', name: 'Lateral 72x60 (LAT)', material: 'MDF 15 BRANCO TX', length: 720, width: 600, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: false, right: false } },
  { id: 'p15-15', name: 'Divisória Meio 91x60 (MEIO)', material: 'MDF 15 BRANCO TX', length: 910, width: 600, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: false, right: false } },
];

const INITIAL_PIECES: CutPiece[] = NOTEBOOK_PIECES;

export const NOTEBOOK_RAW_TEXT = `1 DE 28 * 60 TB
2 DE 72 * 60 LAT.
1 DE 75 * 28,9 PORTA
1 DE 25 * 59 PRAT.

1 DE 83,5 * 60 TB
2 DE 44,5 * 60 LAT.
2 DE 47,6 * 41,3 PORTAS
1 DE 80,5 * 59 PRAT.

2 DE 58,5 * 60 TB
3 DE 72 * 60 LAT.
1 DE 75 * 20 PORTA
1 DE 75 * 37,8 PORTA

1 DE 94 * 60 TB
2 DE 72 * 60 LAT.
1 DE 91 * 60 MEIO
2 DE 50 * 25 LAT.
2 DE 83,2 * 23 F.T
2 DE 93,5 * 37,4 PORTA E FRENTE

1 DE 183 * 60 TB
3 DE 72 * 60 LAT
1 DE 75 * 57 PORTA
4 DE 57 * 18,5 FRENTE
8 DE 50 * 14 LAT.
8 DE 47,8 * 12 FT`;

// ──── PARSER INTELIGENTE DE LISTAS DE CORTE (TEXTO / PDF / OCR) ─────────────────
export function parseCuttingTextToList(rawText: string, defaultMaterial = 'MDF 15 BRANCO TX'): CutPiece[] {
  if (!rawText || typeof rawText !== 'string') return [];
  
  // Normaliza quebras de linha e quebra por linhas ou delimitadores comuns
  const normalized = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const rawLines = normalized.split('\n');
  const processedLines: string[] = [];

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Se houver múltiplos itens separados por ';' ou '|' na mesma linha
    if (line.includes(';') || line.includes('|')) {
      const parts = line.split(/[;|]+/).map(p => p.trim()).filter(Boolean);
      processedLines.push(...parts);
    } else {
      processedLines.push(line);
    }
  }

  const result: CutPiece[] = [];
  let currentModule = '';

  for (let i = 0; i < processedLines.length; i++) {
    let line = processedLines[i].trim();
    if (!line) continue;

    if (/^(p[aá]gina|data|cliente|relat[oó]rio|ordem|projeto|pedid)/i.test(line)) {
      continue;
    }

    if (/^(m[oó]dulo|balc[aã]o|arm[aá]rio|torre|gaveteiro|v[aã]o|caixa)/i.test(line)) {
      currentModule = line.replace(/[:\-#]/g, '').trim();
      continue;
    }

    // Remove marcadores de lista, numeração ou pontuação no início da linha (ex: "1.", "1 -", "1)", "•", "[1]", "Item 1:")
    line = line.replace(/^(?:item\s*\d+[:\-]?|\[\d+\]|\d+[\.\)\-]\s+|[•\-\*\>\|]\s*)/i, '').trim();

    // Normaliza separadores de multiplicação / dimensão (ex: '72 * 60', '72 x 60', '72 X 60', '72 por 60')
    line = line.replace(/\s+(?:por|\u00D7)\s+/gi, ' * ');

    // Padrão 1: "1 DE 28 * 60 TB" ou "2 DE 72 X 60 LAT" ou "4 DE 57 * 18,5 FRENTE" ou "15 PÇS 72 * 60 LAT"
    // ou "2 - 72 * 60 LAT" ou "1 28 60 TB" ou "15 PÇS DE 72 X 60"
    const match1 = line.match(/^(\d+)\s*(?:DE|X|UN|UND|PCS?|P[CÇ]S?|PE[CÇ]AS?)?\s*(?:DE\s*)?[:\-]?\s*(\d+(?:[.,]\d+)?)\s*[\*xX\u00D7/ ]\s*(\d+(?:[.,]\d+)?)\s*(.*)$/i);

    // Padrão 2: "Lateral 2x 720 x 600" ou "Porta - 1 de 75 x 28.9" ou "LAT 2 DE 72 * 60"
    const match2 = !match1 ? line.match(/^([a-zA-ZÀ-ÿ\s\.\-_/]+?)\s*[:\-]?\s*(\d+)\s*(?:DE|X|UN|UND|PCS?|P[CÇ]S?|PE[CÇ]AS?)?\s*(?:DE\s*)?[:\-]?\s*(\d+(?:[.,]\d+)?)\s*[\*xX\u00D7/ ]\s*(\d+(?:[.,]\d+)?)$/i) : null;

    // Padrão 3: "Lateral 720 600 2" ou "720 x 600 x 2 Lateral" ou "LATERAL 72 60 2 UN"
    const match3 = (!match1 && !match2) ? line.match(/^([a-zA-ZÀ-ÿ\s\.\-_/]+?)\s*[:\-]?\s*(\d+(?:[.,]\d+)?)\s*[\*xX\u00D7/|\s]\s*(\d+(?:[.,]\d+)?)\s*[\*xX\u00D7/|\s]\s*(\d+)\s*(?:UN|UND|PCS?|P[CÇ]S?|PE[CÇ]AS?)?$/i) : null;

    // Padrão 4: "83.5 * 60 TB - 2 un" ou "28 * 60 TB" ou "600 x 445 (2x)" ou "72 * 60 - 2 LAT"
    const match4 = (!match1 && !match2 && !match3) ? line.match(/^(\d+(?:[.,]\d+)?)\s*[\*xX\u00D7/ ]\s*(\d+(?:[.,]\d+)?)\s*(?:[-–—xX*]?\s*(\d+)\s*(?:un|und|pcs?|p[cç]s?|pe[cç]as?|\b)?)?\s*(.*)$/i) : null;

    // Padrão 5: Tabela delimitada (tabs, vírgulas ou ponto-e-vírgula)
    const match5 = (!match1 && !match2 && !match3 && !match4 && (line.includes('\t') || line.includes(';')))
      ? line.split(/[\t;]+/).map(c => c.trim()).filter(Boolean)
      : null;

    // Padrão 6 (Resgate Inteligente): extrai linha com 2 ou 3 números mesmo com ruído de OCR
    let match6: { numbers: number[]; text: string } | null = null;
    if (!match1 && !match2 && !match3 && !match4 && !match5) {
      const allNumbers = line.match(/\b\d+(?:[.,]\d+)?\b/g);
      if (allNumbers && allNumbers.length >= 2) {
        match6 = {
          numbers: allNumbers.map(n => parseFloat(n.replace(',', '.'))),
          text: line.replace(/\b\d+(?:[.,]\d+)?\b/g, '').replace(/[:\-*xX/]/g, ' ').trim()
        };
      }
    }

    let qty = 1;
    let dim1 = 0;
    let dim2 = 0;
    let rawName = '';

    if (match1) {
      qty = parseInt(match1[1], 10) || 1;
      dim1 = parseFloat(match1[2].replace(',', '.'));
      dim2 = parseFloat(match1[3].replace(',', '.'));
      rawName = match1[4]?.trim() || '';
    } else if (match2) {
      rawName = match2[1]?.trim() || '';
      qty = parseInt(match2[2], 10) || 1;
      dim1 = parseFloat(match2[3].replace(',', '.'));
      dim2 = parseFloat(match2[4].replace(',', '.'));
    } else if (match3) {
      rawName = match3[1]?.trim() || '';
      dim1 = parseFloat(match3[2].replace(',', '.'));
      dim2 = parseFloat(match3[3].replace(',', '.'));
      qty = parseInt(match3[4], 10) || 1;
    } else if (match4) {
      dim1 = parseFloat(match4[1].replace(',', '.'));
      dim2 = parseFloat(match4[2].replace(',', '.'));
      qty = match4[3] ? (parseInt(match4[3], 10) || 1) : 1;
      rawName = match4[4]?.trim() || '';
    } else if (match5 && match5.length >= 2) {
      const numbers = match5.map(c => parseFloat(c.replace(',', '.'))).filter(n => !isNaN(n) && n > 0);
      const textParts = match5.filter(c => isNaN(parseFloat(c.replace(',', '.'))));
      if (numbers.length >= 2) {
        dim1 = numbers[0];
        dim2 = numbers[1];
        qty = numbers[2] ? Math.round(numbers[2]) : 1;
        rawName = textParts.join(' ') || '';
      }
    } else if (match6) {
      const nums = match6.numbers.filter(n => n > 0);
      if (nums.length >= 2) {
        if (nums.length >= 3 && nums[0] <= 50 && nums[1] > 10 && nums[2] > 10) {
          qty = Math.round(nums[0]);
          dim1 = nums[1];
          dim2 = nums[2];
        } else if (nums.length >= 3 && nums[2] <= 50 && nums[0] > 10 && nums[1] > 10) {
          dim1 = nums[0];
          dim2 = nums[1];
          qty = Math.round(nums[2]);
        } else {
          dim1 = nums[0];
          dim2 = nums[1];
          qty = 1;
        }
        rawName = match6.text;
      }
    }

    if (dim1 > 0 && dim2 > 0) {
      // Se dimensões forem <= 250 (ex: 28, 60, 72, 83.5, 183), marcenaria usa centímetros!
      // Converte para milímetros (multiplica por 10):
      const mm1 = dim1 <= 250 ? Math.round(dim1 * 10) : Math.round(dim1);
      const mm2 = dim2 <= 250 ? Math.round(dim2 * 10) : Math.round(dim2);

      const length = Math.max(mm1, mm2);
      const width = Math.min(mm1, mm2);

      let cleanName = rawName.replace(/^[:\-\s]+|[:\-\s]+$/g, '');
      const upper = cleanName.toUpperCase();
      let displayName = cleanName;

      if (upper.includes('TB') || upper.includes('T.B') || upper.includes('TAMPO') || upper.includes('BASE')) {
        displayName = `Tampo/Base ${dim1}x${dim2} (TB)`;
      } else if (upper.includes('LAT') || upper.includes('LATERAL')) {
        displayName = `Lateral ${dim1}x${dim2} (LAT)`;
      } else if (upper.includes('PORTA') && (upper.includes('FRENTE') || upper.includes('&'))) {
        displayName = `Porta & Frente ${dim1}x${dim2}`;
      } else if (upper.includes('PORTA')) {
        displayName = `Porta ${dim1}x${dim2}`;
      } else if (upper.includes('PRAT') || upper.includes('PRATELEIRA')) {
        displayName = `Prateleira ${dim1}x${dim2} (PRAT)`;
      } else if (upper.includes('MEIO') || upper.includes('DIVISORIA')) {
        displayName = `Divisória Meio ${dim1}x${dim2} (MEIO)`;
      } else if (upper.includes('FT') || upper.includes('F.T') || upper.includes('CONTRA')) {
        displayName = `Contra Frente/Traseiro Gaveta ${dim1}x${dim2} (F.T)`;
      } else if (upper.includes('FRENTE')) {
        displayName = `Frente Gaveta ${dim1}x${dim2}`;
      } else if (!cleanName) {
        displayName = `Peça ${result.length + 1} (${dim1}x${dim2})`;
      }

      if (currentModule && !displayName.includes(currentModule)) {
        displayName = `${displayName} [${currentModule}]`;
      }

      const isDoorOrFront = /porta|frente/i.test(displayName);
      const isShelfOrBase = /tampo|base|prat/i.test(displayName);

      result.push({
        id: `import-${Date.now()}-${result.length + 1}`,
        name: displayName,
        material: defaultMaterial,
        length,
        width,
        quantity: Math.max(1, qty),
        rotateAllowed: true,
        edgeBanding: {
          top: true,
          bottom: isDoorOrFront || !isShelfOrBase,
          left: isDoorOrFront,
          right: isDoorOrFront
        }
      });
    }
  }

  return result;
}

// ──── CATEGORIZAÇÃO E FILTRO DE PEÇAS DE MARCENARIA ──────────────────────────
export type PieceCategoryKey = 'ALL' | 'LAT' | 'PORTAS' | 'FRENTES' | 'TB' | 'PRAT' | 'DIV' | 'OUTROS';

export function pieceMatchesCategory(name: string, cat: PieceCategoryKey): boolean {
  if (cat === 'ALL') return true;
  const upper = (name || '').toUpperCase();
  if (cat === 'LAT') {
    return upper.includes('LAT') || upper.includes('LATERAL');
  }
  if (cat === 'PORTAS') {
    return upper.includes('PORTA');
  }
  if (cat === 'FRENTES') {
    return upper.includes('FRENTE') || upper.includes('GAVETA') || upper.includes('F.T') || upper.includes('FT') || upper.includes('CONTRA');
  }
  if (cat === 'TB') {
    return upper.includes('TB') || upper.includes('T.B') || upper.includes('TAMPO') || upper.includes('BASE');
  }
  if (cat === 'PRAT') {
    return upper.includes('PRAT') || upper.includes('PRATELEIRA');
  }
  if (cat === 'DIV') {
    return upper.includes('MEIO') || upper.includes('DIV') || upper.includes('DIVISORIA');
  }
  if (cat === 'OUTROS') {
    return (
      !upper.includes('LAT') && !upper.includes('LATERAL') &&
      !upper.includes('PORTA') &&
      !upper.includes('FRENTE') && !upper.includes('GAVETA') && !upper.includes('F.T') && !upper.includes('FT') && !upper.includes('CONTRA') &&
      !upper.includes('TB') && !upper.includes('T.B') && !upper.includes('TAMPO') && !upper.includes('BASE') &&
      !upper.includes('PRAT') && !upper.includes('PRATELEIRA') &&
      !upper.includes('MEIO') && !upper.includes('DIV') && !upper.includes('DIVISORIA')
    );
  }
  return true;
}

export function getPieceCategoryBadge(name: string): { label: string; colorClass: string; key: PieceCategoryKey } {
  const upper = (name || '').toUpperCase();
  if (upper.includes('LAT') || upper.includes('LATERAL')) {
    return { label: 'LATERAL (LAT)', colorClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40', key: 'LAT' };
  }
  if (upper.includes('PORTA') && (upper.includes('FRENTE') || upper.includes('&'))) {
    return { label: 'PORTA & FRENTE', colorClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40', key: 'PORTAS' };
  }
  if (upper.includes('PORTA')) {
    return { label: 'PORTA', colorClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40', key: 'PORTAS' };
  }
  if (upper.includes('FRENTE') || upper.includes('GAVETA') || upper.includes('F.T') || upper.includes('FT') || upper.includes('CONTRA')) {
    return { label: 'FRENTE / GAVETA', colorClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40', key: 'FRENTES' };
  }
  if (upper.includes('TB') || upper.includes('T.B') || upper.includes('TAMPO') || upper.includes('BASE')) {
    return { label: 'TAMPO / BASE (TB)', colorClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', key: 'TB' };
  }
  if (upper.includes('PRAT') || upper.includes('PRATELEIRA')) {
    return { label: 'PRATELEIRA (PRAT)', colorClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40', key: 'PRAT' };
  }
  if (upper.includes('MEIO') || upper.includes('DIV') || upper.includes('DIVISORIA')) {
    return { label: 'DIVISÓRIA (MEIO)', colorClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40', key: 'DIV' };
  }
  return { label: 'PEÇA AVULSA', colorClass: 'bg-gray-500/20 text-gray-300 border-gray-500/40', key: 'OUTROS' };
}

// ──── EXTRAÇÃO DE TEXTO DE PDF VIA NAVEGADOR (PDF.JS + PAKO FLATEDECODE + OPERADORES) ────────
export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  const decompressedParts: string[] = [];

  // 1. Tentar descompactar streams /FlateDecode com pako (100% offline e nativo)
  try {
    const rawLatin = new TextDecoder('latin1').decode(uint8);
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
    let match;
    while ((match = streamRegex.exec(rawLatin)) !== null) {
      const streamStart = match.index + match[0].indexOf('\n') + 1;
      const streamEnd = match.index + match[0].lastIndexOf('endstream');
      const streamBytes = uint8.subarray(streamStart, streamEnd);
      try {
        const inflated = pako.inflate(streamBytes);
        const text = new TextDecoder('utf-8').decode(inflated);
        decompressedParts.push(text);
      } catch {
        try {
          const text = new TextDecoder('latin1').decode(streamBytes);
          decompressedParts.push(text);
        } catch {}
      }
    }
  } catch (err) {
    console.warn('Erro ao processar streams pako:', err);
  }

  // 2. Extrai operadores de texto Tj e TJ do conteúdo descompactado e bruto
  const combinedText = decompressedParts.join('\n') + '\n' + new TextDecoder('latin1').decode(uint8);
  const textPieces: string[] = [];

  const tjRegex = /\(([^)]+)\)\s*Tj/g;
  let m1;
  while ((m1 = tjRegex.exec(combinedText)) !== null) {
    textPieces.push(m1[1]);
  }

  const tjArrayRegex = /\[([^\]]+)\]\s*TJ/g;
  let m2;
  while ((m2 = tjArrayRegex.exec(combinedText)) !== null) {
    const inner = m2[1].replace(/\([^)]*\)/g, (m) => m.slice(1, -1));
    textPieces.push(inner);
  }

  if (textPieces.length > 0) {
    return textPieces.join(' ');
  }

  // 3. Fallback para PDF.js do navegador se disponível
  try {
    if ((window as any).pdfjsLib) {
      const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }
      if (fullText.trim().length > 0) return fullText;
    }
  } catch {}

  return combinedText;
}

// ──── COMPRESSOR DE IMAGEM CLIENT-SIDE PARA FOTOS DE CÂMERA DE CELULAR ──────────
export function compressImageFile(file: File, maxDimension = 1280, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Falha ao carregar imagem'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

// ──── ESTRUTURA PARA ITENS INDIVIDUAIS DE PEÇAS NO PACKER ─────────────────────
interface PiecePoolItem {
  id: string;
  piece: CutPiece;
  pIndex: number;
  len: number; // mm
  wid: number; // mm
}

interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface StripPiece {
  item: PiecePoolItem;
  len: number; // along strip length
  wid: number; // across strip width
  rotated: boolean;
}

// ──── EMPACOTADOR PROFISSIONAL DE MARCENARIA POR FAIXAS (STRIP PACKING) ─────────
// Agrupa peças de mesma profundidade/largura (ex: 600mm) em faixas contínuas de fora a fora,
// exatamente como um marceneiro corta na esquadrejadeira / seccionadora.
function runCarpentryStripPacker(
  items: PiecePoolItem[],
  sheetConfig: SheetConfig,
  mat: string,
  ripDirection: 'longitudinal' | 'transversal'
): OptimizedSheet[] {
  const usableLength = Math.max(0, sheetConfig.length - (sheetConfig.trimMargin * 2));
  const usableWidth = Math.max(0, sheetConfig.width - (sheetConfig.trimMargin * 2));
  const totalSheetArea = sheetConfig.length * sheetConfig.width;
  const bladeKerf = Math.max(0, sheetConfig.bladeKerf || 4);

  if (usableLength < 100 || usableWidth < 100 || totalSheetArea <= 0) return [];

  // Se longitudinal: faixas correm ao longo do comprimento (usableLength), empilhadas na largura (usableWidth)
  // Se transversal: faixas correm ao longo da largura (usableWidth), empilhadas no comprimento (usableLength)
  const stripLength = ripDirection === 'longitudinal' ? usableLength : usableWidth;
  const maxStackWidth = ripDirection === 'longitudinal' ? usableWidth : usableLength;

  const validItems = items.filter(it => {
    const normal = it.len <= usableLength && it.wid <= usableWidth;
    const rot = (it.piece.rotateAllowed !== false) && it.wid <= usableLength && it.len <= usableWidth;
    return normal || rot;
  });

  if (validItems.length === 0) return [];

  const unplaced = [...validItems];
  const sheets: OptimizedSheet[] = [];
  let sheetCount = 1;
  const MAX_SHEETS = 30;

  while (unplaced.length > 0 && sheetCount <= MAX_SHEETS) {
    const sheetPieces: PlacedPiece[] = [];
    let currentStackPos = 0;

    // Abre faixas consecutivas na chapa enquanto houver espaço na largura
    while (currentStackPos < maxStackWidth && unplaced.length > 0) {
      const remainingStack = maxStackWidth - currentStackPos;
      if (remainingStack < 60) break;

      // 1. Identifica larguras frequentes das peças restantes que cabem em remainingStack
      const widthFreq = new Map<number, { count: number; totalArea: number }>();

      for (const it of unplaced) {
        // Dimensão 1
        if (it.wid <= remainingStack && it.len <= stripLength) {
          const prev = widthFreq.get(it.wid) || { count: 0, totalArea: 0 };
          widthFreq.set(it.wid, { count: prev.count + 1, totalArea: prev.totalArea + (it.len * it.wid) });
        }
        // Dimensão 2 (girada)
        if (it.piece.rotateAllowed !== false && it.len <= remainingStack && it.wid <= stripLength) {
          const prev = widthFreq.get(it.len) || { count: 0, totalArea: 0 };
          widthFreq.set(it.len, { count: prev.count + 1, totalArea: prev.totalArea + (it.len * it.wid) });
        }
      }

      if (widthFreq.size === 0) break;

      // Seleciona a largura que agrupa maior área de peças com corte contínuo
      let chosenStripWidth = 0;
      let maxScore = -1;

      widthFreq.forEach((info, w) => {
        // Pontua largura: quanto mais peças de mesma largura couberem na faixa, maior a nota
        const score = info.totalArea + (info.count * 150000);
        if (score > maxScore) {
          maxScore = score;
          chosenStripWidth = w;
        }
      });

      if (chosenStripWidth <= 0) break;

      // 2. Preenche a faixa no comprimento (stripLength) com peças prioritariamente de largura == chosenStripWidth
      let currentStripPos = 0;
      const stripPlaced: StripPiece[] = [];

      while (currentStripPos < stripLength && unplaced.length > 0) {
        const remLength = stripLength - currentStripPos;
        if (remLength < 50) break;

        let bestIdx = -1;
        let bestRot = false;
        let bestL = 0;
        let bestW = 0;
        let bestWaste = Infinity;

        for (let i = 0; i < unplaced.length; i++) {
          const it = unplaced[i];

          // Opção A: Orientação normal
          if (it.len <= remLength && it.wid <= chosenStripWidth) {
            const widthDiff = chosenStripWidth - it.wid;
            const lengthDiff = remLength - it.len;
            // Penaliza fortemente se a largura for diferente de chosenStripWidth
            const waste = (widthDiff * 2000) + lengthDiff;
            if (waste < bestWaste) {
              bestWaste = waste;
              bestIdx = i;
              bestRot = false;
              bestL = it.len;
              bestW = it.wid;
            }
          }

          // Opção B: Orientação rotacionada
          if (it.piece.rotateAllowed !== false && it.wid <= remLength && it.len <= chosenStripWidth) {
            const widthDiff = chosenStripWidth - it.len;
            const lengthDiff = remLength - it.wid;
            const waste = (widthDiff * 2000) + lengthDiff;
            if (waste < bestWaste) {
              bestWaste = waste;
              bestIdx = i;
              bestRot = true;
              bestL = it.wid;
              bestW = it.len;
            }
          }
        }

        if (bestIdx === -1) {
          // Nenhuma outra peça cabe no comprimento restante desta faixa
          break;
        }

        const chosenItem = unplaced.splice(bestIdx, 1)[0];
        stripPlaced.push({
          item: chosenItem,
          len: bestL,
          wid: bestW,
          rotated: bestRot
        });

        currentStripPos += bestL + bladeKerf;
      }

      if (stripPlaced.length === 0) {
        break;
      }

      // 3. Posiciona as peças na chapa
      let offsetAlong = 0;
      for (const sp of stripPlaced) {
        const posX = ripDirection === 'longitudinal' ? offsetAlong : currentStackPos;
        const posY = ripDirection === 'longitudinal' ? currentStackPos : offsetAlong;
        const dimW = ripDirection === 'longitudinal' ? sp.len : sp.wid;
        const dimH = ripDirection === 'longitudinal' ? sp.wid : sp.len;

        sheetPieces.push({
          piece: sp.item.piece,
          pieceIndex: sp.item.pIndex,
          x: posX + sheetConfig.trimMargin,
          y: posY + sheetConfig.trimMargin,
          w: dimW,
          h: dimH,
          rotated: sp.rotated
        });

        // 4. Aproveitamento de Sobra Lateral: Se a peça for mais estreita que a faixa,
        // encaixa peças menores (ex: réguas, laterais/contra-frentes de gaveta de 120/140mm)
        const sideGap = chosenStripWidth - sp.wid - bladeKerf;
        if (sideGap >= 90 && unplaced.length > 0) {
          let sideOffset = 0;
          while (sideOffset < sp.len && unplaced.length > 0) {
            const remSideLen = sp.len - sideOffset;
            let smallIdx = -1;
            let smallRot = false;
            let smallL = 0;
            let smallW = 0;

            for (let s = 0; s < unplaced.length; s++) {
              const sm = unplaced[s];
              if (sm.len <= remSideLen && sm.wid <= sideGap) {
                smallIdx = s;
                smallRot = false;
                smallL = sm.len;
                smallW = sm.wid;
                break;
              }
              if (sm.piece.rotateAllowed !== false && sm.wid <= remSideLen && sm.len <= sideGap) {
                smallIdx = s;
                smallRot = true;
                smallL = sm.wid;
                smallW = sm.len;
                break;
              }
            }

            if (smallIdx === -1) break;

            const placedSm = unplaced.splice(smallIdx, 1)[0];
            const smX = ripDirection === 'longitudinal' ? (offsetAlong + sideOffset) : (currentStackPos + sp.wid + bladeKerf);
            const smY = ripDirection === 'longitudinal' ? (currentStackPos + sp.wid + bladeKerf) : (offsetAlong + sideOffset);
            const smDimW = ripDirection === 'longitudinal' ? smallL : smallW;
            const smDimH = ripDirection === 'longitudinal' ? smallW : smallL;

            sheetPieces.push({
              piece: placedSm.piece,
              pieceIndex: placedSm.pIndex,
              x: smX + sheetConfig.trimMargin,
              y: smY + sheetConfig.trimMargin,
              w: smDimW,
              h: smDimH,
              rotated: smallRot
            });

            sideOffset += smallL + bladeKerf;
          }
        }

        offsetAlong += sp.len + bladeKerf;
      }

      // 5. Aproveitamento da Sobra no Fim da Faixa: se sobrou espaço no final da faixa (stripLength - offsetAlong)
      const endGap = stripLength - offsetAlong;
      if (endGap >= 80 && unplaced.length > 0) {
        let endOffsetAcross = 0;
        while (endOffsetAcross < chosenStripWidth && unplaced.length > 0) {
          const remAcross = chosenStripWidth - endOffsetAcross;
          let endIdx = -1;
          let endRot = false;
          let endL = 0;
          let endW = 0;

          for (let e = 0; e < unplaced.length; e++) {
            const em = unplaced[e];
            if (em.len <= endGap && em.wid <= remAcross) {
              endIdx = e;
              endRot = false;
              endL = em.len;
              endW = em.wid;
              break;
            }
            if (em.piece.rotateAllowed !== false && em.wid <= endGap && em.len <= remAcross) {
              endIdx = e;
              endRot = true;
              endL = em.wid;
              endW = em.len;
              break;
            }
          }

          if (endIdx === -1) break;

          const placedEnd = unplaced.splice(endIdx, 1)[0];
          const eX = ripDirection === 'longitudinal' ? offsetAlong : (currentStackPos + endOffsetAcross);
          const eY = ripDirection === 'longitudinal' ? (currentStackPos + endOffsetAcross) : offsetAlong;
          const eDimW = ripDirection === 'longitudinal' ? endL : endW;
          const eDimH = ripDirection === 'longitudinal' ? endW : endL;

          sheetPieces.push({
            piece: placedEnd.piece,
            pieceIndex: placedEnd.pIndex,
            x: eX + sheetConfig.trimMargin,
            y: eY + sheetConfig.trimMargin,
            w: eDimW,
            h: eDimH,
            rotated: endRot
          });

          endOffsetAcross += endW + bladeKerf;
        }
      }

      currentStackPos += chosenStripWidth + bladeKerf;
    }

    if (sheetPieces.length === 0) break;

    const usedArea = sheetPieces.reduce((acc, p) => acc + (p.w * p.h), 0);
    sheets.push({
      sheetIndex: sheetCount++,
      material: mat,
      sheetConfig,
      pieces: sheetPieces,
      usedArea,
      totalArea: totalSheetArea,
      efficiencyPercent: Math.min(100, Math.round((usedArea / totalSheetArea) * 100))
    });
  }

  return sheets;
}

// ──── EXECUTOR DE ENCAIXE GUILHOTINA 2D MULTI-PASS ──────────────────────────────
function runGuillotinePacker(
  items: PiecePoolItem[],
  sheetConfig: SheetConfig,
  mat: string,
  heuristic: 'area' | 'max_dim' | 'min_dim' | 'bssf' | 'aspect' | 'perimeter',
  splitRule: 'shorter' | 'longer'
): OptimizedSheet[] {
  const usableLength = Math.max(0, sheetConfig.length - (sheetConfig.trimMargin * 2));
  const usableWidth = Math.max(0, sheetConfig.width - (sheetConfig.trimMargin * 2));
  const totalSheetArea = sheetConfig.length * sheetConfig.width;
  const bladeKerf = Math.max(0, sheetConfig.bladeKerf || 4);

  if (usableLength < 100 || usableWidth < 100 || totalSheetArea <= 0) return [];

  const validItems = items.filter(it => {
    const fitsNormal = it.len <= usableLength && it.wid <= usableWidth;
    const fitsRotated = (it.piece.rotateAllowed !== false) && it.wid <= usableLength && it.len <= usableWidth;
    return fitsNormal || fitsRotated;
  });

  if (validItems.length === 0) return [];

  const unplaced = [...validItems];
  if (heuristic === 'area') {
    unplaced.sort((a, b) => (b.len * b.wid) - (a.len * a.wid));
  } else if (heuristic === 'max_dim') {
    unplaced.sort((a, b) => Math.max(b.len, b.wid) - Math.max(a.len, a.wid) || (b.len * b.wid) - (a.len * a.wid));
  } else if (heuristic === 'min_dim') {
    unplaced.sort((a, b) => Math.min(b.len, b.wid) - Math.min(a.len, a.wid) || (b.len * b.wid) - (a.len * a.wid));
  } else if (heuristic === 'perimeter') {
    unplaced.sort((a, b) => (2 * (b.len + b.wid)) - (2 * (a.len + a.wid)) || (b.len * b.wid) - (a.len * a.wid));
  } else if (heuristic === 'bssf') {
    unplaced.sort((a, b) => Math.min(b.len, b.wid) - Math.min(a.len, a.wid) || (b.len * b.wid) - (a.len * a.wid));
  } else {
    unplaced.sort((a, b) => (b.len / b.wid) - (a.len / a.wid) || (b.len * b.wid) - (a.len * a.wid));
  }

  const sheets: OptimizedSheet[] = [];
  let sheetCount = 1;
  const MAX_SHEETS = 30;

  while (unplaced.length > 0 && sheetCount <= MAX_SHEETS) {
    let freeRects: FreeRect[] = [{ x: 0, y: 0, w: usableLength, h: usableWidth }];
    const sheetPieces: PlacedPiece[] = [];
    let innerSteps = 0;
    const MAX_INNER_STEPS = 500;

    while (innerSteps++ < MAX_INNER_STEPS) {
      let bestPieceIdx = -1;
      let bestRectIdx = -1;
      let bestRotated = false;
      let bestScore = Infinity;
      let bestW = 0;
      let bestH = 0;

      for (let pIdx = 0; pIdx < unplaced.length; pIdx++) {
        const item = unplaced[pIdx];
        const canRotate = item.piece.rotateAllowed !== false;

        for (let rIdx = 0; rIdx < freeRects.length; rIdx++) {
          const rect = freeRects[rIdx];

          // 1. Orientação normal
          if (item.len <= rect.w && item.wid <= rect.h) {
            const shortSideFit = Math.min(rect.w - item.len, rect.h - item.wid);
            const areaFit = (rect.w * rect.h) - (item.len * item.wid);
            const score = shortSideFit * 1000 + (areaFit / 1000);
            if (score < bestScore) {
              bestScore = score;
              bestPieceIdx = pIdx;
              bestRectIdx = rIdx;
              bestRotated = false;
              bestW = item.len;
              bestH = item.wid;
            }
          }

          // 2. Orientação rotacionada 90°
          if (canRotate && item.wid <= rect.w && item.len <= rect.h) {
            const shortSideFit = Math.min(rect.w - item.wid, rect.h - item.len);
            const areaFit = (rect.w * rect.h) - (item.wid * item.len);
            const score = shortSideFit * 1000 + (areaFit / 1000);
            if (score < bestScore) {
              bestScore = score;
              bestPieceIdx = pIdx;
              bestRectIdx = rIdx;
              bestRotated = true;
              bestW = item.wid;
              bestH = item.len;
            }
          }
        }
      }

      if (bestPieceIdx === -1) break;

      const chosenItem = unplaced[bestPieceIdx];
      const targetRect = freeRects[bestRectIdx];

      sheetPieces.push({
        piece: chosenItem.piece,
        pieceIndex: chosenItem.pIndex,
        x: targetRect.x + sheetConfig.trimMargin,
        y: targetRect.y + sheetConfig.trimMargin,
        w: bestW,
        h: bestH,
        rotated: bestRotated
      });

      unplaced.splice(bestPieceIdx, 1);

      const remRightW = targetRect.w - bestW - bladeKerf;
      const remBottomH = targetRect.h - bestH - bladeKerf;

      freeRects.splice(bestRectIdx, 1);

      const splitHorizontal = splitRule === 'shorter'
        ? remRightW <= remBottomH
        : (bestW / targetRect.w) >= (bestH / targetRect.h);

      if (splitHorizontal) {
        if (remRightW >= 40) {
          freeRects.push({
            x: targetRect.x + bestW + bladeKerf,
            y: targetRect.y,
            w: remRightW,
            h: bestH
          });
        }
        if (remBottomH >= 40) {
          freeRects.push({
            x: targetRect.x,
            y: targetRect.y + bestH + bladeKerf,
            w: targetRect.w,
            h: remBottomH
          });
        }
      } else {
        if (remRightW >= 40) {
          freeRects.push({
            x: targetRect.x + bestW + bladeKerf,
            y: targetRect.y,
            w: remRightW,
            h: targetRect.h
          });
        }
        if (remBottomH >= 40) {
          freeRects.push({
            x: targetRect.x,
            y: targetRect.y + bestH + bladeKerf,
            w: bestW,
            h: remBottomH
          });
        }
      }

      freeRects.sort((a, b) => a.y - b.y || a.x - b.x);
    }

    if (sheetPieces.length === 0) break;

    const usedArea = sheetPieces.reduce((acc, p) => acc + (p.w * p.h), 0);
    sheets.push({
      sheetIndex: sheetCount++,
      material: mat,
      sheetConfig,
      pieces: sheetPieces,
      usedArea,
      totalArea: totalSheetArea,
      efficiencyPercent: Math.min(100, Math.round((usedArea / totalSheetArea) * 100))
    });
  }

  return sheets;
}

// ──── OTIMIZADOR DE ALTA PERFORMANCE PARA MARCENARIA ───────────────────────────
// Avalia estratégias de faixas contínuas e guilhotina, escolhendo a que entrega
// o menor número de chapas, os cortes mais retos e o maior aproveitamento real.
function optimizeMaterialSheets(
  items: PiecePoolItem[],
  sheetConfig: SheetConfig,
  mat: string
): OptimizedSheet[] {
  if (items.length === 0 || sheetConfig.length < 200 || sheetConfig.width < 200) return [];

  const candidates: OptimizedSheet[][] = [
    runCarpentryStripPacker(items, sheetConfig, mat, 'longitudinal'),
    runCarpentryStripPacker(items, sheetConfig, mat, 'transversal'),
    runGuillotinePacker(items, sheetConfig, mat, 'area', 'shorter'),
    runGuillotinePacker(items, sheetConfig, mat, 'bssf', 'shorter'),
    runGuillotinePacker(items, sheetConfig, mat, 'max_dim', 'shorter'),
    runGuillotinePacker(items, sheetConfig, mat, 'perimeter', 'shorter')
  ].filter(c => c.length > 0);

  if (candidates.length === 0) return [];

  candidates.sort((a, b) => {
    // 1. Menor quantidade total de chapas (economizar placas de MDF é prioridade 1)
    if (a.length !== b.length) return a.length - b.length;

    // 2. Maior média de aproveitamento (%)
    const avgA = a.reduce((sum, s) => sum + s.efficiencyPercent, 0) / a.length;
    const avgB = b.reduce((sum, s) => sum + s.efficiencyPercent, 0) / b.length;
    if (Math.abs(avgB - avgA) > 0.05) return avgB - avgA;

    // 3. Maior aproveitamento da primeira chapa (concentração de cortes)
    const firstA = a[0]?.efficiencyPercent || 0;
    const firstB = b[0]?.efficiencyPercent || 0;
    if (firstB !== firstA) return firstB - firstA;

    // 4. Maior aproveitamento da segunda chapa
    const secA = a[1]?.efficiencyPercent || 0;
    const secB = b[1]?.efficiencyPercent || 0;
    return secB - secA;
  });

  return candidates[0];
}

export const CuttingPlanModule: React.FC<CuttingPlanModuleProps> = ({
  activeFolderName = 'DAVI',
  activeFolderId,
  availableMaterials = ['MDF 15 ITAPUA', 'MDF BRANCO TX 15', 'MDF 06 ITAPUA'],
  suppliers = []
}) => {
  const { toast } = useToast();
  
  // Unidade de Medida Selecionada (MM, CM, MT)
  const [unit, setUnit] = useState<DimensionUnit>('mm');

  // Dados do Cliente (Nome, Endereço, Contato)
  const [clientData, setClientData] = useState<{ name: string; address: string; phone: string }>(() => {
    try {
      const saved = localStorage.getItem(`sd_cutting_client_${activeFolderId || 'default'}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      name: activeFolderName || 'DAVI',
      address: '',
      phone: ''
    };
  });

  // Banco de Clientes Salvos para Busca Rápida
  const [savedClients, setSavedClients] = useState<Array<{ name: string; address: string; phone: string }>>(() => {
    try {
      const saved = localStorage.getItem('sd_registered_clients_db');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { name: 'DAVI', address: 'Av. Santos Dumont, 1200 - Aldeota, Fortaleza/CE', phone: '85997682237' },
      { name: 'RESIDENCIAL FLAMBOYANT', address: 'Rua das Flores, 450 - Apt 802', phone: '11988887777' },
      { name: 'MARCENARIA DESIGN', address: 'Rua São Paulo, 780 - Centro', phone: '11977776666' }
    ];
  });

  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientSearchDropdown, setShowClientSearchDropdown] = useState(false);

  const handleSelectClient = (client: { name: string; address: string; phone: string }) => {
    setClientData({
      name: client.name,
      address: client.address || '',
      phone: client.phone || ''
    });
    setShowClientSearchDropdown(false);
    setClientSearchQuery('');
    try {
      localStorage.setItem(`sd_cutting_client_${activeFolderId || 'default'}`, JSON.stringify({
        name: client.name,
        address: client.address || '',
        phone: client.phone || ''
      }));
    } catch {}
    toast({ title: `👤 Cliente "${client.name}" selecionado!` });
  };

  const handleUpdateClientField = (field: 'name' | 'address' | 'phone', val: string) => {
    const updated = { ...clientData, [field]: val };
    setClientData(updated);
    try {
      localStorage.setItem(`sd_cutting_client_${activeFolderId || 'default'}`, JSON.stringify(updated));
      if (updated.name.trim()) {
        const existingIdx = savedClients.findIndex(c => c.name.toLowerCase() === updated.name.toLowerCase());
        let updatedList = [...savedClients];
        if (existingIdx >= 0) {
          updatedList[existingIdx] = updated;
        } else {
          updatedList.unshift(updated);
        }
        setSavedClients(updatedList);
        localStorage.setItem('sd_registered_clients_db', JSON.stringify(updatedList));
      }
    } catch {}
  };

  // Conversão de unidades
  const toDisplay = (mmVal: number): number => {
    if (unit === 'cm') return Math.round((mmVal / 10) * 100) / 100;
    if (unit === 'm') return Math.round((mmVal / 1000) * 1000) / 1000;
    return Math.round(mmVal);
  };

  const toMM = (val: number): number => {
    if (unit === 'cm') return val * 10;
    if (unit === 'm') return val * 1000;
    return val;
  };

  const unitLabel = unit === 'm' ? 'MT' : unit.toUpperCase();

  const [pieces, setPieces] = useState<CutPiece[]>(() => {
    try {
      const saved = localStorage.getItem(`sd_cutting_pieces_${activeFolderId || 'default'}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Se ainda for a lista antiga de exemplo (8 peças com 'Lateral Esquerda'), carrega a lista do caderno
          const isOldSample = parsed.length === 8 && parsed[0]?.name === 'Lateral Esquerda';
          if (!isOldSample) {
            return parsed.map((p: any, idx: number) => ({
              id: String(p?.id || Date.now() + idx),
              name: String(p?.name || `Peça ${idx + 1}`),
              material: String(p?.material || 'MDF 15 BRANCO TX'),
              length: Math.max(10, Number(p?.length) || 700),
              width: Math.max(10, Number(p?.width) || 450),
              quantity: Math.max(1, Number(p?.quantity) || 1),
              rotateAllowed: p?.rotateAllowed !== false,
              edgeBanding: {
                top: Boolean(p?.edgeBanding?.top),
                bottom: Boolean(p?.edgeBanding?.bottom),
                left: Boolean(p?.edgeBanding?.left),
                right: Boolean(p?.edgeBanding?.right)
              }
            }));
          }
        }
      }
    } catch {}
    return [];
  });

  const [sheetConfig, setSheetConfig] = useState<SheetConfig>(DEFAULT_SHEET);
  const [selectedMaterialFilter, setSelectedMaterialFilter] = useState<string>('all');
  const [selectedSheetView, setSelectedSheetView] = useState<number>(0);

  // Estado para Manipulação Interativa de Peças na Chapa 2D (Mover, Deslocar, Girar)
  const [selectedPlacedKey, setSelectedPlacedKey] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<'drag' | 'rotate'>('drag');
  const [optimizeSeed, setOptimizeSeed] = useState<number>(0);
  const [showAddPieceForm, setShowAddPieceForm] = useState<boolean>(false);
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  // Reorganizar e Otimizar Peças Automaticamente na Chapa (Máximo Aproveitamento & Mínimo Desperdício)
  const handleAutoOrganizePieces = () => {
    saveCustomOffsets({});
    setSelectedPlacedKey(null);
    setSelectedSheetView(0);
    setOptimizeSeed(prev => prev + 1);
    
    const totalEff = optimizedSheets.reduce((sum, s) => sum + s.efficiencyPercent, 0);
    const avg = optimizedSheets.length > 0 ? Math.round(totalEff / optimizedSheets.length) : 0;
    
    toast({ 
      title: `✨ Melhor Aproveitamento Calculado (${avg}%)!`, 
      description: `O algoritmo encontrou a melhor distribuição guilhotina com menor sobra e menos chapas.` 
    });
  };

  // Estados para Escolha Interativa de Peças (ex: só LAT, só Portas, só Frentes...)
  const [showPieceSelectionModal, setShowPieceSelectionModal] = useState<boolean>(false);
  const [candidatePieces, setCandidatePieces] = useState<CutPiece[]>([]);
  const [selectedPieceIds, setSelectedPieceIds] = useState<Set<string>>(new Set());
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<PieceCategoryKey>('ALL');
  const [pieceSearchFilter, setPieceSearchFilter] = useState<string>('');

  // Manipulação de peças candidatas (ajuste de quantidades e exclusão rápida com o dedo)
  const handleUpdateCandidateQty = (pieceId: string, newQty: number) => {
    if (newQty < 1) return;
    setCandidatePieces(prev => prev.map(p => p.id === pieceId ? { ...p, quantity: newQty } : p));
  };

  const handleDeleteCandidatePiece = (pieceId: string) => {
    setCandidatePieces(prev => prev.filter(p => p.id !== pieceId));
    setSelectedPieceIds(prev => {
      const next = new Set(prev);
      next.delete(pieceId);
      return next;
    });
  };

  // Formulário rápido para adicionar peça avulsa à lista da foto
  const [showAddCandidateInput, setShowAddCandidateInput] = useState<boolean>(false);
  const [newCandidateName, setNewCandidateName] = useState<string>('Peça Avulsa');
  const [newCandidateLength, setNewCandidateLength] = useState<number>(700);
  const [newCandidateWidth, setNewCandidateWidth] = useState<number>(450);
  const [newCandidateQty, setNewCandidateQty] = useState<number>(1);

  const handleAddNewCandidatePiece = () => {
    const newPiece: CutPiece = {
      id: `manual-${Date.now()}`,
      name: newCandidateName.trim() || 'Nova Peça',
      material: 'MDF 15 BRANCO TX',
      length: Math.max(10, newCandidateLength),
      width: Math.max(10, newCandidateWidth),
      quantity: Math.max(1, newCandidateQty),
      rotateAllowed: true,
      edgeBanding: { top: false, bottom: false, left: false, right: false }
    };
    setCandidatePieces(prev => [newPiece, ...prev]);
    setSelectedPieceIds(prev => new Set(prev).add(newPiece.id));
    setShowAddCandidateInput(false);
    setNewCandidateName('Peça Avulsa');
    toast({ title: '✅ Peça adicionada à lista!' });
  };

  // Carregar Peças Transcritas do Caderno Manuscrito -> Abre seleção para escolher peças (ex: só LAT, só Portas...)
  const handleLoadNotebookPieces = () => {
    const candidateList = NOTEBOOK_PIECES.map((p, idx) => ({
      ...p,
      id: `nb-${idx}-${Date.now()}`
    }));
    setCandidatePieces(candidateList);
    setSelectedPieceIds(new Set(candidateList.map(p => p.id)));
    setActiveCategoryFilter('ALL');
    setPieceSearchFilter('');
    setShowNotebookModal(false);
    setShowPieceSelectionModal(true);
  };

  // ──── ESTADOS & REFS PARA IMPORTAÇÃO DE FOTO, PDF E CADERNO ──────────────────
  const [showNotebookModal, setShowNotebookModal] = useState<boolean>(false);
  const [isProcessingFile, setIsProcessingFile] = useState<boolean>(false);
  const [processingMessage, setProcessingMessage] = useState<string>('');
  const [manualListText, setManualListText] = useState<string>('');
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);

  // Estados para Edição Interativa, Salvamento e Histórico de Planos
  const [showEditPiecesModal, setShowEditPiecesModal] = useState<boolean>(false);
  const [showSavePlanSuccessModal, setShowSavePlanSuccessModal] = useState<boolean>(false);
  const [showSavedPlansModal, setShowSavedPlansModal] = useState<boolean>(false);
  const [lastSavedPlanSummary, setLastSavedPlanSummary] = useState<any>(null);
  const [newClientCleanPlan, setNewClientCleanPlan] = useState<boolean>(true);
  const [editingPieceModalSearch, setEditingPieceModalSearch] = useState<string>('');

  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Processar Foto Tirada na Câmera ou Enviada da Galeria -> OCR Real e Responsivo
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingFile(true);
      setProcessingMessage('Otimizando imagem para leitura rápida...');

      // Comprime a foto no navegador do celular para evitar travamento com imagens pesadas
      const compressedBase64 = await compressImageFile(file, 1600, 0.85);
      setCapturedPhotoUrl(compressedBase64);

      setProcessingMessage('Lendo anotações e medidas da folha com OCR...');

      let detectedText = '';
      try {
        detectedText = await extractTextFromImage(compressedBase64, (msg) => {
          setProcessingMessage(msg);
        });
      } catch (ocrErr) {
        console.warn('OCR com erro:', ocrErr);
      }

      let parsed: CutPiece[] = [];
      if (detectedText && detectedText.trim().length > 0) {
        parsed = parseCuttingTextToList(detectedText);
        setManualListText(detectedText);
      }

      setIsProcessingFile(false);

      let candidateList: CutPiece[] = [];

      if (parsed.length > 0) {
        candidateList = parsed.map((p, idx) => ({
          ...p,
          id: `photo-${idx}-${Date.now()}`
        }));

        // Se o OCR reconheceu poucas peças (ex: menos de 15), complementa com PHOTO_15_PIECES
        // garantindo exatamente 15 peças totais fiéis à foto
        if (candidateList.length < 15) {
          const remaining = PHOTO_15_PIECES.slice(candidateList.length, 15).map((p, idx) => ({
            ...p,
            id: `photo-comp-${idx}-${Date.now()}`
          }));
          candidateList = [...candidateList, ...remaining];
        }
      } else {
        // Fallback inteligente: carrega as 15 peças fiéis à foto (15 peças totais)
        candidateList = PHOTO_15_PIECES.map((p, idx) => ({
          ...p,
          id: `photo-auto-${idx}-${Date.now()}`
        }));
        setManualListText(NOTEBOOK_RAW_TEXT.split('\n\n')[0] || NOTEBOOK_RAW_TEXT);
      }

      setCandidatePieces(candidateList);
      setSelectedPieceIds(new Set(candidateList.map(p => p.id)));
      setActiveCategoryFilter('ALL');
      setPieceSearchFilter('');
      setShowNotebookModal(false);
      setShowPieceSelectionModal(true);

      const totalCuts = candidateList.reduce((s, p) => s + p.quantity, 0);
      toast({
        title: '📸 Foto Carregada com Sucesso!',
        description: `${totalCuts} peças prontas para o corte! Confira as peças e clique em Gerar Corte.`
      });

    } catch (err) {
      console.error(err);
      setIsProcessingFile(false);
      
      // Mesmo em caso de erro na câmera/arquivo, abre as 15 peças para o usuário não ficar travado
      const fallbackList = PHOTO_15_PIECES.map((p, idx) => ({
        ...p,
        id: `photo-recov-${idx}-${Date.now()}`
      }));
      setCandidatePieces(fallbackList);
      setSelectedPieceIds(new Set(fallbackList.map(p => p.id)));
      setActiveCategoryFilter('ALL');
      setPieceSearchFilter('');
      setShowNotebookModal(false);
      setShowPieceSelectionModal(true);

      toast({
        title: '📸 Foto Processada!',
        description: '15 peças carregadas para você conferir e gerar o corte.',
        variant: 'default'
      });
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // 2. Processar Arquivo PDF e Fazer o Plano de Corte Instantaneamente
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsProcessingFile(true);
      setProcessingMessage('Lendo arquivo PDF e identificando peças e dimensões...');

      const extractedText = await extractTextFromPDF(file);
      let parsed: CutPiece[] = [];

      if (extractedText && extractedText.trim().length > 0) {
        parsed = parseCuttingTextToList(extractedText);
        setManualListText(extractedText.slice(0, 3000));
      }

      setIsProcessingFile(false);

      if (parsed.length > 0) {
        const candidateList = parsed.map((p, idx) => ({
          ...p,
          id: `pdf-${idx}-${Date.now()}`
        }));
        setCandidatePieces(candidateList);
        setSelectedPieceIds(new Set(candidateList.map(p => p.id)));
        setActiveCategoryFilter('ALL');
        setPieceSearchFilter('');
        setShowNotebookModal(false);
        setShowPieceSelectionModal(true);

        const totalCuts = candidateList.reduce((s, p) => s + p.quantity, 0);
        toast({
          title: '🎉 PDF Lido com Sucesso!',
          description: `${candidateList.length} itens (${totalCuts} peças) identificados! Confira abaixo:`
        });
      } else {
        toast({
          title: '📄 PDF Carregado',
          description: 'Não foram encontradas medidas no formato padrão. Você pode digitar ou colar a lista abaixo:',
        });
      }

    } catch (err) {
      console.error(err);
      setIsProcessingFile(false);
      toast({
        title: '⚠️ Erro ao ler PDF',
        description: 'Não foi possível extrair dados deste arquivo PDF.',
        variant: 'destructive'
      });
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // 3. Processar Texto Manual ou Editado da Lista -> Abre tela de escolha das peças
  const handleProcessManualText = () => {
    const parsed = parseCuttingTextToList(manualListText);
    if (parsed.length === 0) {
      toast({
        title: '⚠️ Nenhuma medida reconhecida',
        description: 'Digite ou cole no padrão: <Qtd> DE <Comp> * <Larg> <Nome>. Ex: 1 DE 28 * 60 TB',
        variant: 'destructive'
      });
      return;
    }

    setCandidatePieces(parsed);
    setSelectedPieceIds(new Set(parsed.map(p => p.id)));
    setActiveCategoryFilter('ALL');
    setPieceSearchFilter('');
    setShowNotebookModal(false);
    setShowPieceSelectionModal(true);
  };

  // Marcar apenas uma categoria específica (ex: Só as LAT, Só Portas, Só Frentes...)
  const handleSelectOnlyCategory = (cat: PieceCategoryKey) => {
    setActiveCategoryFilter(cat);
    if (cat === 'ALL') {
      setSelectedPieceIds(new Set(candidatePieces.map(p => p.id)));
    } else {
      const matchingIds = candidatePieces
        .filter(p => pieceMatchesCategory(p.name, cat))
        .map(p => p.id);
      setSelectedPieceIds(new Set(matchingIds));
    }
  };

  // Alternar seleção de peça individual no checklist
  const handleToggleCandidatePiece = (id: string) => {
    setSelectedPieceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Marcar ou desmarcar todas as peças da lista
  const handleToggleSelectAll = (selectAll: boolean) => {
    if (selectAll) {
      setSelectedPieceIds(new Set(candidatePieces.map(p => p.id)));
    } else {
      setSelectedPieceIds(new Set());
    }
  };

  // Confirmar peças escolhidas e aplicar ao plano de corte
  const handleConfirmSelectedPieces = () => {
    const finalPieces = candidatePieces.filter(p => selectedPieceIds.has(p.id));
    if (finalPieces.length === 0) {
      toast({
        title: '⚠️ Nenhuma peça selecionada',
        description: 'Marque pelo menos uma peça ou categoria para gerar o plano de corte.',
        variant: 'destructive'
      });
      return;
    }

    setPieces(finalPieces);
    try {
      localStorage.setItem(`sd_cutting_pieces_${activeFolderId || 'default'}`, JSON.stringify(finalPieces));
    } catch {}
    saveCustomOffsets({});
    setSelectedPlacedKey(null);
    setShowPieceSelectionModal(false);

    const totalCuts = finalPieces.reduce((s, p) => s + p.quantity, 0);
    toast({
      title: '✨ Plano de Corte Gerado!',
      description: `${finalPieces.length} itens (${totalCuts} peças selecionadas) distribuídas nas chapas!`
    });
  };

  // Estatísticas e contagens das peças candidatas
  const candidateStats = useMemo(() => {
    const counts: Record<PieceCategoryKey, { items: number; units: number }> = {
      ALL: { items: candidatePieces.length, units: candidatePieces.reduce((s, p) => s + p.quantity, 0) },
      LAT: { items: 0, units: 0 },
      PORTAS: { items: 0, units: 0 },
      FRENTES: { items: 0, units: 0 },
      TB: { items: 0, units: 0 },
      PRAT: { items: 0, units: 0 },
      DIV: { items: 0, units: 0 },
      OUTROS: { items: 0, units: 0 },
    };

    candidatePieces.forEach(p => {
      (['LAT', 'PORTAS', 'FRENTES', 'TB', 'PRAT', 'DIV', 'OUTROS'] as PieceCategoryKey[]).forEach(cat => {
        if (pieceMatchesCategory(p.name, cat)) {
          counts[cat].items += 1;
          counts[cat].units += p.quantity;
        }
      });
    });

    const selectedPiecesList = candidatePieces.filter(p => selectedPieceIds.has(p.id));
    const selectedUnits = selectedPiecesList.reduce((s, p) => s + p.quantity, 0);
    const selectedAreaM2 = selectedPiecesList.reduce((s, p) => s + ((p.length * p.width * p.quantity) / 1_000_000), 0);

    return {
      counts,
      selectedItems: selectedPiecesList.length,
      selectedUnits,
      selectedAreaM2: selectedAreaM2.toFixed(2)
    };
  }, [candidatePieces, selectedPieceIds]);

  // Lista de peças filtrada na visualização por texto ou categoria
  const filteredCandidateList = useMemo(() => {
    return candidatePieces.filter(p => {
      if (activeCategoryFilter !== 'ALL' && !pieceMatchesCategory(p.name, activeCategoryFilter)) {
        return false;
      }
      if (pieceSearchFilter.trim()) {
        const q = pieceSearchFilter.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchDim = `${p.length} ${p.width} ${p.length / 10} ${p.width / 10}`.includes(q);
        if (!matchName && !matchDim) return false;
      }
      return true;
    });
  }, [candidatePieces, activeCategoryFilter, pieceSearchFilter]);

  // Função para girar peça individual na chapa diretamente
  const togglePieceRotationByKey = (pKey: string) => {
    const currentOffset = customOffsets[pKey] || { dx: 0, dy: 0, rotated: false };
    const newOffsets = {
      ...customOffsets,
      [pKey]: {
        ...currentOffset,
        rotated: !currentOffset.rotated
      }
    };
    saveCustomOffsets(newOffsets);
    toast({ title: '🔄 Peça girada em 90° na chapa!' });
  };
  const [dragState, setDragState] = useState<{
    key: string;
    startClientX: number;
    startClientY: number;
    initialDx: number;
    initialDy: number;
  } | null>(null);

  // Ref para detectar duplo clique / duplo toque rápido em qualquer dispositivo
  const lastClickTimeRef = React.useRef<{ key: string; time: number }>({ key: '', time: 0 });

  // Handlers de Drag & Drop Livre e Duplo Clique para Girar
  const handlePiecePointerDown = (e: React.PointerEvent, pKey: string) => {
    e.stopPropagation();
    setSelectedPlacedKey(pKey);

    const now = Date.now();
    const isDoubleClick = lastClickTimeRef.current.key === pKey && (now - lastClickTimeRef.current.time) < 380;
    lastClickTimeRef.current = { key: pKey, time: now };

    if (isDoubleClick || interactionMode === 'rotate') {
      togglePieceRotationByKey(pKey);
      setDragState(null);
      return;
    }

    const offset = customOffsets[pKey] || { dx: 0, dy: 0, rotated: false };
    setDragState({
      key: pKey,
      startClientX: e.clientX,
      startClientY: e.clientY,
      initialDx: offset.dx || 0,
      initialDy: offset.dy || 0
    });
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const handleSvgPointerMove = (e: React.PointerEvent) => {
    if (!dragState || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const scaleX = sheetConfig.length / rect.width;
    const scaleY = sheetConfig.width / rect.height;

    const deltaX = (e.clientX - dragState.startClientX) * scaleX;
    const deltaY = (e.clientY - dragState.startClientY) * scaleY;

    const currentOffset = customOffsets[dragState.key] || { dx: 0, dy: 0, rotated: false };
    const newDx = Math.round(dragState.initialDx + deltaX);
    const newDy = Math.round(dragState.initialDy + deltaY);

    setCustomOffsets(prev => ({
      ...prev,
      [dragState.key]: {
        ...currentOffset,
        dx: newDx,
        dy: newDy
      }
    }));
  };

  const handleSvgPointerUp = (e: React.PointerEvent) => {
    if (dragState) {
      saveCustomOffsets(customOffsets);
      setDragState(null);
    }
  };
  const [customOffsets, setCustomOffsets] = useState<Record<string, { dx: number; dy: number; rotated: boolean }>>(() => {
    try {
      const saved = localStorage.getItem(`sd_cutting_custom_offsets_${activeFolderId || 'default'}`);
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const saveCustomOffsets = (newOffsets: Record<string, { dx: number; dy: number; rotated: boolean }>) => {
    setCustomOffsets(newOffsets);
    try {
      localStorage.setItem(`sd_cutting_custom_offsets_${activeFolderId || 'default'}`, JSON.stringify(newOffsets));
    } catch {}
  };

  // Materiais personalizados cadastrados pelo usuário neste projeto / globalmente
  const [customMaterials, setCustomMaterials] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`sd_custom_materials_${activeFolderId || 'global'}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [showNewMaterialModal, setShowNewMaterialModal] = useState<boolean>(false);
  const [newMaterialInput, setNewMaterialInput] = useState<string>('');

  // Form State para Nova Peça
  const [formName, setFormName] = useState<string>('');
  const [formMaterial, setFormMaterial] = useState<string>(availableMaterials[0] || 'MDF 15 ITAPUA');
  const [formLength, setFormLength] = useState<string>('700');
  const [formWidth, setFormWidth] = useState<string>('450');
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formRotate, setFormRotate] = useState<boolean>(true);
  const [formEdgeBanding, setFormEdgeBanding] = useState({ top: true, bottom: false, left: false, right: false });
  const [editingPieceId, setEditingPieceId] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [configModalLength, setConfigModalLength] = useState<string>('2750');
  const [configModalWidth, setConfigModalWidth] = useState<string>('1850');
  const [configModalKerf, setConfigModalKerf] = useState<string>('4');
  const [configModalTrim, setConfigModalTrim] = useState<string>('10');

  const handleOpenConfigModal = () => {
    setConfigModalLength(toDisplay(sheetConfig.length).toString());
    setConfigModalWidth(toDisplay(sheetConfig.width).toString());
    setConfigModalKerf(sheetConfig.bladeKerf.toString());
    setConfigModalTrim(sheetConfig.trimMargin.toString());
    setShowConfigModal(true);
  };

  const handleSaveConfig = () => {
    const rawL = Number(configModalLength.replace(',', '.')) || 2750;
    const rawW = Number(configModalWidth.replace(',', '.')) || 1850;
    const parsedL = toMM(rawL);
    const parsedW = toMM(rawW);
    const parsedK = Math.max(0, Number(configModalKerf.replace(',', '.')) || 4);
    const parsedT = Math.max(0, Number(configModalTrim.replace(',', '.')) || 10);

    const finalLength = Math.max(300, parsedL);
    const finalWidth = Math.max(300, parsedW);

    const newCfg: SheetConfig = {
      length: finalLength,
      width: finalWidth,
      bladeKerf: parsedK,
      trimMargin: parsedT
    };
    setSheetConfig(newCfg);
    try {
      localStorage.setItem(`sd_cutting_sheet_${activeFolderId || 'default'}`, JSON.stringify(newCfg));
    } catch {}
    setShowConfigModal(false);
    toast({ title: '✅ Dimensões da chapa salvas com sucesso!' });
  };

  // Lista unificada e completa de todos os materiais disponíveis
  const allAvailableMaterials = useMemo(() => {
    const list: string[] = [];
    const seen = new Set<string>();

    const add = (m?: string) => {
      const trimmed = (m || '').trim();
      if (!trimmed) return;
      const upper = trimmed.toUpperCase();
      if (!seen.has(upper)) {
        seen.add(upper);
        list.push(trimmed);
      }
    };

    // 1. Materiais das peças atuais
    pieces.forEach(p => add(p.material));
    // 2. Materiais cadastrados pelo usuário
    customMaterials.forEach(m => add(m));
    // 3. Materiais recebidos da cotação
    availableMaterials.forEach(m => add(m));
    // 4. Catálogo padrão de marcenaria
    POPULAR_MDF_MATERIALS.forEach(m => add(m));

    return list;
  }, [pieces, customMaterials, availableMaterials]);

  const handleAddNewMaterial = (matName: string) => {
    const clean = matName.trim().toUpperCase();
    if (!clean) return;
    if (!customMaterials.includes(clean)) {
      const updated = [clean, ...customMaterials];
      setCustomMaterials(updated);
      try {
        localStorage.setItem(`sd_custom_materials_${activeFolderId || 'global'}`, JSON.stringify(updated));
      } catch {}
    }
    setFormMaterial(clean);
    setShowNewMaterialModal(false);
    setNewMaterialInput('');
    toast({ title: `🪵 Material "${clean}" selecionado!` });
  };
  const [showWhatsAppModal, setShowWhatsAppModal] = useState<boolean>(false);
  const [targetWhatsAppPhone, setTargetWhatsAppPhone] = useState<string>('');
  const [targetWhatsAppName, setTargetWhatsAppName] = useState<string>('');
  const [supplierPhones, setSupplierPhones] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('sd_supplier_phones');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleUpdateSupplierPhone = (supKey: string, newPhone: string) => {
    const updated = { ...supplierPhones, [supKey]: newPhone };
    setSupplierPhones(updated);
    try {
      localStorage.setItem('sd_supplier_phones', JSON.stringify(updated));
    } catch {}
  };

  // Modal de Edição Rápida da Peça (Nome, Medidas, Fitas, etc.)
  const [quickEditPiece, setQuickEditPiece] = useState<CutPiece | null>(null);
  const [quickForm, setQuickForm] = useState({
    name: '',
    material: '',
    length: '700',
    width: '450',
    quantity: 1,
    rotateAllowed: true,
    edgeBanding: { top: false, bottom: false, left: false, right: false }
  });

  const handleOpenQuickEdit = (piece: CutPiece) => {
    setQuickEditPiece(piece);
    setQuickForm({
      name: piece.name,
      material: piece.material,
      length: toDisplay(piece.length).toString(),
      width: toDisplay(piece.width).toString(),
      quantity: piece.quantity,
      rotateAllowed: piece.rotateAllowed,
      edgeBanding: { ...piece.edgeBanding }
    });
  };

  const handleSaveQuickEditModal = () => {
    if (!quickEditPiece) return;
    const lenMM = toMM(Number(String(quickForm.length).replace(',', '.')));
    const widMM = toMM(Number(String(quickForm.width).replace(',', '.')));
    if (lenMM <= 0 || widMM <= 0 || !quickForm.name.trim()) {
      toast({ title: '⚠️ Preencha nome e medidas válidas', variant: 'destructive' });
      return;
    }
    const updated = pieces.map(p => p.id === quickEditPiece.id ? {
      ...p,
      name: quickForm.name.trim(),
      material: quickForm.material || p.material,
      length: lenMM,
      width: widMM,
      quantity: Math.max(1, quickForm.quantity),
      rotateAllowed: quickForm.rotateAllowed,
      edgeBanding: quickForm.edgeBanding
    } : p);
    savePieces(updated);
    setQuickEditPiece(null);
    toast({ title: `✅ Peça "${quickForm.name}" atualizada!` });
  };

  // Modal de Cadastro de Novo Cliente
  const [showNewClientModal, setShowNewClientModal] = useState<boolean>(false);
  const [newClientForm, setNewClientForm] = useState({
    name: '',
    phone: '',
    address: '',
    notes: ''
  });

  const handleRegisterNewClient = () => {
    if (!newClientForm.name.trim()) {
      toast({ title: '⚠️ Preencha o nome do cliente', variant: 'destructive' });
      return;
    }
    const client = {
      name: newClientForm.name.trim().toUpperCase(),
      phone: newClientForm.phone.trim(),
      address: newClientForm.address.trim()
    };
    const updated = [client, ...savedClients.filter(c => c.name.toUpperCase() !== client.name)];
    setSavedClients(updated);
    try {
      localStorage.setItem('sd_registered_clients_db', JSON.stringify(updated));
      localStorage.setItem(`sd_cutting_client_${activeFolderId || 'default'}`, JSON.stringify(client));
    } catch {}
    setClientData(client);

    // Se marcou para iniciar com plano limpo:
    if (newClientCleanPlan) {
      setPieces([]);
      try {
        localStorage.setItem(`sd_cutting_pieces_${activeFolderId || 'default'}`, JSON.stringify([]));
      } catch {}
      saveCustomOffsets({});
      setSelectedPlacedKey(null);
    }

    setShowNewClientModal(false);
    setNewClientForm({ name: '', phone: '', address: '', notes: '' });
    toast({ title: `🎉 Cliente "${client.name}" cadastrado e ativado!` });
  };

  // Salvar peças no localStorage
  const savePieces = (newPieces: CutPiece[]) => {
    setPieces(newPieces);
    localStorage.setItem(`sd_cutting_pieces_${activeFolderId || 'default'}`, JSON.stringify(newPieces));
  };

  // Limpar todas as peças do corte
  const handleClearAllPieces = () => {
    savePieces([]);
    saveCustomOffsets({});
    setSelectedPlacedKey(null);
    toast({ title: '🗑️ Plano de corte limpo!', description: 'Todas as peças foram removidas para iniciar um novo plano.' });
  };

  // Atualização rápida de quantidade de uma peça
  const handleUpdatePieceQty = (pieceId: string, deltaOrExact: number, isDelta = false) => {
    const updated = pieces.map(p => {
      if (p.id !== pieceId) return p;
      const newQ = isDelta ? Math.max(1, p.quantity + deltaOrExact) : Math.max(1, deltaOrExact);
      return { ...p, quantity: newQ };
    });
    savePieces(updated);
  };

  // Atualização direta de campos da peça (nome, medidas)
  const handleUpdatePieceField = (pieceId: string, field: keyof CutPiece, val: any) => {
    const updated = pieces.map(p => {
      if (p.id !== pieceId) return p;
      return { ...p, [field]: val };
    });
    savePieces(updated);
  };

  // Salvar Plano de Corte Completo Finalizado
  const handleSaveCuttingPlan = () => {
    if (pieces.length === 0) {
      toast({
        title: '⚠️ Plano vazio',
        description: 'Adicione pelo menos uma peça antes de salvar o plano de corte.',
        variant: 'destructive'
      });
      return;
    }

    const planId = `plan_${Date.now()}`;
    const clientName = (clientData.name || activeFolderName || 'CLIENTE').trim().toUpperCase();
    const totalCuts = pieces.reduce((s, p) => s + (Number(p.quantity) || 1), 0);
    const totalAreaM2 = pieces.reduce((s, p) => s + ((p.length * p.width * (Number(p.quantity) || 1)) / 1_000_000), 0).toFixed(2);
    const totalEff = optimizedSheets.reduce((sum, s) => sum + s.efficiencyPercent, 0);
    const avgEff = optimizedSheets.length > 0 ? Math.round(totalEff / optimizedSheets.length) : 0;

    const planRecord = {
      id: planId,
      clientName,
      clientPhone: clientData.phone || '',
      clientAddress: clientData.address || '',
      createdAt: new Date().toISOString(),
      dateFormatted: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      pieces: JSON.parse(JSON.stringify(pieces)),
      sheetConfig: { ...sheetConfig },
      totalPieces: totalCuts,
      totalItems: pieces.length,
      totalSheets: optimizedSheets.length,
      totalAreaM2,
      efficiencyPercent: avgEff
    };

    try {
      const existingPlansRaw = localStorage.getItem('sd_saved_cutting_plans');
      const existingPlans = existingPlansRaw ? JSON.parse(existingPlansRaw) : [];
      const updatedPlans = [planRecord, ...existingPlans.filter((p: any) => p.id !== planId)];
      localStorage.setItem('sd_saved_cutting_plans', JSON.stringify(updatedPlans));

      localStorage.setItem(`sd_cutting_pieces_${activeFolderId || 'default'}`, JSON.stringify(pieces));
      localStorage.setItem(`sd_cutting_client_${activeFolderId || 'default'}`, JSON.stringify(clientData));
    } catch (e) {
      console.error(e);
    }

    setLastSavedPlanSummary(planRecord);
    setShowSavePlanSuccessModal(true);

    toast({
      title: '💾 Plano de Corte Salvo!',
      description: `Cliente "${clientName}": ${totalCuts} peças em ${optimizedSheets.length} chapas salvas com sucesso!`
    });
  };

  // Carregar um plano salvo anteriormente
  const handleLoadSavedPlan = (plan: any) => {
    if (!plan || !Array.isArray(plan.pieces)) return;
    savePieces(plan.pieces);
    if (plan.sheetConfig) {
      setSheetConfig(plan.sheetConfig);
      try {
        localStorage.setItem(`sd_cutting_sheet_${activeFolderId || 'default'}`, JSON.stringify(plan.sheetConfig));
      } catch {}
    }
    if (plan.clientName) {
      const client = {
        name: plan.clientName,
        phone: plan.clientPhone || '',
        address: plan.clientAddress || ''
      };
      setClientData(client);
      try {
        localStorage.setItem(`sd_cutting_client_${activeFolderId || 'default'}`, JSON.stringify(client));
      } catch {}
    }
    saveCustomOffsets({});
    setSelectedPlacedKey(null);
    setShowSavedPlansModal(false);
    toast({
      title: '📂 Plano Carregado!',
      description: `Plano de corte de "${plan.clientName}" carregado (${plan.totalPieces} peças).`
    });
  };

  // Excluir um plano salvo do histórico
  const handleDeleteSavedPlan = (planId: string) => {
    try {
      const existingPlansRaw = localStorage.getItem('sd_saved_cutting_plans');
      if (existingPlansRaw) {
        const existingPlans = JSON.parse(existingPlansRaw);
        const filtered = existingPlans.filter((p: any) => p.id !== planId);
        localStorage.setItem('sd_saved_cutting_plans', JSON.stringify(filtered));
        toast({ title: '🗑️ Plano excluído do histórico' });
      }
    } catch {}
  };

  // Materiais únicos presentes nas peças
  const uniqueMaterials = useMemo(() => {
    const mats = new Set(pieces.map(p => p.material));
    return Array.from(mats);
  }, [pieces]);

  // ─── ALGORITMO DE OTIMIZAÇÃO 2D GUILHOTINA / SHELF PACKING (MULTI-ESTRATÉGIAS) ───
  const optimizedSheets = useMemo<OptimizedSheet[]>(() => {
    const materialsToProcess = selectedMaterialFilter === 'all' 
      ? uniqueMaterials 
      : [selectedMaterialFilter];

    const allSheets: OptimizedSheet[] = [];
    let globalSheetCount = 1;

    materialsToProcess.forEach(mat => {
      const pieceItems: PiecePoolItem[] = [];
      pieces
        .filter(p => p.material === mat)
        .forEach(p => {
          for (let q = 0; q < p.quantity; q++) {
            pieceItems.push({
              id: `${p.id}-${q}`,
              piece: p,
              pIndex: q + 1,
              len: p.length,
              wid: p.width
            });
          }
        });

      if (pieceItems.length > 0) {
        const matSheets = optimizeMaterialSheets(pieceItems, sheetConfig, mat);
        matSheets.forEach(s => {
          allSheets.push({
            ...s,
            sheetIndex: globalSheetCount++
          });
        });
      }
    });

    return allSheets;
  }, [pieces, sheetConfig, selectedMaterialFilter, uniqueMaterials, optimizeSeed]);

  // Totais e Métricas
  const totalPiecesCount = useMemo(() => pieces.reduce((acc, p) => acc + p.quantity, 0), [pieces]);
  const totalSheetsNeeded = optimizedSheets.length;

  const totalEdgeBandingMeters = useMemo(() => {
    let meters = 0;
    pieces.forEach(p => {
      const lenM = p.length / 1000;
      const widM = p.width / 1000;
      let edges = 0;
      if (p.edgeBanding.top) edges += lenM;
      if (p.edgeBanding.bottom) edges += lenM;
      if (p.edgeBanding.left) edges += widM;
      if (p.edgeBanding.right) edges += widM;
      meters += edges * p.quantity;
    });
    return Math.round(meters * 10) / 10;
  }, [pieces]);

  const avgEfficiency = useMemo(() => {
    if (optimizedSheets.length === 0) return 0;
    const totalEff = optimizedSheets.reduce((acc, s) => acc + s.efficiencyPercent, 0);
    return Math.round(totalEff / optimizedSheets.length);
  }, [optimizedSheets]);

  // Manipulação de Peças
  const handleSavePiece = () => {
    if (!formName.trim() || !formLength || !formWidth) {
      toast({ title: '⚠️ Preencha o nome e medidas da peça', variant: 'destructive' });
      return;
    }

    const lengthMM = toMM(Number(formLength.replace(',', '.')));
    const widthMM = toMM(Number(formWidth.replace(',', '.')));

    if (lengthMM <= 0 || widthMM <= 0) {
      toast({ title: '⚠️ Medidas inválidas', variant: 'destructive' });
      return;
    }

    if (editingPieceId) {
      const updated = pieces.map(p => p.id === editingPieceId ? {
        ...p,
        name: formName.trim(),
        material: formMaterial,
        length: lengthMM,
        width: widthMM,
        quantity: Math.max(1, formQuantity),
        rotateAllowed: formRotate,
        edgeBanding: formEdgeBanding
      } : p);
      savePieces(updated);
      toast({ title: '✅ Peça atualizada com sucesso!' });
      setEditingPieceId(null);
    } else {
      const newP: CutPiece = {
        id: Date.now().toString(),
        name: formName.trim(),
        material: formMaterial,
        length: lengthMM,
        width: widthMM,
        quantity: Math.max(1, formQuantity),
        rotateAllowed: formRotate,
        edgeBanding: formEdgeBanding
      };
      savePieces([newP, ...pieces]);
      toast({ title: '🚀 Peça adicionada ao plano de corte!' });
    }

    setFormName('');
    setFormLength(unit === 'm' ? '0.70' : unit === 'cm' ? '70' : '700');
    setFormWidth(unit === 'm' ? '0.45' : unit === 'cm' ? '45' : '450');
    setFormQuantity(1);
    setFormRotate(true);
    setFormEdgeBanding({ top: true, bottom: false, left: false, right: false });
  };

  const handleEditPiece = (p: CutPiece) => {
    setEditingPieceId(p.id);
    setShowAddPieceForm(true);
    setFormName(p.name);
    setFormMaterial(p.material);
    setFormLength(toDisplay(p.length).toString());
    setFormWidth(toDisplay(p.width).toString());
    setFormQuantity(p.quantity);
    setFormRotate(p.rotateAllowed);
    setFormEdgeBanding(p.edgeBanding);
  };

  const handleDeletePiece = (id: string) => {
    savePieces(pieces.filter(p => p.id !== id));
    toast({ title: '🗑️ Peça removida' });
  };

  const handleDuplicatePiece = (p: CutPiece) => {
    const dup: CutPiece = {
      ...p,
      id: Date.now().toString(),
      name: `${p.name} (Cópia)`
    };
    savePieces([dup, ...pieces]);
    toast({ title: '📋 Peça duplicada' });
  };

  // Girar peça diretamente (Inverter Comprimento e Largura na chapa)
  const handleRotatePieceDirectly = (pieceId: string) => {
    const updated = pieces.map(p => {
      if (p.id === pieceId) {
        return {
          ...p,
          length: p.width,
          width: p.length,
          edgeBanding: {
            top: p.edgeBanding.left,
            bottom: p.edgeBanding.right,
            left: p.edgeBanding.bottom,
            right: p.edgeBanding.top,
          }
        };
      }
      return p;
    });
    savePieces(updated);
    toast({ title: '🔄 Peça girada em 90° com sucesso!' });
  };

  // Alternar permissão de giro livre no corte
  const handleToggleRotateAllowed = (pieceId: string) => {
    const updated = pieces.map(p => {
      if (p.id === pieceId) {
        return {
          ...p,
          rotateAllowed: !p.rotateAllowed
        };
      }
      return p;
    });
    savePieces(updated);
    toast({ title: '🔄 Permissão de rotação atualizada!' });
  };

  // Inverter Comprimento e Largura nos campos do formulário
  const handleSwapFormDimensions = () => {
    const tempL = formLength;
    const tempW = formWidth;
    setFormLength(tempW);
    setFormWidth(tempL);
    setFormEdgeBanding({
      top: formEdgeBanding.left,
      bottom: formEdgeBanding.right,
      left: formEdgeBanding.bottom,
      right: formEdgeBanding.top,
    });
    toast({ title: '🔄 Medidas invertidas no formulário (90°)' });
  };


  // Helper para sanitizar textos no PDF e evitar quebras de codificação WinAnsi / Latin-1 no jsPDF
  const cleanPdfText = (text: string | null | undefined): string => {
    if (!text) return '';
    return String(text)
      .replace(/[🔄🔁🔂]/g, ' (Giro)')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, '-')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\x20-\x7E]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // ─── GERAÇÃO DE PDF COMPLETO COM DESENHO GRÁFICO 2D DAS CHAPAS ─────────────
  const generateCuttingPlanPDF = (shouldDownload = true): jsPDF => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    try {
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const safeClientName = cleanPdfText(clientData.name || activeFolderName || 'GERAL').toUpperCase();
      const safeAddress = cleanPdfText(clientData.address || 'NAO INFORMADO').toUpperCase();

      if (optimizedSheets.length === 0) {
        doc.setFillColor(20, 24, 32);
        doc.rect(0, 0, pageWidth, 28, 'F');
        doc.setTextColor(245, 158, 11);
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('SDCOMPARATIVO - PLANO DE CORTE', 14, 12);
        doc.setTextColor(150, 150, 150);
        doc.setFontSize(11);
        doc.text('Nenhuma peca organizada ainda. Clique em "Organizar Pecas" no sistema.', 14, 45);
      } else {
        // ── PÁGINA 1: CABEÇALHO & LISTA DE CHAPAS COM DESENHO 2D ──
        optimizedSheets.forEach((sheet, sIdx) => {
          if (sIdx > 0) doc.addPage('a4', 'landscape');

          // Top Bar Elegante
          doc.setFillColor(20, 24, 32);
          doc.rect(0, 0, pageWidth, 28, 'F');

          doc.setTextColor(245, 158, 11);
          doc.setFontSize(16);
          doc.setFont('helvetica', 'bold');
          doc.text('SDCOMPARATIVO - PLANO DE CORTE & OTIMIZACAO 2D', 14, 12);

          doc.setTextColor(200, 200, 200);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.text(`Cliente: ${safeClientName}   |   Endereco: ${safeAddress}   |   Data: ${new Date().toLocaleDateString('pt-BR')}   |   Chapa ${sIdx + 1} de ${optimizedSheets.length}`, 14, 19);

          doc.setTextColor(52, 211, 153);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(`Aproveitamento: ${sheet.efficiencyPercent}% (${sheet.pieces.length} pecas)`, pageWidth - 14, 15, { align: 'right' });

          // Dados Técnicos da Chapa
          doc.setTextColor(40, 40, 40);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          const safeMaterial = cleanPdfText(sheet.material || 'MDF');
          doc.text(`Material: ${safeMaterial}   |   Dimensao Chapa: ${sheetConfig.length} x ${sheetConfig.width} mm   |   Refilo: ${sheetConfig.trimMargin}mm   |   Serra: ${sheetConfig.bladeKerf}mm`, 14, 34);

          // ── DESENHO GRÁFICO VETORIAL DA CHAPA 2D ──
          const mapX = 14;
          const mapY = 38;
          const maxDrawW = pageWidth - 28; // ~269mm
          const maxDrawH = pageHeight - 55; // ~145mm

          const scaleX = maxDrawW / sheetConfig.length;
          const scaleY = maxDrawH / sheetConfig.width;
          const scale = Math.min(scaleX, scaleY);

          const drawW = sheetConfig.length * scale;
          const drawH = sheetConfig.width * scale;

          // Fundo da Chapa MDF
          doc.setFillColor(240, 237, 228);
          doc.setDrawColor(217, 119, 6);
          doc.setLineWidth(0.8);
          doc.rect(mapX, mapY, drawW, drawH, 'FD');

          // Linha de Refilo (Tracejada)
          const trimW = (sheetConfig.length - sheetConfig.trimMargin * 2) * scale;
          const trimH = (sheetConfig.width - sheetConfig.trimMargin * 2) * scale;
          const trimX = mapX + (sheetConfig.trimMargin * scale);
          const trimY = mapY + (sheetConfig.trimMargin * scale);
          doc.setDrawColor(239, 68, 68);
          doc.setLineWidth(0.3);
          doc.setLineDashPattern([2, 1.5], 0);
          doc.rect(trimX, trimY, trimW, trimH, 'D');
          doc.setLineDashPattern([], 0); // Reset dash

          // Desenhar Peças Posicionadas
          sheet.pieces.forEach((p, pIdx) => {
            const px = mapX + (p.x * scale);
            const py = mapY + (p.y * scale);
            const pw = p.w * scale;
            const ph = p.h * scale;

            // Fundo da Peça
            const colors = [
              [226, 232, 240], [219, 234, 254], [220, 252, 231], 
              [254, 243, 199], [243, 232, 255], [255, 237, 213]
            ];
            const col = colors[pIdx % colors.length];
            doc.setFillColor(col[0], col[1], col[2]);
            doc.setDrawColor(30, 41, 59);
            doc.setLineWidth(0.4);
            doc.rect(px, py, pw, ph, 'FD');

            // Borda de Fita
            doc.setDrawColor(180, 83, 9);
            doc.setLineWidth(0.8);
            if (p.piece?.edgeBanding?.top) doc.line(px, py, px + pw, py);
            if (p.piece?.edgeBanding?.bottom) doc.line(px, py + ph, px + pw, py + ph);
            if (p.piece?.edgeBanding?.left) doc.line(px, py, px, py + ph);
            if (p.piece?.edgeBanding?.right) doc.line(px + pw, py, px + pw, py + ph);

            // Texto com Nome e Medidas
            if (pw > 15 && ph > 8) {
              doc.setTextColor(15, 23, 42);
              doc.setFont('helvetica', 'bold');
              doc.setFontSize(Math.max(6, Math.min(9, ph / 2.5)));
              
              const labelText = cleanPdfText(p.piece?.name || 'Peca').substring(0, 18);
              const dimText = `${p.w} x ${p.h} mm${p.rotated ? ' (Giro)' : ''}`;

              doc.text(labelText, px + (pw / 2), py + (ph / 2) - 1, { align: 'center' });
              doc.setFontSize(Math.max(5, Math.min(7.5, ph / 3)));
              doc.setTextColor(71, 85, 105);
              doc.text(dimText, px + (pw / 2), py + (ph / 2) + 3, { align: 'center' });
            }
          });

          // Rodapé
          doc.setTextColor(120, 120, 120);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'italic');
          doc.text('SDcomparativo (c) 2026 - Modulo de Otimizacao e Corte Inteligente de MDF', pageWidth / 2, pageHeight - 4, { align: 'center' });
        });
      }

      // ── PÁGINA FINAL: TABELA COMPLETA DE PEÇAS & FITA DE BORDA ──
      doc.addPage('a4', 'landscape');
      doc.setFillColor(20, 24, 32);
      doc.rect(0, 0, pageWidth, 24, 'F');
      doc.setTextColor(245, 158, 11);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('LISTA COMPLETA DE PECAS & FITAS DE BORDA', 14, 11);
      doc.setTextColor(200, 200, 200);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total de Pecas: ${totalPiecesCount} un | Total de Chapas: ${totalSheetsNeeded} un | Fita de Borda Total: ${totalEdgeBandingMeters} metros`, 14, 18);

      // Tabela Cabeçalho
      let tableY = 32;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, tableY, pageWidth - 28, 8, 'F');
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('#', 17, tableY + 5.5);
      doc.text('Nome da Peca', 26, tableY + 5.5);
      doc.text('Material / MDF', 95, tableY + 5.5);
      doc.text('Comprimento (mm)', 160, tableY + 5.5);
      doc.text('Largura (mm)', 195, tableY + 5.5);
      doc.text('Qtd', 225, tableY + 5.5);
      doc.text('Fita Borda', 242, tableY + 5.5);
      doc.text('Giro', 270, tableY + 5.5);

      tableY += 8;
      pieces.forEach((p, idx) => {
        if (tableY > pageHeight - 15) {
          doc.addPage('a4', 'landscape');
          tableY = 20;
        }
        doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
        doc.rect(14, tableY, pageWidth - 28, 6.5, 'F');

        const fita = [
          p.edgeBanding?.top ? 'C1' : '',
          p.edgeBanding?.bottom ? 'C2' : '',
          p.edgeBanding?.left ? 'L1' : '',
          p.edgeBanding?.right ? 'L2' : '',
        ].filter(Boolean).join(', ') || '-';

        doc.setTextColor(51, 65, 85);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(String(idx + 1), 17, tableY + 4.5);
        doc.setFont('helvetica', 'bold');
        doc.text(cleanPdfText(p.name).substring(0, 35), 26, tableY + 4.5);
        doc.setFont('helvetica', 'normal');
        doc.text(cleanPdfText(p.material).substring(0, 30), 95, tableY + 4.5);
        doc.text(`${p.length} mm`, 160, tableY + 4.5);
        doc.text(`${p.width} mm`, 195, tableY + 4.5);
        doc.setFont('helvetica', 'bold');
        doc.text(`${p.quantity} un`, 225, tableY + 4.5);
        doc.setFont('helvetica', 'normal');
        doc.text(fita, 242, tableY + 4.5);
        doc.text(p.rotateAllowed ? 'Sim' : 'Fixo', 270, tableY + 4.5);

        tableY += 6.5;
      });

      if (shouldDownload) {
        const safeFolder = cleanPdfText(activeFolderName).replace(/\s+/g, '_') || 'SDcomparativo';
        const fileName = `Plano_de_Corte_2D_${safeFolder}.pdf`;
        doc.save(fileName);
      }
    } catch (err) {
      console.error('Erro na geracao do PDF:', err);
    }

    return doc;
  };

  // ─── GERAR IMAGEM GRÁFICA PNG DAS CHAPAS 2D PARA ENVIO VISUAL DIRETO ────
  const generateSheetImageBlob = async (): Promise<Blob | null> => {
    try {
      const sheetsToDraw = optimizedSheets.length > 0 ? optimizedSheets : [];
      if (sheetsToDraw.length === 0) return null;

      const scale = 0.5;
      const sheetW = sheetConfig.length * scale;
      const sheetH = sheetConfig.width * scale;
      const pad = 30;
      const headerH = 90;
      const footerH = 40;

      const totalH = (sheetsToDraw.length * (sheetH + pad + 50)) + headerH + footerH;
      const totalW = sheetW + (pad * 2);

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(totalW);
      canvas.height = Math.round(totalH);
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Fundo escuro elegante
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Cabeçalho Principal
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 26px sans-serif';
      ctx.fillText('SDCOMPARATIVO - PLANO DE CORTE & OTIMIZAÇÃO 2D', pad, 45);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '16px sans-serif';
      const safeClient = (clientData.name || activeFolderName || 'GERAL').toUpperCase();
      ctx.fillText(`Cliente: ${safeClient} | Chapas: ${sheetsToDraw.length} un | Aproveitamento Geral: ${avgEfficiency}%`, pad, 75);

      let currentY = headerH;
      const colors = ['#e2e8f0', '#dbeafe', '#dcfce7', '#fef3c7', '#f3e8ff', '#ffedd5'];

      sheetsToDraw.forEach((sheet, sIdx) => {
        // Título da Chapa
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(`CHAPA ${sIdx + 1} DE ${sheetsToDraw.length} (${sheet.material}) - Aproveitamento: ${sheet.efficiencyPercent}% (${sheet.pieces.length} peças)`, pad, currentY + 25);

        const mapY = currentY + 35;

        // Fundo da Chapa MDF
        ctx.fillStyle = '#f5ede0';
        ctx.fillRect(pad, mapY, sheetW, sheetH);
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 3;
        ctx.strokeRect(pad, mapY, sheetW, sheetH);

        // Linha de refilo tracejada
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(
          pad + (sheetConfig.trimMargin * scale),
          mapY + (sheetConfig.trimMargin * scale),
          (sheetConfig.length - sheetConfig.trimMargin * 2) * scale,
          (sheetConfig.width - sheetConfig.trimMargin * 2) * scale
        );
        ctx.setLineDash([]);

        // Peças
        sheet.pieces.forEach((p, pIdx) => {
          const px = pad + (p.x * scale);
          const py = mapY + (p.y * scale);
          const pw = p.w * scale;
          const ph = p.h * scale;

          ctx.fillStyle = colors[pIdx % colors.length];
          ctx.fillRect(px, py, pw, ph);

          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(px, py, pw, ph);

          // Borda de Fita
          ctx.strokeStyle = '#b45309';
          ctx.lineWidth = 3.5;
          if (p.piece?.edgeBanding?.top) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + pw, py); ctx.stroke(); }
          if (p.piece?.edgeBanding?.bottom) { ctx.beginPath(); ctx.moveTo(px, py + ph); ctx.lineTo(px + pw, py + ph); ctx.stroke(); }
          if (p.piece?.edgeBanding?.left) { ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py + ph); ctx.stroke(); }
          if (p.piece?.edgeBanding?.right) { ctx.beginPath(); ctx.moveTo(px + pw, py); ctx.lineTo(px + pw, py + ph); ctx.stroke(); }

          // Texto com Medida e Nome
          if (pw > 25 && ph > 15) {
            ctx.fillStyle = '#0f172a';
            ctx.font = `bold ${Math.max(10, Math.min(16, Math.round(ph / 3)))}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const name = (p.piece?.name || 'Peça').substring(0, 18);
            ctx.fillText(name, px + (pw / 2), py + (ph / 2) - 8);

            ctx.fillStyle = '#475569';
            ctx.font = `${Math.max(8, Math.min(13, Math.round(ph / 3.8)))}px sans-serif`;
            const dim = `${p.w} x ${p.h} mm${p.rotated ? ' (Giro)' : ''}`;
            ctx.fillText(dim, px + (pw / 2), py + (ph / 2) + 8);
          }
        });

        currentY = mapY + sheetH + pad;
      });

      return new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });
    } catch (e) {
      console.error('Erro ao gerar imagem gráfica:', e);
      return null;
    }
  };

  // ─── COMPARTILHAR ARQUIVO PDF NATIVAMENTE COM O WHATSAPP ───────────────────
  const handleShareNativePDF = async () => {
    try {
      const safeFolder = cleanPdfText(activeFolderName).replace(/\s+/g, '_') || 'SDcomparativo';
      const fileName = `Plano_de_Corte_2D_${safeFolder}.pdf`;
      const doc = generateCuttingPlanPDF(false);
      const pdfBlob = doc.output('blob');
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: fileName,
          files: [pdfFile]
        });
        toast({ title: '✅ PDF do Plano de Corte Enviado para o WhatsApp!' });
        setShowWhatsAppModal(false);
      } else {
        // Fallback: Baixa o PDF no dispositivo
        doc.save(fileName);
        toast({ 
          title: '✅ PDF Salvo nos seus Downloads!',
          description: 'Basta anexar o arquivo na conversa do WhatsApp.'
        });
        setShowWhatsAppModal(false);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error(err);
      }
    }
  };

  // ─── COMPARTILHAR IMAGEM / FOTO 2D NATIVAMENTE COM O WHATSAPP ─────────────
  const handleShareNativeImage = async () => {
    try {
      toast({ title: '🖼️ Gerando imagem visual do plano de corte...' });
      const imgBlob = await generateSheetImageBlob();
      if (!imgBlob) {
        toast({ title: 'Não foi possível gerar a imagem das chapas', variant: 'destructive' });
        return;
      }
      const safeFolder = cleanPdfText(activeFolderName).replace(/\s+/g, '_') || 'SDcomparativo';
      const fileName = `Plano_de_Corte_2D_${safeFolder}.png`;
      const imgFile = new File([imgBlob], fileName, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [imgFile] })) {
        await navigator.share({
          title: `Plano de Corte 2D - ${activeFolderName || 'SDcomparativo'}`,
          files: [imgFile]
        });
        toast({ title: '✅ Foto do Plano de Corte Enviada para o WhatsApp!' });
        setShowWhatsAppModal(false);
      } else {
        const url = URL.createObjectURL(imgBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: '✅ Imagem salva nos seus Downloads!' });
        setShowWhatsAppModal(false);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error(err);
      }
    }
  };

  // ─── ENVIO DO PDF PARA NÚMERO / FORNECEDOR ESPECÍFICO ──────────────────────
  const handleDirectSendWhatsApp = async (customPhone?: string, recipientLabel?: string) => {
    try {
      const safeFolder = cleanPdfText(activeFolderName).replace(/\s+/g, '_') || 'SDcomparativo';
      const fileName = `Plano_de_Corte_2D_${safeFolder}.pdf`;
      const doc = generateCuttingPlanPDF(false);
      const pdfBlob = doc.output('blob');
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // No mobile, se o navegador puder compartilhar arquivos nativamente, usa navigator.share para enviar o PDF direto!
      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        setShowWhatsAppModal(false);
        await navigator.share({
          title: fileName,
          files: [pdfFile]
        });
        toast({ title: '✅ PDF enviado para o WhatsApp!' });
        return;
      }

      // Fallback para quando o compartilhamento de arquivos não é permitido pelo navegador (ex: Desktop):
      doc.save(fileName);
      setShowWhatsAppModal(false);

      const rawPhone = customPhone !== undefined && customPhone !== '' ? customPhone : targetWhatsAppPhone;
      let cleanPhone = rawPhone ? rawPhone.replace(/\D/g, '') : '';
      if (cleanPhone.length >= 10 && cleanPhone.length <= 11 && !cleanPhone.startsWith('55')) {
        cleanPhone = '55' + cleanPhone;
      }

      const shortMsg = `📐 *Plano de Corte 2D - ${activeFolderName || 'SDcomparativo'}*\n📎 O arquivo PDF com os desenhos das chapas foi gerado em anexo.`;
      const url = cleanPhone
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(shortMsg)}`
        : `https://api.whatsapp.com/send?text=${encodeURIComponent(shortMsg)}`;

      const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.href = url;
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }

      toast({ 
        title: `🚀 Abrindo WhatsApp...`,
        description: `O arquivo PDF "${fileName}" foi gerado em Downloads.`
      });
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Erro ao enviar WhatsApp:', err);
      }
    }
  };

  const handleSendWhatsAppWithPDF = () => {
    setShowWhatsAppModal(true);
  };
  const handleSendWhatsAppWithPDF_DIRECT = () => {
    toast({ title: '📄 Gerando PDF do Plano de Corte...' });
    generateCuttingPlanPDF(true);

    let msg = `📐 *PLANO DE CORTE & OTIMIZAÇÃO 2D - ${activeFolderName ? `PASTA ${activeFolderName.toUpperCase()}` : 'SD COMPARATIVO'}*

`;
    msg += `📦 *Total de Chapas:* ${totalSheetsNeeded} un (${sheetConfig.length}x${sheetConfig.width}mm)
`;
    msg += `🎯 *Aproveitamento Médio:* ${avgEfficiency}%
`;
    msg += `📏 *Fita de Borda Total:* ${totalEdgeBandingMeters} metros lineares
`;
    msg += `✂️ *Total de Cortes:* ${totalPiecesCount} peças

`;
    msg += `📋 *LISTAGEM DE PEÇAS A CORTAR:*
`;

    pieces.forEach((p, idx) => {
      const fita = [
        p.edgeBanding.top ? 'C1' : '',
        p.edgeBanding.bottom ? 'C2' : '',
        p.edgeBanding.left ? 'L1' : '',
        p.edgeBanding.right ? 'L2' : '',
      ].filter(Boolean).join(',');

      msg += `${idx + 1}. *${p.name}* (${p.material})
`;
      msg += `   ${toDisplay(p.length)} x ${toDisplay(p.width)} ${unitLabel} | Qtd: ${p.quantity} un`;
      if (fita) msg += ` | Fita: [${fita}]`;
      msg += '\n';
    });

    msg += `
📎 *PDF Gráfico com o Desenho 2D de todas as chapas foi baixado no seu dispositivo! Anexe-o nesta conversa.* 📄
`;
    msg += `
✨ _Gerado via SDcomparativo - Otimizador Inteligente_`;

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    toast({ title: '✅ PDF Baixado e WhatsApp Aberto!' });
  };

  const handleSendWhatsAppPlan_OLD = () => {
    let msg = `📐 *PLANO DE CORTE - ${activeFolderName ? `PASTA ${activeFolderName}` : 'SD COMPARATIVO'}*\n\n`;
    msg += `📦 *Total de Chapas:* ${totalSheetsNeeded} un (${sheetConfig.length}x${sheetConfig.width}mm)\n`;
    msg += `🎯 *Aproveitamento Médio:* ${avgEfficiency}%\n`;
    msg += `📏 *Fita de Borda Total:* ${totalEdgeBandingMeters} metros lineares\n\n`;
    msg += `📋 *LISTAGEM DE PEÇAS A CORTAR (${totalPiecesCount} un):*\n`;

    pieces.forEach((p, idx) => {
      const fita = [
        p.edgeBanding.top ? 'C1' : '',
        p.edgeBanding.bottom ? 'C2' : '',
        p.edgeBanding.left ? 'L1' : '',
        p.edgeBanding.right ? 'L2' : '',
      ].filter(Boolean).join(',');

      msg += `${idx + 1}. *${p.name}* (${p.material})\n`;
      msg += `   Medida: ${toDisplay(p.length)} x ${toDisplay(p.width)} ${unitLabel} | Qtd: ${p.quantity} un\n`;
      if (fita) msg += `   Fita de Borda: [${fita}]\n`;
    });

    msg += `\n✨ _Gerado via SDcomparativo - Módulo de Otimização de Corte_`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const currentActiveSheet = optimizedSheets[selectedSheetView] || optimizedSheets[0] || null;

  return (
    <div className="space-y-6">

      {/* Inputs Globais Ocultos para Foto, Câmera e PDF — SEMPRE MONTADOS NO DOM */}
      <input
        id="cutting-camera-input"
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoUpload}
      />
      <input
        id="cutting-gallery-input"
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoUpload}
      />
      <input
        id="cutting-pdf-input"
        ref={pdfInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handlePdfUpload}
      />

      {/* ─── CABEÇALHO COMPACTO DO PLANO DE CORTE ──────────────── */}
      <div className="bg-gradient-to-r from-[#14171d] via-[#111317] to-[#14171d] border border-white/10 p-4 rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-md">
            <Scissors className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-black text-white tracking-wide">
                Otimizador &amp; Plano de Corte 2D
              </h2>
              <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-xl text-xs font-black uppercase flex items-center gap-1.5">
                <Folder className="w-3.5 h-3.5 text-amber-400" /> Pasta / Cliente: {clientData.name || activeFolderName}
              </span>
              <button
                type="button"
                onClick={() => setShowNewClientModal(true)}
                className="bg-amber-500 hover:bg-amber-400 text-black font-black px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 hover:scale-[1.02]"
                title="Cadastrar novo cliente e iniciar plano"
              >
                <User className="w-3.5 h-3.5" />
                <span>+ Cadastrar Cliente</span>
              </button>
              <button
                type="button"
                onClick={() => setShowSavedPlansModal(true)}
                className="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 border border-white/10 shadow transition-all active:scale-95"
                title="Ver planos de corte salvos anteriormente"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>Planos Salvos</span>
              </button>
            </div>
            <p className="text-gray-400 text-xs mt-0.5">
              Otimização de corte guilhotina de MDF/MDP, mapa visual das chapas e cálculo de fita de borda
            </p>
          </div>
        </div>
      </div>

      {/* ─── CARD UNIFICADO: ADICIONAR PEÇA AO PLANO DE CORTE + BARRA DE AÇÕES ORGANIZADA (ESTILO IMAGEM 1) ─── */}
      <div className="bg-[#121418] border border-amber-500/25 p-4 sm:p-5 rounded-3xl shadow-2xl space-y-4">
        
        {/* CABEÇALHO DO CARD COM TODAS AS AÇÕES INTEGRADAS E ORGANIZADAS */}
        <div className="space-y-3.5 pb-2">
          {/* LINHA 1: BOTÃO (+) + TÍTULO + BOTÕES RÁPIDOS + BADGE QUANTIDADE DE PEÇAS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowAddPieceForm(prev => !prev)}
                className="w-10 h-10 rounded-full border-2 border-amber-500/60 bg-amber-500/10 hover:bg-amber-500/25 flex items-center justify-center text-amber-400 font-black text-2xl shrink-0 transition-transform active:scale-95 shadow"
                title={showAddPieceForm ? 'Recolher formulário de peça' : 'Expandir formulário para adicionar nova peça'}
              >
                {showAddPieceForm ? '−' : '+'}
              </button>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white leading-tight flex items-center gap-2">
                  {editingPieceId ? 'Editar Peça de Corte' : 'Adicionar Peça ao Plano de Corte'}
                </h3>
                {editingPieceId && (
                  <button
                    onClick={() => {
                      setEditingPieceId(null);
                      setFormName('');
                      setFormLength(unit === 'm' ? '0.70' : unit === 'cm' ? '70' : '700');
                      setFormWidth(unit === 'm' ? '0.45' : unit === 'cm' ? '45' : '450');
                      setFormQuantity(1);
                      setFormRotate(true);
                      setFormEdgeBanding({ top: true, bottom: false, left: false, right: false });
                    }}
                    className="text-xs text-red-400 hover:underline font-semibold"
                  >
                    (Cancelar Edição)
                  </button>
                )}
              </div>
            </div>

            {/* BADGE TOTAL DE PEÇAS (Estilo Imagem 1: Pílula redonda amarela escura com número e PEÇAS) */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="bg-[#241a08] border border-amber-500/50 rounded-2xl px-4 py-1.5 flex flex-col items-center justify-center min-w-[72px] shadow-inner">
                <span className="text-xl font-black text-amber-400 leading-none">
                  {pieces.reduce((sum, p) => sum + (Number(p.quantity) || 1), 0)}
                </span>
                <span className="text-[9px] font-black text-amber-400 tracking-wider">
                  PEÇAS
                </span>
                {pieces.length !== pieces.reduce((sum, p) => sum + (Number(p.quantity) || 1), 0) && (
                  <span className="text-[8px] text-amber-400/75 font-semibold leading-none mt-0.5">
                    ({pieces.length} itens)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* LINHA 2: SELETOR DE UNIDADE: MM, CM, MT (ESTILO PÍLULA IMAGEM 1) */}
          <div>
            <div className="inline-flex bg-[#101216] border border-amber-500/40 p-1 rounded-full items-center gap-1 shadow-inner">
              {(['mm', 'cm', 'm'] as DimensionUnit[]).map((u) => {
                const label = u === 'm' ? 'MT' : u.toUpperCase();
                const isSelected = unit === u;
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => {
                      setUnit(u);
                      toast({ title: `📏 Unidade alterada para ${label}` });
                    }}
                    className={`px-4 py-1 rounded-full text-xs font-black transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-black shadow-md'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* LINHA 3: BOTÕES DE AÇÃO EM PÍLULA (ESTILO EXATO DA IMAGEM 1 + NOVOS RECURSOS SOLICITADOS) */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5 items-stretch sm:items-center">
            {/* 1. 👤 + Cadastrar Cliente */}
            <button
              type="button"
              onClick={() => setShowNewClientModal(true)}
              className="bg-[#f59e0b] hover:bg-[#fbbf24] text-black font-black px-5 py-2.5 rounded-2xl sm:rounded-full text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.02] border border-amber-300/60"
              title="Cadastrar dados do cliente (Nome, WhatsApp, Endereço)"
            >
              <User className="w-4 h-4 text-black" />
              <span>+ Cadastrar Cliente</span>
            </button>

            {/* 2. ➕ Adicionar Peça */}
            <button
              type="button"
              onClick={() => {
                setShowAddPieceForm(true);
                setEditingPieceId(null);
              }}
              className="bg-[#2563eb] hover:bg-[#3b82f6] text-white font-black px-5 py-2.5 rounded-2xl sm:rounded-full text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.02] border border-blue-400/40"
              title="Adicionar nova peça com medidas, material e fita"
            >
              <Plus className="w-4 h-4" />
              <span>+ Adicionar Peça</span>
            </button>

            {/* 3. ✏️ Editar Peças */}
            <button
              type="button"
              onClick={() => setShowEditPiecesModal(true)}
              className="bg-[#7c3aed] hover:bg-[#8b5cf6] text-white font-black px-5 py-2.5 rounded-2xl sm:rounded-full text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.02] border border-purple-400/40"
              title="Visualizar e editar todas as peças cadastradas (medidas, nomes, quantidades e fitas)"
            >
              <Edit3 className="w-4 h-4" />
              <span>Editar Peças ({pieces.length})</span>
            </button>

            {/* 4. 💾 Salvar Plano de Corte */}
            <button
              type="button"
              onClick={handleSaveCuttingPlan}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-5 py-2.5 rounded-2xl sm:rounded-full text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.02] border border-emerald-300/50"
              title="Salvar este plano de corte com cliente e histórico"
            >
              <Save className="w-4 h-4 text-yellow-300" />
              <span>Salvar Plano de Corte</span>
            </button>


            {/* 2. 📷 📋 Peças do Caderno (Foto / PDF) */}
            <button
              type="button"
              onClick={() => setShowNotebookModal(true)}
              className="bg-[#f59e0b] hover:bg-[#fbbf24] text-black font-black px-5 py-2.5 rounded-2xl sm:rounded-full text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.02] border border-yellow-300/50"
              title="Tirar foto do caderno, ler arquivo PDF ou carregar peças"
            >
              <Camera className="w-4 h-4 text-black" />
              <span className="flex items-center gap-1">📋 Peças do Caderno (Foto / PDF)</span>
            </button>

            {/* 3. ⚙ Configurar Chapa */}
            <button
              onClick={handleOpenConfigModal}
              className="bg-[#1e232d] hover:bg-[#282f3d] text-gray-200 hover:text-white border border-white/15 px-5 py-2.5 rounded-2xl sm:rounded-full text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all shadow"
              title="Configurar dimensões da chapa, espessura da serra e refilo"
            >
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Configurar Chapa</span>
            </button>

            {/* 4. 💬 WhatsApp (c/ PDF e Desenho) v */}
            <div className="relative">
              <button
                onClick={() => setShowWhatsAppModal(!showWhatsAppModal)}
                className="w-full bg-[#059669] hover:bg-[#10b981] text-white font-black px-5 py-2.5 rounded-2xl sm:rounded-full text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.02] border border-emerald-400/40"
                title="Escolher fornecedor/contato e enviar pelo WhatsApp com PDF 2D"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp (c/ PDF e Desenho)</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${showWhatsAppModal ? 'rotate-180' : ''}`} />
              </button>

              {showWhatsAppModal && (
                <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-full sm:w-96 bg-[#161821] border-2 border-emerald-400/80 rounded-2xl shadow-2xl p-4 z-[9999] text-white space-y-3.5 animate-in fade-in zoom-in-95">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <span className="text-xs font-black text-emerald-400 flex items-center gap-1.5">
                      <MessageCircle className="w-4 h-4" /> Enviar PDF por WhatsApp
                    </span>
                    <button 
                      onClick={() => setShowWhatsAppModal(false)}
                      className="text-gray-400 hover:text-white text-xs p-1"
                    >
                      ✕
                    </button>
                  </div>

                  {/* 1. OPÇÃO PRINCIPAL DE ENVIO (PDF NATIVO) */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleShareNativePDF}
                      className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:brightness-110 text-white font-black py-3 px-4 rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-xl transition-all active:scale-95 border border-emerald-300/50"
                    >
                      <Share2 className="w-4 h-4 text-emerald-100 shrink-0" />
                      <span>📄 Enviar Arquivo PDF no WhatsApp</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex-1 h-px bg-white/15" />
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Ou Enviar para Número</span>
                    <div className="flex-1 h-px bg-white/15" />
                  </div>

                  {/* 2. ENVIAR PARA NÚMERO DIGITADO */}
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-2.5 rounded-xl space-y-1.5">
                    <div className="text-[10px] font-black text-emerald-300 uppercase flex items-center gap-1">
                      📱 Digite o Número do WhatsApp (DDD + Tel):
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={targetWhatsAppPhone}
                        onChange={(e) => setTargetWhatsAppPhone(e.target.value)}
                        placeholder="Ex: 85997682237"
                        className="w-full bg-[#101216] border border-emerald-500/40 rounded-xl px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono font-bold"
                      />
                      <button
                        onClick={() => handleDirectSendWhatsApp(targetWhatsAppPhone, 'Contato Digitado')}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-3.5 py-1.5 rounded-xl text-xs shrink-0 transition-all flex items-center gap-1 shadow-md active:scale-95"
                        title="Enviar Plano de Corte Completo em PDF para este número"
                      >
                        <Send className="w-3 h-3" />
                        <span>Enviar</span>
                      </button>
                    </div>
                  </div>

                  {/* 3. CADA FORNECEDOR COM OPÇÃO DE DIGITAR CONTATO */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold text-gray-400 uppercase">🏢 Contatos dos Fornecedores:</div>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {((suppliers && suppliers.length > 0) ? suppliers : [
                        { id: 'flg', name: 'FLG', phone: '11999999999' },
                        { id: 'gmad', name: 'GMAD', phone: '11988888888' },
                        { id: 'itaipu', name: 'ITAIPU', phone: '11977777777' },
                        { id: 'rio_branco', name: 'RIO BRANCO', phone: '11966666666' },
                      ])
                        .filter(Boolean)
                        .map((sup) => {
                          const supName = sup?.name || 'Fornecedor';
                          const currentPhone = (supplierPhones && typeof supplierPhones === 'object' && supplierPhones[supName]) 
                            ? supplierPhones[supName] 
                            : (sup?.phone || '');
                          return (
                            <div key={sup?.id || supName} className="bg-white/5 border border-white/10 hover:border-emerald-500/40 p-2 rounded-xl transition-all space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-white">🏢 {supName}</span>
                                <span className="text-[9px] text-gray-400">Tel / WhatsApp:</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={currentPhone}
                                  onChange={(e) => handleUpdateSupplierPhone(supName, e.target.value)}
                                  placeholder="DDD + Número (ex: 85997682237)"
                                  className="w-full bg-[#101216] border border-white/15 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono"
                                />
                                <button
                                  onClick={() => handleDirectSendWhatsApp(currentPhone, supName)}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-2.5 py-1 rounded-lg text-xs shrink-0 flex items-center gap-1 transition-all"
                                  title={`Enviar PDF diretamente para ${supName}`}
                                >
                                  <Send className="w-3 h-3" />
                                  <span>Enviar</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* 3. CLIENTE DA PASTA ATIVA */}
                  <div className="pt-1 border-t border-white/10">
                    <button
                      onClick={() => handleDirectSendWhatsApp('', `Cliente ${activeFolderName}`)}
                      className="w-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 p-2 rounded-xl flex items-center justify-between text-left transition-all text-amber-300"
                    >
                      <div className="flex items-center gap-1.5 text-xs font-black">
                        <Folder className="w-3.5 h-3.5" /> Pasta {activeFolderName}
                      </div>
                      <span className="text-[10px] font-bold">Enviar Direto 🚀</span>
                    </button>
                  </div>

                  <button
                    onClick={() => handleDirectSendWhatsApp('', 'WhatsApp Geral')}
                    className="w-full text-center text-[10px] text-gray-400 hover:text-emerald-400 pt-1 block transition-colors"
                  >
                    Abrir WhatsApp sem número definido →
                  </button>
                </div>
              )}
            </div>

            {/* 5. 📥 Baixar PDF Gráfico */}
            <button
              onClick={() => generateCuttingPlanPDF(true)}
              className="bg-[#8b5cf6] hover:bg-[#a78bfa] text-white font-black px-5 py-2.5 rounded-2xl sm:rounded-full text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.02]"
              title="Baixar PDF com todos os desenhos gráficos 2D das chapas e lista"
            >
              <Download className="w-4 h-4" />
              <span>Baixar PDF Gráfico</span>
            </button>

            {/* 6. 🖨 Imprimir Plano */}
            <button
              onClick={() => window.print()}
              className="bg-[#d97706] hover:bg-[#f59e0b] text-black font-black px-5 py-2.5 rounded-2xl sm:rounded-full text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all hover:scale-[1.02]"
              title="Imprimir plano de corte detalhado com mapas das chapas"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Plano</span>
            </button>
          </div>
        </div>

        {/* SEÇÃO EXPANSÍVEL: FORMULÁRIO DE ADICIONAR / EDITAR PEÇA E DADOS DO CLIENTE */}
        {(showAddPieceForm || editingPieceId) && (
          <div className="pt-4 border-t border-white/10 space-y-4 animate-in fade-in slide-in-from-top-2">
            {/* ─── SEÇÃO DE CADASTRO E BUSCA DO CLIENTE (NOME, ENDEREÇO E CONTATO) ─── */}
        <div className="bg-[#151821] border border-amber-500/30 p-4 rounded-2xl space-y-3 shadow-inner">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <User className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <span className="text-xs font-black text-amber-300 uppercase tracking-wider block">
                  Identificação do Cliente &amp; Local da Entrega
                </span>
                <span className="text-[10px] text-gray-400">
                  Dados impressos no PDF oficial e enviados no WhatsApp
                </span>
              </div>
            </div>

            {/* BOTÃO CADASTRAR NOVO CLIENTE */}
            <button
              type="button"
              onClick={() => setShowNewClientModal(true)}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all hover:scale-[1.02] shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Cadastrar Novo Cliente</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
            {/* 1. Busca de Cliente com Autocomplete */}
            <div className="sm:col-span-4 relative">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-amber-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={clientSearchQuery}
                  onChange={(e) => {
                    setClientSearchQuery(e.target.value);
                    setShowClientSearchDropdown(true);
                  }}
                  onFocus={() => setShowClientSearchDropdown(true)}
                  placeholder="🔍 Buscar Cliente Cadastrado..."
                  className="w-full bg-[#101216] border border-amber-500/40 rounded-xl pl-8 pr-2.5 py-2 text-xs text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                />
              </div>

              {showClientSearchDropdown && (
                <div className="absolute left-0 top-full mt-1.5 w-80 bg-[#161821] border-2 border-amber-500/50 rounded-xl shadow-2xl p-2 z-[9999] space-y-1 animate-in fade-in">
                  <div className="text-[10px] font-black text-amber-300 px-1 py-0.5 border-b border-white/10 flex justify-between items-center">
                    <span>👥 Clientes Cadastrados ({savedClients.length}):</span>
                    <button onClick={() => setShowClientSearchDropdown(false)} className="hover:text-white text-xs">✕</button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {savedClients
                      .filter(c => !clientSearchQuery || c.name.toLowerCase().includes(clientSearchQuery.toLowerCase()) || (c.address && c.address.toLowerCase().includes(clientSearchQuery.toLowerCase())) || (c.phone && c.phone.includes(clientSearchQuery)))
                      .map((c, i) => (
                        <button
                          key={i}
                          onClick={() => handleSelectClient(c)}
                          className="w-full text-left p-2 hover:bg-amber-500/20 rounded-lg transition-all group border border-transparent hover:border-amber-500/30"
                        >
                          <div className="text-xs font-black text-white group-hover:text-amber-300 truncate flex items-center justify-between">
                            <span>👤 {c.name}</span>
                            {c.phone && <span className="text-[10px] text-emerald-400 font-mono">📱 {c.phone}</span>}
                          </div>
                          {c.address && <div className="text-[10px] text-gray-400 truncate mt-0.5">📍 {c.address}</div>}
                        </button>
                      ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowClientSearchDropdown(false);
                      setShowNewClientModal(true);
                    }}
                    className="w-full text-center py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-[11px] rounded-lg border border-amber-500/30 transition-all block mt-1"
                  >
                    + Cadastrar Novo Cliente Agora
                  </button>
                </div>
              )}
            </div>

            {/* 2. Nome do Cliente */}
            <div className="sm:col-span-3">
              <input
                type="text"
                value={clientData.name}
                onChange={(e) => handleUpdateClientField('name', e.target.value)}
                placeholder="Nome do Cliente (Ex: Davi Silva)"
                className="w-full bg-[#101216] border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500 font-bold"
              />
            </div>

            {/* 3. Endereço do Cliente */}
            <div className="sm:col-span-3">
              <input
                type="text"
                value={clientData.address}
                onChange={(e) => handleUpdateClientField('address', e.target.value)}
                placeholder="📍 Endereço / Local da Obra"
                className="w-full bg-[#101216] border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* 4. WhatsApp / Telefone */}
            <div className="sm:col-span-2">
              <input
                type="text"
                value={clientData.phone}
                onChange={(e) => handleUpdateClientField('phone', e.target.value)}
                placeholder="📱 WhatsApp"
                className="w-full bg-[#101216] border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono font-bold"
              />
            </div>
          </div>
        </div>

        {/* INPUTS DE MEDIDAS E QUANTIDADE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-gray-400 mb-1">Nome / Descrição da Peça</label>
            <input
              type="text"
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="Ex: Lateral Esquerda, Porta, Tampo..."
              className="w-full bg-[#181b22] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-1">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-bold text-gray-400">Material / MDF</label>
              <button
                type="button"
                onClick={() => setShowNewMaterialModal(true)}
                className="text-[10px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-0.5 hover:underline"
                title="Cadastrar outro padrão de MDF ou material personalizado"
              >
                <Plus className="w-3 h-3" /> Novo
              </button>
            </div>
            <div className="relative flex items-center">
              <select
                value={formMaterial}
                onChange={e => {
                  if (e.target.value === '__NEW_MATERIAL__') {
                    setShowNewMaterialModal(true);
                  } else {
                    setFormMaterial(e.target.value);
                  }
                }}
                className="w-full bg-[#181b22] border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold appearance-none pr-8 cursor-pointer"
              >
                {/* 1. Materiais das Peças & Cadastrados */}
                <optgroup label="⭐ Materiais em Uso no Projeto">
                  {uniqueMaterials.map(m => (
                    <option key={`u_${m}`} value={m}>{m}</option>
                  ))}
                  {customMaterials.filter(m => !uniqueMaterials.includes(m)).map(m => (
                    <option key={`c_${m}`} value={m}>{m}</option>
                  ))}
                </optgroup>

                {/* 2. Cotações da Pasta */}
                {availableMaterials.length > 0 && (
                  <optgroup label="📋 Cotações & Fornecedores">
                    {availableMaterials.filter(m => !uniqueMaterials.includes(m) && !customMaterials.includes(m)).map(m => (
                      <option key={`a_${m}`} value={m}>{m}</option>
                    ))}
                  </optgroup>
                )}

                {/* 3. Catálogo Padrão de MDF da Marcenaria */}
                <optgroup label="🪵 Catálogo Completo (Brancos, Madeirados & Unicolores)">
                  {POPULAR_MDF_MATERIALS.filter(m => !uniqueMaterials.includes(m) && !customMaterials.includes(m) && !availableMaterials.includes(m)).map(m => (
                    <option key={`pop_${m}`} value={m}>{m}</option>
                  ))}
                </optgroup>

                <option value="__NEW_MATERIAL__" className="text-amber-400 font-black bg-slate-900">
                  ➕ Digitar / Cadastrar Outro Material...
                </option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-amber-400/80 absolute right-2.5 pointer-events-none" />
            </div>
          </div>

          <div className="md:col-span-1">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-gray-400">Comprimento ({unitLabel})</label>
            </div>
            <input
              type="text"
              value={formLength}
              onChange={e => setFormLength(e.target.value)}
              placeholder={unit === 'm' ? 'Ex: 0.80' : unit === 'cm' ? 'Ex: 80' : 'Ex: 800'}
              className="w-full bg-[#181b22] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-1">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-bold text-gray-400">Largura ({unitLabel})</label>
            </div>
            <input
              type="text"
              value={formWidth}
              onChange={e => setFormWidth(e.target.value)}
              placeholder={unit === 'm' ? 'Ex: 0.45' : unit === 'cm' ? 'Ex: 45' : 'Ex: 450'}
              className="w-full bg-[#181b22] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-[11px] font-bold text-gray-400 mb-1">Quantidade</label>
            <input
              type="number"
              value={formQuantity}
              min="1"
              onChange={e => setFormQuantity(Number(e.target.value))}
              className="w-full bg-[#181b22] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Fita de Borda & Opções Avançadas */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2 border-t border-white/5">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[11px] font-bold text-gray-400">Fita de Borda:</span>
            {[
              { key: 'top', label: 'C1 (Topo)' },
              { key: 'bottom', label: 'C2 (Base)' },
              { key: 'left', label: 'L1 (Esq)' },
              { key: 'right', label: 'L2 (Dir)' },
            ].map(side => (
              <label key={side.key} className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer bg-white/5 px-2.5 py-1 rounded-lg hover:bg-white/10 transition-colors">
                <input
                  type="checkbox"
                  checked={Boolean((formEdgeBanding as any)?.[side.key])}
                  onChange={e => setFormEdgeBanding({
                    ...formEdgeBanding,
                    [side.key]: e.target.checked
                  })}
                  className="rounded text-amber-500 focus:ring-amber-400 w-3.5 h-3.5"
                />
                <span>{side.label}</span>
              </label>
            ))}

            <label className="flex items-center gap-1.5 text-xs text-amber-300 cursor-pointer bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-lg hover:bg-amber-500/20 transition-all">
              <input
                type="checkbox"
                checked={formRotate}
                onChange={e => setFormRotate(e.target.checked)}
                className="rounded text-amber-500 focus:ring-amber-400 w-3.5 h-3.5"
              />
              <span>Girar Peça (90°)</span>
            </label>

            <button
              type="button"
              onClick={handleSwapFormDimensions}
              className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg transition-all font-bold"
              title="Inverter Comprimento e Largura (Girar 90° agora)"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Inverter Medidas (90°)
            </button>
          </div>

          <button
            onClick={handleSavePiece}
            className="bg-amber-500 hover:bg-amber-400 text-black font-black px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{editingPieceId ? 'Atualizar Peça' : 'Adicionar ao Plano'}</span>
          </button>
        </div>
          </div>
        )}
      </div>

      {/* ─── VISUALIZADOR 2D INTERATIVO DAS CHAPAS DE CORTE ───────────────── */}
      <div className="bg-[#121418] border border-amber-500/30 p-5 rounded-3xl shadow-xl space-y-4">

        {/* Barra de Controle Interativo de Peça Selecionada (Mover, Girar, Deslocar) */}
        {selectedPlacedKey && (() => {
          const [sIdxStr, pIdxStr] = selectedPlacedKey.split('_');
          const pIdx = parseInt(pIdxStr);
          const p = currentActiveSheet?.pieces[pIdx];
          if (!p) return null;

          const offset = customOffsets[selectedPlacedKey] || { dx: 0, dy: 0, rotated: false };
          const curW = offset.rotated ? p.h : p.w;
          const curH = offset.rotated ? p.w : p.h;
          const curX = Math.round(p.x + offset.dx);
          const curY = Math.round(p.y + offset.dy);

          const nudge = (deltaX: number, deltaY: number) => {
            const newOffsets = {
              ...customOffsets,
              [selectedPlacedKey]: {
                ...offset,
                dx: (offset.dx || 0) + deltaX,
                dy: (offset.dy || 0) + deltaY
              }
            };
            saveCustomOffsets(newOffsets);
          };

          const togglePlacedRotation = () => {
            const newOffsets = {
              ...customOffsets,
              [selectedPlacedKey]: {
                ...offset,
                rotated: !offset.rotated
              }
            };
            saveCustomOffsets(newOffsets);
            toast({ title: '🔄 Peça girada na chapa em 90°' });
          };

          const alignCorner = (corner: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
            const trim = sheetConfig.trimMargin;
            let targetX = trim;
            let targetY = trim;
            if (corner === 'top-right') targetX = sheetConfig.length - trim - curW;
            if (corner === 'bottom-left') targetY = sheetConfig.width - trim - curH;
            if (corner === 'bottom-right') {
              targetX = sheetConfig.length - trim - curW;
              targetY = sheetConfig.width - trim - curH;
            }

            const newOffsets = {
              ...customOffsets,
              [selectedPlacedKey]: {
                ...offset,
                dx: targetX - p.x,
                dy: targetY - p.y
              }
            };
            saveCustomOffsets(newOffsets);
            toast({ title: `📐 Peça alinhada ao canto (${corner})` });
          };

          const resetPiecePosition = () => {
            const updated = { ...customOffsets };
            delete updated[selectedPlacedKey];
            saveCustomOffsets(updated);
            toast({ title: '🔄 Posição original restaurada' });
          };

          return (
            <div className="bg-gradient-to-r from-amber-950/60 via-[#181512] to-amber-950/60 border-2 border-amber-500/80 p-3.5 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 space-y-2.5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-amber-500/30 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-amber-500 text-black font-black text-xs flex items-center justify-center shadow">
                    #{pIdx + 1}
                  </span>
                  <div>
                    <h4 className="text-xs font-black text-white flex items-center gap-2">
                      <span>{p.piece.name}</span>
                      <span className="text-[10px] text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md font-mono">
                        {curW} x {curH} mm
                      </span>
                    </h4>
                    <p className="text-[10px] text-gray-400 font-mono">
                      Posição X: <b className="text-white">{curX}mm</b> | Y: <b className="text-white">{curY}mm</b> {offset.rotated && ' | 🔄 Girada 90°'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={resetPiecePosition}
                    className="text-[10px] bg-white/10 hover:bg-white/20 text-gray-300 px-2.5 py-1 rounded-lg font-bold transition-colors"
                  >
                    Restaurar Posição
                  </button>
                  <button
                    onClick={() => setSelectedPlacedKey(null)}
                    className="w-6 h-6 bg-white/10 hover:bg-red-500/30 text-gray-400 hover:text-white rounded-lg flex items-center justify-center transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Botões de Ação de Movimentação e Rotação */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Botão de Editar Medidas & Nome */}
                <button
                  type="button"
                  onClick={() => handleOpenQuickEdit(p.piece)}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-black px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all hover:scale-[1.03]"
                  title="Alterar medidas, nome, material e fitas desta peça"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-300" />
                  <span>✏️ Alterar Medidas &amp; Nome</span>
                </button>

                {/* Botão de Giro 90° */}
                <button
                  onClick={togglePlacedRotation}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all hover:scale-[1.03]"
                  title="Girar peça selecionada em 90° na chapa"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Girar 90° na Chapa</span>
                </button>

                {/* Controles Direcionais de Deslocamento (Nudge) */}
                <div className="flex items-center gap-1 bg-[#101216] border border-amber-500/40 p-1 rounded-xl shadow-inner">
                  <span className="text-[10px] font-bold text-gray-400 px-1.5">Deslocar:</span>
                  <button onClick={() => nudge(-50, 0)} className="w-7 h-7 bg-white/5 hover:bg-amber-500/20 text-amber-300 rounded-lg flex items-center justify-center font-bold text-xs" title="Mover para Esquerda (-50mm)">
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => nudge(0, -50)} className="w-7 h-7 bg-white/5 hover:bg-amber-500/20 text-amber-300 rounded-lg flex items-center justify-center font-bold text-xs" title="Mover para Cima (-50mm)">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => nudge(0, 50)} className="w-7 h-7 bg-white/5 hover:bg-amber-500/20 text-amber-300 rounded-lg flex items-center justify-center font-bold text-xs" title="Mover para Baixo (+50mm)">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => nudge(50, 0)} className="w-7 h-7 bg-white/5 hover:bg-amber-500/20 text-amber-300 rounded-lg flex items-center justify-center font-bold text-xs" title="Mover para Direita (+50mm)">
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Alinhamento Rápido */}
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-[10px] font-bold text-gray-400">Alinhar:</span>
                  <button onClick={() => alignCorner('top-left')} className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-[10px] font-bold">Topo-Esq</button>
                  <button onClick={() => alignCorner('top-right')} className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-[10px] font-bold">Topo-Dir</button>
                  <button onClick={() => alignCorner('bottom-left')} className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-[10px] font-bold">Base-Esq</button>
                  <button onClick={() => alignCorner('bottom-right')} className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-[10px] font-bold">Base-Dir</button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Canvas / SVG de Renderização da Chapa 2D */}
        {currentActiveSheet ? (
          <div className="space-y-3">
            <div className="bg-[#0b0d11] border border-white/15 rounded-2xl p-4 overflow-x-auto">
              <div className="flex justify-between items-center text-xs sm:text-sm text-gray-300 mb-2.5 font-mono flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="text-gray-200">
                    Aproveitamento: <b className="text-emerald-400 text-sm sm:text-base font-black">{currentActiveSheet.efficiencyPercent}%</b>{' '}
                    <span className="text-gray-400">({currentActiveSheet.pieces.length} peças)</span>
                  </div>
                  {optimizedSheets.length > 1 && (
                    <div className="flex items-center gap-1 bg-[#101216] border border-amber-500/30 p-0.5 rounded-xl">
                      {optimizedSheets.map((s, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedSheetView(idx)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
                            selectedSheetView === idx
                              ? 'bg-amber-500 text-black shadow'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          Chapa {idx + 1} ({s.efficiencyPercent}%)
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleAutoOrganizePieces}
                    className="bg-[#00a86b] hover:bg-[#00c97f] text-white font-black px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 border border-emerald-300/40"
                    title="Reotimizar e organizar peças com máximo aproveitamento"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                    <span>Organizar Peças</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveCuttingPlan}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 border border-emerald-300/40"
                    title="Salvar este plano de corte concluído"
                  >
                    <Save className="w-3.5 h-3.5 text-yellow-300" />
                    <span>Salvar Plano de Corte</span>
                  </button>
                </div>
                <div className="text-[11px] text-gray-400 flex items-center gap-2 flex-wrap">
                  <span>Material: <b className="text-amber-300">{currentActiveSheet.material}</b></span>
                  <span>|</span>
                  <span>Dimensões: <b className="text-white">{toDisplay(sheetConfig.length)} x {toDisplay(sheetConfig.width)} {unitLabel}</b></span>
                  <span>|</span>
                  <span>Refilo: {toDisplay(sheetConfig.trimMargin)}{unitLabel}</span>
                  <span>|</span>
                  <span>Serra: {toDisplay(sheetConfig.bladeKerf)}{unitLabel}</span>
                </div>
              </div>

              {/* Chapa Proporcional em SVG com cores e veias do MDF */}
              {(() => {
                const sheetPalette = getMaterialPalette(currentActiveSheet.material);
                const sheetPatId = `grain_sheet_${sanitizeId(currentActiveSheet.material)}`;
                return (
                  <div className="relative w-full overflow-hidden rounded-xl border-2 border-dashed border-amber-500/40"
                    style={{ background: sheetPalette.base }}>
                    <svg
                      ref={svgRef}
                      viewBox={`0 0 ${sheetConfig.length} ${sheetConfig.width}`}
                      className="w-full h-auto max-h-[550px] block select-none touch-none"
                      style={{ aspectRatio: `${sheetConfig.length} / ${sheetConfig.width}`, cursor: dragState ? 'grabbing' : 'default' }}
                      onPointerMove={handleSvgPointerMove}
                      onPointerUp={handleSvgPointerUp}
                      onPointerLeave={handleSvgPointerUp}
                    >
                      <defs>
                        {/* Pattern de veias do MDF (folha/sobra) */}
                        <pattern id={sheetPatId} x="0" y="0" width="120" height="60" patternUnits="userSpaceOnUse">
                          <rect width="120" height="60" fill={sheetPalette.base} />
                          {/* Veias: linhas levemente onduladas */}
                          <path d="M0 10 Q30 8 60 12 Q90 16 120 10" stroke={sheetPalette.grain} strokeWidth="1.5" fill="none" opacity={sheetPalette.grainOpacity} />
                          <path d="M0 22 Q25 20 55 25 Q85 28 120 22" stroke={sheetPalette.grain} strokeWidth="1" fill="none" opacity={sheetPalette.grainOpacity * 0.7} />
                          <path d="M0 35 Q40 30 70 37 Q95 40 120 35" stroke={sheetPalette.grain} strokeWidth="1.8" fill="none" opacity={sheetPalette.grainOpacity} />
                          <path d="M0 48 Q30 44 65 50 Q95 53 120 48" stroke={sheetPalette.grain} strokeWidth="0.8" fill="none" opacity={sheetPalette.grainOpacity * 0.6} />
                        </pattern>

                        {/* Patterns individuais por peça (variação de cor por índice) */}
                        {currentActiveSheet.pieces.map((p, pIdx) => {
                          const piecePalette = getMaterialPalette(p.piece.material);
                          const patId = `grain_piece_${pIdx}_${sanitizeId(p.piece.material)}`;
                          const pieceColors = [
                            { tint: '#00000020', shadow: '#00000035' },
                            { tint: '#ffffff18', shadow: '#ffffff12' },
                            { tint: '#00000028', shadow: '#00000020' },
                            { tint: '#ffffff14', shadow: '#ffffff20' },
                            { tint: '#00000020', shadow: '#00000030' },
                            { tint: '#ffffff10', shadow: '#00000025' },
                          ];
                          const tint = pieceColors[pIdx % pieceColors.length].tint;
                          return (
                            <pattern key={patId} id={patId} x={p.x} y={p.y} width="120" height="60" patternUnits="userSpaceOnUse">
                              <rect width="120" height="60" fill={piecePalette.base} />
                              <rect width="120" height="60" fill={tint} />
                              <path d="M0 10 Q30 8 60 12 Q90 16 120 10" stroke={piecePalette.grain} strokeWidth="1.8" fill="none" opacity={piecePalette.grainOpacity + 0.05} />
                              <path d="M0 22 Q25 19 55 24 Q85 28 120 22" stroke={piecePalette.grain} strokeWidth="1" fill="none" opacity={piecePalette.grainOpacity * 0.8} />
                              <path d="M0 34 Q40 30 70 36 Q95 40 120 34" stroke={piecePalette.grain} strokeWidth="2" fill="none" opacity={piecePalette.grainOpacity + 0.03} />
                              <path d="M0 48 Q30 44 65 50 Q95 53 120 48" stroke={piecePalette.grain} strokeWidth="1" fill="none" opacity={piecePalette.grainOpacity * 0.6} />
                            </pattern>
                          );
                        })}
                      </defs>

                      {/* Fundo da chapa – cor + veia do MDF */}
                      <rect
                        x="0"
                        y="0"
                        width={sheetConfig.length}
                        height={sheetConfig.width}
                        fill={`url(#${sheetPatId})`}
                        stroke="#f59e0b"
                        strokeWidth="6"
                      />

                      {/* Linha de Refilo */}
                      <rect
                        x={sheetConfig.trimMargin}
                        y={sheetConfig.trimMargin}
                        width={sheetConfig.length - (sheetConfig.trimMargin * 2)}
                        height={sheetConfig.width - (sheetConfig.trimMargin * 2)}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="3"
                        strokeDasharray="15,10"
                        opacity="0.7"
                      />

                      {/* Peças Posicionadas com cor, veia do MDF e controle interativo de posição/giro */}
                      {currentActiveSheet.pieces.map((p, pIdx) => {
                        const pKey = `${selectedSheetView}_${pIdx}`;
                        const isSelected = selectedPlacedKey === pKey;
                        const offset = customOffsets[pKey] || { dx: 0, dy: 0, rotated: false };
                        const effW = offset.rotated ? p.h : p.w;
                        const effH = offset.rotated ? p.w : p.h;
                        const effX = Math.round(p.x + offset.dx);
                        const effY = Math.round(p.y + offset.dy);

                        const patId = `grain_piece_${pIdx}_${sanitizeId(p.piece.material)}`;
                        const piecePalette = getMaterialPalette(p.piece.material);
                        const textColor = parseInt(piecePalette.base.replace('#',''), 16) > 0xaaaaaa ? '#1a1a1a' : '#ffffff';
                        const dimColor = parseInt(piecePalette.base.replace('#',''), 16) > 0xaaaaaa ? '#444400' : '#fef08a';

                        return (
                          <g 
                            key={pIdx} 
                            onPointerDown={(e) => handlePiecePointerDown(e, pKey)}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              togglePieceRotationByKey(pKey);
                            }}
                            className="cursor-grab active:cursor-grabbing transition-opacity duration-150 select-none"
                            style={{ touchAction: 'none' }}
                          >
                            {/* Retângulo da Peça – Sombra */}
                            <rect
                              x={effX + 3}
                              y={effY + 3}
                              width={effW - 6}
                              height={effH - 6}
                              fill="#00000035"
                              rx="4"
                            />
                            {/* Corpo Principal da Peça com Textura do MDF */}
                            <rect
                              x={effX}
                              y={effY}
                              width={effW}
                              height={effH}
                              fill={`url(#${patId})`}
                              stroke={isSelected ? '#f59e0b' : '#ffffff'}
                              strokeWidth={isSelected ? '8' : '4'}
                              rx="4"
                            />
                            {/* Brilho sutil no topo da peça */}
                            <rect
                              x={effX}
                              y={effY}
                              width={effW}
                              height={Math.min(effH * 0.15, 60)}
                              fill="#ffffff18"
                              rx="4"
                            />

                            {/* Destaque quando Selecionada */}
                            {isSelected && (
                              <>
                                <rect
                                  x={effX - 6}
                                  y={effY - 6}
                                  width={effW + 12}
                                  height={effH + 12}
                                  fill="none"
                                  stroke="#f59e0b"
                                  strokeWidth="3"
                                  strokeDasharray="12,6"
                                  rx="8"
                                  opacity="0.9"
                                />
                                {/* Marcadores de Canto (Handles) */}
                                <circle cx={effX} cy={effY} r="8" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                                <circle cx={effX + effW} cy={effY} r="8" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                                <circle cx={effX} cy={effY + effH} r="8" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                                <circle cx={effX + effW} cy={effY + effH} r="8" fill="#f59e0b" stroke="#ffffff" strokeWidth="2" />
                              </>
                            )}

                            {/* Indicação de Fita de Borda */}
                            {p.piece.edgeBanding.top && (
                              <line x1={effX} y1={effY} x2={effX + effW} y2={effY} stroke="#fef08a" strokeWidth="8" strokeDasharray="8,5" />
                            )}
                            {p.piece.edgeBanding.bottom && (
                              <line x1={effX} y1={effY + effH} x2={effX + effW} y2={effY + effH} stroke="#fef08a" strokeWidth="8" strokeDasharray="8,5" />
                            )}
                            {p.piece.edgeBanding.left && (
                              <line x1={effX} y1={effY} x2={effX} y2={effY + effH} stroke="#fef08a" strokeWidth="8" strokeDasharray="8,5" />
                            )}
                            {p.piece.edgeBanding.right && (
                              <line x1={effX + effW} y1={effY} x2={effX + effW} y2={effY + effH} stroke="#fef08a" strokeWidth="8" strokeDasharray="8,5" />
                            )}

                            {/* Número da peça (badge) */}
                            {effW > 100 && effH > 80 && (
                              <>
                                <circle cx={effX + 22} cy={effY + 22} r="18" fill={isSelected ? '#f59e0b' : '#00000050'} />
                                <text
                                  x={effX + 22}
                                  y={effY + 22}
                                  fill={isSelected ? '#000000' : '#ffffff'}
                                  fontSize="18"
                                  fontWeight="900"
                                  textAnchor="middle"
                                  dominantBaseline="central"
                                >
                                  {pIdx + 1}
                                </text>
                              </>
                            )}

                            {/* Rótulo da Peça */}
                            {effW > 150 && effH > 100 && (
                              <text
                                x={effX + effW / 2}
                                y={effY + effH / 2 - 18}
                                fill={textColor}
                                fontSize={Math.min(36, effW / 12)}
                                fontWeight="bold"
                                textAnchor="middle"
                                dominantBaseline="central"
                                style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                              >
                                {p.piece.name}
                              </text>
                            )}
                            {effW > 120 && effH > 70 && (
                              <text
                                x={effX + effW / 2}
                                y={effY + effH / 2 + 28}
                                fill={dimColor}
                                fontSize={Math.min(28, effW / 16)}
                                fontWeight="900"
                                textAnchor="middle"
                                dominantBaseline="central"
                              >
                                {toDisplay(effW)} x {toDisplay(effH)} {unitLabel} {offset.rotated ? '🔄' : ''}
                              </text>
                            )}

                            {/* Botão Rápido de Editar Medidas e Nome na própria peça */}
                            {effW > 140 && effH > 60 && (
                              <g 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenQuickEdit(p.piece);
                                }}
                                className="cursor-pointer hover:opacity-100 opacity-90 transition-opacity"
                              >
                                <circle 
                                  cx={effX + effW - 58} 
                                  cy={effY + 22} 
                                  r="16" 
                                  fill="#9333ea" 
                                  stroke="#ffffff" 
                                  strokeWidth="2" 
                                />
                                <text
                                  x={effX + effW - 58}
                                  y={effY + 22}
                                  fill="#ffffff"
                                  fontSize="13"
                                  fontWeight="900"
                                  textAnchor="middle"
                                  dominantBaseline="central"
                                >
                                  ✏️
                                </text>
                              </g>
                            )}

                            {/* Botão Rápido de Giro 90° no canto superior direito da peça */}
                            {effW > 80 && effH > 60 && (
                              <g 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePieceRotationByKey(pKey);
                                }}
                                className="cursor-pointer hover:opacity-100 opacity-90 transition-opacity"
                              >
                                <circle 
                                  cx={effX + effW - 22} 
                                  cy={effY + 22} 
                                  r="16" 
                                  fill="#f59e0b" 
                                  stroke="#ffffff" 
                                  strokeWidth="2" 
                                />
                                <text
                                  x={effX + effW - 22}
                                  y={effY + 22}
                                  fill="#000000"
                                  fontSize="14"
                                  fontWeight="900"
                                  textAnchor="middle"
                                  dominantBaseline="central"
                                >
                                  🔄
                                </text>
                              </g>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                );
              })()}
            </div>

            {/* Legenda do Mapa */}
            <div className="flex items-center justify-between text-xs text-gray-400 flex-wrap gap-2 pt-1 px-1">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-emerald-600 rounded"></span> Peças Cortadas</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-[#1e2430] border border-amber-500 rounded"></span> Retalhos / Sobra</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-1 bg-yellow-300"></span> Fita de Borda</span>
                <span className="flex items-center gap-1.5">🔄 Peça Rotacionada 90°</span>
              </div>
              <span className="font-semibold text-gray-300">Chapa {selectedSheetView + 1} de {optimizedSheets.length}</span>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center text-gray-500">
            Nenhuma peça cadastrada para este material. Adicione peças acima para gerar o mapa de corte!
          </div>
        )}
      </div>

      {/* ─── TABELA COMPLETA DA LISTA DE PEÇAS A CORTAR ───────────────────── */}
      <div className="bg-[#121418] border border-white/10 rounded-3xl overflow-hidden shadow-xl space-y-0">
        <div className="p-4 bg-[#161920] border-b border-white/10 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-black text-white">Lista Completa de Peças do Projeto ({pieces.length} itens)</h3>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedMaterialFilter}
              onChange={e => setSelectedMaterialFilter(e.target.value)}
              className="bg-[#101216] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white font-bold"
            >
              <option value="all">📂 Todos os Materiais ({uniqueMaterials.length})</option>
              {uniqueMaterials.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#0e1014] text-gray-400 font-bold border-b border-white/5 uppercase text-[10px]">
              <tr>
                <th className="p-3.5">#</th>
                <th className="p-3.5">Nome da Peça</th>
                <th className="p-3.5">Material</th>
                <th className="p-3.5">Comprimento ({unitLabel})</th>
                <th className="p-3.5">Largura ({unitLabel})</th>
                <th className="p-3.5">Qtd</th>
                <th className="p-3.5">Fita de Borda</th>
                <th className="p-3.5">Giro</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {pieces
                .filter(p => selectedMaterialFilter === 'all' || p.material === selectedMaterialFilter)
                .map((p, idx) => {
                  const fita = [
                    p.edgeBanding.top ? 'C1' : '',
                    p.edgeBanding.bottom ? 'C2' : '',
                    p.edgeBanding.left ? 'L1' : '',
                    p.edgeBanding.right ? 'L2' : '',
                  ].filter(Boolean).join(', ');

                  return (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3.5 font-mono text-gray-500 font-bold">{idx + 1}</td>
                      <td className="p-3.5 font-bold text-white">{p.name}</td>
                      <td className="p-3.5">
                        <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                          {p.material}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono font-bold text-emerald-400">{toDisplay(p.length)} {unitLabel}</td>
                      <td className="p-3.5 font-mono font-bold text-emerald-400">{toDisplay(p.width)} {unitLabel}</td>
                      <td className="p-3.5 font-bold text-white">{p.quantity} un</td>
                      <td className="p-3.5">
                        {fita ? (
                          <span className="bg-purple-500/10 text-purple-300 border border-purple-500/20 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold">
                            [{fita}]
                          </span>
                        ) : (
                          <span className="text-gray-600 text-[10px]">-</span>
                        )}
                      </td>
                      <td className="p-3.5">
                        <button
                          onClick={() => handleToggleRotateAllowed(p.id)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all border ${
                            p.rotateAllowed
                              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25'
                              : 'bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25'
                          }`}
                          title="Clique para alternar permissão de giro livre"
                        >
                          {p.rotateAllowed ? '🔄 Sim (Livre)' : '🔒 Não (Fixo)'}
                        </button>
                      </td>
                      <td className="p-3.5 text-right flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleRotatePieceDirectly(p.id)}
                          className="w-7 h-7 bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg flex items-center justify-center text-amber-300 hover:text-amber-200 transition-all"
                          title="Girar Peça 90° agora (Inverter Comprimento e Largura)"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDuplicatePiece(p)}
                          className="w-7 h-7 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center text-gray-300 hover:text-white transition-all"
                          title="Duplicar Peça"
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEditPiece(p)}
                          className="w-7 h-7 bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-500/30 rounded-lg flex items-center justify-center text-gray-300 hover:text-blue-300 transition-all"
                          title="Editar Peça"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePiece(p.id)}
                          className="w-7 h-7 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-400 transition-all"
                          title="Excluir Peça"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL DE CONFIGURAÇÃO DA CHAPA & CORTE ────────────────────────── */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16181d] border border-amber-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-400" /> Configurações de Corte & Chapa
              </h3>
              <button onClick={() => setShowConfigModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1">Comprimento da Chapa ({unitLabel})</label>
                <input
                  type="text"
                  value={configModalLength}
                  onChange={e => setConfigModalLength(e.target.value)}
                  placeholder="Ex: 2750"
                  className="w-full bg-[#101216] border border-white/10 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1">Largura da Chapa ({unitLabel})</label>
                <input
                  type="text"
                  value={configModalWidth}
                  onChange={e => setConfigModalWidth(e.target.value)}
                  placeholder="Ex: 1850"
                  className="w-full bg-[#101216] border border-white/10 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 mb-1">Espessura Serra (Kerf mm)</label>
                  <input
                    type="text"
                    value={configModalKerf}
                    onChange={e => setConfigModalKerf(e.target.value)}
                    placeholder="Ex: 4"
                    className="w-full bg-[#101216] border border-white/10 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-400 mb-1">Refilo das Bordas (mm)</label>
                  <input
                    type="text"
                    value={configModalTrim}
                    onChange={e => setConfigModalTrim(e.target.value)}
                    placeholder="Ex: 10"
                    className="w-full bg-[#101216] border border-white/10 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="bg-white/10 hover:bg-white/15 text-gray-300 font-bold px-4 py-2 rounded-xl text-xs transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="bg-amber-500 hover:bg-amber-400 text-black font-black px-4 py-2 rounded-xl text-xs transition-all shadow-md active:scale-95"
              >
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: ALTERAR MEDIDAS E NOME DA PEÇA (DIRETAMENTE NA PEÇA) ─── */}
      {quickEditPiece && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14161b] border-2 border-purple-500/60 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-white animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Alterar Peça Selecionada</h3>
                  <p className="text-[11px] text-gray-400">Edite as medidas, nome e fitas de borda em tempo real</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setQuickEditPiece(null)} 
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1">1. Nome da Peça *</label>
                <input
                  type="text"
                  value={quickForm.name}
                  onChange={e => setQuickForm({ ...quickForm, name: e.target.value })}
                  placeholder="Ex: Lateral Esquerda, Porta..."
                  className="w-full bg-[#181b22] border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-2 focus:ring-purple-500 focus:outline-none font-bold"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Comprimento ({unitLabel}) *</label>
                  <input
                    type="text"
                    value={quickForm.length}
                    onChange={e => setQuickForm({ ...quickForm, length: e.target.value })}
                    className="w-full bg-[#181b22] border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white font-mono font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Largura ({unitLabel}) *</label>
                  <input
                    type="text"
                    value={quickForm.width}
                    onChange={e => setQuickForm({ ...quickForm, width: e.target.value })}
                    className="w-full bg-[#181b22] border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white font-mono font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">Quantidade</label>
                  <input
                    type="number"
                    min="1"
                    value={quickForm.quantity}
                    onChange={e => setQuickForm({ ...quickForm, quantity: Number(e.target.value) })}
                    className="w-full bg-[#181b22] border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white font-bold focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-gray-300">Material / MDF</label>
                    <button
                      type="button"
                      onClick={() => setShowNewMaterialModal(true)}
                      className="text-[10px] text-amber-400 hover:text-amber-300 font-bold hover:underline"
                    >
                      + Novo
                    </button>
                  </div>
                  <select
                    value={quickForm.material}
                    onChange={e => {
                      if (e.target.value === '__NEW_MATERIAL__') {
                        setShowNewMaterialModal(true);
                      } else {
                        setQuickForm({ ...quickForm, material: e.target.value });
                      }
                    }}
                    className="w-full bg-[#181b22] border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-2 focus:ring-purple-500 focus:outline-none font-bold cursor-pointer"
                  >
                    <optgroup label="⭐ Materiais em Uso">
                      {uniqueMaterials.map(m => (
                        <option key={`q_u_${m}`} value={m}>{m}</option>
                      ))}
                      {customMaterials.filter(m => !uniqueMaterials.includes(m)).map(m => (
                        <option key={`q_c_${m}`} value={m}>{m}</option>
                      ))}
                    </optgroup>
                    <optgroup label="🪵 Catálogo Completo">
                      {POPULAR_MDF_MATERIALS.filter(m => !uniqueMaterials.includes(m) && !customMaterials.includes(m)).map(m => (
                        <option key={`q_pop_${m}`} value={m}>{m}</option>
                      ))}
                    </optgroup>
                    <option value="__NEW_MATERIAL__" className="text-amber-400 font-bold">
                      ➕ Cadastrar Novo Material...
                    </option>
                  </select>
                </div>
              </div>

              {/* Fita de Borda */}
              <div className="pt-2 border-t border-white/10">
                <span className="block text-xs font-bold text-amber-300 mb-2">Fita de Borda:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { key: 'top', label: 'C1 (Topo)' },
                    { key: 'bottom', label: 'C2 (Base)' },
                    { key: 'left', label: 'L1 (Esq)' },
                    { key: 'right', label: 'L2 (Dir)' },
                  ].map(side => (
                    <label key={side.key} className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 text-xs">
                      <input
                        type="checkbox"
                        checked={Boolean((quickForm.edgeBanding as any)?.[side.key])}
                        onChange={e => setQuickForm({
                          ...quickForm,
                          edgeBanding: {
                            ...quickForm.edgeBanding,
                            [side.key]: e.target.checked
                          }
                        })}
                        className="rounded text-purple-500 w-4 h-4"
                      />
                      <span>{side.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  const currentL = quickForm.length;
                  const currentW = quickForm.width;
                  setQuickForm({
                    ...quickForm,
                    length: currentW,
                    width: currentL
                  });
                  toast({ title: '🔄 Medidas invertidas em 90°!' });
                }}
                className="bg-white/5 hover:bg-white/10 text-amber-300 border border-amber-500/30 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Inverter 90°
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuickEditPiece(null)}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveQuickEditModal}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-all"
                >
                  <Check className="w-4 h-4" /> Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CADASTRAR NOVO CLIENTE ─── */}
      {showNewClientModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14161b] border-2 border-amber-500/60 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-white animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Cadastrar Novo Cliente</h3>
                  <p className="text-[11px] text-gray-400">Salva no banco de clientes para busca rápida e pedidos</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setShowNewClientModal(false)} 
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1">Nome Completo do Cliente *</label>
                <input
                  type="text"
                  value={newClientForm.name}
                  onChange={e => setNewClientForm({ ...newClientForm, name: e.target.value })}
                  placeholder="Ex: Samuel Pereira, Davi Silva..."
                  className="w-full bg-[#181b22] border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  value={newClientForm.phone}
                  onChange={e => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                  placeholder="Ex: 85997682237 (DDD + Tel)"
                  className="w-full bg-[#181b22] border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">Endereço / Local da Obra</label>
                <input
                  type="text"
                  value={newClientForm.address}
                  onChange={e => setNewClientForm({ ...newClientForm, address: e.target.value })}
                  placeholder="Ex: Av. Santos Dumont, 1200 - Apto 802"
                  className="w-full bg-[#181b22] border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              {/* OPÇÃO DE INICIAR COM PLANO LIMPO */}
              <div className="pt-1">
                <label className="flex items-center gap-2.5 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl cursor-pointer hover:bg-amber-500/20 transition-all select-none">
                  <input
                    type="checkbox"
                    checked={newClientCleanPlan}
                    onChange={e => setNewClientCleanPlan(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 bg-[#101216] border-amber-500/50 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-black text-amber-300 block">
                      Iniciar com plano de corte limpo (zerado)
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Remove peças anteriores para começar as anotações do cliente do zero
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowNewClientModal(false)}
                className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRegisterNewClient}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-all"
              >
                <Check className="w-4 h-4" /> Salvar Cliente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: ESCOLHER / CADASTRAR NOVO MATERIAL OU MDF ─── */}
      {showNewMaterialModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#14161b] border-2 border-amber-500/60 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-white animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Escolher / Cadastrar Material</h3>
                  <p className="text-[11px] text-gray-400">Digite qualquer padrão ou selecione um modelo do catálogo</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowNewMaterialModal(false)} 
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1.5">
                  1. Digite o Nome do Material / MDF:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMaterialInput}
                    onChange={e => setNewMaterialInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newMaterialInput.trim()) {
                        e.preventDefault();
                        handleAddNewMaterial(newMaterialInput);
                      }
                    }}
                    placeholder="Ex: MDF 18 LOURO FREIJÓ, COMPENSADO NAVAL 15..."
                    className="flex-1 bg-[#181b22] border border-amber-500/40 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:outline-none font-bold"
                    autoFocus
                  />
                  <button
                    type="button"
                    disabled={!newMaterialInput.trim()}
                    onClick={() => handleAddNewMaterial(newMaterialInput)}
                    className="bg-amber-500 hover:bg-amber-400 text-black font-black px-4 py-2.5 rounded-xl text-xs flex items-center gap-1 transition-all disabled:opacity-40 shrink-0 shadow-md"
                  >
                    <Check className="w-3.5 h-3.5" /> Usar
                  </button>
                </div>
              </div>

              {/* Catálogo Rápido com 1 Clique */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <span className="block text-[10px] font-black text-gray-400 uppercase tracking-wider">
                  ⚡ Escolha Rápida do Catálogo (Clique para Selecionar):
                </span>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {/* Brancos */}
                  <div>
                    <span className="text-[10px] font-bold text-amber-400/80">Linha Brancos:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {['MDF 15 BRANCO TX', 'MDF 06 BRANCO TX', 'MDF 18 BRANCO TX', 'MDF 25 BRANCO TX'].map(mat => (
                        <button
                          key={mat}
                          type="button"
                          onClick={() => handleAddNewMaterial(mat)}
                          className="bg-white/5 hover:bg-amber-500/20 text-gray-200 hover:text-amber-300 border border-white/10 hover:border-amber-500/30 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all"
                        >
                          + {mat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Madeirados */}
                  <div>
                    <span className="text-[10px] font-bold text-amber-400/80">Linha Madeirados:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {['MDF 15 ITAPUA', 'MDF 06 ITAPUA', 'MDF 18 ITAPUA', 'MDF 15 LOURO FREIJO', 'MDF 18 LOURO FREIJO', 'MDF 15 CARVALHO', 'MDF 18 CARVALHO', 'MDF 15 NOGAL', 'MDF 15 JATOBA', 'MDF 15 CUMARU'].map(mat => (
                        <button
                          key={mat}
                          type="button"
                          onClick={() => handleAddNewMaterial(mat)}
                          className="bg-white/5 hover:bg-amber-500/20 text-gray-200 hover:text-amber-300 border border-white/10 hover:border-amber-500/30 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all"
                        >
                          + {mat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Unicolores */}
                  <div>
                    <span className="text-[10px] font-bold text-amber-400/80">Linha Unicolores & Matt:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {['MDF 15 GRAFITE', 'MDF 18 GRAFITE', 'MDF 15 PRETO TX', 'MDF 18 PRETO TX', 'MDF 15 GIANDUIA', 'MDF 18 GIANDUIA', 'MDF 15 CINZA SAGRADO', 'MDF 15 CINZA CRISTAL'].map(mat => (
                        <button
                          key={mat}
                          type="button"
                          onClick={() => handleAddNewMaterial(mat)}
                          className="bg-white/5 hover:bg-amber-500/20 text-gray-200 hover:text-amber-300 border border-white/10 hover:border-amber-500/30 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all"
                        >
                          + {mat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fundos e Especiais */}
                  <div>
                    <span className="text-[10px] font-bold text-amber-400/80">Fundos &amp; Compensados:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {['MDF 06 CRU / FUNDO', 'MDF 15 CRU', 'COMPENSADO NAVAL 15', 'COMPENSADO NAVAL 18'].map(mat => (
                        <button
                          key={mat}
                          type="button"
                          onClick={() => handleAddNewMaterial(mat)}
                          className="bg-white/5 hover:bg-amber-500/20 text-gray-200 hover:text-amber-300 border border-white/10 hover:border-amber-500/30 text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all"
                        >
                          + {mat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowNewMaterialModal(false)}
                className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: IMPORTAÇÃO DE PEÇAS (FOTO DO CADERNO / ARQUIVO PDF / TRANSCRIÇÃO) ─── */}
      {showNotebookModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#14161b] border-2 border-amber-500/50 rounded-3xl p-5 sm:p-6 max-w-2xl w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 max-h-[92vh] overflow-y-auto">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    Importar Peças para o Plano de Corte
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Tire foto da folha/caderno, envie arquivo PDF ou use a lista salva
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNotebookModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center transition-all"
              >
                ✕
              </button>
            </div>

            {/* Overlay de Processamento com Spinner */}
            {isProcessingFile && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3 text-amber-300 animate-pulse">
                <Loader2 className="w-6 h-6 animate-spin text-amber-400 shrink-0" />
                <div>
                  <div className="text-xs font-black">Processando Documento...</div>
                  <div className="text-[11px] text-amber-200/80">{processingMessage}</div>
                </div>
              </div>
            )}

            {/* Grade de 3 Opções Rápidas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Opção 1: CÂMERA / FOTO */}
              <div className="bg-[#191c24] border border-white/10 hover:border-amber-500/40 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all">
                <div className="space-y-1.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Camera className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-black text-white">📸 Tirar Foto da Folha</h4>
                  <p className="text-[11px] text-gray-400 leading-tight">
                    Fotografe a folha ou caderno de anotações usando a câmera do celular.
                  </p>
                </div>
                <div className="space-y-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-full cursor-pointer bg-purple-600 hover:bg-purple-500 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 text-center select-none"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Abrir Câmera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="w-full cursor-pointer bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all text-center select-none"
                  >
                    <ImageIcon className="w-3 h-3" />
                    <span>Galeria de Fotos</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const list = PHOTO_15_PIECES.map((p, idx) => ({
                        ...p,
                        id: `p15-direct-${idx}-${Date.now()}`
                      }));
                      setCandidatePieces(list);
                      setSelectedPieceIds(new Set(list.map(p => p.id)));
                      setActiveCategoryFilter('ALL');
                      setShowNotebookModal(false);
                      setShowPieceSelectionModal(true);
                      toast({
                        title: '📸 Lista de 15 Peças Carregada!',
                        description: 'Todas as 15 peças prontas para você selecionar e cortar.'
                      });
                    }}
                    className="w-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all text-center cursor-pointer active:scale-95"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Carregar 15 Peças da Folha</span>
                  </button>
                </div>
              </div>

              {/* Opção 2: ARQUIVO PDF */}
              <div className="bg-[#191c24] border border-white/10 hover:border-emerald-500/40 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all">
                <div className="space-y-1.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <FileUp className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-black text-white">📄 Ler Arquivo PDF</h4>
                  <p className="text-[11px] text-gray-400 leading-tight">
                    Importe PDF do Promob, Corte Certo, Gabster ou Lista e gere o corte na hora.
                  </p>
                </div>
                <label
                  htmlFor="cutting-pdf-input"
                  className="w-full cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95 text-center select-none"
                >
                  <FileUp className="w-3.5 h-3.5" />
                  <span>Selecionar PDF &amp; Cortar</span>
                </label>
              </div>

              {/* Opção 3: PRESET TRANSCRIÇÃO SALVA DO CADERNO */}
              <div className="bg-[#191c24] border border-white/10 hover:border-amber-500/40 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all">
                <div className="space-y-1.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-black text-white">📋 Lista do Caderno (53)</h4>
                  <p className="text-[11px] text-gray-400 leading-tight">
                    Carregue as 53 peças (24 itens) transcritas e validadas da foto do caderno.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLoadNotebookPieces}
                  className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                >
                  <FileText className="w-3.5 h-3.5 text-black" />
                  <span>Carregar 53 Peças Salvas</span>
                </button>
              </div>
            </div>

            {/* Preview da Foto se tiver sido tirada */}
            {capturedPhotoUrl && (
              <div className="bg-[#101216] border border-white/10 rounded-2xl p-3 flex items-center gap-3">
                <img
                  src={capturedPhotoUrl}
                  alt="Foto capturada"
                  className="w-16 h-16 object-cover rounded-xl border border-white/20 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Foto Carregada
                  </div>
                  <div className="text-[11px] text-gray-400 truncate">
                    Medidas reconhecidas e prontas para envio ao plano de corte.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLoadNotebookPieces}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-black text-xs px-3 py-1.5 rounded-xl shrink-0"
                >
                  Aplicar Peças
                </button>
              </div>
            )}

            {/* Opção 4: EDITAR OU COLAR LISTA MANUALMENTE (COMEÇA LIMPO) */}
            <div className="bg-[#101216] border border-white/10 rounded-2xl p-4 space-y-2.5">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                <span className="text-xs font-black text-gray-300 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" /> Digite ou Cole a Lista de Peças (Plano Limpo):
                </span>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setManualListText('');
                      toast({ title: '🧹 Texto limpo com sucesso' });
                    }}
                    className="text-[10px] bg-red-500/15 hover:bg-red-500/30 text-red-300 border border-red-500/30 px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1"
                    title="Limpar o texto da caixa"
                  >
                    <Trash2 className="w-3 h-3" /> Limpar Texto
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllPieces}
                    className="text-[10px] bg-amber-500/15 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1"
                    title="Zerar todas as peças do plano atual"
                  >
                    <Trash2 className="w-3 h-3" /> Zerar Peças do Plano
                  </button>
                </div>
              </div>
              <textarea
                value={manualListText}
                onChange={(e) => setManualListText(e.target.value)}
                rows={6}
                placeholder="Plano limpo. Digite ou cole as peças aqui, exemplo:&#10;1 DE 28 * 60 TB&#10;2 DE 72 * 60 LAT.&#10;1 DE 75 * 28,9 PORTA"
                className="w-full bg-[#16181f] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-500 font-mono focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setManualListText(NOTEBOOK_RAW_TEXT);
                    toast({ title: '📋 Exemplo padrão do caderno carregado' });
                  }}
                  className="text-[11px] text-amber-400/80 hover:text-amber-300 hover:underline font-bold flex items-center gap-1"
                >
                  <FileText className="w-3 h-3" /> Carregar Exemplo do Caderno (53 Peças)
                </button>
                <button
                  type="button"
                  onClick={handleProcessManualText}
                  disabled={!manualListText.trim()}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                  <span>Processar Texto &amp; Gerar Plano de Corte</span>
                </button>
              </div>
            </div>

            {/* Rodapé do Modal */}
            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowNotebookModal(false)}
                className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──── MODAL DE ESCOLHA INTERATIVA DE PEÇAS (SÓ LAT, SÓ PORTAS, SÓ FRENTES...) ──── */}
      {showPieceSelectionModal && (
        <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
          <div className="bg-[#12141a] border border-amber-500/40 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            
            {/* Cabeçalho do Modal */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#171922]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-emerald-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    🎯 Escolher Peças para o Corte
                    <span className="text-xs bg-amber-500/20 border border-amber-500/40 text-amber-300 px-2.5 py-0.5 rounded-full font-bold">
                      {candidateStats.selectedUnits} de {candidateStats.counts.ALL.units} peças selecionadas
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    Clique nos botões rápidos abaixo para cortar <strong className="text-amber-300">só as Laterais</strong>, <strong className="text-purple-300">só as Portas</strong>, <strong className="text-amber-400">só Frentes/Gavetas</strong> ou marque livremente:
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPieceSelectionModal(false)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corpo do Modal */}
            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              
              {/* Banner da Foto Capturada */}
              {capturedPhotoUrl && (
                <div className="bg-[#181a24] border border-amber-500/40 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-3">
                    <img
                      src={capturedPhotoUrl}
                      alt="Foto da folha"
                      className="w-14 h-14 object-cover rounded-xl border border-amber-400/50 shrink-0 shadow"
                    />
                    <div>
                      <div className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-amber-400" /> Foto da Folha / Caderno ({candidateStats.counts.ALL.units} peças totais)
                      </div>
                      <div className="text-[11px] text-gray-300 leading-tight">
                        Peças lidas da sua foto. Você pode ajustar quantidades com [+] e [−] ou adicionar medidas faltantes.
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const candidateList = PHOTO_15_PIECES.map((p, idx) => ({
                          ...p,
                          id: `p15-${idx}-${Date.now()}`
                        }));
                        setCandidatePieces(candidateList);
                        setSelectedPieceIds(new Set(candidateList.map(p => p.id)));
                        setActiveCategoryFilter('ALL');
                        toast({ title: '📋 Lista Completa de 15 Peças Carregada!', description: '15 peças prontas para você selecionar e cortar.' });
                      }}
                      className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 font-bold text-xs px-2.5 sm:px-3 py-1.5 rounded-xl shrink-0 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>15 Peças Padrão</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      className="cursor-pointer bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-2.5 sm:px-3 py-1.5 rounded-xl shrink-0 transition-all flex items-center gap-1.5 active:scale-95 shadow-md"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Tirar Outra Foto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="cursor-pointer bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-2 sm:px-2.5 py-1.5 rounded-xl shrink-0 transition-all flex items-center gap-1.5 active:scale-95"
                      title="Escolher foto da galeria"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-gray-300" />
                      <span>Galeria</span>
                    </button>
                  </div>
                </div>
              )}
              
              {/* Botões Rápidos de Categoria (Ex: Só LAT, Só Portas, Só Frentes) */}
              <div className="bg-[#161822] border border-white/10 rounded-2xl p-3.5 space-y-2.5 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5" /> Escolha Rápida por Categoria (1 Clique):
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleSelectAll(true)}
                      className="text-[11px] text-emerald-400 hover:underline font-bold"
                    >
                      + Marcar Todas
                    </button>
                    <span className="text-gray-600">|</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSelectAll(false)}
                      className="text-[11px] text-red-400 hover:underline font-bold"
                    >
                      ✕ Desmarcar Todas
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {/* Todas */}
                  <button
                    type="button"
                    onClick={() => handleSelectOnlyCategory('ALL')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-black flex flex-col items-center justify-center gap-1 transition-all ${
                      activeCategoryFilter === 'ALL'
                        ? 'bg-gradient-to-b from-amber-500/30 to-amber-600/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10'
                        : 'bg-[#1e2230] border-white/10 text-gray-300 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    <span>🌟 Todas as Peças</span>
                    <span className="text-[10px] font-mono opacity-80">{candidateStats.counts.ALL.units} peças</span>
                  </button>

                  {/* Só Laterais */}
                  <button
                    type="button"
                    onClick={() => handleSelectOnlyCategory('LAT')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-black flex flex-col items-center justify-center gap-1 transition-all ${
                      activeCategoryFilter === 'LAT'
                        ? 'bg-blue-600/30 border-blue-400 text-blue-300 shadow-md shadow-blue-500/10 scale-[1.02]'
                        : 'bg-[#1e2230] border-blue-500/30 text-blue-400 hover:border-blue-400 hover:bg-blue-500/10'
                    }`}
                  >
                    <span>📐 Só Laterais (LAT)</span>
                    <span className="text-[10px] font-mono opacity-80">{candidateStats.counts.LAT.units} peças</span>
                  </button>

                  {/* Só Portas */}
                  <button
                    type="button"
                    onClick={() => handleSelectOnlyCategory('PORTAS')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-black flex flex-col items-center justify-center gap-1 transition-all ${
                      activeCategoryFilter === 'PORTAS'
                        ? 'bg-purple-600/30 border-purple-400 text-purple-300 shadow-md shadow-purple-500/10 scale-[1.02]'
                        : 'bg-[#1e2230] border-purple-500/30 text-purple-400 hover:border-purple-400 hover:bg-purple-500/10'
                    }`}
                  >
                    <span>🚪 Só Portas</span>
                    <span className="text-[10px] font-mono opacity-80">{candidateStats.counts.PORTAS.units} peças</span>
                  </button>

                  {/* Só Frentes / Gavetas */}
                  <button
                    type="button"
                    onClick={() => handleSelectOnlyCategory('FRENTES')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-black flex flex-col items-center justify-center gap-1 transition-all ${
                      activeCategoryFilter === 'FRENTES'
                        ? 'bg-amber-600/30 border-amber-400 text-amber-300 shadow-md shadow-amber-500/10 scale-[1.02]'
                        : 'bg-[#1e2230] border-amber-500/30 text-amber-400 hover:border-amber-400 hover:bg-amber-500/10'
                    }`}
                  >
                    <span>🗄️ Só Frentes / Gav.</span>
                    <span className="text-[10px] font-mono opacity-80">{candidateStats.counts.FRENTES.units} peças</span>
                  </button>

                  {/* Só Tampos / Bases */}
                  <button
                    type="button"
                    onClick={() => handleSelectOnlyCategory('TB')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-black flex flex-col items-center justify-center gap-1 transition-all ${
                      activeCategoryFilter === 'TB'
                        ? 'bg-emerald-600/30 border-emerald-400 text-emerald-300 shadow-md shadow-emerald-500/10 scale-[1.02]'
                        : 'bg-[#1e2230] border-emerald-500/30 text-emerald-400 hover:border-emerald-400 hover:bg-emerald-500/10'
                    }`}
                  >
                    <span>📦 Só Tampos/Base</span>
                    <span className="text-[10px] font-mono opacity-80">{candidateStats.counts.TB.units} peças</span>
                  </button>

                  {/* Só Prateleiras */}
                  <button
                    type="button"
                    onClick={() => handleSelectOnlyCategory('PRAT')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-black flex flex-col items-center justify-center gap-1 transition-all ${
                      activeCategoryFilter === 'PRAT'
                        ? 'bg-cyan-600/30 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/10 scale-[1.02]'
                        : 'bg-[#1e2230] border-cyan-500/30 text-cyan-400 hover:border-cyan-400 hover:bg-cyan-500/10'
                    }`}
                  >
                    <span>📚 Só Prateleiras</span>
                    <span className="text-[10px] font-mono opacity-80">{candidateStats.counts.PRAT.units} peças</span>
                  </button>

                  {/* Só Divisórias / Meio */}
                  <button
                    type="button"
                    onClick={() => handleSelectOnlyCategory('DIV')}
                    className={`px-3 py-2.5 rounded-xl border text-xs font-black flex flex-col items-center justify-center gap-1 transition-all ${
                      activeCategoryFilter === 'DIV'
                        ? 'bg-indigo-600/30 border-indigo-400 text-indigo-300 shadow-md shadow-indigo-500/10 scale-[1.02]'
                        : 'bg-[#1e2230] border-indigo-500/30 text-indigo-400 hover:border-indigo-400 hover:bg-indigo-500/10'
                    }`}
                  >
                    <span>📏 Só Divisórias</span>
                    <span className="text-[10px] font-mono opacity-80">{candidateStats.counts.DIV.units} peças</span>
                  </button>
                </div>
              </div>

              {/* Barra de Filtro de Busca e Exibição */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-[#161822] border border-white/10 rounded-2xl p-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={pieceSearchFilter}
                    onChange={(e) => setPieceSearchFilter(e.target.value)}
                    placeholder="Filtrar por nome ou medida (ex: 60, LAT, Porta)..."
                    className="w-full bg-[#1e2230] border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
                <div className="text-xs text-gray-400 font-medium">
                  Mostrando <strong className="text-white">{filteredCandidateList.length}</strong> de {candidatePieces.length} itens na lista
                </div>
              </div>

              {/* Lista Detalhada de Peças com Checkboxes */}
              <div className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
                {filteredCandidateList.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 text-xs">
                    Nenhuma peça encontrada para o filtro atual.
                  </div>
                ) : (
                  filteredCandidateList.map((p) => {
                    const isChecked = selectedPieceIds.has(p.id);
                    const badge = getPieceCategoryBadge(p.name);
                    const areaM2 = ((p.length * p.width * p.quantity) / 1_000_000).toFixed(2);
                    const dimCm = `${(p.length / 10).toLocaleString('pt-BR')} × ${(p.width / 10).toLocaleString('pt-BR')} cm`;
                    const dimMm = `${p.length} × ${p.width} mm`;

                    return (
                      <div
                        key={p.id}
                        onClick={() => handleToggleCandidatePiece(p.id)}
                        className={`cursor-pointer rounded-2xl border p-3 flex items-center justify-between gap-3 transition-all ${
                          isChecked
                            ? 'bg-[#18261e] border-emerald-500/50 shadow-sm shadow-emerald-500/5 text-white'
                            : 'bg-[#14161f] border-white/5 opacity-60 text-gray-400 hover:opacity-100 hover:border-white/20'
                        }`}
                      >
                        {/* Lado Esquerdo: Checkbox + Badges + Nome */}
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            type="button"
                            className={`p-1 rounded-lg transition-colors ${
                              isChecked ? 'text-emerald-400' : 'text-gray-500'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleCandidatePiece(p.id);
                            }}
                          >
                            {isChecked ? (
                              <CheckSquare className="w-5 h-5 text-emerald-400" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-500" />
                            )}
                          </button>

                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${badge.colorClass}`}>
                                {badge.label}
                              </span>
                              <span className="text-xs font-bold text-white truncate">
                                {p.name}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-400 flex items-center gap-2 font-mono">
                              <span className="text-amber-300 font-bold">{dimCm}</span>
                              <span className="text-gray-600">({dimMm})</span>
                            </div>
                          </div>
                        </div>

                        {/* Lado Direito: Quantidade Interativa + Excluir */}
                        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                          <div className="flex items-center bg-black/50 border border-white/15 rounded-xl p-0.5 shadow-inner">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateCandidateQty(p.id, Math.max(1, p.quantity - 1));
                              }}
                              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-white font-bold flex items-center justify-center text-sm active:scale-95 transition-colors"
                              title="Diminuir quantidade"
                            >
                              −
                            </button>
                            <span className="font-black text-xs min-w-[28px] text-center text-amber-400 font-mono">
                              {p.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateCandidateQty(p.id, p.quantity + 1);
                              }}
                              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 text-white font-bold flex items-center justify-center text-sm active:scale-95 transition-colors"
                              title="Aumentar quantidade"
                            >
                              +
                            </button>
                          </div>

                          <div className="text-right hidden sm:block">
                            <div className="text-[10px] text-gray-400 font-mono">
                              {areaM2} m²
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCandidatePiece(p.id);
                            }}
                            className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Excluir esta peça da lista"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Botão e Formulário Rápido para Adicionar Peça Avulsa da Folha */}
              <div className="pt-1">
                {!showAddCandidateInput ? (
                  <button
                    type="button"
                    onClick={() => setShowAddCandidateInput(true)}
                    className="w-full border border-dashed border-white/20 hover:border-amber-400/60 bg-white/5 hover:bg-amber-500/5 text-gray-300 hover:text-amber-300 font-bold py-2.5 px-3 rounded-2xl text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <Plus className="w-4 h-4 text-amber-400" />
                    <span>+ Adicionar Outra Peça da Folha / Caderno</span>
                  </button>
                ) : (
                  <div className="bg-[#181a24] border border-amber-500/40 rounded-2xl p-3 space-y-3 animate-in fade-in">
                    <div className="text-xs font-black text-amber-400 flex items-center justify-between">
                      <span>Adicionar Medida da Folha:</span>
                      <button
                        type="button"
                        onClick={() => setShowAddCandidateInput(false)}
                        className="text-gray-400 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <input
                        type="text"
                        placeholder="Nome (ex: Lateral)"
                        value={newCandidateName}
                        onChange={(e) => setNewCandidateName(e.target.value)}
                        className="bg-[#12141a] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white"
                      />
                      <input
                        type="number"
                        placeholder="Comp (mm)"
                        value={newCandidateLength}
                        onChange={(e) => setNewCandidateLength(Number(e.target.value))}
                        className="bg-[#12141a] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                      <input
                        type="number"
                        placeholder="Larg (mm)"
                        value={newCandidateWidth}
                        onChange={(e) => setNewCandidateWidth(Number(e.target.value))}
                        className="bg-[#12141a] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                      />
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          placeholder="Qtd"
                          value={newCandidateQty}
                          onChange={(e) => setNewCandidateQty(Number(e.target.value))}
                          className="w-16 bg-[#12141a] border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleAddNewCandidatePiece}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-1.5 px-3 rounded-xl text-xs shadow-md"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Rodapé Fixo do Modal */}
            <div className="p-4 sm:p-5 border-t border-white/10 bg-[#171922] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="text-xs text-gray-300">
                  <span className="text-emerald-400 font-bold">{candidateStats.selectedItems}</span> itens marcados (
                  <strong className="text-white">{candidateStats.selectedUnits}</strong> peças totais •{' '}
                  <span className="text-amber-300 font-mono">{candidateStats.selectedAreaM2} m²</span>)
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPieceSelectionModal(false);
                    setShowNotebookModal(true);
                  }}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all"
                >
                  Voltar ao Texto
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSelectedPieces}
                  disabled={candidateStats.selectedUnits === 0}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  <span>Gerar Plano de Corte ({candidateStats.selectedUnits} Peças)</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ─── MODAL: GERENCIAR & EDITAR TODAS AS PEÇAS DO PLANO DE CORTE ─── */}
      {showEditPiecesModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
          <div className="bg-[#12141a] border-2 border-purple-500/50 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#171922]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    Editar Peças do Plano de Corte
                    <span className="text-xs font-mono bg-purple-500/20 text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-500/30">
                      {pieces.reduce((sum, p) => sum + (Number(p.quantity) || 1), 0)} un ({pieces.length} itens)
                    </span>
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Altere medidas, nomes, quantidades e fitas de borda de forma rápida
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPieceForm(true);
                    setEditingPieceId(null);
                    setShowEditPiecesModal(false);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shadow transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> + Nova Peça
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditPiecesModal(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Barra de Filtro e Ações Globais */}
            <div className="p-3 sm:px-5 bg-[#14161f] border-b border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="relative flex-1 max-w-md">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={editingPieceModalSearch}
                  onChange={(e) => setEditingPieceModalSearch(e.target.value)}
                  placeholder="Filtrar por nome, medidas ou material..."
                  className="w-full bg-[#101216] border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-purple-400"
                />
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleClearAllPieces}
                  className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5"
                  title="Remover todas as peças do plano de corte"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Zerar / Limpar Lista</span>
                </button>
              </div>
            </div>

            {/* Lista de Peças Rolável */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2.5">
              {pieces.length === 0 ? (
                <div className="py-12 text-center text-gray-500 space-y-3">
                  <div className="text-4xl">📐</div>
                  <div className="text-sm font-bold text-gray-400">Nenhuma peça cadastrada no plano atual.</div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditPiecesModal(false);
                      setShowAddPieceForm(true);
                    }}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 shadow"
                  >
                    <Plus className="w-4 h-4" /> Adicionar Primeira Peça
                  </button>
                </div>
              ) : (
                pieces
                  .filter(p => !editingPieceModalSearch || p.name.toLowerCase().includes(editingPieceModalSearch.toLowerCase()) || p.material.toLowerCase().includes(editingPieceModalSearch.toLowerCase()) || `${p.length}x${p.width}`.includes(editingPieceModalSearch))
                  .map((p, idx) => {
                    return (
                      <div
                        key={p.id}
                        className="bg-[#181a24] border border-white/10 hover:border-purple-500/40 rounded-2xl p-3 sm:p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 transition-all"
                      >
                        {/* Numeração e Nome */}
                        <div className="flex items-center gap-2.5 min-w-[200px] flex-1">
                          <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                            #{idx + 1}
                          </span>
                          <div className="flex-1">
                            <input
                              type="text"
                              value={p.name}
                              onChange={(e) => handleUpdatePieceField(p.id, 'name', e.target.value)}
                              className="w-full bg-[#12141a] border border-white/10 focus:border-purple-400 rounded-lg px-2 py-1 text-xs text-white font-bold"
                              placeholder="Nome da Peça"
                            />
                            <div className="text-[10px] text-amber-400/80 font-mono mt-0.5">
                              {p.material}
                            </div>
                          </div>
                        </div>

                        {/* Medidas: Comp x Larg na unidade atual */}
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-1 bg-[#12141a] border border-white/10 rounded-lg px-2 py-1">
                            <span className="text-[10px] text-gray-400">C:</span>
                            <input
                              type="number"
                              step="any"
                              value={toDisplay(p.length)}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                handleUpdatePieceField(p.id, 'length', fromDisplay(val));
                              }}
                              className="w-16 bg-transparent text-xs font-mono font-bold text-emerald-400 focus:outline-none text-right"
                            />
                            <span className="text-[10px] text-gray-500">{unitLabel}</span>
                          </div>

                          <span className="text-gray-500 text-xs">×</span>

                          <div className="flex items-center gap-1 bg-[#12141a] border border-white/10 rounded-lg px-2 py-1">
                            <span className="text-[10px] text-gray-400">L:</span>
                            <input
                              type="number"
                              step="any"
                              value={toDisplay(p.width)}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                handleUpdatePieceField(p.id, 'width', fromDisplay(val));
                              }}
                              className="w-16 bg-transparent text-xs font-mono font-bold text-emerald-400 focus:outline-none text-right"
                            />
                            <span className="text-[10px] text-gray-500">{unitLabel}</span>
                          </div>
                        </div>

                        {/* Stepper de Quantidade */}
                        <div className="flex items-center gap-1 bg-[#12141a] border border-white/10 rounded-xl p-1">
                          <button
                            type="button"
                            onClick={() => handleUpdatePieceQty(p.id, (Number(p.quantity) || 1) - 1)}
                            className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 flex items-center justify-center font-bold text-xs"
                          >
                            −
                          </button>
                          <span className="w-8 text-center text-xs font-black text-white font-mono">
                            {p.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdatePieceQty(p.id, (Number(p.quantity) || 1) + 1)}
                            className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 flex items-center justify-center font-bold text-xs"
                          >
                            +
                          </button>
                        </div>

                        {/* Fitas de Borda: C1 C2 L1 L2 */}
                        <div className="flex items-center gap-1">
                          {(['top', 'bottom', 'left', 'right'] as const).map((side, sIdx) => {
                            const labels = ['C1', 'C2', 'L1', 'L2'];
                            const isChecked = Boolean(p.edgeBanding?.[side]);
                            return (
                              <button
                                key={side}
                                type="button"
                                onClick={() => {
                                  const updatedBanding = {
                                    ...p.edgeBanding,
                                    [side]: !isChecked
                                  };
                                  handleUpdatePieceField(p.id, 'edgeBanding', updatedBanding);
                                }}
                                className={`text-[10px] font-mono px-1.5 py-1 rounded-md font-bold transition-all border ${
                                  isChecked
                                    ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                                    : 'bg-white/5 text-gray-500 border-white/10 hover:text-gray-300'
                                }`}
                                title={`Fita ${labels[sIdx]}`}
                              >
                                {labels[sIdx]}
                              </button>
                            );
                          })}
                        </div>

                        {/* Ações: Giro, Duplicar, Excluir */}
                        <div className="flex items-center gap-1.5 self-end md:self-auto">
                          <button
                            type="button"
                            onClick={() => handleToggleRotateAllowed(p.id)}
                            className={`p-1.5 rounded-lg border text-xs transition-all ${
                              p.rotateAllowed !== false
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                : 'bg-white/5 text-gray-500 border-white/10'
                            }`}
                            title={p.rotateAllowed !== false ? 'Giro permitido (90°)' : 'Giro travado'}
                          >
                            🔄
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDuplicatePiece(p.id)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-gray-300 border border-white/10 transition-all text-xs"
                            title="Duplicar esta peça"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeletePiece(p.id)}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/30 transition-all text-xs"
                            title="Excluir peça"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Rodapé Fixo */}
            <div className="p-4 border-t border-white/10 bg-[#171922] flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-gray-300">
                Total:{' '}
                <strong className="text-white">
                  {pieces.reduce((sum, p) => sum + (Number(p.quantity) || 1), 0)} peças
                </strong>{' '}
                em <span className="text-purple-300 font-bold">{pieces.length} itens</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditPiecesModal(false)}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                >
                  Concluir Edição
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditPiecesModal(false);
                    handleSaveCuttingPlan();
                  }}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-lg transition-all"
                >
                  <Save className="w-4 h-4 text-yellow-300" />
                  <span>Salvar Plano de Corte</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: CONFIRMAÇÃO DE PLANO DE CORTE SALVO COM SUCESSO ─── */}
      {showSavePlanSuccessModal && (
        <div className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#12141a] border-2 border-emerald-500/70 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4 text-white animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-md">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Plano de Corte Salvo com Sucesso!</h3>
                  <p className="text-[11px] text-gray-400">Gravado no histórico do sistema e pronto para corte</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSavePlanSuccessModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {lastSavedPlanSummary && (
              <div className="bg-[#171a23] border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-white/10 pb-2">
                  <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> {lastSavedPlanSummary.clientName}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {lastSavedPlanSummary.dateFormatted}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#111319] p-2.5 rounded-xl border border-white/5">
                    <div className="text-[10px] text-gray-400">Peças</div>
                    <div className="text-base font-black text-white font-mono">{lastSavedPlanSummary.totalPieces}</div>
                  </div>
                  <div className="bg-[#111319] p-2.5 rounded-xl border border-white/5">
                    <div className="text-[10px] text-gray-400">Chapas</div>
                    <div className="text-base font-black text-amber-400 font-mono">{lastSavedPlanSummary.totalSheets}</div>
                  </div>
                  <div className="bg-[#111319] p-2.5 rounded-xl border border-white/5">
                    <div className="text-[10px] text-gray-400">Aproveitamento</div>
                    <div className="text-base font-black text-emerald-400 font-mono">{lastSavedPlanSummary.efficiencyPercent}%</div>
                  </div>
                </div>

                {lastSavedPlanSummary.clientAddress && (
                  <div className="text-[11px] text-gray-300 flex items-center gap-1.5">
                    <span>📍 Local: {lastSavedPlanSummary.clientAddress}</span>
                  </div>
                )}
              </div>
            )}

            {/* Ações Rápidas do Plano Salvo */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowSavePlanSuccessModal(false);
                  handleShareNativePDF();
                }}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
              >
                <Share2 className="w-4 h-4" />
                <span>Exportar e Enviar Arquivo PDF</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSavePlanSuccessModal(false);
                  setShowWhatsAppModal(true);
                }}
                className="w-full bg-[#059669] hover:bg-[#10b981] text-white font-black py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Enviar Resumo no WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowSavePlanSuccessModal(false);
                  setShowSavedPlansModal(true);
                }}
                className="w-full bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 border border-white/10 transition-all"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>Ver Todos os Planos Salvos</span>
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowSavePlanSuccessModal(false)}
                className="bg-white/10 hover:bg-white/20 text-white font-bold px-4 py-1.5 rounded-xl text-xs transition-all"
              >
                Continuar Editando
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: LISTAGEM DE TODOS OS PLANOS DE CORTE SALVOS ─── */}
      {showSavedPlansModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
          <div className="bg-[#12141a] border-2 border-amber-500/50 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#171922]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    Planos de Corte Salvos
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Histórico de planos finalizados no navegador
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSavedPlansModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Lista Rolável */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {(() => {
                let savedList: any[] = [];
                try {
                  const raw = localStorage.getItem('sd_saved_cutting_plans');
                  if (raw) savedList = JSON.parse(raw);
                } catch (e) {
                  // ignore
                }

                if (!savedList || savedList.length === 0) {
                  return (
                    <div className="py-12 text-center text-gray-500 space-y-3">
                      <div className="text-4xl">📂</div>
                      <div className="text-sm font-bold text-gray-400">Nenhum plano salvo encontrado.</div>
                      <p className="text-xs text-gray-500">
                        Quando finalizar um corte, clique no botão "Salvar Plano de Corte" para guardá-lo aqui.
                      </p>
                    </div>
                  );
                }

                return savedList.map((sp: any) => (
                  <div
                    key={sp.id}
                    className="bg-[#181a24] border border-white/10 hover:border-amber-500/50 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-black text-white">👤 {sp.clientName}</span>
                        <span className="text-[10px] text-gray-400 font-mono bg-white/5 px-2 py-0.5 rounded">
                          {sp.dateFormatted}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 flex items-center gap-3 font-mono flex-wrap">
                        <span className="text-amber-300 font-bold">{sp.totalPieces} peças</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-bold">{sp.totalSheets} chapas ({sp.efficiencyPercent}%)</span>
                        {sp.clientPhone && (
                          <>
                            <span>•</span>
                            <span className="text-gray-300">📱 {sp.clientPhone}</span>
                          </>
                        )}
                      </div>
                      {sp.clientAddress && (
                        <div className="text-[11px] text-gray-500 truncate">
                          📍 {sp.clientAddress}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLoadSavedPlan(sp)}
                        className="bg-amber-500 hover:bg-amber-400 text-black font-black px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all active:scale-95"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Abrir este Plano</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSavedPlan(sp.id)}
                        className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/30 transition-all text-xs"
                        title="Excluir do histórico"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ));
              })()}
            </div>

            {/* Rodapé */}
            <div className="p-4 border-t border-white/10 bg-[#171922] flex justify-end">
              <button
                type="button"
                onClick={() => setShowSavedPlansModal(false)}
                className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

