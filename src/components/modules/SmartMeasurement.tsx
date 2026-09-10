import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Camera, Ruler, CheckCircle2, Upload, Maximize, Info, Send, Wand2, Sparkles, Undo2, ScanLine, Calculator, ChevronRight, MousePointer2, Image as ImageIcon, Search, Loader2, Eraser, Paintbrush, Trash2, Crosshair, Plus, Minus, Move, Palette
} from 'lucide-react';
import { analyzeImageWithGemini } from '@/services/geminiService';
import { cleanupObject, inpaintObject, styleTransfer } from '@/services/stabilityService';
import { generateOpenAIImage } from '@/services/openaiImageService';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';

const db = supabase as any;

interface Point { x: number; y: number; }
interface Calibration { p1: Point; p2: Point; value: number; unit: string; }

const SmartMeasurement: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [image, setImage] = useState<string | null>(null);
  const [refImage, setRefImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [iaCommand, setIaCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Edit States
  const [tool, setTool] = useState<'SELECT' | 'BRUSH' | 'ERASER' | 'MEASURE' | 'CALIBRATE'>('SELECT');
  const [brushSize, setBrushSize] = useState(40);
  const [isDrawing, setIsDrawing] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<Point[]>([]);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  const [pixelsPerMm, setPixelsPerMm] = useState<number | null>(null);
  const [manualMeasurement, setManualMeasurement] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);

  // Initialize and update main canvas
  useEffect(() => {
    if (image && canvasRef.current && maskCanvasRef.current) {
      const canvas = canvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      const ctx = canvas.getContext('2d');
      const mctx = maskCanvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        maskCanvas.width = img.width;
        maskCanvas.height = img.height;
        
        ctx?.drawImage(img, 0, 0);
        
        // Clear mask
        if (mctx) {
          mctx.fillStyle = 'black';
          mctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
        }
      };
      img.src = image;
    }
  }, [image]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isRef = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (isRef) setRefImage(result);
        else {
          setImage(result);
          setHistory([result]);
          setCalibration(null);
          setPixelsPerMm(null);
          setMeasurePoints([]);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const getCanvasMousePos = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handlePointerDown = (e: any) => {
    if (!image) return;
    const pos = getCanvasMousePos(e);
    
    if (tool === 'BRUSH' || tool === 'ERASER') {
      setIsDrawing(true);
      draw(pos);
    } else if (tool === 'MEASURE' || tool === 'CALIBRATE') {
      if (measurePoints.length >= 2) setMeasurePoints([pos]);
      else setMeasurePoints(prev => [...prev, pos]);
    }
  };

  const handlePointerMove = (e: any) => {
    if (!isDrawing) return;
    const pos = getCanvasMousePos(e);
    draw(pos);
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
    if (tool === 'CALIBRATE' && measurePoints.length === 2) {
      const val = prompt("Qual a medida real entre esses pontos em centímetros? (Ex: 100)");
      if (val) {
        const numVal = parseFloat(val);
        const dist = Math.sqrt(Math.pow(measurePoints[1].x - measurePoints[0].x, 2) + Math.pow(measurePoints[1].y - measurePoints[0].y, 2));
        setCalibration({ p1: measurePoints[0], p2: measurePoints[1], value: numVal, unit: 'cm' });
        setPixelsPerMm(dist / (numVal * 10));
        toast({ title: "Calibração concluída!" });
      }
      setMeasurePoints([]);
    } else if (tool === 'MEASURE' && measurePoints.length === 2 && pixelsPerMm) {
      const dist = Math.sqrt(Math.pow(measurePoints[1].x - measurePoints[0].x, 2) + Math.pow(measurePoints[1].y - measurePoints[0].y, 2));
      const realMm = dist / pixelsPerMm;
      setManualMeasurement(`${(realMm / 10).toFixed(1)} cm / ${(realMm / 1000).toFixed(2)} m`);
      toast({ title: `Medida: ${(realMm / 10).toFixed(1)} cm` });
    }
  };

  const draw = (pos: Point) => {
    const canvas = maskCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    ctx.globalCompositeOperation = tool === 'ERASER' ? 'destination-out' : 'source-over';
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, brushSize, 0, Math.PI * 2);
    ctx.fill();
  };

  const clearMask = () => {
    const canvas = maskCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx && canvas) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      toast({ title: "Máscara limpa" });
    }
  };

  const resizeImage = (base64Str: string, maxW = 1024, maxH = 1024): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxW) {
            height *= maxW / width;
            width = maxW;
          }
        } else {
          if (height > maxH) {
            width *= maxH / height;
            height = maxH;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    });
  };

  const executeIA = async () => {
    if (!image || !iaCommand) {
      toast({ title: '⚠️ Descreva o que deseja fazer.', variant: "destructive" });
      return;
    }

    setAnalyzing(true);
    setResult(null);

    try {
      console.log("[SD VISION PRO] Iniciando processamento...");
      const optimizedImage = await resizeImage(image);
      const optimizedRefImage = refImage ? await resizeImage(refImage, 512, 512) : null;

      const maskCanvas = maskCanvasRef.current;
      const maskBase64 = maskCanvas?.toDataURL('image/png') || "";
      
      const mctx = maskCanvas?.getContext('2d');
      let hasMask = false;
      if (mctx && maskCanvas) {
        const data = mctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] > 10) { hasMask = true; break; }
        }
      }

      const prompt = `Você é o AGENTE PROJETISTA SD VISION ELITE V20.
      Analise o ambiente e o comando: "${iaCommand}".
      
      Determine a melhor ação técnica:
      - "cleanup": Se o usuário quer APAGAR, TIRAR ou REMOVER algo.
      - "inpaint": Se o usuário quer TROCAR, MUDAR, PINTAR ou ADICIONAR algo específico em uma área.
      - "style": Se o usuário quer MUDAR O ESTILO COMPLETO, REFORMAR TUDO ou dar uma SUGESTÃO GERAL.
      - "measure": Se for apenas uma pergunta sobre dimensões.
      
      RETORNE APENAS JSON VÁLIDO:
      {
        "action": "cleanup" | "inpaint" | "style" | "measure",
        "measureResult": "estimativa (ex: 2.5m)",
        "reasoning": "Sua análise estratégica em PT-BR.",
        "descriptionEn": "Extremely detailed prompt in English. Focused on luxury interior design, realistic materials (marble, gold, oak), professional architectural lighting, 8k, photorealistic.",
        "targetPolygon": [] 
      }`;

      const res = await analyzeImageWithGemini(optimizedImage + (optimizedRefImage ? '|' + optimizedRefImage : ''), prompt); 
      const cleanRes = res.replace(/```json|```/g, '').trim();
      const data = JSON.parse(cleanRes);

      setResult(data);

      if (data.action === 'measure' && !pixelsPerMm) {
        toast({ title: "📐 Medição estimada detectada." });
        setAnalyzing(false);
        return;
      }

      toast({ title: '✨ Projetando mudanças de alto padrão...' });

      const activeMask = hasMask ? maskBase64 : null;
      let finalResult: string | null = null;

      const tryAIGeneration = async () => {
        try {
          if (data.action === 'cleanup') {
            if (!activeMask) {
              toast({ title: "⚠️ Dica: Marque o objeto com o Pincel para apagar.", variant: "destructive" });
              return null;
            }
            return await cleanupObject({ image: optimizedImage, mask: activeMask });
          } else if (data.action === 'style') {
            return await styleTransfer(optimizedImage, data.descriptionEn);
          } else {
            // INPAINT / REPLACE
            const enhancedPrompt = optimizedRefImage 
              ? `${data.descriptionEn}. The furniture should look exactly like the reference image provided.` 
              : data.descriptionEn;
              
            if (!activeMask) {
              toast({ title: "💡 Dica: Para trocar algo, desenhe por cima com o Pincel.", variant: "default" });
              return await inpaintObject(optimizedImage, maskBase64, enhancedPrompt);
            }
            return await inpaintObject(optimizedImage, activeMask, enhancedPrompt);
          }
        } catch (err) {
          console.error("Stability Error:", err);
          return null;
        }
      };

      finalResult = await tryAIGeneration();

      // Fallback para Pollinations se Stability falhar
      if (!finalResult) {
        console.log("[SD VISION PRO] Acionando motor de resgate (Pollinations)...");
        toast({ title: "🔄 Refinando detalhes (Motor de Resgate)..." });
        const seed = Math.floor(Math.random() * 1000000);
        // Usamos pollinations.ai/p/ que é mais estável para retorno direto de imagem
        const pollinationsUrl = `https://pollinations.ai/p/${encodeURIComponent(data.descriptionEn)}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`;
        
        // Se for estilo, podemos usar a imagem do Pollinations direto.
        if (data.action === 'style') {
          finalResult = pollinationsUrl;
        } else if (activeMask) {
          // Merge Pollinations with Original using Mask
          const canvas = document.createElement('canvas');
          const imgObj = new Image(); imgObj.src = image; await new Promise(r => imgObj.onload = r);
          canvas.width = imgObj.width; canvas.height = imgObj.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(imgObj, 0, 0);
          ctx.globalCompositeOperation = 'destination-out';
          const maskImg = new Image(); maskImg.src = activeMask; await new Promise(r => maskImg.onload = r);
          ctx.drawImage(maskImg, 0, 0);
          ctx.globalCompositeOperation = 'destination-over';
          const aiImg = new Image(); aiImg.crossOrigin = "anonymous"; aiImg.src = pollinationsUrl;
          await new Promise(r => aiImg.onload = r);
          ctx.drawImage(aiImg, 0, 0, canvas.width, canvas.height);
          finalResult = canvas.toDataURL('image/jpeg', 0.95);
        } else {
           finalResult = pollinationsUrl;
        }
      }

      if (finalResult) {
        setHistory(prev => [finalResult!, ...prev]);
        setImage(finalResult);
        toast({ title: '✅ Ambiente transformado!' });
      }

    } catch (e: any) {
      console.error("ERRO SD VISION PRO:", e);
      toast({ 
        variant: "destructive",
        title: '❌ Falha Crítica', 
        description: 'O motor de IA está sobrecarregado. Tente novamente em instantes.' 
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-[#08080a] min-h-screen text-white w-full selection:bg-amber-500/30 font-sans">
      <header className="flex flex-col lg:flex-row justify-between items-center bg-[#111114] p-4 lg:p-6 rounded-[32px] border border-white/5 shadow-2xl gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 rotate-3">
             <Palette className="w-7 h-7 text-black" />
          </div>
          <div>
            <h1 className="text-2xl font-black italic tracking-tight">SD VISION <span className="text-amber-500 font-normal">ELITE V20</span></h1>
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em]">Creative AI Architect & Precision Surveyor</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto">
           <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex-1 lg:flex-none bg-white/5 border-white/10 h-12 rounded-2xl font-bold hover:bg-white/10 text-white">
             <Camera className="w-4 h-4 mr-2 text-amber-500" /> NOVO
           </Button>
           <Button onClick={executeIA} disabled={analyzing || !image} className="flex-1 lg:flex-none bg-amber-500 hover:bg-amber-400 text-black font-black h-12 px-8 rounded-2xl shadow-xl shadow-amber-500/20 transition-all active:scale-95">
             {analyzing ? <Loader2 className="animate-spin w-5 h-5" /> : "TRANSFORMAR"}
           </Button>
        </div>
      </header>

      <div className="grid lg:grid-cols-12 gap-6 h-[calc(100vh-200px)] min-h-[650px]">
        {/* Main Workspace */}
        <div className="lg:col-span-9 flex flex-col gap-4">
          <Card className="flex-1 bg-[#0b0b0d] border-white/5 rounded-[40px] overflow-hidden relative flex items-center justify-center border-t border-l border-white/10 group">
            {image ? (
               <div className="relative w-full h-full flex items-center justify-center bg-black/40 overflow-hidden"
                    onMouseDown={handlePointerDown}
                    onMouseMove={handlePointerMove}
                    onMouseUp={handlePointerUp}
                    onTouchStart={handlePointerDown}
                    onTouchMove={handlePointerMove}
                    onTouchEnd={handlePointerUp}>
                 <canvas ref={canvasRef} className="max-w-full max-h-full object-contain shadow-2xl" />
                 <canvas ref={maskCanvasRef} className="absolute inset-0 max-w-full max-h-full object-contain opacity-40 mix-blend-screen pointer-events-none" />
                 
                 {/* Points Visualizer */}
                 {measurePoints.map((p, i) => (
                   <div key={i} className="absolute w-4 h-4 bg-amber-500 rounded-full border-2 border-white shadow-lg pointer-events-none z-50"
                        style={{ left: `${(p.x / maskCanvasRef.current!.width) * 100}%`, top: `${(p.y / maskCanvasRef.current!.height) * 100}%`, transform: 'translate(-50%, -50%)' }} />
                 ))}
                 
                 {measurePoints.length === 2 && (
                   <svg className="absolute inset-0 w-full h-full pointer-events-none">
                     <line 
                       x1={`${(measurePoints[0].x / maskCanvasRef.current!.width) * 100}%`} 
                       y1={`${(measurePoints[0].y / maskCanvasRef.current!.height) * 100}%`}
                       x2={`${(measurePoints[1].x / maskCanvasRef.current!.width) * 100}%`} 
                       y2={`${(measurePoints[1].y / maskCanvasRef.current!.height) * 100}%`}
                       stroke="#f59e0b" strokeWidth="2" strokeDasharray="4"
                     />
                   </svg>
                 )}
               </div>
            ) : (
               <div className="text-center space-y-8">
                  <div className="w-28 h-28 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10 animate-pulse group-hover:scale-110 transition-transform">
                    <Upload className="w-12 h-12 text-white/20" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-black text-white/40 uppercase tracking-widest">Seu Estúdio IA</h3>
                    <p className="text-sm text-white/20 font-medium">Carregue uma foto para medir e decorar</p>
                  </div>
                  <Button onClick={() => fileInputRef.current?.click()} className="bg-amber-500 text-black rounded-2xl px-12 h-14 font-black text-lg shadow-2xl shadow-amber-500/20">
                    COMEÇAR AGORA
                  </Button>
               </div>
            )}

            {image && (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-3xl p-2 rounded-2xl border border-white/10 flex items-center gap-1 shadow-2xl z-[60]">
                <Button variant={tool === 'SELECT' ? 'default' : 'ghost'} size="icon" onClick={() => setTool('SELECT')} className={tool === 'SELECT' ? 'bg-amber-500 text-black' : 'text-white'} title="Navegar"><Move className="w-4 h-4" /></Button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <Button variant={tool === 'BRUSH' ? 'default' : 'ghost'} size="icon" onClick={() => setTool('BRUSH')} className={tool === 'BRUSH' ? 'bg-amber-500 text-black' : 'text-white'} title="Pincel (Desenhar Área)"><Paintbrush className="w-4 h-4" /></Button>
                <Button variant={tool === 'ERASER' ? 'default' : 'ghost'} size="icon" onClick={() => setTool('ERASER')} className={tool === 'ERASER' ? 'bg-amber-500 text-black' : 'text-white'} title="Borracha de Máscara"><Eraser className="w-4 h-4" /></Button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <Button variant={tool === 'MEASURE' ? 'default' : 'ghost'} size="icon" onClick={() => setTool('MEASURE')} className={tool === 'MEASURE' ? 'bg-amber-500 text-black' : 'text-white'} title="Régua de Precisão"><Ruler className="w-4 h-4" /></Button>
                <Button variant={tool === 'CALIBRATE' ? 'default' : 'ghost'} size="icon" onClick={() => setTool('CALIBRATE')} className={tool === 'CALIBRATE' ? 'bg-amber-500 text-black' : 'text-white'} title="Calibrar Escala"><Crosshair className="w-4 h-4" /></Button>
                <div className="w-px h-4 bg-white/10 mx-1" />
                <Button variant="ghost" size="icon" onClick={clearMask} className="text-red-400 hover:text-red-300 hover:bg-red-500/10" title="Limpar Tudo"><Trash2 className="w-4 h-4" /></Button>
              </div>
            )}
          </Card>

          {image && (
            <div className="bg-[#111114] p-4 rounded-[30px] border border-white/5 flex flex-col md:flex-row gap-4 items-center shadow-xl">
              <div className="flex-1 flex items-center gap-4 bg-black/40 rounded-2xl px-6 h-14 border border-white/5 w-full group focus-within:border-amber-500/50 transition-all">
                <Wand2 className="w-5 h-5 text-amber-500 group-focus-within:animate-bounce" />
                <input 
                  placeholder="O que sua IA deve fazer hoje?"
                  value={iaCommand}
                  onChange={e => setIaCommand(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && executeIA()}
                  className="bg-transparent border-none flex-1 text-sm focus:ring-0 placeholder:text-white/20 text-white font-medium"
                />
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <Button onClick={() => refFileInputRef.current?.click()} variant="outline" className={`h-14 rounded-2xl flex-1 md:flex-none border-2 transition-all ${refImage ? 'border-green-500/50 bg-green-500/10 text-green-500' : 'border-amber-500/10 text-white hover:bg-white/5'}`}>
                  {refImage ? <CheckCircle2 className="w-5 h-5" /> : <ImageIcon className="w-5 h-5 text-amber-500" />}
                  <span className="ml-2 text-xs font-black tracking-tight">{refImage ? 'FOTO REF. OK' : 'FOTO REF.'}</span>
                </Button>
                <Button onClick={executeIA} disabled={analyzing} className="bg-white text-black h-14 px-10 rounded-2xl font-black hover:bg-amber-500 transition-all active:scale-95 flex-1 md:flex-none">
                  EXECUTAR
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div className="lg:col-span-3 flex flex-col gap-6 overflow-y-auto pr-1">
          <Card className="bg-[#111114] border-white/5 rounded-[32px] p-6 space-y-6 shadow-2xl">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 flex items-center gap-2">
                <Sparkles className="w-4 h-4" /> Versões Recentes
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {history.map((h, i) => (
                  <button key={i} onClick={() => setImage(h)} className="aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-amber-500 transition-all hover:scale-105 active:scale-95 bg-black">
                    <img src={h} className="w-full h-full object-cover" />
                  </button>
                ))}
                {history.length === 0 && <div className="col-span-3 py-10 text-center border-2 border-dashed border-white/5 rounded-2xl text-[10px] text-white/20 uppercase font-black tracking-widest">Nenhuma Edição</div>}
              </div>
            </div>

            <div className="space-y-4 pt-6 border-t border-white/5">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 flex items-center gap-2">
                <Ruler className="w-4 h-4" /> Centro de Medição
              </h4>
              <div className="bg-black/60 rounded-2xl p-4 border border-white/5 space-y-3">
                {manualMeasurement ? (
                  <div className="space-y-1">
                    <p className="text-[8px] font-black uppercase text-gray-500">Distância Calculada:</p>
                    <p className="text-xl font-black text-amber-500 tracking-tight">{manualMeasurement}</p>
                  </div>
                ) : (
                  <p className="text-[10px] text-white/30 italic text-center py-2">Calibre a régua para medir com precisão milimétrica.</p>
                )}
                {pixelsPerMm && (
                  <div className="flex justify-between items-center pt-2 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-[9px] font-black text-green-500 uppercase">Motor Calibrado</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setPixelsPerMm(null)} className="h-6 text-[8px] font-black text-red-400 hover:bg-red-500/10">RESET</Button>
                  </div>
                )}
              </div>
            </div>

            {(tool === 'BRUSH' || tool === 'ERASER') && (
              <div className="space-y-4 pt-6 border-t border-white/5 animate-in slide-in-from-right-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">Ajuste do Pincel</h4>
                <div className="flex items-center gap-4">
                  <input type="range" min="5" max="150" value={brushSize} onChange={e => setBrushSize(parseInt(e.target.value))} className="flex-1 accent-amber-500" />
                  <span className="text-xs font-black text-amber-500 tabular-nums w-8">{brushSize}</span>
                </div>
              </div>
            )}
          </Card>

          {/* Quick Support */}
          <div className="bg-amber-500/5 rounded-[32px] p-6 border border-amber-500/10 space-y-5">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 flex items-center gap-2">
              <Info className="w-4 h-4" /> Smart Shortcuts
            </h4>
            <div className="space-y-4">
              {[
                { t: "TROCA TOTAL", d: "Pinte o móvel e peça 'substitua por um sofá de luxo'.", i: <ImageIcon className="w-4 h-4" /> },
                { t: "PINTURA TÉCNICA", d: "Marque a parede e peça 'pinte com cor cinza fosca'.", i: <Paintbrush className="w-4 h-4" /> },
                { t: "LIMPEZA IA", d: "Use o pincel no objeto e peça 'limpar ambiente'.", i: <Eraser className="w-4 h-4" /> },
                { t: "DIMENSÕES", d: "Calibre a escala e use a régua para laudos técnicos.", i: <Calculator className="w-4 h-4" /> }
              ].map((g, i) => (
                <div key={i} className="flex gap-4 items-start group">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-amber-500 group-hover:text-black transition-all">
                    {g.i}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-black uppercase text-white tracking-widest">{g.t}</p>
                    <p className="text-[11px] text-white/40 leading-snug font-medium">{g.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <input type="file" ref={fileInputRef} onChange={e => handleFileUpload(e, false)} accept="image/*" className="hidden" />
      <input type="file" ref={refFileInputRef} onChange={e => handleFileUpload(e, true)} accept="image/*" className="hidden" />
      
      {analyzing && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-2xl flex flex-col items-center justify-center animate-in fade-in duration-500">
           <div className="relative">
             <div className="w-32 h-32 border-4 border-amber-500/10 border-t-amber-500 rounded-full animate-spin" />
             <div className="absolute inset-0 m-auto w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-amber-500 animate-pulse" />
             </div>
           </div>
           <div className="mt-10 text-center space-y-3">
             <h2 className="text-3xl font-black uppercase tracking-[0.4em] text-white animate-pulse">Vision Elite V20</h2>
             <p className="text-amber-500 font-bold uppercase text-xs tracking-[0.2em] opacity-80">Renderizando Arquitetura & Materiais Luxo...</p>
           </div>
           <div className="mt-12 w-64 h-1 bg-white/10 rounded-full overflow-hidden">
             <div className="h-full bg-amber-500 animate-[progress_3s_ease-in-out_infinite]" style={{ width: '30%' }} />
           </div>
        </div>
      )}
    </div>
  );
};

export default SmartMeasurement;
