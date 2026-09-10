import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Camera, Ruler, Check, RefreshCcw, ChevronRight, Info, AlertTriangle } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────────
   ARMeasureTool v3 — Medição por Perspectiva de Câmera
   Fluxo: Câmera → Foto → 4 cantos do chão → Referência → Cálculo automático
   Sem LiDAR, funciona em qualquer celular com câmera traseira.
───────────────────────────────────────────────────────────────────────────── */

interface ARMeasureToolProps {
  onClose: () => void;
  onConfirmMeasurement: (meters: number, dims?: { width: number; depth: number; height: number }) => void;
}

type Phase = 'INTRO' | 'CAMERA' | 'CORNERS' | 'REFERENCE' | 'HEIGHT' | 'RESULT' | 'ERROR';
type Corner = { x: number; y: number };

// ─── Homografia: 4 pontos na foto → retângulo real ───────────────────────────

function gaussElim(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    [M[col], M[maxRow]] = [M[maxRow], M[col]];
    for (let row = col + 1; row < n; row++) {
      const f = M[row][col] / M[col][col];
      for (let j = col; j <= n; j++) M[row][j] -= f * M[col][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n] / M[i][i];
    for (let j = i + 1; j < n; j++) x[i] -= (M[i][j] / M[i][i]) * x[j];
  }
  return x;
}

function computeHomography(src: Corner[], dst: Corner[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: sx, y: sy } = src[i];
    const { x: dx, y: dy } = dst[i];
    A.push([-sx, -sy, -1, 0, 0, 0, sx * dx, sy * dx]);
    b.push(-dx);
    A.push([0, 0, 0, -sx, -sy, -1, sx * dy, sy * dy]);
    b.push(-dy);
  }
  const h = gaussElim(A, b);
  return [...h, 1];
}

function applyH(H: number[], x: number, y: number): Corner {
  const w = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
}

function dist(a: Corner, b: Corner) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

// Dado 4 cantos no sentido horário: TL, TR, BR, BL (perspectiva)
// Retorna proporção {w, h} do retângulo real (em pixels normalizados)
function getPerspectiveDims(corners: Corner[]): { w: number; h: number } {
  const [tl, tr, br, bl] = corners;
  const wTop = dist(tl, tr);
  const wBot = dist(bl, br);
  const hLeft = dist(tl, bl);
  const hRight = dist(tr, br);
  const W = Math.max(wTop, wBot);
  const H = Math.max(hLeft, hRight);
  return { w: W, h: H };
}

// ─── Referências de escala ────────────────────────────────────────────────────

