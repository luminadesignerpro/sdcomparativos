import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Camera, Ruler, CheckCircle2, Upload, Maximize, Info, Send, Wand2, Sparkles, Undo2, ScanLine, Calculator, ChevronRight, MousePointer2, Image as ImageIcon, Search, Loader2
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

const SmartMeasurement: React.FC = () => {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [image, setImage] = useState<string | null>(null);
  const [refImage, setRefImage] = useState<string | null>(null); // Foto do móvel novo
  const [points, setPoints] = useState<Point[]>([]);
  const [refPoints, setRefPoints] = useState<Point[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [iaCommand, setIaCommand] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isRef = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (isRef) setRefImage(e.target?.result as string);
        else setImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (image && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
      };
      img.src = image;
    }
  }, [image]);

  const isCreativeTaskUI = React.useMemo(() => {
    const creativeKeywords = [
      'sugest', 'melhor', 'decor', 'estil', 'luxo', 'bonit', 'chatgpt', 'ambiente', 
      'moderno', 'novo', 'troc', 'mud', 'substitu', 'preto', 'cinza', 'diferente', 'top',
      'remov', 'tirar', 'apagar', 'limpar'
    ];
    return iaCommand && creativeKeywords.some(k => iaCommand.toLowerCase().includes(k));
  }, [iaCommand]);

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
      toast({ title: '⚠️ Descreva o que deseja fazer.' });
      return;
    }

    setAnalyzing(true);
    setResult(null);

    try {
      console.log("[SD VISION] Otimizando imagem...");
      const optimizedImage = await resizeImage(image);
      const optimizedRefImage = refImage ? await resizeImage(refImage, 512, 512) : null;

      const tmpImg = new Image();
      tmpImg.src = optimizedImage;
      await new Promise(r => tmpImg.onload = r);

      // PROMPT DE ALTO NÍVEL - AGENTE ARQUITETO SD VISION
      const prompt = `Você é o AGENTE PROJETISTA SD VISION ENGINEERING V15.
      
      OBJETIVO: Analisar a foto do ambiente e o comando: "${iaCommand}".
      
      REGRAS DE MÁSCARA (targetPolygon):
      - Se o comando for "trocar o sofá", foque o polígono EXCLUSIVAMENTE no sofá e no chão ao redor dele. 
      - NÃO mascare as paredes ou o teto se o comando for apenas para trocar móveis.
      - Seja MUITO agressivo no tamanho do polígono do móvel.
      
      REGRAS DE PROMPT (descriptionEn):
      - Use termos de substituição total: "Completely delete the old sofa", "Replace with a new modern black furniture", "Total reconstruction of the seating area".
      - Foque em materiais de luxo e design de alto padrão.
      
      RETORNE APENAS JSON VÁLIDO:
      {
        "action": "inpaint" | "style" | "cleanup" | "measure",
        "measureResult": "valor estimado (ex: 2.5m ou 2500mm)",
        "reasoning": "Sua análise em Português.",
        "descriptionEn": "Aggressive transformative prompt to REPLACE the target object entirely.",
        "targetPolygon": [{"x": float, "y": float}, ...] 
      }`;

      const imagesToAnalyze = [optimizedImage];
      if (optimizedRefImage) {
        imagesToAnalyze.push(optimizedRefImage);
      }

      // Enriquecer o prompt para indicar que a foto de referência deve ser usada
      let enhancedPrompt = prompt;
      if (optimizedRefImage) {
        enhancedPrompt += "\n\nINSTRUÇÃO: Use a foto de referência enviada como guia visual para o novo sofá ou móvel a ser inserido.";
      }
      const res = await analyzeImageWithGemini(imagesToAnalyze.join('|'), enhancedPrompt); 
      const cleanRes = res.replace(/```json|```/g, '').trim();
      const data = JSON.parse(cleanRes);

      // --- INTELIGÊNCIA DE DECISÃO SD VISION V13 (ESTILO CHATGPT) ---
      const cmdLower = iaCommand.toLowerCase();
      // Qualquer palavra que indique mudança de estilo ou desejo de algo novo ativa o modo criativo
      const creativeKeywords = [
        'sugest', 'melhor', 'decor', 'estil', 'luxo', 'bonit', 'chatgpt', 'ambiente', 
        'moderno', 'novo', 'troc', 'mud', 'substitu', 'preto', 'cinza', 'diferente', 'top',
        'remov', 'tirar', 'apagar', 'limpar', 'sofa', 'sofá'
      ];
      const isCreativeTask = creativeKeywords.some(k => cmdLower.includes(k));
      
      const changeKeywords = ['troc', 'mud', 'substitu', 'coloc', 'põe', 'poe', 'remov', 'tirar', 'sofa', 'sofá'];
      const isChangeTask = changeKeywords.some(k => cmdLower.includes(k));

      const paintKeywords = ['pint', 'parede', 'cor', 'colorir'];
      const isPaintTask = paintKeywords.some(k => cmdLower.includes(k));

      // Detecção robusta de troca de sofá via Regex (mais flexível)
      const sofaRegex = /(troc|remov|tir|substitu|mud|troca|mudar|novo|nova|coloc|põe|poe).*sof[aá]/i;
      const isSofaSwap = sofaRegex.test(iaCommand);
      
      console.log("[SD VISION] Análise de Comando:", { 
        iaCommand, 
        isSofaSwap, 
        isCreativeTask, 
        isPaintTask, 
        isChangeTask 
      });

      if (isSofaSwap) {
        console.log("[SD VISION] Forçando Inpaint para Troca de Sofá.");
        data.action = 'inpaint';
        data.descriptionEn = "Remove entire old sofa and replace with new modern sofa, high quality interior design";
        data.targetPolygon = []; // Força máscara completa
      }

      // Se for uma tarefa de REMOÇÃO grande em modo criativo, tratamos como INPAINT de reconstrução
      if (data.action === 'cleanup' && isCreativeTask) {
        data.action = 'inpaint';
        data.descriptionEn = "clean empty floor, perfectly reconstructed wall, high-end interior architecture, empty space, realistic lighting";
      }

      if (isCreativeTask) {
        console.log("[SD VISION V13] Modo Criativo Ativado.");
        // Se envolver troca de móvel, usamos inpaint para focar no objeto, mas com liberdade
        data.action = isChangeTask ? 'inpaint' : 'style';
        data.reasoning = `Modo de Alta Criatividade ativado. Re-renderizando ${isChangeTask ? 'objetos e ' : ''}ambiente com foco em estética e design.`;
        data.descriptionEn = `A high-end luxury interior design, ${iaCommand}, cinematic lighting, architectural details, ultra-realistic, professional photography, 8k, highly detailed.`;
      } else if (isPaintTask) {
        console.log("[SD VISION V13] Modo Fidelidade: Pintura técnica.");
        data.action = 'inpaint';
        data.reasoning = "Comando de pintura detectado. Ativando motor de preservação estrutural.";
        if (cmdLower.includes('pret')) {
          data.descriptionEn = "Solid uniform deep matte black wall, architectural finish, high quality, photorealistic, consistent texture, luxury matte black paint.";
        }
      }

      console.log("[SD VISION V13] AI Plan:", data);

      if (data.action === 'measure') {
        setResult({ 
          measureMm: data.measureResult, 
          reasoning: data.reasoning || "Cálculo baseado na escala 3D do ambiente detectada.",
          promptEn: data.descriptionEn
        });
        toast({ title: '📐 Medição detectada!' });
      } else if (data.action === 'cleanup' || data.action === 'inpaint' || data.action === 'style') {
        toast({ title: '✨ Projetando mudanças em HD...' });
        
        setResult({ 
          measureMm: data.action.toUpperCase(), 
          reasoning: data.reasoning || "Processando requisição de edição inteligente.",
          promptEn: data.descriptionEn
        });

        // Preparação da máscara
        const mCanvas = document.createElement('canvas');
        const tmpImg = new Image();
        tmpImg.src = image;
        await new Promise(r => tmpImg.onload = r);

        mCanvas.width = tmpImg.width;
        mCanvas.height = tmpImg.height;
        const mctx = mCanvas.getContext('2d')!;
        mctx.fillStyle = 'black';
        mctx.fillRect(0, 0, mCanvas.width, mCanvas.height);
        mctx.fillStyle = 'white';
        mctx.beginPath();

        if (isSofaSwap) {
          // Máscara completa para trocar o sofá
          mctx.rect(0, 0, mCanvas.width, mCanvas.height);
        } else if (data.targetPolygon && data.targetPolygon.length > 0) {
          data.targetPolygon.forEach((p: any, i: number) => {
            if (i === 0) mctx.moveTo(p.x * mCanvas.width, p.y * mCanvas.height);
            else mctx.lineTo(p.x * mCanvas.width, p.y * mCanvas.height);
          });
          if (data.action === 'cleanup' || (data.action === 'inpaint' && isCreativeTask)) {
            mctx.lineWidth = 100;
          mctx.beginPath();
          mctx.moveTo(data.targetPolygon[0].x * mCanvas.width, data.targetPolygon[0].y * mCanvas.height);
          data.targetPolygon.forEach((p: any) => mctx.lineTo(p.x * mCanvas.width, p.y * mCanvas.height));
          mctx.closePath();
          mctx.fill();
        } else {
          mctx.arc(mCanvas.width/2, mCanvas.height/2, mCanvas.width/4, 0, Math.PI*2);
          mctx.fill();
        }
        
        const mBase64 = mCanvas.toDataURL('image/png');
        
        let aiRawResult: string | null = null;
        
        const tryAIGeneration = async () => {
          try {
            console.log(`[SD VISION] Camada 1: Acionando Stability (${data.action})...`);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000));
            const generationPromise = (async () => {
              const normalizedImg = await resizeImage(optimizedImage, 1024, 1024);
              const normalizedMask = await resizeImage(mBase64, 1024, 1024);
              if (data.action === 'cleanup') return await cleanupObject({ image: normalizedImg, mask: normalizedMask });
              else if (data.action === 'style') return await styleTransfer(normalizedImg, data.descriptionEn);
              else return await inpaintObject(normalizedImg, normalizedMask, data.descriptionEn);
            })();
            const res = await Promise.race([generationPromise, timeoutPromise]) as string | null;
            if (res) return res;
          } catch (err) {
            console.warn("[SD VISION] Motor principal offline ou lento. Usando motor de resgate...");
          }
          console.log("[SD VISION] Camada 2: Motor de Resgate Ativado...");
          toast({ title: '🔄 Gerando projeto (Aguarde 10s)...' });
          const seed = Math.floor(Math.random() * 1000000);
          return `https://image.pollinations.ai/prompt/${encodeURIComponent(data.descriptionEn)}?width=1024&height=1024&seed=${seed}&model=flux`;
        };

        aiRawResult = await tryAIGeneration();
        console.log("[SD VISION] IA RETORNOU:", aiRawResult?.slice(0, 50) + "...");
        
        if (aiRawResult) {
          let finalImg = "";
          if (isCreativeTask || data.action === 'style') {
            finalImg = aiRawResult.includes('?') ? `${aiRawResult}&t=${Date.now()}` : `${aiRawResult}?t=${Date.now()}`;
          } else {
            const canvas = document.createElement('canvas');
            canvas.width = tmpImg.width; canvas.height = tmpImg.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(tmpImg, 0, 0);
            ctx.globalCompositeOperation = 'destination-out';
            const maskImg = new Image(); maskImg.src = mBase64; await new Promise(r => maskImg.onload = r);
            ctx.drawImage(maskImg, 0, 0);
            ctx.globalCompositeOperation = 'destination-over';
            const aiImg = new Image(); 
            aiImg.crossOrigin = "anonymous";
            aiImg.src = aiRawResult; 
            await new Promise((resolve, reject) => {
              aiImg.onload = resolve;
              aiImg.onerror = reject;
              setTimeout(() => reject(new Error("Image Load Timeout")), 15000);
            });
            ctx.drawImage(aiImg, 0, 0);
            finalImg = canvas.toDataURL('image/jpeg', 0.95);
          }
          setHistory(prev => [finalImg, ...prev]);
          setImage(finalImg);
          toast({ title: '✅ Projeto concluído!' });
        }
      }
    } catch (e: any) {
      console.error("ERRO FINAL IA:", e);
      toast({ 
        variant: "destructive",
        title: '❌ Erro no Processamento', 
        description: 'Não foi possível gerar a imagem no momento. Tente novamente.' 
      });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 bg-[#0a0a0c] min-h-screen text-white w-full selection:bg-amber-500/30">
      <header className="flex flex-col md:flex-row justify-between items-center bg-[#111114] p-4 sm:p-8 rounded-[30px] sm:rounded-[40px] border border-white/5 shadow-2xl gap-6">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-amber-500 flex items-center justify-center shadow-2xl shadow-amber-500/20 rotate-3 shrink-0">
             <ScanLine className="w-6 h-6 sm:w-8 sm:h-8 text-black" />
          </div>
          <div>
            <h1 className="text-xl sm:text-3xl font-black italic tracking-tighter text-white">SD VISION <span className="text-amber-500 font-normal">V15 - ATIVO</span></h1>
            <p className="text-[8px] sm:text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] sm:tracking-[0.4em]">Advanced Creative Surveyor Engine & AI Measurement</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 w-full md:w-auto">
           <Button onClick={() => fileInputRef.current?.click()} className="flex-1 md:flex-none bg-white/5 border border-white/10 h-12 sm:h-16 px-4 sm:px-8 rounded-2xl sm:rounded-3xl font-black hover:bg-white/10 transition-all text-xs sm:text-base">
             <Camera className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 text-amber-500" /> NOVO
           </Button>
           <Button onClick={executeIA} disabled={analyzing} className="flex-1 md:flex-none bg-amber-500 hover:bg-amber-300 text-black font-black h-12 sm:h-16 px-6 sm:px-12 rounded-2xl sm:rounded-3xl shadow-2xl shadow-amber-500/30 transition-all active:scale-95 text-xs sm:text-lg">
             {analyzing ? <Sparkles className="animate-spin w-5 h-5 sm:w-6 sm:h-6" /> : "PROJETAR"}
           </Button>
        </div>
      </header>

      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-8 h-auto lg:h-[calc(100vh-250px)]">
        <Card className="lg:col-span-9 bg-[#0b0b0d] border-white/5 rounded-[30px] lg:rounded-[50px] overflow-hidden relative shadow-inner flex items-center justify-center border-t border-l border-white/10 min-h-[400px] lg:h-full">
          {image ? (
             <div className="relative w-full h-full flex items-center justify-center p-8">
               <canvas ref={canvasRef} className="max-w-full max-h-full object-contain pointer-events-none drop-shadow-2xl" />
             </div>
          ) : (
             <div className="text-center space-y-8 animate-pulse">
                <Upload className="w-20 h-20 text-white/5 mx-auto" />
                <h3 className="text-2xl font-black text-white/20 uppercase tracking-widest">Carregue a foto do cômodo</h3>
             </div>
          )}

          {/* Prompt Bar Inteligente */}
          {image && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl space-y-4">
               {refImage && (
                 <div className="flex justify-center">
                   <div className="relative group">
                     <img src={refImage} className="w-24 h-24 object-cover rounded-2xl border-4 border-amber-500 shadow-2xl transition-all group-hover:scale-110" />
                     <button onClick={() => setRefImage(null)} className="absolute -top-3 -right-3 w-8 h-8 bg-red-600 rounded-full flex items-center justify-center border-4 border-black text-white font-bold">×</button>
                     <p className="absolute -bottom-6 left-0 right-0 text-[8px] text-center font-black uppercase text-amber-500">Móvel de Ref.</p>
                   </div>
                 </div>
               )}

               <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 p-3 sm:p-4 bg-black/80 backdrop-blur-3xl rounded-[25px] sm:rounded-[35px] border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.6)]">
                  <div className="flex-1 relative">
                    <Wand2 className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
                    <Input 
                      placeholder="Qual a largura?"
                      value={iaCommand}
                      onChange={e => setIaCommand(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && executeIA()}
                      className="bg-transparent border-none text-sm sm:text-lg h-12 sm:h-16 pl-12 sm:pl-16 focus-visible:ring-0 placeholder:text-white/20 font-medium"
                    />
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button 
                      onClick={() => refFileInputRef.current?.click()} 
                      variant="outline" 
                      className={`h-12 sm:h-14 px-4 sm:px-6 rounded-2xl border-2 transition-all active:scale-95 ${
                        refImage 
                          ? 'border-green-500/50 bg-green-500/10 text-green-400' 
                          : 'border-amber-500/50 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                      }`}
                    >
                      <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6 sm:mr-1" /> 
                      <span className="hidden sm:inline">{refImage ? 'FOTO SELECIONADA' : 'USAR FOTO REF.'}</span>
                      <span className="sm:hidden">{refImage ? 'OK' : 'REF.'}</span>
                    </Button>
                    <Button onClick={executeIA} disabled={analyzing} className="flex-1 sm:flex-none bg-white text-black h-12 sm:h-16 px-6 sm:px-10 rounded-xl sm:rounded-3xl font-black text-xs sm:text-lg hover:bg-amber-500 transition-colors">
                      OK
                    </Button>
                  </div>
               </div>
            </div>
          )}
        </Card>

        <div className="lg:col-span-3 space-y-6 overflow-y-auto lg:pr-2">
            <div className="bg-[#111114] rounded-[40px] p-8 border border-white/5 space-y-6">
              <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
                 <Sparkles className="w-5 h-5 text-amber-500" /> Memória de Projeto
              </h4>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {history.map((h, i) => (
                  <img 
                    key={i} 
                    src={h} 
                    onClick={() => setImage(h)}
                    className="w-20 h-20 object-cover rounded-xl border-2 border-white/5 hover:border-amber-500 transition-all cursor-pointer shrink-0" 
                  />
                ))}
                {history.length === 0 && <p className="text-[10px] text-gray-600 uppercase font-black">Nenhuma versão anterior</p>}
              </div>
           </div>

           {analyzing && (
             <Card className="bg-amber-500/10 border border-amber-500/30 rounded-[30px] p-6 animate-pulse">
                <div className="flex items-center gap-4">
                   <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                   <div>
                     <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">IA SD VISION PENSANDO...</p>
                     <p className="text-xs text-white/70">Analisando arquitetura e planejando renderização...</p>
                   </div>
                </div>
             </Card>
           )}

           {result && (
             <Card className="bg-amber-500 rounded-[40px] p-8 space-y-4 shadow-2xl animate-in zoom-in-95 duration-500">
                <div className="flex items-center gap-2">
                  <Search className="w-5 h-5 text-black" />
                  <p className="text-[10px] font-black text-black/60 uppercase tracking-widest">Análise do Projetista</p>
                </div>
                <h2 className="text-2xl font-black text-black leading-tight border-b border-black/10 pb-4 uppercase">
                  {isCreativeTaskUI ? 'SD VISION - MOTOR CHATGPT (V4)' : 
                   result.measureMm === 'INPAINT' ? 'Edição Localizada' : 
                   result.measureMm === 'STYLE' ? 'Nova Estilização' : 
                   result.measureMm === 'CLEANUP' ? 'Limpeza de Ambiente' : 
                   result.measureMm}
                </h2>
                <div className="bg-black/10 p-4 rounded-2xl">
                  <p className="text-[11px] text-black font-bold leading-relaxed italic">
                    <Sparkles className="w-3 h-3 inline mr-2" />
                    {result.reasoning}
                  </p>
                </div>

                <div className="pt-4 border-t border-black/10">
                   <button 
                     onClick={() => setShowAdvanced(!showAdvanced)}
                     className="text-[9px] font-black uppercase text-black/40 hover:text-black transition-colors flex items-center gap-1"
                   >
                     {showAdvanced ? 'Esconder Prompt Técnico' : 'Ver Prompt Técnico (Modo Avançado)'}
                   </button>
                   {showAdvanced && result.promptEn && (
                     <div className="mt-2 p-3 bg-black/5 rounded-xl border border-black/5">
                        <p className="text-[10px] font-mono text-black/60 break-words">{result.promptEn}</p>
                     </div>
                   )}
                </div>
             </Card>
           )}

            <div className="bg-[#111114] rounded-[40px] p-8 border border-white/5 space-y-6">
              <h4 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-3">
                 <Sparkles className="w-5 h-5 text-amber-500" /> Super Poderes IA
              </h4>
              <div className="grid gap-4">
                 {[
                   { t: "MODO CHATGPT", d: "Use 'Dê uma sugestão...' para remodelagem total e estética.", i: <Sparkles className="w-4 h-4 text-amber-400" /> },
                   { t: "PINTAR PAREDE", d: "Pinte a parede de [cor]. Use modo técnico para fidelidade.", i: <Wand2 className="w-4 h-4 text-amber-500" /> },
                   { t: "TROCAR MÓVEL", d: "Use 'USAR FOTO REF.' + 'Troque o sofá por este'.", i: <ImageIcon className="w-4 h-4 text-amber-500" /> },
                   { t: "MEDIR", d: "Pergunte 'Qual a largura desta parede?'", i: <Ruler className="w-4 h-4 text-amber-500" /> }
                 ].map((g, i) => (
                   <div key={i} className="p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all cursor-help group">
                     <div className="flex items-center gap-2 mb-1">
                        {g.i}
                        <p className="text-[10px] font-black uppercase text-amber-500 group-hover:text-white transition-colors">{g.t}</p>
                     </div>
                     <p className="text-[11px] text-gray-300 font-medium leading-relaxed">{g.d}</p>
                   </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      <input type="file" ref={fileInputRef} onChange={e => handleFileUpload(e, false)} accept="image/*" className="hidden" />
      <input type="file" ref={refFileInputRef} onChange={e => handleFileUpload(e, true)} accept="image/*" className="hidden" />
    </div>
  );
};

export default SmartMeasurement;
