import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
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
  Send,
  Search
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  'MDF 15 ITAPUA':     { base: '#c8a87a', grain: '#8b6340', grainOpacity: 0.22, label: 'Itapuã Natural' },
  'MDF BRANCO TX 15':  { base: '#f5f0e8', grain: '#d4cdbf', grainOpacity: 0.35, label: 'Branco TX' },
  'MDF 06 ITAPUA':     { base: '#c9a77a', grain: '#7a5330', grainOpacity: 0.20, label: 'Itapuã 6mm' },
  'MDF PRETO TX 15':   { base: '#1e1e1e', grain: '#000000', grainOpacity: 0.50, label: 'Preto TX' },
  'MDF CINZA TX 15':   { base: '#9e9e9e', grain: '#666666', grainOpacity: 0.30, label: 'Cinza TX' },
  'MDF 15 JATOBA':     { base: '#8b4513', grain: '#5c2d0a', grainOpacity: 0.28, label: 'Jatobá' },
  'MDF 15 IPE':        { base: '#a0522d', grain: '#6b3510', grainOpacity: 0.28, label: 'Ipê' },
  'MDF 15 NOGAL':      { base: '#7b5b3a', grain: '#4a3520', grainOpacity: 0.25, label: 'Nogal' },
  'MDF 15 CARVALHO':   { base: '#b8860b', grain: '#7a5a00', grainOpacity: 0.25, label: 'Carvalho' },
  'MDF 15 EUCALIPTO':  { base: '#cbb79e', grain: '#9a7555', grainOpacity: 0.22, label: 'Eucalipto' },
  'MDF LARICATO':      { base: '#d4a574', grain: '#a0724e', grainOpacity: 0.22, label: 'Laricato' },
  'MDF TRIPLEX':       { base: '#d2b48c', grain: '#8b6914', grainOpacity: 0.25, label: 'Triplex' },
};

// Função para obter paleta de um material (fallback para madeira genérica)
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
  if (matUpper.includes('PRETO') || matUpper.includes('BLACK'))
    return { base: '#1e1e1e', grain: '#000000', grainOpacity: 0.50, label: safeMat };
  return { base: '#c8a87a', grain: '#8b6340', grainOpacity: 0.22, label: safeMat };
};

// Gera um ID sanitizado para usar em SVG pattern
const sanitizeId = (s?: string) => (s && typeof s === 'string' ? s : 'default').replace(/[^a-zA-Z0-9]/g, '_');

