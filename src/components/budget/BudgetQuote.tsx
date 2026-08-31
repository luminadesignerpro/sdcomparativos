import { supabase } from '@/integrations/supabase/client';
import { analyzeImageWithGemini } from "../../services/geminiService";
import ARMeasureTool from '@/components/ar/ARMeasureTool';
import ARStudio2D from '@/components/ar/ARStudio2D';
import { 
  Share2, Download, Info, Check, Eye, Trash2, Edit2, Send, CreditCard, Sparkles, Layout, Ruler, Box,
  Camera, Upload, Loader2, DollarSign, RotateCcw, ChevronDown, ChevronUp, Package, X, CheckCircle2,
  ArrowRight, LayoutDashboard, Maximize2, ChevronRight
} from 'lucide-react';
import { generatePromobXML, downloadFile } from '@/services/promobService';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

const db = supabase as any;

interface AnalysisResult {
  ambiente: string;
  dimensoes: {
    largura: number;
    altura: number;
    profundidade: number;
    metrosLineares: number;
    metrosQuadrados: number;
  };
  estoqueCalculado?: string;
  blenderScript?: string;
  descricao: string;
  simulacao: string;
  complexidade: 'simples' | 'media' | 'complexa';
  itens: any[];
  decoracaoSugestoes: string[];
  estiloRecomendado: string;
}

interface OrcamentoTier {
  nome: string;
  valor: number;
  descricao: string;
  caracteristicas: string[];
}

interface OrcamentoResult {
  opcoes: OrcamentoTier[];
  breakdown: { item: string; valor: number; fromStock: boolean }[];
  prazo: string;
  observacoes: string;
}

interface StockProduct {
  id: string;
  name: string;
  price: number;
  unit: string;
}

const AR_POSITIONS = [
  { xRatio: 0.1, yRatio: 0.4, wRatio: 0.25, hRatio: 0.45 },
  { xRatio: 0.4, yRatio: 0.35, wRatio: 0.2, hRatio: 0.5 },
  { xRatio: 0.65, yRatio: 0.4, wRatio: 0.28, hRatio: 0.45 },
  { xRatio: 0.15, yRatio: 0.7, wRatio: 0.3, hRatio: 0.25 },
  { xRatio: 0.5, yRatio: 0.75, wRatio: 0.35, hRatio: 0.2 },
  { xRatio: 0.05, yRatio: 0.2, wRatio: 0.15, hRatio: 0.55 },
];

const AR_COLORS = [
  { fill: 'rgba(245, 200, 100, 0.12)', stroke: 'rgba(212, 160, 50, 0.85)', label: '#7a5c00' },
  { fill: 'rgba(100, 180, 255, 0.10)', stroke: 'rgba(60, 140, 230, 0.80)', label: '#1a4f8c' },
  { fill: 'rgba(130, 220, 140, 0.10)', stroke: 'rgba(60, 170, 80, 0.80)', label: '#1a6b30' },
  { fill: 'rgba(255, 150, 100, 0.10)', stroke: 'rgba(220, 100, 50, 0.80)', label: '#8b3500' },
  { fill: 'rgba(200, 130, 255, 0.10)', stroke: 'rgba(160, 80, 220, 0.80)', label: '#5a1a8c' },
  { fill: 'rgba(255, 220, 100, 0.10)', stroke: 'rgba(200, 170, 40, 0.80)', label: '#6b5a00' },
];

const PRECOS = {
  cozinha: { min: 1500, medio: 2500, max: 3500 },
  dormitorio: { min: 1200, medio: 1800, max: 2500 },
  sala: { min: 800, medio: 1200, max: 1800 },
  banheiro: { min: 1500, medio: 2000, max: 3000 },
};

const MULTIPLICADORES = { simples: 1.0, media: 1.3, complexa: 1.6 };