const REFERENCES = [
  { label: 'Porta padrão (80cm)', value: 0.80, emoji: '🚪' },
  { label: 'Piso 60×60cm', value: 0.60, emoji: '⬛' },
  { label: 'Piso 30×30cm', value: 0.30, emoji: '◾' },
  { label: 'Folha A4 (29.7cm)', value: 0.297, emoji: '📄' },
  { label: 'Personalizado...', value: -1, emoji: '✏️' },
];

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function ARMeasureTool({ onClose, onConfirmMeasurement }: ARMeasureToolProps) {
  const [phase, setPhase] = useState<Phase>('INTRO');
  const [corners, setCorners] = useState<Corner[]>([]);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [selectedRef, setSelectedRef] = useState<number>(0.80);
  const [customRef, setCustomRef] = useState('');
  const [isCustomRef, setIsCustomRef] = useState(false);
  const [refPixels, setRefPixels] = useState<Corner[]>([]);
  const [heightPixels, setHeightPixels] = useState<Corner[]>([]);
  const [ppm, setPpm] = useState<number>(0);
  const [dims, setDims] = useState<{ width: number; depth: number; height: number } | null>(null);
  const [imgSize, setImgSize] = useState({ w: 1, h: 1 });
  const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 });
  const [errorMsg, setErrorMsg] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Iniciar câmera
  const startCamera = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Câmera não suportada (verifique se está acessando via HTTPS).');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setPhase('CAMERA');
    } catch (err: any) {
      setErrorMsg(err.message || 'Câmera não acessível. Verifique as permissões do navegador.');
      setPhase('ERROR');
    }
  }, []);

  // Parar câmera
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // Capturar foto
  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setPhotoDataUrl(dataUrl);
    setNaturalSize({ w: video.videoWidth, h: video.videoHeight });
    stopCamera();
    setCorners([]);
    setRefPixels([]);
    setHeightPixels([]);
    setPhase('CORNERS');
  };

  // Tap na imagem para marcar cantos
  const handleImageTap = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }

    // Posição relativa à imagem exibida
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    // Converter para coordenadas naturais da foto
    const nx = px * naturalSize.w;
    const ny = py * naturalSize.h;

    setImgSize({ w: rect.width, h: rect.height });

    if (phase === 'CORNERS') {
      if (corners.length < 4) {
        const newCorners = [...corners, { x: nx, y: ny }];
        setCorners(newCorners);
        if (newCorners.length === 4) {
          // Avançar para referência
          setPhase('REFERENCE');
        }
      }
    }
  };

  // Marcar 2 pontos de referência na foto
  const handleRefTap = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }

    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    const nx = px * naturalSize.w;
    const ny = py * naturalSize.h;

    const newRef = [...refPixels, { x: nx, y: ny }];
    setRefPixels(newRef);

    if (newRef.length === 2) {
      // Calcular tudo
      calculateDimensions(corners, newRef, selectedRef);
    }
  };

  // Marcar 2 pontos para a altura
  const handleHeightTap = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ('touches' in e) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    else { clientX = (e as React.MouseEvent).clientX; clientY = (e as React.MouseEvent).clientY; }

    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    const nx = px * naturalSize.w;
    const ny = py * naturalSize.h;

    const newPts = [...heightPixels, { x: nx, y: ny }];
    setHeightPixels(newPts);

    if (newPts.length === 2 && dims && ppm > 0) {
      // Calcular altura:
      const hPx = dist(newPts[0], newPts[1]);
      const H = hPx / ppm;
      
      setDims({ ...dims, height: parseFloat(H.toFixed(2)) });
      setPhase('RESULT');
    }
  };

  const calculateDimensions = (
    corners4: Corner[],
    refPts: Corner[],
    refMeters: number,
  ) => {
    // 1. Proporção do chão via perspectiva
    const { w: propW, h: propD } = getPerspectiveDims(corners4);

    // 2. Pixels por metro usando referência
    const refPx = dist(refPts[0], refPts[1]);
    const computedPpm = refPx / refMeters;
    setPpm(computedPpm);

    // 3. Medidas absolutas (em metros)
    const W = propW / computedPpm;
    const D = propD / computedPpm;

    setDims({ width: parseFloat(W.toFixed(2)), depth: parseFloat(D.toFixed(2)), height: 0 });
    setPhase('HEIGHT');
  };

  // Converter coordenadas naturais → exibidas na tela
  const toDisplay = (pt: Corner): Corner => {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const rect = img.getBoundingClientRect();
    return {
      x: (pt.x / naturalSize.w) * rect.width + rect.left - (containerRef.current?.getBoundingClientRect().left || 0),
      y: (pt.y / naturalSize.h) * rect.height + rect.top - (containerRef.current?.getBoundingClientRect().top || 0),
    };
  };

  const cornerLabels = ['1 – Canto Esq. Frente', '2 – Canto Dir. Frente', '3 – Canto Dir. Fundo', '4 – Canto Esq. Fundo'];
  const cornerColors = ['#F5A823', '#22c55e', '#3b82f6', '#a855f7'];

  // ── INTRO ────────────────────────────────────────────────────────────────────
  if (phase === 'INTRO') return (
    <div className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 rounded-[32px] bg-amber-500/15 flex items-center justify-center mb-6 ring-2 ring-amber-500/30">
        <Camera className="w-12 h-12 text-amber-400" />
      </div>
      <h2 className="text-3xl font-black text-white mb-3 tracking-tight">Medição por Câmera</h2>
      <p className="text-gray-400 text-sm mb-2 max-w-xs leading-relaxed">
        Fotografe a parede inteira, mostrando o chão e o teto do ambiente e marque os <strong className="text-white">4 cantos do chão</strong>.
      </p>
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 mb-8 max-w-xs text-left space-y-2">
        {['📸 Enquadre a parede, chão e teto', '👆 Marque os 4 cantos do chão', '📏 Indique 1 referência', '📏 Marque chão e teto'].map((s, i) => (
          <p key={i} className="text-amber-200 text-xs font-medium">{s}</p>
        ))}
      </div>
      <div className="w-full max-w-xs space-y-3">
        <button onClick={startCamera} className="w-full py-5 rounded-2xl font-black text-black text-base shadow-xl flex items-center justify-center gap-2" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}>
          <Camera className="w-5 h-5" /> ABRIR CÂMERA
        </button>
      </div>
      <button onClick={onClose} className="absolute top-5 right-5 p-3 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
    </div>
  );

  // ── CAMERA ───────────────────────────────────────────────────────────────────
  if (phase === 'CAMERA') return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" playsInline muted />
      {/* Grid overlay */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)',
        backgroundSize: '25% 25%',
      }} />
      <div className="absolute inset-0 flex flex-col">
        <div className="bg-gradient-to-b from-black/80 to-transparent pt-10 pb-6 px-5 flex justify-between items-center">
          <div>
            <p className="text-amber-400 font-black text-sm uppercase tracking-widest">Fotografar Ambiente</p>
            <p className="text-gray-300 text-xs mt-1">Enquadre TODO o chão do ambiente</p>
          </div>
          <button onClick={() => { stopCamera(); setPhase('INTRO'); }} className="p-3 bg-red-500/80 rounded-2xl text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-40 border-2 border-amber-400/50 rounded-lg relative">
            {['tl','tr','bl','br'].map(pos => (
              <div key={pos} className={`absolute w-5 h-5 border-amber-400 ${pos.includes('t') ? 'top-0' : 'bottom-0'} ${pos.includes('l') ? 'left-0' : 'right-0'} ${pos.includes('t') ? (pos.includes('l') ? 'border-t-2 border-l-2' : 'border-t-2 border-r-2') : (pos.includes('l') ? 'border-b-2 border-l-2' : 'border-b-2 border-r-2')}`} />
            ))}
          </div>
        </div>
        <div className="bg-gradient-to-t from-black/90 to-transparent px-5 pb-12 pt-8 flex flex-col items-center gap-4">
          <button onClick={capturePhoto} className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-2xl active:scale-95 transition-transform">
            <div className="w-16 h-16 rounded-full bg-white border-4 border-gray-300" />
          </button>
          <p className="text-gray-400 text-xs">Toque para fotografar</p>
        </div>
      </div>
    </div>
  );

  // ── CORNERS + REFERENCE + HEIGHT ─────────────────────────────────────────────
  if ((phase === 'CORNERS' || phase === 'REFERENCE' || phase === 'HEIGHT') && photoDataUrl) {
    const isRefPhase = phase === 'REFERENCE';
    const isHeightPhase = phase === 'HEIGHT';

    const displayedCorners = corners.map(c => toDisplay(c));
    const displayedRef = refPixels.map(c => toDisplay(c));
    const displayedHeight = heightPixels.map(c => toDisplay(c));

    return (
      <div ref={containerRef} className="fixed inset-0 z-[9999] bg-black flex flex-col select-none">
        {/* Photo */}
        <div className="relative flex-1 overflow-hidden flex items-center justify-center">
          <img
            ref={imgRef}
            src={photoDataUrl}
            alt="foto"
            className="max-w-full max-h-full object-contain cursor-crosshair"
            draggable={false}
            onTouchStart={isHeightPhase ? handleHeightTap : (isRefPhase ? handleRefTap : handleImageTap)}
            onClick={isHeightPhase ? handleHeightTap : (isRefPhase ? handleRefTap : handleImageTap)}
          />

          {/* SVG overlay */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            {/* Polígono dos cantos */}
            {displayedCorners.length >= 2 && (
              <polyline
                points={displayedCorners.map(p => `${p.x},${p.y}`).join(' ')}
                fill={displayedCorners.length === 4 ? 'rgba(245,168,35,0.15)' : 'none'}
                stroke="#F5A823" strokeWidth="2" strokeDasharray={displayedCorners.length < 4 ? '6 4' : '0'}
              />
            )}
            {displayedCorners.length === 4 && (
              <line x1={displayedCorners[3].x} y1={displayedCorners[3].y} x2={displayedCorners[0].x} y2={displayedCorners[0].y} stroke="#F5A823" strokeWidth="2" />
            )}
            {/* Marcadores dos cantos */}
            {displayedCorners.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={18} fill={cornerColors[i] + '33'} stroke={cornerColors[i]} strokeWidth="2" />
                <text x={p.x} y={p.y + 5} textAnchor="middle" fill={cornerColors[i]} fontSize="13" fontWeight="bold">{i + 1}</text>
              </g>
            ))}
            {/* Linha de referência */}
            {isRefPhase && displayedRef.map((p, i) => (
              <g key={`ref-${i}`}>
                <circle cx={p.x} cy={p.y} r={16} fill="rgba(59,130,246,0.3)" stroke="#3b82f6" strokeWidth="2" />
                <text x={p.x} y={p.y + 5} textAnchor="middle" fill="#3b82f6" fontSize="11" fontWeight="bold">{i === 0 ? 'A' : 'B'}</text>
              </g>
            ))}
            {isRefPhase && displayedRef.length === 2 && (
              <line x1={displayedRef[0].x} y1={displayedRef[0].y} x2={displayedRef[1].x} y2={displayedRef[1].y} stroke="#3b82f6" strokeWidth="2" strokeDasharray="6 3" />
            )}
            {/* Marcadores da altura */}
            {isHeightPhase && displayedHeight.map((p, i) => (
              <g key={`height-${i}`}>
                <circle cx={p.x} cy={p.y} r={16} fill="rgba(34,197,94,0.3)" stroke="#22c55e" strokeWidth="2" />
                <text x={p.x} y={p.y + 5} textAnchor="middle" fill="#22c55e" fontSize="11" fontWeight="bold">H{i + 1}</text>
              </g>
            ))}
            {isHeightPhase && displayedHeight.length === 2 && (
              <line x1={displayedHeight[0].x} y1={displayedHeight[0].y} x2={displayedHeight[1].x} y2={displayedHeight[1].y} stroke="#22c55e" strokeWidth="2" strokeDasharray="6 3" />
            )}
          </svg>
        </div>

        {/* Bottom HUD */}
        <div className="bg-[#0f0f0f] border-t border-white/10 px-5 pt-4 pb-8 space-y-3">
          {isHeightPhase ? (
            <>
              <div>
                <p className="text-white font-black text-sm">Marque a Altura</p>
                <p className="text-gray-500 text-xs mt-0.5">Toque no chão e depois no teto (mesma direção)</p>
              </div>
              
              <p className="text-center text-green-400 text-xs font-bold">
                {heightPixels.length === 0 ? 'Toque na base da parede (chão) →' : heightPixels.length === 1 ? 'Toque no topo da parede (teto) →' : 'Calculando...'}
              </p>
              <div className="flex gap-2">
                <button onClick={() => { setHeightPixels([]); }} className="flex-1 py-2 rounded-xl text-gray-500 text-xs border border-white/10 hover:text-white transition-all">
                  <RefreshCcw className="w-3 h-3 inline mr-1" /> Limpar
                </button>
                <button onClick={() => { setPhase('REFERENCE'); setRefPixels([]); setHeightPixels([]); }} className="flex-1 py-2 rounded-xl text-gray-500 text-xs border border-white/10 hover:text-white transition-all">
                  ← Voltar ref.
                </button>
              </div>
              <div className="w-full text-center">
                 <button onClick={() => { setDims({ ...dims!, height: 2.70 }); setPhase('RESULT'); }} className="text-gray-500 text-xs mt-2 underline">Digitar altura manualmente (Teto 2.70m)</button>
              </div>
            </>
          ) : !isRefPhase ? (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-black text-sm">Marque os 4 cantos do chão</p>
                  <p className="text-gray-500 text-xs mt-0.5">{corners.length}/4 marcados</p>
                </div>
                <button onClick={() => setCorners([])} className="text-gray-500 text-xs flex items-center gap-1 hover:text-red-400">
                  <RefreshCcw className="w-3 h-3" /> Limpar
                </button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {cornerLabels.map((label, i) => (
                  <div key={i} className={`rounded-xl px-2 py-2 text-center transition-all ${i < corners.length ? 'opacity-100' : 'opacity-30'}`} style={{ background: cornerColors[i] + '22', border: `1px solid ${cornerColors[i]}44` }}>
                    <div className="w-5 h-5 rounded-full mx-auto flex items-center justify-center mb-1" style={{ background: i < corners.length ? cornerColors[i] : 'transparent', border: `1.5px solid ${cornerColors[i]}` }}>
                      <span className="text-[9px] font-black text-white">{i + 1}</span>
                    </div>
                    <p className="text-[8px] text-gray-400 leading-tight">{['Esq.Frente', 'Dir.Frente', 'Dir.Fundo', 'Esq.Fundo'][i]}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => { stopCamera(); setPhase('INTRO'); setCorners([]); setPhotoDataUrl(null); }} className="w-full py-3 rounded-xl text-gray-500 text-xs border border-white/10 hover:border-red-500/30 hover:text-red-400 transition-all">
                ← Nova foto
              </button>
            </>
          ) : (
            <>
              <div>
                <p className="text-white font-black text-sm">Marque 1 referência de medida</p>
                <p className="text-gray-500 text-xs mt-0.5">Toque em 2 pontos com distância conhecida</p>
              </div>
              {/* Seletor de referência */}
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                {REFERENCES.map(r => (
                  <button
                    key={r.label}
                    onClick={() => {
                      if (r.value === -1) { setIsCustomRef(true); }
                      else { setSelectedRef(r.value); setIsCustomRef(false); }
                      setRefPixels([]);
                    }}
                    className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold border transition-all whitespace-nowrap ${(isCustomRef ? r.value === -1 : selectedRef === r.value) ? 'bg-blue-500/20 border-blue-400 text-blue-300' : 'bg-white/5 border-white/10 text-gray-400'}`}
                  >
                    {r.emoji} {r.label}
                  </button>
                ))}
              </div>
              {isCustomRef && (
                <div className="flex items-center gap-2">
                  <input
                    type="number" inputMode="decimal"
                    value={customRef}
                    onChange={e => { setCustomRef(e.target.value); setSelectedRef(parseFloat(e.target.value.replace(',', '.')) || 0); }}
                    placeholder="Ex: 0.90"
                    className="flex-1 bg-[#1a1a1a] border border-white/10 text-white text-center py-2 rounded-xl outline-none focus:border-blue-400 text-sm"
                  />
                  <span className="text-gray-400 text-sm">metros</span>
                </div>
              )}
              <p className="text-center text-blue-400 text-xs font-bold">
                {refPixels.length === 0 ? 'Toque no ponto A →' : refPixels.length === 1 ? 'Toque no ponto B →' : 'Calculando...'}
              </p>
              <div className="flex gap-2">
                <button onClick={() => { setRefPixels([]); }} className="flex-1 py-2 rounded-xl text-gray-500 text-xs border border-white/10 hover:text-white transition-all">
                  <RefreshCcw className="w-3 h-3 inline mr-1" /> Limpar ref.
                </button>
                <button onClick={() => setPhase('CORNERS')} className="flex-1 py-2 rounded-xl text-gray-500 text-xs border border-white/10 hover:text-white transition-all">
                  ← Remarcar cantos
                </button>
              </div>
              <div className="w-full text-center">
                 <button onClick={() => { 
                   if (dims) {
                     setPhase('HEIGHT'); 
                   } else {
                     alert('Marque a referência antes de avançar');
                   }
                  }} className="text-white bg-amber-500/20 px-4 py-2 rounded-xl text-xs mt-2 border border-amber-500/50">Ignorar referência e avançar</button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── RESULT ────────────────────────────────────────────────────────────────────
  if (phase === 'RESULT' && dims) return (
    <div className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-24 h-24 bg-emerald-500/15 rounded-[32px] flex items-center justify-center mb-6 ring-2 ring-emerald-500/30">
        <Ruler className="w-12 h-12 text-emerald-400" />
      </div>
      <p className="text-[10px] uppercase font-black text-gray-500 tracking-widest mb-2">Medidas do Ambiente</p>
      <div className="w-full max-w-xs space-y-3 mb-8">
        {[
          { label: '↔ Largura', value: dims.width, color: 'text-amber-400' },
          { label: '↕ Profundidade', value: dims.depth, color: 'text-blue-400' },
          { label: '↑ Altura', value: dims.height, color: 'text-green-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex justify-between items-center bg-[#111] border border-white/10 rounded-2xl px-6 py-4">
            <span className="text-gray-400 font-bold text-sm">{label}</span>
            <span className={`${color} font-black text-2xl`}>{value.toFixed(2)} m</span>
          </div>
        ))}
      </div>
      <div className="w-full max-w-xs space-y-3">
        <button onClick={() => onConfirmMeasurement(dims.width, dims)}
          className="w-full py-5 rounded-2xl font-black text-black text-base shadow-xl"
          style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}>
          ✓ GERAR ORÇAMENTO E PROJETO
        </button>
        <button onClick={() => { setPhase('INTRO'); setCorners([]); setPhotoDataUrl(null); setRefPixels([]); setHeightPixels([]); setDims(null); setPpm(0); }}
          className="w-full bg-white/5 text-gray-400 py-3 rounded-2xl text-sm border border-white/10">
          Medir novamente
        </button>
      </div>
      <button onClick={onClose} className="absolute top-5 right-5 p-3 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
    </div>
  );

  // ── ERROR ─────────────────────────────────────────────────────────────────────
  if (phase === 'ERROR') return (
    <div className="fixed inset-0 z-[9999] bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center">
      <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
      <h2 className="text-xl font-black text-white mb-2">Erro de Câmera</h2>
      <p className="text-gray-400 text-sm mb-8 max-w-xs">{errorMsg}</p>
      <button onClick={onClose} className="w-full max-w-xs bg-white/10 text-white py-4 rounded-2xl font-bold">Fechar</button>
    </div>
  );

  return null;
}
