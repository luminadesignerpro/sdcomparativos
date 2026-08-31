import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import { 
  X, Paintbrush, Undo2, Redo2, RefreshCcw, Eye, Download, 
  Move, Sofa, Trash2, Plus, Minus, Check, MousePointer2, Sparkles, Share2
} from 'lucide-react';
import { Sofa3D, Table3D, Plant3D, Rug3D } from './Furniture3DModels';
import { cleanupObject, relightImage } from '@/services/stabilityService';
import { useToast } from '@/hooks/use-toast';
import { generatePromobXML, generateDXF, downloadFile } from '@/services/promobService';

interface DetectedItem {
  nome: string;
  confianca: number;
  box?: { xmin: number; ymin: number; xmax: number; ymax: number };
}

interface WallPolygon {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  opacity: number;
  texture?: string;
}

type Tool = 'SELECT' | 'WALL_PAINT' | 'ADD_FURNITURE' | 'AI_ERASE' | 'RELIGHT';

interface FurnitureItem {
  id: string; name: string; type: 'sofa' | 'table' | 'rug' | 'plant';
  imageUrl: string;
  x: number; y: number; w: number; h: number;
  color: string; opacity: number; rotation: number; zIndex: number;
}

const HD_ASSETS = {
  sofa: '/src/assets/furniture/sofa.png',
  table: '/src/assets/furniture/table.png',
  rug: '/src/assets/furniture/rug.png',
  plant: '/src/assets/furniture/plant.png',
};

const FURNITURE_CATALOG = [
  { name: 'Sofá de Luxo HD', type: 'sofa' as const, imageUrl: HD_ASSETS.sofa, w: 25, h: 18, color: '#FFFFFF' },
  { name: 'Mesa de Jantar HD', type: 'table' as const, imageUrl: HD_ASSETS.table, w: 20, h: 20, color: '#FFFFFF' },
  { name: 'Tapete Premium HD', type: 'rug' as const, imageUrl: HD_ASSETS.rug, w: 35, h: 25, color: '#FFFFFF' },
  { name: 'Planta Interior HD', type: 'plant' as const, imageUrl: HD_ASSETS.plant, w: 12, h: 12, color: '#FFFFFF' },
];

const DETECTED_COLORS = [
  { fill: 'rgba(212,175,55,0.15)', stroke: 'rgba(212,175,55,0.9)', label: '#D4AF37' },
  { fill: 'rgba(255,50,50,0.15)', stroke: 'rgba(255,50,50,0.9)', label: '#ff3232' },
  { fill: 'rgba(50,150,255,0.15)', stroke: 'rgba(50,150,255,0.9)', label: '#3296ff' },
];

const WALL_MATERIALS = [
  { name: 'Pintura Lisa', type: 'COLOR', value: '#F5F5F0' },
  { name: 'Mármore Br.', type: 'TEXTURE', value: 'https://images.unsplash.com/photo-1533154683836-84ea7a0bc310?auto=format&fit=crop&q=80&w=200' },
  { name: 'Madeira Nobre', type: 'TEXTURE', value: 'https://images.unsplash.com/photo-1541810574719-79883bc2f50d?auto=format&fit=crop&q=80&w=200' },
  { name: 'Tijolo Br.', type: 'TEXTURE', value: 'https://images.unsplash.com/photo-1523413555809-0fb83c9c1d0e?auto=format&fit=crop&q=80&w=200' },
];

interface Props {
  imagePreview: string;
  detectedItems: DetectedItem[];
  onClose: () => void;
  onExport: (dataUrl: string) => void;
  ambiente?: string;
  projectName?: string;
  initialDimensions?: { largura: number; altura: number; profundidade: number };
}