const INITIAL_PIECES: CutPiece[] = [
  { id: '1', name: 'Lateral Esquerda', material: 'MDF 15 ITAPUA', length: 2100, width: 550, quantity: 1, rotateAllowed: false, edgeBanding: { top: true, bottom: true, left: true, right: false } },
  { id: '2', name: 'Lateral Direita', material: 'MDF 15 ITAPUA', length: 2100, width: 550, quantity: 1, rotateAllowed: false, edgeBanding: { top: true, bottom: true, left: true, right: false } },
  { id: '3', name: 'Base Inferior', material: 'MDF 15 ITAPUA', length: 870, width: 550, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: false, left: false, right: false } },
  { id: '4', name: 'Tampo Superior', material: 'MDF 15 ITAPUA', length: 900, width: 570, quantity: 1, rotateAllowed: true, edgeBanding: { top: true, bottom: true, left: true, right: true } },
  { id: '5', name: 'Prateleiras Internas', material: 'MDF 15 ITAPUA', length: 868, width: 530, quantity: 3, rotateAllowed: true, edgeBanding: { top: true, bottom: false, left: false, right: false } },
  { id: '6', name: 'Porta Direita', material: 'MDF 15 ITAPUA', length: 2000, width: 440, quantity: 1, rotateAllowed: false, edgeBanding: { top: true, bottom: true, left: true, right: true } },
  { id: '7', name: 'Porta Esquerda', material: 'MDF 15 ITAPUA', length: 2000, width: 440, quantity: 1, rotateAllowed: false, edgeBanding: { top: true, bottom: true, left: true, right: true } },
  { id: '8', name: 'Fundo do Armário', material: 'MDF BRANCO TX 15', length: 2050, width: 880, quantity: 1, rotateAllowed: true, edgeBanding: { top: false, bottom: false, left: false, right: false } }
];

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
          return parsed.map((p: any, idx: number) => ({
            id: String(p?.id || Date.now() + idx),
            name: String(p?.name || `Peça ${idx + 1}`),
            material: String(p?.material || 'MDF 15 ITAPUA'),
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
    } catch {}
    return INITIAL_PIECES;
  });

  const [sheetConfig, setSheetConfig] = useState<SheetConfig>(DEFAULT_SHEET);
  const [selectedMaterialFilter, setSelectedMaterialFilter] = useState<string>('all');
  const [selectedSheetView, setSelectedSheetView] = useState<number>(0);

  // Estado para Manipulação Interativa de Peças na Chapa 2D (Mover, Deslocar, Girar)
  const [selectedPlacedKey, setSelectedPlacedKey] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<'drag' | 'rotate'>('drag');
  const svgRef = React.useRef<SVGSVGElement | null>(null);

  // Reorganizar e Otimizar Peças Automaticamente na Chapa (Reset de Deslocamentos Manuais)
  const handleAutoOrganizePieces = () => {
    saveCustomOffsets({});
    setSelectedPlacedKey(null);
    toast({ 
      title: '✨ Peças Reorganizadas com Sucesso!', 
      description: 'O algoritmo recalculou o melhor aproveitamento e alinhamento geométrico de corte.' 
    });
  };

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

  // Form State para Nova Peça
  const [formName, setFormName] = useState<string>('');
  const [formMaterial, setFormMaterial] = useState<string>(availableMaterials[0] || 'MDF 15 ITAPUA');
  const [formLength, setFormLength] = useState<string>('700');
  const [formWidth, setFormWidth] = useState<string>('450');
  const [formQuantity, setFormQuantity] = useState<number>(1);
  const [formRotate, setFormRotate] = useState<boolean>(true);
  const [formEdgeBanding, setFormEdgeBanding] = useState({ top: true, bottom: false, left: false, right: false });
  const [editingPieceId, setEditingPieceId] = useState<string | null>(null);
  const [pieceFormTab, setPieceFormTab] = useState<'mdf' | 'fita'>('mdf');
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
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
    setShowNewClientModal(false);
    setNewClientForm({ name: '', phone: '', address: '', notes: '' });
    toast({ title: `🎉 Cliente "${client.name}" cadastrado e selecionado!` });
  };

  // Salvar peças no localStorage
  const savePieces = (newPieces: CutPiece[]) => {
    setPieces(newPieces);
    localStorage.setItem(`sd_cutting_pieces_${activeFolderId || 'default'}`, JSON.stringify(newPieces));
  };

  // Materiais únicos presentes nas peças
  const uniqueMaterials = useMemo(() => {
    const mats = new Set(pieces.map(p => p.material));
    return Array.from(mats);
  }, [pieces]);

  // ─── ALGORITMO DE OTIMIZAÇÃO 2D GUILHOTINA / SHELF PACKING ───────────────
  const optimizedSheets = useMemo<OptimizedSheet[]>(() => {
    const usableLength = sheetConfig.length - (sheetConfig.trimMargin * 2);
    const usableWidth = sheetConfig.width - (sheetConfig.trimMargin * 2);
    const totalSheetArea = sheetConfig.length * sheetConfig.width;

    const materialsToProcess = selectedMaterialFilter === 'all' 
      ? uniqueMaterials 
      : [selectedMaterialFilter];

    const allSheets: OptimizedSheet[] = [];
    let globalSheetCount = 1;

    materialsToProcess.forEach(mat => {
      const pieceItems: { piece: CutPiece; pIndex: number; len: number; wid: number }[] = [];
      pieces
        .filter(p => p.material === mat)
        .forEach(p => {
          for (let q = 0; q < p.quantity; q++) {
            pieceItems.push({ piece: p, pIndex: q + 1, len: p.length, wid: p.width });
          }
        });

      pieceItems.sort((a, b) => (b.len * b.wid) - (a.len * a.wid));

      let currentSheetPieces: PlacedPiece[] = [];
      type FreeRect = { x: number; y: number; w: number; h: number };
      let freeRects: FreeRect[] = [{ x: 0, y: 0, w: usableLength, h: usableWidth }];

      pieceItems.forEach(item => {
        let placed = false;

        for (let i = 0; i < freeRects.length; i++) {
          const rect = freeRects[i];
          let canFitNormal = item.len <= rect.w && item.wid <= rect.h;
          let canFitRotated = item.piece.rotateAllowed && (item.wid <= rect.w && item.len <= rect.h);

          if (canFitNormal || canFitRotated) {
            let useW = item.len;
            let useH = item.wid;
            let rotated = false;

            if (canFitRotated && !canFitNormal) {
              useW = item.wid;
              useH = item.len;
              rotated = true;
            } else if (canFitNormal && canFitRotated) {
              if (rect.w - item.wid < rect.w - item.len) {
                useW = item.wid;
                useH = item.len;
                rotated = true;
              }
            }

            currentSheetPieces.push({
              piece: item.piece,
              pieceIndex: item.pIndex,
              x: rect.x + sheetConfig.trimMargin,
              y: rect.y + sheetConfig.trimMargin,
              w: useW,
              h: useH,
              rotated
            });

            const remainingRightW = rect.w - useW - sheetConfig.bladeKerf;
            const remainingBottomH = rect.h - useH - sheetConfig.bladeKerf;

            freeRects.splice(i, 1);

            if (remainingRightW > 50) {
              freeRects.push({
                x: rect.x + useW + sheetConfig.bladeKerf,
                y: rect.y,
                w: remainingRightW,
                h: useH
              });
            }

            if (remainingBottomH > 50) {
              freeRects.push({
                x: rect.x,
                y: rect.y + useH + sheetConfig.bladeKerf,
                w: rect.w,
                h: remainingBottomH
              });
            }

            freeRects.sort((a, b) => a.y - b.y || a.x - b.x);
            placed = true;
            break;
          }
        }

        if (!placed) {
          if (currentSheetPieces.length > 0) {
            const usedArea = currentSheetPieces.reduce((acc, p) => acc + (p.w * p.h), 0);
            allSheets.push({
              sheetIndex: globalSheetCount++,
              material: mat,
              sheetConfig,
              pieces: currentSheetPieces,
              usedArea,
              totalArea: totalSheetArea,
              efficiencyPercent: Math.round((usedArea / totalSheetArea) * 100)
            });
          }

          currentSheetPieces = [];
          freeRects = [{ x: 0, y: 0, w: usableLength, h: usableWidth }];

          let useW = item.len;
          let useH = item.wid;
          let rotated = false;
          if (item.piece.rotateAllowed && item.wid <= usableLength && item.len <= usableWidth && item.len > usableLength) {
            useW = item.wid;
            useH = item.len;
            rotated = true;
          }

          currentSheetPieces.push({
            piece: item.piece,
            pieceIndex: item.pIndex,
            x: sheetConfig.trimMargin,
            y: sheetConfig.trimMargin,
            w: useW,
            h: useH,
            rotated
          });

          const remainingRightW = usableLength - useW - sheetConfig.bladeKerf;
          const remainingBottomH = usableWidth - useH - sheetConfig.bladeKerf;
          freeRects = [];
          if (remainingRightW > 50) {
            freeRects.push({ x: useW + sheetConfig.bladeKerf, y: 0, w: remainingRightW, h: useH });
          }
          if (remainingBottomH > 50) {
            freeRects.push({ x: 0, y: useH + sheetConfig.bladeKerf, w: usableLength, h: remainingBottomH });
          }
        }
      });

      if (currentSheetPieces.length > 0) {
        const usedArea = currentSheetPieces.reduce((acc, p) => acc + (p.w * p.h), 0);
        allSheets.push({
          sheetIndex: globalSheetCount++,
          material: mat,
          sheetConfig,
          pieces: currentSheetPieces,
          usedArea,
          totalArea: totalSheetArea,
          efficiencyPercent: Math.round((usedArea / totalSheetArea) * 100)
        });
      }
    });

    return allSheets;
  }, [pieces, sheetConfig, selectedMaterialFilter, uniqueMaterials]);

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


  // ─── GERAÇÃO DE PDF COMPLETO COM DESENHO GRÁFICO 2D DAS CHAPAS ─────────────
  const generateCuttingPlanPDF = (shouldDownload = true): jsPDF => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // ── PÁGINA 1: CABEÇALHO & LISTA DE CHAPAS COM DESENHO 2D ──
    optimizedSheets.forEach((sheet, sIdx) => {
      if (sIdx > 0) doc.addPage('a4', 'landscape');

      // Top Bar Elegante
      doc.setFillColor(20, 24, 32);
      doc.rect(0, 0, pageWidth, 28, 'F');

      doc.setTextColor(245, 158, 11);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('SDCOMPARATIVO - PLANO DE CORTE & OTIMIZAÇÃO 2D', 14, 12);

      doc.setTextColor(200, 200, 200);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`Cliente: ${(clientData.name || activeFolderName || 'GERAL').toUpperCase()}   |   Endereço: ${clientData.address ? clientData.address.toUpperCase() : 'NÃO INFORMADO'}   |   Data: ${new Date().toLocaleDateString('pt-BR')}   |   Chapa ${sIdx + 1} de ${optimizedSheets.length}`, 14, 19);

      doc.setTextColor(52, 211, 153);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`Aproveitamento: ${sheet.efficiencyPercent}% (${sheet.pieces.length} peças)`, pageWidth - 14, 15, { align: 'right' });

      // Dados Técnicos da Chapa
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`Material: ${sheet.material}   |   Dimensão Chapa: ${sheetConfig.length} x ${sheetConfig.width} mm   |   Refilo: ${sheetConfig.trimMargin}mm   |   Serra: ${sheetConfig.bladeKerf}mm`, 14, 34);

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
        if (p.piece.edgeBanding.top) doc.line(px, py, px + pw, py);
        if (p.piece.edgeBanding.bottom) doc.line(px, py + ph, px + pw, py + ph);
        if (p.piece.edgeBanding.left) doc.line(px, py, px, py + ph);
        if (p.piece.edgeBanding.right) doc.line(px + pw, py, px + pw, py + ph);

        // Texto com Nome e Medidas
        if (pw > 15 && ph > 8) {
          doc.setTextColor(15, 23, 42);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(Math.max(6, Math.min(9, ph / 2.5)));
          
          const labelText = `${p.piece.name.substring(0, 18)}`;
          const dimText = `${p.w} x ${p.h} mm${p.rotated ? ' 🔄' : ''}`;

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
      doc.text('SDcomparativo © 2026 - Módulo de Otimização e Corte Inteligente de MDF', pageWidth / 2, pageHeight - 4, { align: 'center' });
    });

    // ── PÁGINA FINAL: TABELA COMPLETA DE PEÇAS & FITA DE BORDA ──
    doc.addPage('a4', 'landscape');
    doc.setFillColor(20, 24, 32);
    doc.rect(0, 0, pageWidth, 24, 'F');
    doc.setTextColor(245, 158, 11);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('LISTA COMPLETA DE PEÇAS & FITAS DE BORDA', 14, 11);
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total de Peças: ${totalPiecesCount} un | Total de Chapas: ${totalSheetsNeeded} un | Fita de Borda Total: ${totalEdgeBandingMeters} metros`, 14, 18);

    // Tabela Cabeçalho
    let tableY = 32;
    doc.setFillColor(241, 245, 249);
    doc.rect(14, tableY, pageWidth - 28, 8, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('#', 17, tableY + 5.5);
    doc.text('Nome da Peça', 26, tableY + 5.5);
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
        p.edgeBanding.top ? 'C1' : '',
        p.edgeBanding.bottom ? 'C2' : '',
        p.edgeBanding.left ? 'L1' : '',
        p.edgeBanding.right ? 'L2' : '',
      ].filter(Boolean).join(', ') || '-';

      doc.setTextColor(51, 65, 85);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(String(idx + 1), 17, tableY + 4.5);
      doc.setFont('helvetica', 'bold');
      doc.text(p.name.substring(0, 35), 26, tableY + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.text(p.material.substring(0, 30), 95, tableY + 4.5);
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
      const fileName = `Plano_de_Corte_2D_${activeFolderName ? activeFolderName.replace(/\s+/g, '_') : 'SDcomparativo'}.pdf`;
      doc.save(fileName);
    }
    return doc;
  };

  // ─── ENVIAR WHATSAPP COM BAIXA AUTOMÁTICA DO PDF & MENSAGEM DETALHADA ─────

  // ─── ENVIO DIRETO DE WHATSAPP PARA NÚMERO / FORNECEDOR ESPECÍFICO ─────────
  const handleDirectSendWhatsApp = async (customPhone?: string, recipientLabel?: string) => {
    const rawPhone = customPhone !== undefined && customPhone !== '' ? customPhone : targetWhatsAppPhone;
    let cleanPhone = rawPhone.replace(/\D/g, '');

    if (cleanPhone.length >= 10 && cleanPhone.length <= 11 && !cleanPhone.startsWith('55')) {
      cleanPhone = '55' + cleanPhone;
    }

    const destName = recipientLabel || targetWhatsAppName || (activeFolderName ? `Pasta ${activeFolderName}` : 'Fornecedor');

    // 1. Gerar e baixar o PDF Gráfico 2D instantaneamente
    const doc = generateCuttingPlanPDF(false);
    const fileName = `Plano_de_Corte_2D_${activeFolderName ? activeFolderName.replace(/\s+/g, '_') : 'SDcomparativo'}.pdf`;
    doc.save(fileName);

    let msg = `📐 *PLANO DE CORTE & OTIMIZAÇÃO 2D - ${activeFolderName ? `PASTA ${activeFolderName.toUpperCase()}` : 'SD COMPARATIVO'}*\n`;
    if (destName) msg += `👤 *Destinatário:* ${destName}\n`;
    if (clientData.name) msg += `👤 *Cliente:* ${clientData.name}\n`;
    if (clientData.address) msg += `📍 *Endereço/Obra:* ${clientData.address}\n`;
    msg += `\n📦 *Total de Chapas:* ${totalSheetsNeeded} un (${sheetConfig.length}x${sheetConfig.width}mm)\n`;
    msg += `🎯 *Aproveitamento Médio:* ${avgEfficiency}%\n`;
    msg += `📏 *Fita de Borda Total:* ${totalEdgeBandingMeters} metros lineares\n`;
    msg += `✂️ *Total de Cortes:* ${totalPiecesCount} peças\n\n`;
    msg += `📋 *LISTAGEM DE PEÇAS A CORTAR:*\n`;

    pieces.forEach((p, idx) => {
      const fita = [
        p.edgeBanding.top ? 'C1' : '',
        p.edgeBanding.bottom ? 'C2' : '',
        p.edgeBanding.left ? 'L1' : '',
        p.edgeBanding.right ? 'L2' : '',
      ].filter(Boolean).join(',');

      msg += `${idx + 1}. *${p.name}* (${p.material})\n`;
      msg += `   ${toDisplay(p.length)} x ${toDisplay(p.width)} ${unitLabel} | Qtd: ${p.quantity} un`;
      if (fita) msg += ` | Fita: [${fita}]`;
      msg += '\n';
    });

    msg += `\n📎 *PDF Gráfico com o Desenho 2D de todas as chapas foi baixado! Segue anexo nesta conversa.* 📄\n`;
    msg += `\n✨ _Gerado via SDcomparativo - Otimizador Inteligente_`;

    // 2. Abrir DIRETAMENTE a conversa no WhatsApp Web com o número digitado (sem texto na caixa de entrada)
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}`
      : `https://api.whatsapp.com/send`;

    window.open(url, '_blank');
    setShowWhatsAppModal(false);
    toast({ 
      title: `🚀 WhatsApp aberto ${cleanPhone ? `para ${cleanPhone}` : ''}!`,
      description: `O arquivo "${fileName}" foi salvo nos seus Downloads. Basta arrastá-lo para o chat.`
    });
  };

  // ─── COMPARTILHAR ARQUIVO PDF NATIVAMENTE COM WHATSAPP (WEB SHARE API) ───
  const handleShareNativePDF = async () => {
    try {
      const doc = generateCuttingPlanPDF(false);
      const pdfBlob = doc.output('blob');
      const fileName = `Plano_de_Corte_2D_${activeFolderName ? activeFolderName.replace(/\s+/g, '_') : 'SDcomparativo'}.pdf`;
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          title: fileName,
          files: [pdfFile]
        });
        toast({ title: '✅ PDF Compartilhado com Sucesso!' });
        setShowWhatsAppModal(false);
      } else {
        // Fallback: Baixa e abre WhatsApp
        handleDirectSendWhatsApp();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        handleDirectSendWhatsApp();
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
    <div className="space-y-4 sm:space-y-6">

      {/* ─── CARDS DE MÉTRICAS EM TEMPO REAL (PADRONIZADO 2x2 NO MOBILE / 4x1 NO DESKTOP) ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5">
        <div className="bg-[#111317] border border-amber-500/20 p-3 sm:p-4 rounded-2xl shadow-lg flex items-center gap-2.5 sm:gap-3.5">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-gray-400 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate">Chapas</p>
            <p className="text-base sm:text-2xl font-black text-white mt-0.5 leading-tight">{totalSheetsNeeded} <span className="text-[10px] sm:text-xs text-gray-400 font-normal">un</span></p>
          </div>
        </div>

        <div className="bg-[#111317] border border-emerald-500/20 p-3 sm:p-4 rounded-2xl shadow-lg flex items-center gap-2.5 sm:gap-3.5">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-gray-400 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate">Aproveitamento</p>
            <p className="text-base sm:text-2xl font-black text-emerald-400 mt-0.5 leading-tight">{avgEfficiency}%</p>
          </div>
        </div>

        <div className="bg-[#111317] border border-blue-500/20 p-3 sm:p-4 rounded-2xl shadow-lg flex items-center gap-2.5 sm:gap-3.5">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Scissors className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-gray-400 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate">Total Peças</p>
            <p className="text-base sm:text-2xl font-black text-blue-400 mt-0.5 leading-tight">{totalPiecesCount} <span className="text-[10px] sm:text-xs text-gray-400 font-normal">cortes</span></p>
          </div>
        </div>

        <div className="bg-[#111317] border border-purple-500/20 p-3 sm:p-4 rounded-2xl shadow-lg flex items-center gap-2.5 sm:gap-3.5">
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <Sliders className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-gray-400 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider truncate">Fita de Borda</p>
            <p className="text-base sm:text-2xl font-black text-purple-400 mt-0.5 leading-tight">{totalEdgeBandingMeters} <span className="text-[10px] sm:text-xs text-gray-400 font-normal">m</span></p>
          </div>
        </div>
      </div>

      {/* ─── CARD UNIFICADO: ADICIONAR PEÇA AO PLANO DE CORTE + BARRA DE AÇÕES ORGANIZADA ─── */}
      <div className="bg-gradient-to-br from-[#121418] via-[#101216] to-[#121418] border border-amber-500/25 p-5 rounded-3xl shadow-2xl space-y-4">
        
        {/* CABEÇALHO DO CARD COM TODAS AS AÇÕES INTEGRADAS E ORGANIZADAS */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                {editingPieceId ? 'Editar Peça de Corte' : 'Adicionar Peça ao Plano de Corte'}
                <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase">
                  {pieces.length} Peças
                </span>
              </h3>
            </div>
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
                className="text-xs text-red-400 hover:underline font-semibold ml-2"
              >
                (Cancelar Edição)
              </button>
            )}
          </div>

          {/* BARRA DE AÇÕES INTEGRADA DENTRO DO CARD */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* SELETOR DE UNIDADE: MM, CM, MT */}
            <div className="bg-[#101216] border border-amber-500/40 p-0.5 rounded-xl flex items-center gap-0.5 shadow-md">
              {(['mm', 'cm', 'm'] as DimensionUnit[]).map((u) => {
                const label = u === 'm' ? 'MT' : u.toUpperCase();
                const isSelected = unit === u;
                return (
                  <button
                    key={u}
                    onClick={() => {
                      setUnit(u);
                      toast({ title: `📏 Unidade alterada para ${label}` });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all ${
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

            <button
              onClick={handleAutoOrganizePieces}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all hover:scale-[1.02] border border-emerald-400/30"
              title="Reotimizar e alinhar todas as peças automaticamente"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span>Organizar Peças</span>
            </button>

            <button
              onClick={() => setShowConfigModal(true)}
              className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
              title="Configurar dimensões da chapa, espessura da serra e refilo"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              <span>Configurar Chapa</span>
            </button>

            {/* DROPDOWN WHATSAPP */}
            <div className="relative">
              <button
                onClick={() => setShowWhatsAppModal(!showWhatsAppModal)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all hover:scale-[1.02] border border-emerald-400/40"
                title="Escolher fornecedor/contato e enviar pelo WhatsApp com PDF 2D"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp (c/ PDF e Desenho)</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showWhatsAppModal ? 'rotate-180' : ''}`} />
              </button>

              {showWhatsAppModal && (
                <div className="absolute right-0 top-full mt-2 w-88 sm:w-96 bg-[#161821] border-2 border-emerald-400/80 rounded-2xl shadow-2xl p-4 z-[9999] text-white space-y-3.5 animate-in fade-in zoom-in-95">
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

                  {/* 1. ENVIAR PARA NÚMERO DIGITADO */}
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
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-3.5 py-1.5 rounded-xl text-xs shrink-0 transition-all flex items-center gap-1 shadow-md"
                      >
                        <Send className="w-3 h-3" />
                        <span>Enviar</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. CADA FORNECEDOR COM OPÇÃO DE DIGITAR CONTATO */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold text-gray-400 uppercase">🏢 Contatos dos Fornecedores:</div>
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                      {(suppliers.length > 0 ? suppliers : [
                        { id: 'flg', name: 'FLG', phone: '11999999999' },
                        { id: 'gmad', name: 'GMAD', phone: '11988888888' },
                        { id: 'itaipu', name: 'ITAIPU', phone: '11977777777' },
                        { id: 'rio_branco', name: 'RIO BRANCO', phone: '11966666666' },
                      ]).map((sup) => {
                        const currentPhone = supplierPhones[sup.name] ?? sup.phone ?? '';
                        return (
                          <div key={sup.id} className="bg-white/5 border border-white/10 hover:border-emerald-500/40 p-2 rounded-xl transition-all space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-white">🏢 {sup.name}</span>
                              <span className="text-[9px] text-gray-400">Tel / WhatsApp:</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={currentPhone}
                                onChange={(e) => handleUpdateSupplierPhone(sup.name, e.target.value)}
                                placeholder="DDD + Número (ex: 85997682237)"
                                className="w-full bg-[#101216] border border-white/15 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 font-mono"
                              />
                              <button
                                onClick={() => handleDirectSendWhatsApp(currentPhone, sup.name)}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-2.5 py-1 rounded-lg text-xs shrink-0 flex items-center gap-1 transition-all"
                                title={`Enviar PDF diretamente para ${sup.name}`}
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

            <button
              onClick={() => generateCuttingPlanPDF(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all hover:scale-[1.02]"
              title="Baixar PDF com todos os desenhos gráficos 2D das chapas e lista"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar PDF Gráfico</span>
            </button>

            <button
              onClick={() => window.print()}
              className="bg-amber-500 hover:bg-amber-400 text-black font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all hover:scale-[1.02]"
              title="Imprimir plano de corte detalhado com mapas das chapas"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir Plano</span>
            </button>
          </div>
        </div>

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

        {/* ─── ABA SELECTOR: Descrição do MDF / Fitas de Borda ─── */}
        <div className="flex items-center gap-1.5 border-b border-white/10 pb-0">
          <button
            type="button"
            onClick={() => setPieceFormTab('mdf')}
            className={`px-4 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
              pieceFormTab === 'mdf'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500'
                : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            📐 Descrição do MDF
          </button>
          <button
            type="button"
            onClick={() => setPieceFormTab('fita')}
            className={`px-4 py-2 rounded-t-xl text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
              pieceFormTab === 'fita'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500'
                : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5'
            }`}
          >
            🔲 Fitas de Borda
          </button>
        </div>

        {/* ─── TAB CONTENT: Descrição do MDF ─── */}
        {pieceFormTab === 'mdf' && (
          <div className="space-y-3 animate-in fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-gray-400 mb-1">Nome / Descrição da Peça</label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Ex: Lateral Esquerda, Porta, Tampo..."
                  className="w-full bg-[#181b22] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-[11px] font-bold text-gray-400 mb-1">Material / MDF</label>
                <select
                  value={formMaterial}
                  onChange={e => setFormMaterial(e.target.value)}
                  className="w-full bg-[#181b22] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                >
                  {availableMaterials.map(mat => (
                    <option key={mat} value={mat}>{mat}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-1">
                <label className="block text-[11px] font-bold text-gray-400 mb-1">Comprimento ({unitLabel})</label>
                <input
                  type="text"
                  value={formLength}
                  onChange={e => setFormLength(e.target.value)}
                  placeholder={unit === 'm' ? 'Ex: 0.80' : unit === 'cm' ? 'Ex: 80' : 'Ex: 800'}
                  className="w-full bg-[#181b22] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-[11px] font-bold text-gray-400 mb-1">Largura ({unitLabel})</label>
                <input
                  type="text"
                  value={formWidth}
                  onChange={e => setFormWidth(e.target.value)}
                  placeholder={unit === 'm' ? 'Ex: 0.45' : unit === 'cm' ? 'Ex: 45' : 'Ex: 450'}
                  className="w-full bg-[#181b22] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-[11px] font-bold text-gray-400 mb-1">Quantidade</label>
                <input
                  type="number"
                  value={formQuantity}
                  min="1"
                  onChange={e => setFormQuantity(Number(e.target.value))}
                  className="w-full bg-[#181b22] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Botão rápido para ir pra aba de fita */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPieceFormTab('fita')}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 transition-colors"
              >
                Definir Fita de Borda →
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB CONTENT: Fitas de Borda ─── */}
        {pieceFormTab === 'fita' && (
          <div className="space-y-4 animate-in fade-in">
            {/* Checkboxes de Fita de Borda em Grid Compacto */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: 'top', label: 'C1 (Topo)', icon: '⬆️' },
                { key: 'bottom', label: 'C2 (Base)', icon: '⬇️' },
                { key: 'left', label: 'L1 (Esq)', icon: '⬅️' },
                { key: 'right', label: 'L2 (Dir)', icon: '➡️' },
              ].map(side => {
                const isActive = Boolean((formEdgeBanding as any)?.[side.key]);
                return (
                  <label
                    key={side.key}
                    className={`flex items-center gap-2 text-xs cursor-pointer px-3 py-2.5 rounded-xl border transition-all ${
                      isActive
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={e => setFormEdgeBanding({
                        ...formEdgeBanding,
                        [side.key]: e.target.checked
                      })}
                      className="rounded text-amber-500 focus:ring-amber-400 w-4 h-4"
                    />
                    <span className="font-bold">{side.icon} {side.label}</span>
                  </label>
                );
              })}
            </div>

            {/* Opções Avançadas */}
            <div className="flex items-center gap-2 flex-wrap">
              <label className="flex items-center gap-2 text-xs text-amber-300 cursor-pointer bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-xl hover:bg-amber-500/20 transition-all font-bold">
                <input
                  type="checkbox"
                  checked={formRotate}
                  onChange={e => setFormRotate(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-400 w-4 h-4"
                />
                🔄 Girar Peça (90°)
              </label>

              <button
                type="button"
                onClick={handleSwapFormDimensions}
                className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 px-3 py-2 rounded-xl transition-all font-bold"
                title="Inverter Comprimento e Largura (Girar 90° agora)"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Inverter Medidas (90°)
              </button>
            </div>

            {/* Botão Adicionar/Atualizar Peça */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
              <button
                type="button"
                onClick={() => setPieceFormTab('mdf')}
                className="text-[11px] text-gray-400 hover:text-white font-bold flex items-center gap-1 transition-colors"
              >
                ← Voltar pra Descrição
              </button>
              <button
                onClick={handleSavePiece}
                className="bg-amber-500 hover:bg-amber-400 text-black font-black px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-amber-500/20 shrink-0 hover:scale-[1.02] active:scale-95"
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">Mapa Visual 2D das Chapas Cortadas</h3>
              <p className="text-gray-400 text-[11px]">
                {optimizedSheets.length > 0 ? `Exibindo chapa ${selectedSheetView + 1} de ${optimizedSheets.length}` : 'Nenhuma chapa gerada ainda'}
              </p>
            </div>
          </div>

          {/* Seletor de Chapa, Filtros e Alternador de Modo de Clique */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Botão de Organização Automática e Toggles de Modo */}
            <button
              type="button"
              onClick={handleAutoOrganizePieces}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 border border-emerald-400/40 transition-all hover:scale-[1.03] active:scale-95 mr-2"
              title="Organizar todas as peças na chapa com alinhamento e aproveitamento máximo automático"
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-spin" />
              <span>✨ Organizar Peças</span>
            </button>

            {/* Toggle de Modo: Arrastar vs Clicar para Girar */}
            <div className="bg-[#101216] border border-amber-500/50 p-1 rounded-2xl flex items-center gap-1 shadow-md mr-2">
              <button
                type="button"
                onClick={() => {
                  setInteractionMode('drag');
                  toast({ title: '🖱️ Modo Arrastar & Mover ativado!' });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  interactionMode === 'drag'
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Move className="w-3.5 h-3.5" />
                <span>Arrastar / Mover</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setInteractionMode('rotate');
                  toast({ title: '🔄 Modo Clicar para Girar 90° ativado!' });
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  interactionMode === 'rotate'
                    ? 'bg-amber-500 text-black shadow-md animate-pulse'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Clicar para Girar 90°</span>
              </button>
            </div>
            {optimizedSheets.map((s, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedSheetView(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  selectedSheetView === idx
                    ? 'bg-amber-500 text-black shadow-md'
                    : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'
                }`}
              >
                Chapa {idx + 1} ({s.efficiencyPercent}%)
              </button>
            ))}
          </div>
        </div>

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
            <div className="bg-[#0b0d11] border border-white/15 rounded-2xl p-3 sm:p-4 overflow-x-auto">
              {/* Informações da Chapa em Cards Padronizados */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs mb-3 font-medium">
                <div className="bg-[#181b22] border border-white/10 px-3 py-2 rounded-xl flex items-center justify-between">
                  <span className="text-gray-400 text-[11px]">Material:</span>
                  <b className="text-amber-300 font-bold truncate ml-1">{currentActiveSheet.material}</b>
                </div>
                <div className="bg-[#181b22] border border-white/10 px-3 py-2 rounded-xl flex items-center justify-between">
                  <span className="text-gray-400 text-[11px]">Dimensões Chapa:</span>
                  <b className="text-white font-bold">{toDisplay(sheetConfig.length)} x {toDisplay(sheetConfig.width)} {unitLabel}</b>
                </div>
                <div className="bg-[#181b22] border border-white/10 px-3 py-2 rounded-xl flex items-center justify-between">
                  <span className="text-gray-400 text-[11px]">Aproveitamento:</span>
                  <b className="text-emerald-400 font-black">{currentActiveSheet.efficiencyPercent}% ({currentActiveSheet.pieces.length} peças)</b>
                </div>
              </div>

              {/* Chapa Proporcional em SVG com Fundo Branco Limpo e Peças Destacadas */}
              {(() => {
                const sheetPatId = `grain_sheet_${sanitizeId(currentActiveSheet.material)}`;
                return (
                  <div className="relative w-full overflow-hidden rounded-xl border-2 border-amber-500 shadow-2xl"
                    style={{ background: '#ffffff' }}>
                    <svg
                      ref={svgRef}
                      viewBox={`0 0 ${sheetConfig.length} ${sheetConfig.width}`}
                      className="w-full h-auto max-h-[550px] block select-none touch-none bg-white"
                      style={{ aspectRatio: `${sheetConfig.length} / ${sheetConfig.width}`, cursor: dragState ? 'grabbing' : 'default' }}
                      onPointerMove={handleSvgPointerMove}
                      onPointerUp={handleSvgPointerUp}
                      onPointerLeave={handleSvgPointerUp}
                    >
                      <defs>
                        {/* Grid técnico sutil de fundo */}
                        <pattern id="tech_grid" width="100" height="100" patternUnits="userSpaceOnUse">
                          <path d="M 100 0 L 0 0 0 100" fill="none" stroke="#f1f5f9" strokeWidth="1" />
                        </pattern>

                        {/* Patterns individuais por peça (textura do MDF de alta qualidade) */}
                        {currentActiveSheet.pieces.map((p, pIdx) => {
                          const piecePalette = getMaterialPalette(p.piece.material);
                          const patId = `grain_piece_${pIdx}_${sanitizeId(p.piece.material)}`;
                          return (
                            <pattern key={patId} id={patId} x={p.x} y={p.y} width="120" height="60" patternUnits="userSpaceOnUse">
                              <rect width="120" height="60" fill={piecePalette.base} />
                              <path d="M0 10 Q30 8 60 12 Q90 16 120 10" stroke={piecePalette.grain} strokeWidth="1.8" fill="none" opacity={piecePalette.grainOpacity + 0.05} />
                              <path d="M0 22 Q25 19 55 24 Q85 28 120 22" stroke={piecePalette.grain} strokeWidth="1" fill="none" opacity={piecePalette.grainOpacity * 0.8} />
                              <path d="M0 34 Q40 30 70 36 Q95 40 120 34" stroke={piecePalette.grain} strokeWidth="2" fill="none" opacity={piecePalette.grainOpacity + 0.03} />
                              <path d="M0 48 Q30 44 65 50 Q95 53 120 48" stroke={piecePalette.grain} strokeWidth="1" fill="none" opacity={piecePalette.grainOpacity * 0.6} />
                            </pattern>
                          );
                        })}
                      </defs>

                      {/* Fundo da chapa – Branco Limpo Técnico com Grade Suave */}
                      <rect
                        x="0"
                        y="0"
                        width={sheetConfig.length}
                        height={sheetConfig.width}
                        fill="#ffffff"
                        stroke="#f59e0b"
                        strokeWidth="8"
                      />
                      <rect
                        x="0"
                        y="0"
                        width={sheetConfig.length}
                        height={sheetConfig.width}
                        fill="url(#tech_grid)"
                      />

                      {/* Linha de Refilo */}
                      <rect
                        x={sheetConfig.trimMargin}
                        y={sheetConfig.trimMargin}
                        width={sheetConfig.length - (sheetConfig.trimMargin * 2)}
                        height={sheetConfig.width - (sheetConfig.trimMargin * 2)}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="4"
                        strokeDasharray="20,12"
                        opacity="0.85"
                      />

                      {/* Peças Posicionadas com cores, texturas e nomes altamente visíveis */}
                      {currentActiveSheet.pieces.map((p, pIdx) => {
                        const pKey = `${selectedSheetView}_${pIdx}`;
                        const isSelected = selectedPlacedKey === pKey;
                        const offset = customOffsets[pKey] || { dx: 0, dy: 0, rotated: false };
                        const effW = offset.rotated ? p.h : p.w;
                        const effH = offset.rotated ? p.w : p.h;
                        const effX = Math.round(p.x + offset.dx);
                        const effY = Math.round(p.y + offset.dy);

                        const patId = `grain_piece_${pIdx}_${sanitizeId(p.piece.material)}`;

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
                              x={effX + 4}
                              y={effY + 4}
                              width={effW - 8}
                              height={effH - 8}
                              fill="#00000040"
                              rx="6"
                            />
                            {/* Corpo Principal da Peça com Textura do MDF */}
                            <rect
                              x={effX}
                              y={effY}
                              width={effW}
                              height={effH}
                              fill={`url(#${patId})`}
                              stroke={isSelected ? '#f59e0b' : '#0f172a'}
                              strokeWidth={isSelected ? '10' : '5'}
                              rx="6"
                            />
                            {/* Borda interna brilhante */}
                            <rect
                              x={effX + 3}
                              y={effY + 3}
                              width={effW - 6}
                              height={effH - 6}
                              fill="none"
                              stroke="#ffffff"
                              strokeWidth="2"
                              rx="4"
                              opacity="0.6"
                            />

                            {/* Destaque quando Selecionada */}
                            {isSelected && (
                              <>
                                <rect
                                  x={effX - 8}
                                  y={effY - 8}
                                  width={effW + 16}
                                  height={effH + 16}
                                  fill="none"
                                  stroke="#f59e0b"
                                  strokeWidth="5"
                                  strokeDasharray="16,8"
                                  rx="10"
                                  opacity="0.95"
                                />
                                <circle cx={effX} cy={effY} r="10" fill="#f59e0b" stroke="#ffffff" strokeWidth="3" />
                                <circle cx={effX + effW} cy={effY} r="10" fill="#f59e0b" stroke="#ffffff" strokeWidth="3" />
                                <circle cx={effX} cy={effY + effH} r="10" fill="#f59e0b" stroke="#ffffff" strokeWidth="3" />
                                <circle cx={effX + effW} cy={effY + effH} r="10" fill="#f59e0b" stroke="#ffffff" strokeWidth="3" />
                              </>
                            )}

                            {/* Indicação de Fita de Borda */}
                            {p.piece.edgeBanding.top && (
                              <line x1={effX} y1={effY} x2={effX + effW} y2={effY} stroke="#eab308" strokeWidth="12" strokeDasharray="12,6" />
                            )}
                            {p.piece.edgeBanding.bottom && (
                              <line x1={effX} y1={effY + effH} x2={effX + effW} y2={effY + effH} stroke="#eab308" strokeWidth="12" strokeDasharray="12,6" />
                            )}
                            {p.piece.edgeBanding.left && (
                              <line x1={effX} y1={effY} x2={effX} y2={effY + effH} stroke="#eab308" strokeWidth="12" strokeDasharray="12,6" />
                            )}
                            {p.piece.edgeBanding.right && (
                              <line x1={effX + effW} y1={effY} x2={effX + effW} y2={effY + effH} stroke="#eab308" strokeWidth="12" strokeDasharray="12,6" />
                            )}

                            {/* Número da peça (badge circular em destaque) */}
                            {effW > 80 && effH > 60 && (
                              <>
                                <circle cx={effX + 26} cy={effY + 26} r="20" fill={isSelected ? '#f59e0b' : '#0f172a'} stroke="#ffffff" strokeWidth="2.5" />
                                <text
                                  x={effX + 26}
                                  y={effY + 26}
                                  fill={isSelected ? '#000000' : '#ffffff'}
                                  fontSize="20"
                                  fontWeight="900"
                                  textAnchor="middle"
                                  dominantBaseline="central"
                                >
                                  {pIdx + 1}
                                </text>
                              </>
                            )}

                            {/* Rótulo da Peça - ALTA VISIBILIDADE com Badge Branco/Preto */}
                            {effW > 60 && effH > 40 && (
                              <g>
                                {/* Fundo branco opaco para legibilidade máxima */}
                                <rect
                                  x={effX + (effW - Math.min(effW - 20, Math.max(140, (p.piece.name.length + 4) * (Math.min(effW / 8, 42) * 0.6)))) / 2}
                                  y={effY + effH / 2 - (effH > 90 ? 36 : 22)}
                                  width={Math.min(effW - 20, Math.max(140, (p.piece.name.length + 4) * (Math.min(effW / 8, 42) * 0.6)))}
                                  height={effH > 90 ? 72 : 44}
                                  fill="#ffffff"
                                  fillOpacity="0.94"
                                  stroke="#0f172a"
                                  strokeWidth="2.5"
                                  rx="8"
                                />
                                {/* Nome da Peça em Preto Negrito */}
                                <text
                                  x={effX + effW / 2}
                                  y={effY + effH / 2 - (effH > 90 ? 12 : 2)}
                                  fill="#0f172a"
                                  fontSize={Math.max(16, Math.min(42, Math.min(effW / 8, effH / 3.5)))}
                                  fontWeight="900"
                                  textAnchor="middle"
                                  dominantBaseline="central"
                                >
                                  {p.piece.name}
                                </text>
                                {/* Dimensões da Peça em Destaque Âmbar/Marrom */}
                                {effH > 90 && (
                                  <text
                                    x={effX + effW / 2}
                                    y={effY + effH / 2 + 18}
                                    fill="#b45309"
                                    fontSize={Math.max(14, Math.min(32, Math.min(effW / 11, effH / 5)))}
                                    fontWeight="900"
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                  >
                                    {toDisplay(effW)} x {toDisplay(effH)} {unitLabel} {offset.rotated ? '🔄' : ''}
                                  </text>
                                )}
                              </g>
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
                                  cx={effX + effW - 64} 
                                  cy={effY + 26} 
                                  r="18" 
                                  fill="#9333ea" 
                                  stroke="#ffffff" 
                                  strokeWidth="2.5" 
                                />
                                <text
                                  x={effX + effW - 64}
                                  y={effY + 26}
                                  fill="#ffffff"
                                  fontSize="15"
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
                                  cx={effX + effW - 26} 
                                  cy={effY + 26} 
                                  r="18" 
                                  fill="#f59e0b" 
                                  stroke="#ffffff" 
                                  strokeWidth="2.5" 
                                />
                                <text
                                  x={effX + effW - 26}
                                  y={effY + 26}
                                  fill="#000000"
                                  fontSize="16"
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
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-400 rounded border border-black"></span> Peças Cortadas</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-white border-2 border-amber-500 rounded"></span> Chapa / Fundo Branco</span>
                <span className="flex items-center gap-1.5"><span className="w-3.5 h-1 bg-yellow-400 border border-black"></span> Fita de Borda</span>
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
                  type="number"
                  value={toDisplay(sheetConfig.length)}
                  onChange={e => setSheetConfig({ ...sheetConfig, length: toMM(Number(e.target.value)) })}
                  className="w-full bg-[#101216] border border-white/10 rounded-xl px-3 py-2 text-white font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 mb-1">Largura da Chapa ({unitLabel})</label>
                <input
                  type="number"
                  value={toDisplay(sheetConfig.width)}
                  onChange={e => setSheetConfig({ ...sheetConfig, width: toMM(Number(e.target.value)) })}
                  className="w-full bg-[#101216] border border-white/10 rounded-xl px-3 py-2 text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 mb-1">Espessura Serra (Kerf mm)</label>
                  <input
                    type="number"
                    value={sheetConfig.bladeKerf}
                    onChange={e => setSheetConfig({ ...sheetConfig, bladeKerf: Number(e.target.value) })}
                    className="w-full bg-[#101216] border border-white/10 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-400 mb-1">Refilo das Bordas (mm)</label>
                  <input
                    type="number"
                    value={sheetConfig.trimMargin}
                    onChange={e => setSheetConfig({ ...sheetConfig, trimMargin: Number(e.target.value) })}
                    className="w-full bg-[#101216] border border-white/10 rounded-xl px-3 py-2 text-white font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <button
                onClick={() => setShowConfigModal(false)}
                className="bg-amber-500 hover:bg-amber-400 text-black font-black px-4 py-2 rounded-xl text-xs"
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
                  <label className="block text-xs font-bold text-gray-300 mb-1">Material / MDF</label>
                  <select
                    value={quickForm.material}
                    onChange={e => setQuickForm({ ...quickForm, material: e.target.value })}
                    className="w-full bg-[#181b22] border border-white/15 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    {availableMaterials.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
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

    </div>
  );
};