export default function BudgetQuote() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [orcamento, setOrcamento] = useState<OrcamentoResult | null>(null);
  const [showAR, setShowAR] = useState(false);
  const [arRendered, setArRendered] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [stockProducts, setStockProducts] = useState<StockProduct[]>([]);
  const [arImageUrl, setArImageUrl] = useState<string | null>(null);
  const [hiddenItems, setHiddenItems] = useState<string[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationImage, setSimulationImage] = useState<string | null>(null);
  const [showARTool, setShowARTool] = useState(false);
  const [arMeasuredDim, setArMeasuredDim] = useState<number | null>(null);
  const [showARStudio, setShowARStudio] = useState(false);
  const [studioExportedImage, setStudioExportedImage] = useState<string | null>(null);
  const [analysisCache, setAnalysisCache] = useState<Record<string, { analysis: AnalysisResult; orcamento: OrcamentoResult }>>({});

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (isSimulating) {
      timeout = setTimeout(() => setIsSimulating(false), 8000);
    }
    return () => clearTimeout(timeout);
  }, [isSimulating]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  useEffect(() => { fetchStockProducts(); }, []);

  const fetchStockProducts = async () => {
    try {
      const { data } = await db.from('products').select('id, name, price, unit').order('name').limit(200);
      if (data) setStockProducts(data as StockProduct[]);
    } catch { /* products table may not exist yet */ }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string);
      setImageBase64((ev.target?.result as string).split(',')[1]);
      setAnalysis(null);
      setOrcamento(null);
      setShowAR(false);
      setArRendered(false);
      setArImageUrl(null);
      setCurrentStep(2);
    };
    reader.readAsDataURL(file);
  };

  const analisarAmbiente = async () => {
    if (!imageBase64) return;
    
    // Check cache first to ensure consistency for same image
    if (analysisCache[imageBase64]) {
      const cached = analysisCache[imageBase64];
      setAnalysis(cached.analysis);
      setOrcamento(cached.orcamento);
      setCurrentStep(3);
      toast({ title: '✅ Análise recuperada do cache local' });
      return;
    }

    setAnalyzing(true);
    try {
      const stockContext = stockProducts.length > 0 ? `\nMateriais em estoque: ${stockProducts.slice(0, 15).map(p => p.name).join(', ')}.` : '';
      const knownDimContext = arMeasuredDim ? `\nDIMENSÃO REAL MEDIDA PELA TRENA AR: ${arMeasuredDim.toFixed(2)} metros (use exatamente este valor como largura ou metros lineares — não estime).` : '';
      const prompt = `Você é o Agente Antigravity, especialista em marcenaria e design brasileiro. Analise esta foto de um ambiente e responda com um JSON válido contendo a análise técnica para um projeto de móveis projetados.
${stockContext}${knownDimContext}

REGRAS CRÍTICAS DE PRECISÃO E VALIDAÇÃO:
1. Identifique o tipo de ambiente (cozinha, dormitorio, sala ou banheiro).
2. Dimensões: Sempre que receber medidas da Trena AR, execute uma validação de integridade. Verifique se as paredes formam ângulos de 90°. Se a medida for 595mm a 605mm, assuma 600mm para fins de modulação padrão, mas mantenha o desconto de 5mm para folga de montagem no orçamento.
3. Se houver uma DIMENSÃO REAL fornecida acima, use-a como prioridade absoluta (NÃO ESTIME SE JÁ EXISTIR).
4. Do Ponto ao Orçamento: Calcule o consumo de material baseando-se no aproveitamento de chapa (Nesting). Seja específico. Exemplo: "Isso requer 1 chapa de MDF 15mm cortada, 4m de fita de borda e 8 parafusos". Consulte os valores unitários e disponibilidade.
5. O Script de Projeção (Blender): Gere um script Python conciso usando \`bpy.ops.mesh.primitive_cube_add\` passando as dimensões exatas que vieram da trena. Configure o "Pivô" do móvel no ponto inicial do clique da câmera.
6. Itens: Liste em ordem horária a partir da esquerda. Forneça bounding box (ymin,xmin,ymax,xmax entre 0-1000).
7. RESPONDA APENAS O JSON, sem textos explicativos.

Estrutura do JSON:
{
  "ambiente": "cozinha|dormitorio|sala|banheiro",
  "dimensoes": {"largura": n, "altura": n, "profundidade": n, "metrosLineares": n, "metrosQuadrados": n},
  "estoqueCalculado": "Ex: 2 chapas MDF 15mm, 10m fita de borda, 15 parafusos...",
  "blenderScript": "import bpy\\n# Script de projecao...",
  "descricao": "breve descrição técnica",
  "simulacao": "descrição da proposta",
  "complexidade": "simples|media|complexa",
  "itens": [{"nome": "Nome", "box": {"ymin": n, "xmin": n, "ymax": n, "xmax": n}}],
  "decoracaoSugestoes": ["dica 1", "dica 2"],
  "estiloRecomendado": "Moderno|Industrial|Clássico"
}`;

      // FIX 1: let em vez de const para permitir reatribuição
      let text = await analyzeImageWithGemini(imageBase64, prompt);
      console.log('[BUDGET] Gemini Response received:', text);

      if (!text) throw new Error('A IA retornou uma resposta vazia.');

      text = text.trim();
      if (text.includes('```json')) {
        text = text.split('```json')[1].split('```')[0].trim();
      } else if (text.includes('```')) {
        text = text.split('```')[1].split('```')[0].trim();
      }

      try {
        const result: AnalysisResult = JSON.parse(text);
        console.log('[BUDGET] Parsed result:', result);
        setAnalysis(result);
        const orcamentoResult = calcularOrcamento(result);
        
        // Save to cache
        setAnalysisCache(prev => ({ ...prev, [imageBase64]: { analysis: result, orcamento: orcamentoResult } }));
        
        setCurrentStep(3);
        toast({ title: '✅ Análise de IA concluída' });
      } catch (parseErr) {
        console.error('[BUDGET] JSON Parse Error:', parseErr, 'Text:', text);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const result: AnalysisResult = JSON.parse(jsonMatch[0]);
            setAnalysis(result);
            calcularOrcamento(result);
            setCurrentStep(3);
            toast({ title: '✅ Análise de IA concluída (recuperada)' });
            return;
          } catch (e) { }
        }
        throw new Error('Falha ao processar resposta da IA. O formato retornado é inválido.');
      }

    } catch (err) {
      console.error('[ANALYSIS ERROR]', err);
      toast({ title: '❌ Falha na análise', description: err instanceof Error ? err.message : 'Verifique sua conexão ou chave de API.', variant: 'destructive' });
    } finally {
      setAnalyzing(false);
    }
  };

  const calcularOrcamento = (result: AnalysisResult) => {
    const tipo = result.ambiente as keyof typeof PRECOS;
    const precos = PRECOS[tipo] || PRECOS.sala;
    const mult = MULTIPLICADORES[result.complexidade];
    
    // Priority: 1. AR Measured Dimension, 2. AI Estimated Dimension
    let medida = tipo === 'dormitorio' ? result.dimensoes.metrosQuadrados : result.dimensoes.metrosLineares;
    if (arMeasuredDim && arMeasuredDim > 0) {
      medida = arMeasuredDim;
    }

    const valorEconomico = precos.min * medida;
    const valorPremium = precos.medio * medida * mult;
    const valorLuxo = precos.max * medida * mult * 1.5;

    const orcResult = {
      opcoes: [
        {
          nome: "Econômica",
          valor: valorEconomico,
          descricao: "Solução funcional com excelente custo-benefício.",
          caracteristicas: ["MDF Branco Standard", "Puxadores perfil alumínio", "Corrediças metálicas", "Garantia 3 anos"]
        },
        {
          nome: "Premium",
          valor: valorPremium,
          descricao: "O equilíbrio perfeito entre design e durabilidade.",
          caracteristicas: ["MDF Cores/Texturizado", "Amortecimento em todas as portas", "Puxadores design", "Garantia 5 anos"]
        },
        {
          nome: "Luxo / High-End",
          valor: valorLuxo,
          descricao: "O máximo em sofisticação e tecnologia para seu lar.",
          caracteristicas: ["Frentes em vidro/laca", "Ferragens importadas (Blum/Hettich)", "Iluminação LED integrada", "Garantia 10 anos"]
        }
      ],
      breakdown: result.itens.map(itemObj => {
        const item = typeof itemObj === 'string' ? itemObj : itemObj.nome;
        const match = stockProducts.find(p => item.toLowerCase().includes(p.name.toLowerCase().split(' ')[0]));
        return { item, valor: match ? match.price : (valorPremium / result.itens.length) * (0.8 + Math.random() * 0.4), fromStock: !!match };
      }),
      prazo: result.complexidade === 'simples' ? '15-20 dias' : result.complexidade === 'media' ? '25-35 dias' : '40-55 dias',
      observacoes: 'Estimativas baseadas em padrões de mercado. Sujeito a conferência técnica local.'
    };
    setOrcamento(orcResult);
    return orcResult;
  };

  const renderAR = useCallback(() => {
    if (!canvasRef.current || !imageRef.current || !analysis) return;
    const canvas = canvasRef.current;
    const img = imageRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const count = Math.min(analysis.itens.length, AR_POSITIONS.length);
    for (let i = 0; i < count; i++) {
      const pos = AR_POSITIONS[i];
      const color = AR_COLORS[i % AR_COLORS.length];
      const x = pos.xRatio * canvas.width;
      const y = pos.yRatio * canvas.height;
      const w = pos.wRatio * canvas.width;
      const h = pos.hRatio * canvas.height;
      ctx.fillStyle = color.fill;
      ctx.strokeStyle = color.stroke;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 12);
      ctx.fill();
      ctx.stroke();
      ctx.font = `bold ${Math.max(14, canvas.width / 45)}px sans-serif`;
      const label = typeof analysis.itens[i] === 'string' ? analysis.itens[i] : analysis.itens[i].nome;
      const tw = ctx.measureText(label).width + 20;
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.roundRect(x + w / 2 - tw / 2, y + h / 2 - 15, tw, 30, 6);
      ctx.fill();
      ctx.fillStyle = color.label;
      ctx.textAlign = 'center';
      ctx.fillText(label, x + w / 2, y + h / 2 + 6);
    }
    setArImageUrl(canvas.toDataURL('image/jpeg', 0.9));
    setArRendered(true);
  }, [analysis]);

  useEffect(() => {
    if (showAR && !arRendered && imageRef.current?.complete) {
      setTimeout(renderAR, 150);
    }
  }, [showAR, arRendered, renderAR]);

  const resetar = () => {
    setImageBase64(null); setImagePreview(null); setAnalysis(null); setOrcamento(null);
    setShowAR(false); setArRendered(false); setArImageUrl(null); setCurrentStep(1);
    setHiddenItems([]); setSimulationImage(null); setIsSimulating(false);
    setArMeasuredDim(null); setShowARTool(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSimulateFinish = async (finish: string) => {
    if (!analysis) return;
    setIsSimulating(true);
    setSimulationImage(null);
    toast({ title: "🎨 Iniciando Simulação...", description: `Gerando imagem renderizada com acabamento ${finish}...` });
    try {
      // Import the dynamic service
      const { generateRealisticRender } = await import('@/services/geminiService');
      const renderedUrl = await generateRealisticRender({
        room: analysis.ambiente,
        finish: finish,
      });
      if (renderedUrl) {
         setSimulationImage(renderedUrl);
         toast({ title: "✅ Simulação Concluída!" });
      } else {
         toast({ title: "⚠️ Aviso", description: "O renderizador não retornou uma imagem, tente novamente." });
      }
    } catch (e) {
      console.error(e);
      toast({ title: "❌ Erro na Simulação", description: "Não foi possível gerar a simulação agora.", variant: "destructive" });
    } finally {
      setIsSimulating(false);
    }
  };

  const Step = ({ num, label, current }: { num: number, label: string, current: boolean }) => (
    <div className={`flex items-center gap-2 ${current ? 'text-amber-600' : 'text-gray-400'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${current ? 'bg-amber-100 border-2 border-amber-500' : 'bg-gray-100 border border-gray-200'}`}>{num}</div>
      <span className={`text-xs font-bold uppercase tracking-wider hidden sm:block`}>{label}</span>
      {num < 5 && <div className="w-4 h-[2px] bg-gray-200 ml-2 hidden lg:block"></div>}
    </div>
  );

  return (
    <div className="h-full w-full bg-[#0a0a0a] flex flex-col items-center p-6 relative overflow-x-hidden overflow-y-auto">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-amber-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-amber-600/5 rounded-full blur-[100px]" />
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(212,175,55,0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      <div className="max-w-4xl w-full z-10 animate-in fade-in zoom-in duration-700 pb-20">
        
        {/* Progress Steps */}
        {currentStep > 1 && (
          <div className="flex justify-center items-center gap-4 mb-12 bg-white/5 p-4 rounded-3xl border border-white/5 backdrop-blur-md">
            <Step num={1} label="Início" current={currentStep === 1} />
            <Step num={2} label="Foto" current={currentStep === 2} />
            <Step num={3} label="Análise" current={currentStep === 3} />
            <Step num={4} label="Orçamento" current={currentStep === 4} />
            <Step num={5} label="Pedido" current={currentStep === 5} />
          </div>
        )}

        {/* STEP 1: LANDING */}
        {currentStep === 1 && (
          <div className="text-center py-12">
            <div className="mb-8 flex justify-center">
              <div className="w-24 h-24 rounded-[32px] bg-gradient-to-br from-amber-400 to-amber-600 p-0.5 shadow-2xl shadow-amber-500/20">
                <div className="w-full h-full rounded-[30px] bg-black flex items-center justify-center">
                  <Camera className="w-12 h-12 text-amber-500" />
                </div>
              </div>
            </div>

            <h2 className="text-5xl font-black text-white mb-4 tracking-tighter">
              Studio <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">AR Profissional</span>
            </h2>
            <p className="text-gray-400 text-xl max-w-2xl mx-auto mb-12 leading-relaxed">
              O módulo de projetagem 3D agora é integrado diretamente com o nosso aplicativo nativo de Realidade Aumentada ou via Análise de IA Web.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-12">
              <button 
                onClick={() => {
                  window.location.href = "sdmoveisar://open";
                  toast({ title: "🚀 Abrindo Studio AR", description: "Certifique-se de que o app está instalado." });
                }}
                className="bg-white/5 border border-white/10 rounded-[32px] p-8 text-left hover:bg-white/10 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Maximize2 className="w-5 h-5 text-amber-500" />
                </div>
                <h4 className="text-white font-bold text-lg mb-2">App Mobile AR</h4>
                <p className="text-gray-500 text-sm">Capture dimensões milimétricas e posicione módulos no cliente usando o celular.</p>
              </button>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="bg-white/5 border border-white/10 rounded-[32px] p-8 text-left hover:bg-white/10 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Upload className="w-5 h-5 text-blue-500" />
                </div>
                <h4 className="text-white font-bold text-lg mb-2">Análise Web IA</h4>
                <p className="text-gray-500 text-sm">Tire uma foto e receba um orçamento instantâneo e layout 3D gerado por IA.</p>
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-4">
              <button
                onClick={() => {
                  window.location.href = "sdmoveisar://open";
                }}
                className="group relative px-12 py-6 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-black text-xl uppercase tracking-widest shadow-[0_0_50px_rgba(212,175,55,0.4)] hover:shadow-[0_0_70px_rgba(212,175,55,0.6)] hover:scale-105 transition-all duration-500"
              >
                <span className="relative z-10 flex items-center gap-4">
                  ABRIR CÂMERA AR AGORA
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                </span>
              </button>
              <p className="mt-8 text-gray-600 text-[10px] uppercase tracking-widest font-bold">
                Sincronização Automática via Supabase Cloud
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: IMAGE PREVIEW & ANALYSIS */}
        {currentStep === 2 && imagePreview && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="relative rounded-[40px] overflow-hidden border-4 border-white/5 shadow-2xl group aspect-video max-h-[50vh] mx-auto">
              <img ref={imageRef} src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <button onClick={resetar} className="absolute top-6 right-6 p-3 bg-red-500 rounded-full text-white shadow-xl hover:scale-110 transition-transform">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-w-2xl mx-auto space-y-6">
              <h3 className="text-3xl font-black text-white tracking-tight">Ambiente Capturado</h3>
              <p className="text-gray-400">Nossa IA está pronta para analisar este ambiente, calcular medidas e sugerir o melhor projeto.</p>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  disabled={analyzing}
                  onClick={analisarAmbiente}
                  className="flex-1 py-5 rounded-2xl bg-amber-500 text-black font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-amber-400 disabled:opacity-50 transition-all"
                >
                  {analyzing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                  {analyzing ? 'Analisando Ambientes...' : 'Iniciar Análise IA'}
                </button>
                <button
                  disabled={analyzing}
                  onClick={() => setShowARTool(true)}
                  className="px-8 py-5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold flex items-center justify-center gap-3 hover:bg-white/10 transition-all"
                >
                  <Ruler className="w-6 h-6 text-amber-500" />
                  Medir Manualmente
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: RESULTS & BUDGET */}
        {currentStep === 3 && analysis && orcamento && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 text-left">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
              <div>
                <h3 className="text-4xl font-black text-white tracking-tighter flex items-center gap-3 capitalize">
                  <Box className="w-8 h-8 text-amber-500" />
                  {analysis.ambiente}
                </h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">IA v5.3 Precision</Badge>
                  <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">{analysis.estiloRecomendado}</Badge>
                  <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30">Complexidade {analysis.complexidade}</Badge>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAR(true)} className="px-6 py-3 rounded-xl bg-amber-500 text-black font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-amber-400">
                  <Eye className="w-4 h-4" /> Ver em AR
                </button>
                <button onClick={resetar} className="p-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-colors">
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Technical Analysis */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 backdrop-blur-md">
                  <h4 className="text-white font-bold text-lg mb-6 flex items-center gap-2">
                    <Info className="w-5 h-5 text-amber-500" /> Descrição do Projeto
                  </h4>
                  <p className="text-gray-400 leading-relaxed mb-8">{analysis.descricao}</p>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Largura</p>
                      <p className="text-xl font-black text-white">{analysis.dimensoes.largura}m</p>
                    </div>
                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Altura</p>
                      <p className="text-xl font-black text-white">{analysis.dimensoes.altura}m</p>
                    </div>
                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase font-black mb-1">Prof.</p>
                      <p className="text-xl font-black text-white">{analysis.dimensoes.profundidade}m</p>
                    </div>
                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase font-black mb-1">M. Lineares</p>
                      <p className="text-xl font-black text-amber-500">{analysis.dimensoes.metrosLineares}m</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-[32px] p-8 backdrop-blur-md">
                  <h4 className="text-white font-bold text-lg mb-6">Módulos Sugeridos</h4>
                  <div className="space-y-3">
                    {orcamento.breakdown.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-4 bg-black/40 rounded-2xl border border-white/5">
                        <span className="text-gray-300 font-medium">{item.item}</span>
                        <span className="text-amber-500 font-black">R$ {item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Budget Tiers */}
              <div className="space-y-4">
                <h4 className="text-white font-bold text-lg mb-2">Opções de Investimento</h4>
                {orcamento.opcoes.map((tier, idx) => (
                  <div key={idx} className={`p-6 rounded-[32px] border transition-all cursor-pointer group ${idx === 1 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/5 border-white/10 hover:border-white/20'}`}>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${idx === 1 ? 'text-amber-500' : 'text-gray-500'}`}>{tier.nome}</p>
                        <p className="text-2xl font-black text-white mt-1">R$ {tier.valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                      </div>
                      {idx === 1 && <Badge className="bg-amber-500 text-black font-black">RECOMENDADO</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 mb-4">{tier.descricao}</p>
                    <ul className="space-y-2">
                      {tier.caracteristicas.map((c, i) => (
                        <li key={i} className="text-[10px] text-gray-400 flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-500" /> {c}
                        </li>
                      ))}
                    </ul>
                    <button 
                      onClick={() => {
                        setOrcamento(prev => prev ? { ...prev, prazo: tier.nome === 'Luxo / High-End' ? '45-60 dias' : prev.prazo } : null);
                        setCurrentStep(4);
                      }}
                      className={`w-full mt-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${idx === 1 ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-white/10 text-white hover:bg-white/20'}`}
                    >
                      Selecionar {tier.nome}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: VISUALIZER / SIMULATION */}
        {currentStep === 4 && analysis && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="text-center max-w-xl mx-auto mb-12">
              <h3 className="text-4xl font-black text-white tracking-tighter mb-4">Visualizador Realista</h3>
              <p className="text-gray-400">Escolha o acabamento para ver como seu projeto ficará no ambiente real.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Controls */}
              <div className="lg:col-span-1 space-y-4">
                {['MDF Carvalho', 'Laca Branca High Gloss', 'MDF Grafite Tramado', 'Madeira Demolição'].map(finish => (
                  <button
                    key={finish}
                    onClick={() => handleSimulateFinish(finish)}
                    className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-white text-left hover:bg-amber-500 hover:text-black transition-all flex items-center justify-between group"
                  >
                    <span className="font-bold text-sm">{finish}</span>
                    <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>

              {/* Render Area */}
              <div className="lg:col-span-3 relative aspect-video rounded-[40px] overflow-hidden bg-black border-4 border-white/5 shadow-2xl flex items-center justify-center">
                {isSimulating ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
                    <p className="text-amber-500 font-black uppercase tracking-widest text-xs animate-pulse">Renderizando com Gemini Ultra Pro...</p>
                  </div>
                ) : simulationImage ? (
                  <img src={simulationImage} alt="Render" className="w-full h-full object-cover animate-in fade-in zoom-in duration-1000" />
                ) : (
                  <div className="text-center p-12">
                    <Sparkles className="w-16 h-16 text-white/10 mx-auto mb-4" />
                    <p className="text-gray-500 font-bold">Selecione um acabamento para gerar o render 4K</p>
                  </div>
                )}
                
                {simulationImage && !isSimulating && (
                  <div className="absolute bottom-6 right-6 flex gap-2">
                    <button onClick={() => downloadFile(simulationImage, 'render_sd.jpg')} className="p-3 bg-black/60 backdrop-blur-md rounded-xl text-white hover:bg-white hover:text-black transition-all">
                      <Download className="w-5 h-5" />
                    </button>
                    <button className="p-3 bg-black/60 backdrop-blur-md rounded-xl text-white hover:bg-white hover:text-black transition-all">
                      <Share2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-center pt-12">
              <button 
                onClick={() => setCurrentStep(5)}
                className="px-12 py-5 rounded-2xl bg-amber-500 text-black font-black uppercase tracking-widest hover:bg-amber-400 transition-all shadow-xl"
              >
                Finalizar e Exportar Pedido
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: FINALIZATION */}
        {currentStep === 5 && analysis && orcamento && (
          <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="bg-white/5 border border-amber-500/20 rounded-[40px] p-12 shadow-2xl text-center relative overflow-hidden backdrop-blur-md">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[100px] -mr-32 -mt-32" />
              
              <div className="relative z-10">
                <div className="w-20 h-20 bg-green-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-green-500/20">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h3 className="text-3xl font-black text-white mb-3 uppercase tracking-tighter">Projeto Pronto!</h3>
                <p className="text-gray-400 text-sm mb-10 leading-relaxed">
                  O orçamento e os detalhes técnicos foram gerados. Agora você pode exportar para o Promob ou enviar diretamente para o cliente.
                </p>
                
                <div className="space-y-4 mb-10">
                   <div className="flex justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <span className="text-gray-500 text-xs font-bold uppercase">Valor Total</span>
                      <span className="text-amber-500 font-black">R$ {orcamento.opcoes[1].valor.toLocaleString('pt-BR')}</span>
                   </div>
                   <div className="flex justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                      <span className="text-gray-500 text-xs font-bold uppercase">Prazo Estimado</span>
                      <span className="text-white font-black">{orcamento.prazo}</span>
                   </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button 
                    onClick={() => {
                      const xml = generatePromobXML(analysis);
                      downloadFile(xml, 'projeto_promob.xml');
                      toast({ title: "📁 XML Promob Gerado", description: "O arquivo foi baixado para seu computador." });
                    }}
                    className="py-5 rounded-2xl bg-white/10 text-white font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-white/20 transition-all"
                  >
                    <FileCode className="w-5 h-5 text-amber-500" /> Exportar Promob
                  </button>
                  <button 
                    onClick={() => {
                      toast({ title: "📲 Enviando via WhatsApp", description: "O orçamento foi compartilhado com o cliente." });
                    }}
                    className="py-5 rounded-2xl bg-green-600 text-white font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 hover:bg-green-500 transition-all shadow-lg shadow-green-500/20"
                  >
                    <Send className="w-5 h-5" /> Enviar ao Cliente
                  </button>
                </div>

                <button onClick={resetar} className="mt-8 text-gray-500 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 mx-auto">
                  <RotateCcw className="w-4 h-4" /> Novo Projeto
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AR Overlay (Canvas) */}
      {showAR && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
          <canvas ref={canvasRef} className="max-w-full max-h-[85vh] object-contain shadow-2xl" />
          <div className="absolute top-8 left-8 right-8 flex justify-between items-start pointer-events-none">
            <div className="bg-black/60 backdrop-blur-md p-4 rounded-2xl border border-white/10 pointer-events-auto">
               <h4 className="text-white font-black text-sm uppercase">Simulação AR</h4>
               <p className="text-amber-500 text-[10px] font-bold">Geometria Projetada v2</p>
            </div>
            <button onClick={() => setShowAR(false)} className="p-4 bg-white/10 backdrop-blur-md rounded-full text-white pointer-events-auto hover:bg-red-500 transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="absolute bottom-12 px-6 py-4 bg-black/80 backdrop-blur-md rounded-full border border-amber-500/30 text-amber-500 font-black text-xs uppercase tracking-widest">
             Visualize os módulos posicionados no ambiente real
          </div>
        </div>
      )}

      {/* AR MEASURE TOOL MODAL */}
      {showARTool && (
        <ARMeasureTool 
          onClose={() => setShowARTool(false)} 
          onConfirmMeasurement={(m) => {
            setArMeasuredDim(m);
            setShowARTool(false);
            if (currentStep === 2) analisarAmbiente();
          }} 
        />
      )}

      {/* AR STUDIO 2D MODAL */}
      {showARStudio && (
        <ARStudio2D 
          onClose={() => setShowARStudio(false)}
          onExport={(img) => {
            setStudioExportedImage(img);
            setShowARStudio(false);
          }}
        />
      )}

      <canvas ref={canvasRef} className="hidden" />
      <img ref={imageRef} src={imagePreview || ''} className="hidden" />
    </div>
  );
}