export default function ARStudio2D({ 
  imagePreview, 
  detectedItems, 
  onClose, 
  onExport,
  ambiente = 'Ambiente',
  projectName = `Projeto_${new Date().getTime()}`,
  initialDimensions = { largura: 3, altura: 2.6, profundidade: 0.6 }
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const [currentImage, setCurrentImage] = useState(imagePreview);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // SAFETY TIMEOUTS (Fixed position)
  useEffect(() => {
    let timeout: any;
    if (isProcessing) {
      timeout = setTimeout(() => setIsProcessing(false), 8000);
    }
    return () => clearTimeout(timeout);
  }, [isProcessing]);
  const [tool, setTool] = useState<Tool>('SELECT');
  const [wallColor, setWallColor] = useState<string | null>(null);
  const [wallOpacity, setWallOpacity] = useState(0.35);
  const [wallPolygons, setWallPolygons] = useState<WallPolygon[]>([]);
  const [activePolygon, setActivePolygon] = useState<{ x: number, y: number }[]>([]);
  const [erasedIds, setErasedIds] = useState<string[]>([]);
  const [furniture, setFurniture] = useState<FurnitureItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [show3D, setShow3D] = useState(false);
  const [dragState, setDragState] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [history, setHistory] = useState<{ furniture: FurnitureItem[]; erasedIds: string[]; wallColor: string | null; wallPolygons: WallPolygon[]; currentImage: string }[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.src = currentImage;
    img.onload = () => { imgRef.current = img; setImageLoaded(true); };
  }, [currentImage]);

  const pushHistory = useCallback(() => {
    const snap = { furniture: [...furniture], erasedIds: [...erasedIds], wallColor, wallPolygons: [...wallPolygons], currentImage };
    setHistory(prev => [...prev.slice(0, historyIdx + 1), snap]);
    setHistoryIdx(prev => prev + 1);
  }, [furniture, erasedIds, wallColor, wallPolygons, currentImage, historyIdx]);

  const undo = () => { 
    if (historyIdx <= 0) return; 
    const s = history[historyIdx - 1]; 
    setFurniture(s.furniture); 
    setErasedIds(s.erasedIds); 
    setWallColor(s.wallColor); 
    setWallPolygons(s.wallPolygons);
    setCurrentImage(s.currentImage); 
    setHistoryIdx(p => p - 1); 
  };
  
  const redo = () => { 
    if (historyIdx >= history.length - 1) return; 
    const s = history[historyIdx + 1]; 
    setFurniture(s.furniture); 
    setErasedIds(s.erasedIds); 
    setWallColor(s.wallColor); 
    setWallPolygons(s.wallPolygons);
    setCurrentImage(s.currentImage); 
    setHistoryIdx(p => p + 1); 
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (tool !== 'WALL_PAINT' || !containerRef.current) return;
    
    // Check if clicking near first point to close polygon
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (activePolygon.length >= 3) {
      const first = activePolygon[0];
      const dist = Math.sqrt((x - first.x)**2 + (y - first.y)**2);
      if (dist < 2) { // Close polygon
        if (!wallColor) return;
        const newPoly: WallPolygon = {
          id: `w_${Date.now()}`,
          points: [...activePolygon],
          color: wallColor,
          opacity: wallOpacity
        };
        pushHistory();
        setWallPolygons(prev => [...prev, newPoly]);
        setActivePolygon([]);
        return;
      }
    }
    setActivePolygon(prev => [...prev, { x, y }]);
  };

  const addFurniture = (cat: typeof FURNITURE_CATALOG[0]) => {
    pushHistory();
    const item: FurnitureItem = {
      id: `f_${Date.now()}`, name: cat.name, type: cat.type, imageUrl: cat.imageUrl,
      x: 35 + Math.random() * 10, y: 35 + Math.random() * 10,
      w: cat.w, h: cat.h, color: cat.color, opacity: 1,
      rotation: 0, zIndex: furniture.length + 10,
    };
    setFurniture(prev => [...prev, item]);
    setTool('SELECT');
    setSelectedItemId(item.id);
  };

  const handleAiEraser = async (id: string) => {
    const item = detectedItems.find(it => it.nome === id);
    if (!item || !containerRef.current || !imgRef.current) return;

    setIsProcessing(true);
    pushHistory();

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = imgRef.current;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;

    // 1. Create Mask (Black object on White background)
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const { xmin, ymin, xmax, ymax } = item.box;
    const l = (xmin / 1000) * canvas.width;
    const t = (ymin / 1000) * canvas.height;
    const w = ((xmax - xmin) / 1000) * canvas.width;
    const h = ((ymax - ymin) / 1000) * canvas.height;
    
    // Slight padding for better coverage
    const pad = Math.max(w, h) * 0.05;
    ctx.fillStyle = 'black';
    ctx.fillRect(l - pad, t - pad, w + pad * 2, h + pad * 2);
    
    const maskBase64 = canvas.toDataURL('image/png');

    try {
      const result = await cleanupObject({ image: currentImage, mask: maskBase64 });
      if (result) {
        setCurrentImage(result);
        setErasedIds(prev => [...prev, id]);
        toast({ title: "Inpainting Elite Completo", description: "O objeto foi removido profissionalmente." });
      } else {
        // Fallback simulation (local blur)
        setTimeout(() => {
          setErasedIds(prev => [...prev, id]);
          setIsProcessing(false);
          toast({ title: "Simulação de Remoção", description: "Usando inpainting local (API Stability não detectada)." });
        }, 1500);
      }
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const eraseDetected = (id: string) => { pushHistory(); setErasedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); };
  const handleCleanupItem = async (item: DetectedItem) => {
    if (!item.box) {
      toast({ title: "Ops!", description: "Não conseguimos localizar este objeto com precisão." });
      return;
    }

    setIsProcessing(true);
    try {
      const maskCanvas = document.createElement('canvas');
      const img = new Image();
      img.src = currentImage;
      await new Promise(r => img.onload = r);
      maskCanvas.width = img.width;
      maskCanvas.height = img.height;
      const ctx = maskCanvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = 'black'; ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      const x = (item.box.xmin / 1000) * maskCanvas.width;
      const y = (item.box.ymin / 1000) * maskCanvas.height;
      const w = ((item.box.xmax - item.box.xmin) / 1000) * maskCanvas.width;
      const h = ((item.box.ymax - item.box.ymin) / 1000) * maskCanvas.height;
      ctx.fillStyle = 'white'; ctx.fillRect(x - w*0.05, y - h*0.05, w * 1.1, h * 1.1);
      const maskBase64 = maskCanvas.toDataURL('image/png');
      const cleanedImageUrl = await cleanupObject({ image: currentImage, mask: maskBase64 });
      if (cleanedImageUrl) {
        pushHistory();
        setCurrentImage(cleanedImageUrl);
        toast({ title: "Smart Erase!", description: "Objeto removido com realismo pelo Clipdrop." });
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Erro na API", description: "Verifique sua chave Clipdrop.", variant: "destructive" });
    } finally { setIsProcessing(false); }
  };

  const handleRelight = async () => {
    setIsProcessing(true);
    try {
      const relightedImageUrl = await relightImage(
        currentImage, 
        "bright modern studio lighting, high fidelity, professional interior design photography"
      );

      if (relightedImageUrl) {
        pushHistory();
        setCurrentImage(relightedImageUrl);
        toast({ title: "Iluminação IA!", description: "A cena foi reluzida com realismo profissional." });
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Erro no Relight", description: "Verifique sua conexão ou cota Clipdrop.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const removeFurniture = (id: string) => { 
    pushHistory(); setFurniture(prev => prev.filter(f => f.id !== id)); setSelectedItemId(null); 
  };

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    if (tool !== 'SELECT') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setSelectedItemId(id);
    const item = furniture.find(f => f.id === id);
    if (!item) return;
    setDragState({ id, startX: e.clientX, startY: e.clientY, origX: item.x, origY: item.y });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragState || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragState.startX) / rect.width) * 100;
    const dy = ((e.clientY - dragState.startY) / rect.height) * 100;
    setFurniture(prev => prev.map(f => f.id === dragState.id ? { ...f, x: Math.max(0, Math.min(90, dragState.origX + dx)), y: Math.max(0, Math.min(90, dragState.origY + dy)) } : f));
  };

  const onPointerUp = () => { if (dragState) { pushHistory(); setDragState(null); } };


  const exportImage = () => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = container.getBoundingClientRect();
    canvas.width = img.naturalWidth; 
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    
    // 1. Base Image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 1.5. Magic Erase (Inpainting simulation)
    erasedIds.forEach(id => {
      const item = detectedItems.find(it => it.nome === id);
      if (!item || !item.box) return;
      const { xmin, ymin, xmax, ymax } = item.box;
      const l = (xmin / 1000) * canvas.width;
      const t = (ymin / 1000) * canvas.height;
      const w = ((xmax - xmin) / 1000) * canvas.width;
      const h = ((ymax - ymin) / 1000) * canvas.height;
      
      ctx.save();
      // Professional Multi-Sample Inpainting simulation
      ctx.globalAlpha = 1;
      ctx.filter = 'blur(12px) brightness(1.05) saturate(0.9)';
      
      // Sample 1 (Offset Top-Left)
      const ox1 = Math.max(0, l - w * 0.3);
      const oy1 = Math.max(0, t - h * 0.3);
      ctx.drawImage(img, ox1, oy1, w, h, l, t, w, h);
      
      // Sample 2 (Offset Right-Bottom, 50% opacity)
      ctx.globalAlpha = 0.5;
      const ox2 = Math.min(canvas.width - w, l + w * 0.3);
      const oy2 = Math.min(canvas.height - h, t + h * 0.3);
      ctx.drawImage(img, ox2, oy2, w, h, l, t, w, h);
      
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(l, t, w, h);
      ctx.restore();
    });
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    wallPolygons.forEach(poly => {
      ctx.globalAlpha = poly.opacity;
      ctx.fillStyle = poly.color;
      ctx.beginPath();
      poly.points.forEach((p, i) => {
        const px = (p.x / 100) * canvas.width;
        const py = (p.y / 100) * canvas.height;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();

    // 3. Furniture (scaled to image size)
    furniture.forEach(f => {
      ctx.save();
      const fx = (f.x / 100) * canvas.width;
      const fy = (f.y / 100) * canvas.height;
      const fw = (f.w / 100) * canvas.width;
      const fh = (f.h / 100) * canvas.height;
      
      ctx.translate(fx + fw / 2, fy + fh / 2);
      ctx.rotate((f.rotation * Math.PI) / 180);
      ctx.globalAlpha = f.opacity;
      
      // Load image synchronously if possible or use a preloaded one
      // For simplicity here, we assume f.imageUrl refers to preloaded assets 
      // or we draw a placeholder if it's not ready. 
      // In a real app we'd wait for all furniture images to load.
      const fImg = new Image();
      fImg.src = f.imageUrl;
      ctx.drawImage(fImg, -fw / 2, -fh / 2, fw, fh);
      ctx.restore();
    });

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    onExport(dataUrl);
  };

  const exportToPromob = (format: 'XML' | 'DXF') => {
    if (format === 'XML') {
      const xml = generatePromobXML({
        projectName,
        customerName: 'Cliente Studio',
        ambiente,
        dimensions: {
          width: initialDimensions.largura,
          height: initialDimensions.altura,
          depth: initialDimensions.profundidade
        },
        items: [
          ...furniture.map(f => ({ name: f.name, type: f.type })),
          ...wallPolygons.map((_, i) => ({ name: `Pintura Parede ${i+1}`, type: 'WallFinish' }))
        ],
        imageUrl: currentImage,
        simulationUrl: currentImage // In Studio, currentImage is already the "simulated" one
      });
      downloadFile(xml, `${projectName}.xml`, 'text/xml');
      toast({ title: "✅ XML Exportado", description: "O arquivo para Promob Plus foi gerado." });
    } else {
      const dxf = generateDXF(initialDimensions.largura, initialDimensions.profundidade);
      downloadFile(dxf, `${projectName}.dxf`, 'application/dxf');
      toast({ title: "✅ DXF Exportado", description: "Planta baixa técnica gerada." });
    }
  };

  const selectedFurniture = furniture.find(f => f.id === selectedItemId);

  return (
    <div className="fixed inset-0 z-[9998] flex flex-col animate-in fade-in" style={{ background: '#0a0a0a' }}>
      {/* Premium Glassmorphic Header */}
      <header className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-b relative z-[70] backdrop-blur-xl bg-black/40" style={{ borderColor: 'rgba(212,175,55,0.15)' }}>
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center transform rotate-3 shadow-[0_0_20px_rgba(212,175,55,0.3)] transition-transform hover:rotate-0" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}>
            <Paintbrush className="w-5 h-5 text-black" />
          </div>
          <div>
            <p className="text-white font-black text-base tracking-tight leading-none">Studio AR Elite</p>
            <p className="text-[9px] uppercase font-black tracking-[0.2em] mt-1" style={{ color: 'rgba(212,175,55,0.8)' }}>Pro Design Workflow</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-white/5 rounded-2xl p-1 border border-white/10 mr-2">
            <button onClick={undo} disabled={historyIdx <= 0} className="p-2.5 rounded-xl disabled:opacity-20 transition-all hover:bg-white/10 text-white"><Undo2 className="w-4 h-4" /></button>
            <button onClick={redo} disabled={historyIdx >= history.length - 1} className="p-2.5 rounded-xl disabled:opacity-20 transition-all hover:bg-white/10 text-white"><Redo2 className="w-4 h-4" /></button>
          </div>

          <button onClick={() => setShow3D(!show3D)} 
            className={`px-4 py-2.5 font-black text-[10px] rounded-2xl flex items-center gap-2 transition-all uppercase tracking-widest ${show3D ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' : 'bg-blue-600/10 border border-blue-600/30 text-blue-400 hover:bg-blue-600/20'}`}>
            <Eye className="w-4 h-4" /> {show3D ? 'Planta 2D' : 'Simular 3D'}
          </button>

          <div className="h-8 w-px bg-white/10 mx-1" />

          <button onClick={() => { setIsProcessing(true); setTimeout(() => { addFurniture(FURNITURE_CATALOG[0]); addFurniture(FURNITURE_CATALOG[1]); setIsProcessing(false); }, 1500); }} 
            className="px-4 py-2.5 font-black text-[10px] rounded-2xl flex items-center gap-2 transition-all bg-amber-500/10 border border-amber-500/30 text-amber-500 hover:bg-amber-500/20 uppercase tracking-widest animate-pulse">
            <RefreshCcw className="w-4 h-4" /> Design IA
          </button>

          <div className="h-8 w-px bg-white/10 mx-1" />

          <button onClick={() => exportToPromob('XML')} className="px-4 py-2.5 font-black text-[10px] rounded-2xl flex items-center gap-2 transition-all bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 uppercase tracking-widest">
            <Download className="w-4 h-4" /> XML
          </button>
          
          <button onClick={() => exportToPromob('DXF')} className="px-4 py-2.5 font-black text-[10px] rounded-2xl flex items-center gap-2 transition-all bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 uppercase tracking-widest">
            <Download className="w-4 h-4" /> DXF
          </button>

          <button onClick={exportImage} className="px-6 py-2.5 font-black text-xs rounded-2xl flex items-center gap-2 transition-all shadow-2xl text-black hover:scale-105 active:scale-95" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)', boxShadow: '0 8px 32px rgba(212,175,55,0.3)' }}>
            <Check className="w-4 h-4" /> FINALIZAR
          </button>
          
          <button onClick={onClose} className="p-2.5 rounded-2xl transition-all hover:bg-red-500/20 hover:text-red-400 text-gray-500"><X className="w-5 h-5" /></button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* TOOL HINTS (Problem 2 Fix) */}
        {tool === 'WALL_PAINT' && !isProcessing && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[60] animate-bounce pointer-events-none">
            <div className="bg-amber-500 text-white px-6 py-3 rounded-2xl shadow-xl font-black text-xs flex items-center gap-2 border-2 border-white">
              <Paintbrush className="w-4 h-4" /> CLIQUE NA PAREDE PARA DESENHAR A ÁREA
            </div>
          </div>
        )}
        {tool === 'AI_ERASE' && !isProcessing && erasedIds.length === 0 && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[60] animate-bounce pointer-events-none">
            <div className="bg-red-500 text-white px-6 py-3 rounded-2xl shadow-xl font-black text-xs flex items-center gap-2 border-2 border-white">
              <Trash2 className="w-4 h-4" /> SELECIONE ITENS PARA APAGAR
            </div>
          </div>
        )}
        {/* Left Toolbar */}
        <aside className="w-16 flex flex-col items-center py-4 gap-2 flex-shrink-0 border-r" style={{ background: '#111111', borderColor: 'rgba(255,255,255,0.06)' }}>
          {([
            { id: 'SELECT' as Tool, icon: Move, label: 'Mover' },
            { id: 'WALL_PAINT' as Tool, icon: Paintbrush, label: 'Paredes' },
            { id: 'ADD_FURNITURE' as Tool, icon: Sofa, label: 'Móveis HD' },
            { id: 'AI_ERASE' as Tool, icon: Trash2, label: 'Magic Erase' },
            { id: 'RELIGHT' as Tool, icon: Sparkles, label: 'Iluminar', onClick: handleRelight },
          ]).map(({ id, icon: Icon, label, onClick }) => (
            <button key={id} onClick={() => { setTool(id); if (onClick) onClick(); }}
              className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all text-[8px] font-black uppercase tracking-tighter"
              style={tool === id
                ? { background: 'linear-gradient(135deg, #D4AF37, #F5E583)', color: '#000', boxShadow: '0 0 15px rgba(212,175,55,0.4)' }
                : { background: 'rgba(255,255,255,0.05)', color: '#666' }}
              title={label}>
              <Icon className="w-5 h-5" />{label}
            </button>
          ))}
          <div className="w-8 h-px my-2" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <button onClick={() => { setFurniture([]); setErasedIds([]); setWallColor(null); setCurrentImage(imagePreview); pushHistory(); }}
            className="w-11 h-11 rounded-2xl flex flex-col items-center justify-center gap-0.5 text-[8px] font-black transition-all"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }} title="Limpar Tudo">
            <RefreshCcw className="w-4 h-4" />RESET
          </button>
        </aside>

        {/* Canvas Area */}
        <div ref={containerRef} 
          className="flex-1 relative overflow-hidden flex items-center justify-center select-none"
          style={{ background: '#0d0d0d' }} 
          onPointerMove={onPointerMove} 
          onPointerUp={onPointerUp}
          onClick={handleCanvasClick}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            {isProcessing && (
              <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500">
                <Sparkles className="w-16 h-16 text-amber-500 animate-pulse mb-6" />
                <div className="flex flex-col items-center gap-2 text-center">
                  <p className="text-2xl font-black text-white uppercase tracking-[0.3em] animate-pulse">Smart Erase Ativo</p>
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.4em] opacity-80">Removendo objeto via Clipdrop API...</p>
                </div>
                <div className="mt-10 w-64 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 animate-[progress_2s_ease-in-out_infinite]" style={{ width: '40%' }} />
                </div>
              </div>
            )}
            <img src={currentImage} alt="Ambiente" className="max-w-full max-h-full object-contain"
              style={{ userSelect: 'none', pointerEvents: 'none', display: 'block' }} onLoad={() => setImageLoaded(true)} />
            
            {imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-full h-full">
                  
                  {/* WALL POLYGONS LAYER */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-auto" style={{ mixBlendMode: 'multiply' }}>
                    {wallPolygons.map(poly => (
                      <polygon
                        key={poly.id}
                        points={poly.points.map(p => `${p.x},${p.y}`).join(' ')}
                        fill={poly.color}
                        opacity={poly.opacity}
                        style={{ cursor: tool === 'WALL_PAINT' ? 'pointer' : 'default' }}
                      />
                    ))}
                    
                    {/* Active Drawing Polygon */}
                    {activePolygon.length > 0 && (
                      <g>
                        <polyline
                          points={activePolygon.map(p => `${p.x},${p.y}`).join(' ')}
                          fill="none"
                          stroke="#D4AF37"
                          strokeWidth="0.2"
                          strokeDasharray="1 1"
                        />
                        {activePolygon.map((p, i) => (
                          <circle
                            key={i}
                            cx={p.x}
                            cy={p.y}
                            r={i === 0 ? 0.8 : 0.4}
                            fill={i === 0 ? '#D4AF37' : 'white'}
                            stroke="#D4AF37"
                            strokeWidth="0.1"
                          />
                        ))}
                      </g>
                    )}
                  </svg>

                  {/* Legacy global wall color (for backward compatibility or quick preview) */}
                  {wallColor && !wallPolygons.length && activePolygon.length === 0 && (
                    <div className="absolute inset-0 transition-all duration-300"
                      style={{ 
                        backgroundColor: wallColor, 
                        opacity: wallOpacity * 0.5, 
                        mixBlendMode: 'soft-light',
                      }} />
                  )}

                  {/* Detected items */}
                  <div className="absolute inset-0 pointer-events-auto">
                    {detectedItems.map((item, i) => {
                      const nome = item.nome;
                      const isErased = erasedIds.includes(nome);
                      if (isErased) return null;

                      let left = 10, top = 20, width = 20, height = 25;
                      if (item.box) {
                        left = (item.box.xmin / 1000) * 100; top = (item.box.ymin / 1000) * 100;
                        width = Math.max(8, ((item.box.xmax - item.box.xmin) / 1000) * 100);
                        height = Math.max(8, ((item.box.ymax - item.box.ymin) / 1000) * 100);
                      }
                      const color = DETECTED_COLORS[i % DETECTED_COLORS.length];
                      
                      return (
                        <div key={nome} 
                          className={`absolute group rounded-2xl flex items-end justify-center transition-all duration-300 ${tool === 'AI_ERASE' ? 'cursor-pointer hover:scale-105 active:scale-95' : 'pointer-events-none'}`} 
                          style={{
                            left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`,
                            backgroundColor: tool === 'AI_ERASE' ? 'rgba(212,175,55,0.05)' : color.fill,
                            border: `2px solid ${tool === 'AI_ERASE' ? 'rgba(212,175,55,0.4)' : color.stroke}`,
                            boxShadow: `0 4px 20px ${color.fill.replace('0.15', '0.1')}`,
                          }}
                        >
                          <span className="bg-black/80 backdrop-blur-sm text-[8px] font-black px-1.5 py-0.5 rounded-md shadow-md text-center mb-1 text-white opacity-80 group-hover:opacity-100">
                            {nome}
                          </span>
                          {tool === 'AI_ERASE' && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleCleanupItem(item); }}
                              className="absolute -top-3 -right-3 w-8 h-8 bg-amber-500 hover:bg-amber-600 border-2 border-white text-black rounded-full transition-all flex items-center justify-center shadow-xl active:scale-90"
                              title="Smart Erase (Clipdrop)"
                            >
                              <Sparkles className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Added furniture — professional HD assets */}
                  <div className="absolute inset-0 pointer-events-auto">
                    {furniture.map(f => {
                      const isSelected = selectedItemId === f.id;
                      return (
                        <div key={f.id}
                          className={`absolute transition-shadow ${tool === 'SELECT' ? 'cursor-grab active:cursor-grabbing' : ''}`}
                          style={{
                            left: `${f.x}%`, top: `${f.y}%`, width: `${f.w}%`, height: `${f.h}%`,
                            transform: `rotate(${f.rotation}deg)`,
                            opacity: f.opacity, zIndex: f.zIndex,
                            filter: isSelected ? 'drop-shadow(0 0 12px rgba(212,175,55,0.9))' : 'drop-shadow(0 8px 16px rgba(0,0,0,0.4))',
                            outline: isSelected ? '2px solid rgba(212,175,55,0.8)' : 'none',
                            borderRadius: '4px',
                          }}
                          onPointerDown={(e) => onPointerDown(e, f.id)}
                          onClick={(e) => { e.stopPropagation(); setSelectedItemId(f.id); }}
                        >
                          <img src={f.imageUrl} alt={f.name} className="w-full h-full object-contain pointer-events-none" />
                          <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[8px] font-black px-2 py-0.5 rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                            {f.name}
                          </span>
                          {isSelected && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); removeFurniture(f.id); }}
                              className="absolute -top-3 -right-3 w-8 h-8 bg-red-600 hover:bg-red-700 border-2 border-white text-white rounded-full flex items-center justify-center shadow-lg active:scale-90"
                              title="Remover móvel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 3D VIEWER OVERLAY — FIXED BLACK SCREEN */}
            {show3D && (
              <div className="absolute inset-0 z-50 bg-[#0d0d0d] animate-in zoom-in-95 duration-500">
                <Canvas shadows dpr={[1, 2]} camera={{ position: [5, 5, 5], fov: 45 }}>
                  <Environment preset="city" />
                  <ambientLight intensity={0.7} />
                  <pointLight position={[10, 10, 10]} intensity={1.5} castShadow />
                  <directionalLight position={[-5, 5, 5]} intensity={1} />
                  
                  <group position={[0, -1, 0]}>
                    {furniture.map(f => (
                      <group key={f.id} position={[(f.x - 50) / 10, 0, (f.y - 50) / 10]} rotation={[0, -f.rotation * Math.PI / 180, 0]}>
                        {f.type === 'sofa' && <Sofa3D color={f.color} />}
                        {f.type === 'table' && <Table3D color={f.color} />}
                        {f.type === 'plant' && <Plant3D />}
                        {f.type === 'rug' && <Rug3D color={f.color} />}
                      </group>
                    ))}
                  </group>
                  
                  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.02, 0]} receiveShadow>
                    <planeGeometry args={[20, 20]} />
                    <meshStandardMaterial color="#222" metalness={0.2} roughness={0.8} />
                  </mesh>
                  <OrbitControls makeDefault />
                </Canvas>
                <div className="absolute top-4 left-4 bg-black/50 backdrop-blur p-4 rounded-2xl border border-white/10 pointer-events-none">
                  <h4 className="text-white font-black text-sm uppercase">Simulação 3D Ativa</h4>
                  <p className="text-gray-400 text-[10px]">Gire e aproxime para ver os detalhes</p>
                </div>
                <button 
                  onClick={() => setShow3D(false)}
                  className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all backdrop-blur-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            
            {/* Visual Crosshair for Painting/Erasing */}
            {tool === 'WALL_PAINT' && !isProcessing && (
              <div className="absolute inset-0 pointer-events-none cursor-none z-40 flex items-center justify-center">
                 <div className="w-10 h-10 border-2 border-amber-500/50 rounded-full flex items-center justify-center animate-pulse">
                    <div className="w-1 h-1 bg-amber-500 rounded-full" />
                 </div>
              </div>
            )}
            
            {isProcessing && (
              <div className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in zoom-in">
                <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1 bg-amber-500 text-black text-[10px] font-black rounded-full animate-bounce">
                    <Sparkles className="w-3 h-3" /> IA PROFESSIONAL
                  </div>
                  <p className="text-white font-black text-xl tracking-tight uppercase">Processando Ambiente</p>
                  <p className="text-amber-500/70 text-sm font-bold">Inpainting & Reconstrução de Texturas Elite...</p>
                </div>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Right Panel */}
        <aside className="w-64 overflow-y-auto flex-shrink-0 border-l" style={{ background: '#111111', borderColor: 'rgba(255,255,255,0.06)' }}>
          {tool === 'WALL_PAINT' && (
            <div className="p-4 space-y-4">
              <h3 className="text-white font-black text-sm flex items-center gap-2">
                <Paintbrush className="w-4 h-4 text-amber-400" /> Pintura Seletiva
              </h3>
              
              <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Como usar:</p>
                <ol className="text-[11px] text-gray-400 space-y-1 list-decimal list-inside font-medium">
                  <li>Escolha uma cor abaixo</li>
                  <li>Clique na parede para marcar os cantos</li>
                  <li>Clique no <span className="text-amber-400 font-bold underline">primeiro ponto</span> para fechar</li>
                </ol>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {WALL_MATERIALS.map(m => (
                  <button key={m.name} onClick={() => { setWallColor(m.value); pushHistory(); }}
                    className="relative rounded-xl h-14 transition-all border-2 overflow-hidden group shadow-lg"
                    style={{ backgroundColor: m.type === 'COLOR' ? m.value : 'transparent', borderColor: wallColor === m.value ? '#D4AF37' : 'rgba(255,255,255,0.1)' }}
                    title={m.name}>
                    {m.type === 'TEXTURE' && <img src={m.value} className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />}
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                    {wallColor === m.value && <div className="absolute inset-0 flex items-center justify-center bg-amber-500/20"><Check className="w-5 h-5 text-white drop-shadow-md" /></div>}
                  </button>
                ))}
              </div>

              {wallColor && (
                <div className="space-y-2 pt-2 border-t border-white/8">
                  <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(212,175,55,0.7)' }}>Opacidade da Pintura</p>
                  <input type="range" min={0.1} max={0.9} step={0.05} value={wallOpacity}
                    onChange={e => setWallOpacity(parseFloat(e.target.value))} className="w-full accent-amber-500" />
                  <p className="text-gray-500 text-xs text-center">{Math.round(wallOpacity * 100)}%</p>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Ações</p>
                <button onClick={() => { setActivePolygon([]); pushHistory(); }}
                  disabled={activePolygon.length === 0}
                  className="w-full py-2.5 rounded-xl text-xs font-bold transition-all bg-white/5 text-gray-400 border border-white/10 disabled:opacity-30">
                  Cancelar Desenho Atual
                </button>
                <button onClick={() => { setWallPolygons([]); pushHistory(); }}
                  disabled={wallPolygons.length === 0}
                  className="w-full py-2.5 rounded-xl text-xs font-bold transition-all bg-red-500/10 text-red-400 border border-red-500/20 disabled:opacity-30">
                  Remover Todas as Pinturas
                </button>
              </div>
            </div>
          )}

          {tool === 'ADD_FURNITURE' && (
            <div className="p-4 space-y-3">
              <h3 className="text-white font-black text-sm flex items-center gap-2">
                <Sofa className="w-4 h-4 text-amber-400" /> Catálogo de Móveis
              </h3>
              <div className="space-y-1.5">
                {FURNITURE_CATALOG.map(cat => (
                  <button key={cat.name} onClick={() => addFurniture(cat)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group"
                    style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; e.currentTarget.style.background = 'rgba(212,175,55,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}>
                    <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white/5 p-1">
                      <img src={cat.imageUrl} alt={cat.name} className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <p className="text-white text-xs font-bold">{cat.name}</p>
                      <p className="text-[10px]" style={{ color: 'rgba(212,175,55,0.6)' }}>HD Realista — arrastar</p>
                    </div>
                    <Plus className="w-4 h-4 ml-auto text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {tool === 'AI_ERASE' && (
            <div className="p-4 space-y-3">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-2">
                <h3 className="text-amber-500 font-black text-sm flex items-center gap-2">
                  <Trash2 className="w-4 h-4" /> AI Magic Eraser
                </h3>
              </div>
              <p className="text-gray-400 text-[11px] leading-relaxed font-medium">Selecione móveis da foto original para remove-los permanentemente usando Inpainting de IA.</p>
              <div className="space-y-2 pt-2">
                {detectedItems.map(item => {
                  const isErased = erasedIds.includes(item.nome);
                  return (
                    <button key={item.nome} onClick={() => !isErased && handleAiEraser(item.nome)}
                      disabled={isProcessing || isErased}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group disabled:opacity-50"
                      style={{ background: isErased ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)', borderColor: isErased ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)' }}>
                      {isErased ? <Check className="w-4 h-4 text-green-500" /> : <Eye className="w-4 h-4 text-gray-500" />}
                      <span className={`text-xs font-bold ${isErased ? 'text-green-500' : 'text-white'}`}>{item.nome}</span>
                      {!isErased && <span className="ml-auto text-[8px] font-black bg-amber-500 text-black px-1.5 py-0.5 rounded uppercase opacity-0 group-hover:opacity-100 transition-opacity">Remover IA</span>}
                    </button>
                  );
                })}
              </div>
                {erasedIds.length > 0 && (
                  <button onClick={() => { setErasedIds([]); pushHistory(); }} className="w-full mt-2 py-2 rounded-xl text-xs font-bold transition-all" style={{ background: 'rgba(255,255,255,0.06)', color: '#777' }}>Restaurar Todos</button>
                )}
            </div>
          )}

          {tool === 'RELIGHT' && (
            <div className="p-4 space-y-4">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-2">
                <h3 className="text-amber-500 font-black text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> Professional Relighting
                </h3>
              </div>
              <p className="text-gray-400 text-[11px] leading-relaxed font-medium">Re-ilumine sua foto original usando IA para destacar as novas texturas.</p>
              
              <div className="grid grid-cols-1 gap-2 pt-2">
                {[
                  { name: 'Luz Natural (Janela)', prompt: 'Soft natural daylight from a large window on the side, realistic shadows', icon: '☀️' },
                  { name: 'Iluminação de Estúdio', prompt: 'Professional studio three-point lighting, bright and clear', icon: '📸' },
                  { name: 'Vibe Cinematográfica', prompt: 'Cinematic warm lighting with dramatic shadows and high contrast', icon: '🎬' },
                  { name: 'Luz de Teto (LED)', prompt: 'Standard overhead indoor ceiling LED lights, neutral temperature', icon: '💡' },
                ].map((p) => (
                  <button 
                    key={p.name}
                    onClick={() => handleRelight(p.prompt)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all text-left group"
                  >
                    <span className="text-xl">{p.icon}</span>
                    <span className="text-white text-xs font-bold">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tool === 'SELECT' && (
            <div className="p-4 space-y-4">
              <h3 className="text-white font-black text-sm flex items-center gap-2">
                <Move className="w-4 h-4 text-amber-400" /> Propriedades
              </h3>
              {selectedFurniture ? (
                <div className="space-y-3">
                  <p className="font-black text-sm" style={{ color: '#D4AF37' }}>{selectedFurniture.name}</p>
                  <div className="w-full h-24 rounded-xl overflow-hidden bg-white/5 border border-white/10 p-2 flex items-center justify-center">
                    <img src={selectedFurniture.imageUrl} alt={selectedFurniture.name} className="max-w-full max-h-full object-contain" />
                  </div>
                  {[
                    { label: 'Opacidade', min: 0.3, max: 1, step: 0.05, value: selectedFurniture.opacity, key: 'opacity' as const, fmt: (v: number) => `${Math.round(v * 100)}%` },
                    { label: 'Rotação', min: -180, max: 180, step: 5, value: selectedFurniture.rotation, key: 'rotation' as const, fmt: (v: number) => `${v}°` },
                  ].map(({ label, min, max, step, value, key, fmt }) => (
                    <div key={key} className="space-y-1">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
                      <input type="range" min={min} max={max} step={step} value={value}
                        onChange={e => setFurniture(prev => prev.map(f => f.id === selectedFurniture.id ? { ...f, [key]: parseFloat(e.target.value) } : f))}
                        className="w-full accent-amber-500" />
                      <p className="text-gray-600 text-[10px] text-center">{fmt(value)}</p>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-2">
                    {(['w', 'h'] as const).map(k => (
                      <div key={k} className="space-y-1">
                        <p className="text-[10px] font-bold uppercase" style={{ color: 'rgba(212,175,55,0.5)' }}>{k === 'w' ? 'Largura' : 'Altura'}</p>
                        <div className="flex items-center gap-1">
                          <button onClick={() => setFurniture(prev => prev.map(f => f.id === selectedFurniture.id ? { ...f, [k]: Math.max(5, f[k] - 2) } : f))} className="w-6 h-6 rounded text-gray-400 text-xs" style={{ background: 'rgba(255,255,255,0.08)' }}><Minus className="w-3 h-3 mx-auto" /></button>
                          <span className="text-white text-xs font-bold flex-1 text-center">{selectedFurniture[k]}%</span>
                          <button onClick={() => setFurniture(prev => prev.map(f => f.id === selectedFurniture.id ? { ...f, [k]: Math.min(60, f[k] + 2) } : f))} className="w-6 h-6 rounded text-gray-400 text-xs" style={{ background: 'rgba(255,255,255,0.08)' }}><Plus className="w-3 h-3 mx-auto" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => removeFurniture(selectedFurniture.id)} className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                    <Trash2 className="w-3.5 h-3.5" /> Remover Móvel
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-gray-600 text-xs leading-relaxed">Clique em um móvel para editar. Arraste para mover.</p>
                  {furniture.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'rgba(212,175,55,0.5)' }}>Itens Adicionados</p>
                      {furniture.map(f => (
                        <button key={f.id} onClick={() => setSelectedItemId(f.id)} className="w-full flex items-center gap-2 p-2 rounded-xl border transition-all text-left"
                          style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.08)' }}>
                          <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0 p-1 bg-white/5"><img src={f.imageUrl} className="w-full h-full object-contain" /></div>
                          <span className="text-white text-xs font-bold">{f.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* Bottom Bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-t text-[10px] font-bold uppercase tracking-widest flex-shrink-0" style={{ background: '#111111', borderColor: 'rgba(255,255,255,0.06)', color: '#444' }}>
        <span style={{ color: 'rgba(212,175,55,0.6)' }}>
          {tool === 'WALL_PAINT' ? '🎨 Selecione uma cor' : tool === 'ADD_FURNITURE' ? '🛋️ Escolha um móvel' : tool === 'ERASE' ? '✕ Clique para apagar/restaurar' : '↔ Clique e arraste para mover'}
        </span>
        {erasedIds.length > 0 && <span className="ml-auto text-red-400">{erasedIds.length} item(s) apagados</span>}
        {furniture.length > 0 && <span className={erasedIds.length > 0 ? '' : 'ml-auto'} style={{ color: 'rgba(212,175,55,0.6)' }}>{furniture.length} móvel(is) adicionado(s)</span>}
        {wallColor && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border border-white/20 inline-block" style={{ backgroundColor: wallColor }} />Pintura ativa</span>}
      </div>
    </div>
  );
}
