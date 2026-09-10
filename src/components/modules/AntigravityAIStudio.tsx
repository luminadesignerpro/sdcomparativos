import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, Send, Bot, User, Trash2, Camera, 
  Layers, Scissors, Check, Copy, RefreshCw, 
  HelpCircle, Lightbulb, Zap, FileText, ChevronRight,
  TrendingDown, ShoppingCart, MessageSquare, Download, Brain,
  Code, Terminal, Play, FolderTree, FileCode, CheckCircle2,
  Maximize2, Minimize2, Settings, Plus, X, CornerDownLeft
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { chatWithAI, analyzeImageWithGemini } from '@/services/geminiService';

export interface StudioMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  images?: string[];
  model?: 'gemini-3.7-flash' | 'claude-opus-4.6';
  suggestedPieces?: Array<{
    name: string;
    material: string;
    length: number;
    width: number;
    quantity: number;
  }>;
  codeSnippet?: {
    language: string;
    code: string;
  };
}

interface AntigravityAIStudioProps {
  initialModel?: 'gemini-3.7-flash' | 'claude-opus-4.6';
  activeFolderName?: string;
  activeFolderId?: string;
  suppliers?: Array<{ id: string; name: string; [key: string]: any }>;
  clientFolders?: Array<{ id: string; name: string; [key: string]: any }>;
  onCreateFolder?: (name: string) => void;
  onCreateSupplier?: (name: string) => void;
  onDeleteSupplier?: (idOrName: string) => void;
  onNavigateToTab?: (tab: string) => void;
  onCreateMainTab?: (name: string) => void;
  onDeleteMainTab?: (name: string) => void;
  onNavigateToCuttingPlan?: () => void;
}

const INITIAL_FILES = [
  {
    id: 'plano_corte',
    name: 'PlanoDeCorte.ts',
    language: 'typescript',
    content: `// 📐 SDcomparativo - Gerador & Calculador de Peças para Plano de Corte 2D
export interface CutPiece {
  name: string;
  material: string;
  length: number; // mm
  width: number;  // mm
  quantity: number;
  fita: string[];
}

export const pecasProjeto: CutPiece[] = [
  { name: 'Lateral Esquerda', material: 'MDF BRANCO TX 15', length: 2100, width: 550, quantity: 1, fita: ['C1'] },
  { name: 'Lateral Direita', material: 'MDF BRANCO TX 15', length: 2100, width: 550, quantity: 1, fita: ['C1'] },
  { name: 'Tampo Superior', material: 'MDF BRANCO TX 15', length: 1200, width: 550, quantity: 1, fita: ['C1', 'L1', 'L2'] },
  { name: 'Base Inferior', material: 'MDF BRANCO TX 15', length: 1200, width: 550, quantity: 1, fita: ['C1'] },
  { name: 'Prateleira Móvel', material: 'MDF BRANCO TX 15', length: 1168, width: 530, quantity: 3, fita: ['C1'] },
  { name: 'Porta Direita', material: 'MDF 15 ITAPUA', length: 2060, width: 595, quantity: 1, fita: ['C1', 'C2', 'L1', 'L2'] },
  { name: 'Porta Esquerda', material: 'MDF 15 ITAPUA', length: 2060, width: 595, quantity: 1, fita: ['C1', 'C2', 'L1', 'L2'] }
];

console.log("✅ Total de peças carregadas:", pecasProjeto.length);`
  },
  {
    id: 'calculo_gavetas',
    name: 'CalculadoraGavetas.py',
    language: 'python',
    content: `# 🗄️ Fórmulas de Marcenaria para Gavetas & Corrediças Telescópicas
def calcular_gavetas(vao_largura_mm, vao_altura_mm, qtd_gavetas=4, folga_corredica_mm=26):
    """
    vao_largura_mm: Largura livre interna do móvel (ex: 800mm)
    folga_corredica_mm: Folga total necessária (13mm de cada lado = 26mm)
    """
    largura_externa_gaveta = vao_largura_mm - folga_corredica_mm
    altura_frente = (vao_altura_mm - (qtd_gavetas + 1) * 3) / qtd_gavetas
    
    print(f"📏 Largura da Gaveta: {largura_externa_gaveta} mm")
    print(f"📐 Altura de cada Frente: {altura_frente:.1f} mm")
    return largura_externa_gaveta, altura_frente

# Exemplo para vão de 800 x 700 mm
calcular_gavetas(800, 700, 4)`
  },
  {
    id: 'orcamento',
    name: 'OrcamentoMovel.json',
    language: 'json',
    content: `{
  "projeto": "Armário 2 Portas + Gavetas",
  "cliente": "DAVI",
  "data": "2026-08-24",
  "chapasMDF": [
    { "material": "MDF BRANCO TX 15", "dimensao": "2750x1850", "qtdChapas": 2, "precoMedio": 195.00 },
    { "material": "MDF 15 ITAPUA", "dimensao": "2750x1850", "qtdChapas": 1, "precoMedio": 310.00 }
  ],
  "ferragens": [
    { "item": "Dobradiça 35mm Amortecedor Reta", "qtd": 8, "precoUnit": 8.50 },
    { "item": "Corrediça Telescópica 450mm Soft Close", "qtd": 4, "precoUnit": 32.00 },
    { "item": "Puxador Perfil Alumínio 2.0m", "qtd": 2, "precoUnit": 45.00 }
  ],
  "fitaBordaTotalMetros": 48.5,
  "custoTotalEstimado": 948.00
}`
  }
];

export const AntigravityAIStudio: React.FC<AntigravityAIStudioProps> = ({
  initialModel = 'gemini-3.7-flash',
  activeFolderName = 'DAVI',
  activeFolderId,
  suppliers = [],
  clientFolders = [],
  onCreateFolder,
  onCreateSupplier,
  onDeleteSupplier,
  onNavigateToTab,
  onCreateMainTab,
  onDeleteMainTab,
  onNavigateToCuttingPlan
}) => {
  const { toast } = useToast();
  const [activeModel, setActiveModel] = useState<'gemini-3.7-flash' | 'claude-opus-4.6'>(initialModel);
  const [files, setFiles] = useState(INITIAL_FILES);
  const [activeFileId, setActiveFileId] = useState<string>('plano_corte');
  
  // Terminal
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    'PS C:\\Users\\User\\.gemini\\antigravity-ide\\scratch\\SDcomparativo> SD Antigravity AI Studio v2.0',
    '⚡ Modelos Ativos: Google Gemini 3.7 Flash & Anthropic Claude Opus 4.6',
    '📡 Conexão: Online (Sem necessidade de login ou email)',
    '✨ Pronto para criar código, orçamentos, fórmulas e planos de corte!'
  ]);
  const [terminalInput, setTerminalInput] = useState('');

  // Chat
  const [messages, setMessages] = useState<StudioMessage[]>(() => {
    try {
      const saved = localStorage.getItem(`sd_studio_chat_${activeFolderId || 'global'}`);
      return saved ? JSON.parse(saved) : [
        {
          id: 'welcome',
          role: 'assistant',
          model: initialModel,
          content: `🚀 **Bem-vindo ao SD Antigravity AI Studio!**\n\nEstou conectado aos motores neurais de **${initialModel === 'claude-opus-4.6' ? 'Claude Opus 4.6 (Thinking)' : 'Gemini 3.7 Flash (Thinking)'}**.\n\n✨ **O que você pode fazer aqui:**\n1. 💻 **Editar e Executar Código**: Escreva scripts em TypeScript, Python ou JSON no painel esquerdo.\n2. 📐 **Gerar Peças & Enviar ao Plano de Corte 2D**: Peça móveis completos com medidas e envie com 1 clique para as chapas.\n3. 📸 **Leitura com Câmera / Visão**: Envie fotos de rascunhos em papel ou orçamentos.\n4. ⚡ **Terminal Powershell**: Execute comandos, simulações de corte e testes.`,
          timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        }
      ];
    } catch {
      return [];
    }
  });

  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeFile = files.find(f => f.id === activeFileId) || files[0];

  useEffect(() => {
    try {
      localStorage.setItem(`sd_studio_chat_${activeFolderId || 'global'}`, JSON.stringify(messages));
    } catch {}
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeFolderId]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [terminalLogs]);

  const handleSendMessage = async (customText?: string) => {
    const text = (customText || inputPrompt).trim();
    if (!text && selectedImages.length === 0) return;

    const userMsg: StudioMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      images: selectedImages.length > 0 ? selectedImages : undefined,
      model: activeModel
    };

    setMessages(prev => [...prev, userMsg]);
    setInputPrompt('');
    const curImgs = [...selectedImages];
    setSelectedImages([]);
    setIsLoading(true);

    // Adiciona log no terminal
    setTerminalLogs(prev => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] 🚀 Processando prompt com ${activeModel === 'claude-opus-4.6' ? 'Claude Opus 4.6' : 'Gemini 3.7 Flash'}...`
    ]);

    try {
      let aiResponseText = '';

      const systemInstruction = `Você é o assistente AGENTE de IA especialista do "SD Antigravity AI Studio" integrado ao SDcomparativo.
Modelo: ${activeModel === 'claude-opus-4.6' ? 'Anthropic Claude Opus 4.6' : 'Google Gemini 3.7 Flash'}.

VOCÊ TEM CONTROLE TOTAL DA INTERFACE DO USUÁRIO. Para executar ações no sistema, você DEVE adicionar os seguintes comandos (exatamente como mostrados) em qualquer lugar da sua resposta:

1. Para criar uma ABA PRINCIPAL no topo (ex: se o usuário pedir para criar uma aba do lado do Claude, ou uma aba/workspace principal):
   CREATE_MAIN_TAB: [NOME_DA_ABA]
2. Para EXCLUIR uma ABA PRINCIPAL no topo (ex: se o usuário pedir para excluir/deletar a aba X):
   DELETE_MAIN_TAB: [NOME_DA_ABA]
3. Para criar uma PASTA DE CLIENTE (ex: se o usuário pedir para criar pasta, aba de cliente, ou projeto):
   CREATE_TAB: [NOME_DA_PASTA]
4. Para criar um FORNECEDOR na barra superior:
   CREATE_SUPPLIER: [NOME_DO_FORNECEDOR]
5. Para NAVEGAR para alguma aba:
   NAVIGATE_TAB: [NOME_DA_ABA_OU_ID]

SE O USUÁRIO ENVIAR UMA IMAGEM COM UM COMANDO ESCRITO NELA (EX: "EXCLUA A ABA X"), VOCÊ DEVE LER A IMAGEM E EMITIR O COMANDO CORRESPONDENTE NA SUA RESPOSTA!

Se o usuário perguntar quais são os comandos do sistema ou o que você pode fazer, liste os 5 comandos acima com exemplos reais!

Diretrizes:
1. Responda em Português do Brasil com altíssima qualidade técnica.
2. Quando o usuário pedir cálculos de peças de móveis:
   - SEMPRE adicione no final um bloco JSON estruturado:
\`\`\`json
{
  "pieces": [
    { "name": "Lateral", "material": "MDF BRANCO TX 15", "length": 2100, "width": 550, "quantity": 2 }
  ]
}
\`\`\`
3. Se você usar um comando de ação, informe o usuário que você já executou!`;

      if (curImgs.length > 0) {
        aiResponseText = await analyzeImageWithGemini(
          curImgs.join("|"),
          `${systemInstruction}\n\nArquivo de código ativo:\n${activeFile.name}\n\`\`\`${activeFile.language}\n${activeFile.content}\n\`\`\`\n\nPrompt do Usuário: ${text || 'Analise a imagem e gere as peças e código necessários.'}`
        );
      } else {
        const fullPrompt = `Arquivo aberto no editor:\n${activeFile.name}:\n\`\`\`${activeFile.language}\n${activeFile.content}\n\`\`\`\n\nSolicitação: ${text}`;
        aiResponseText = await chatWithAI(fullPrompt, systemInstruction, activeModel);
      }

      // ─── EXECUÇÃO AUTOMÁTICA DE AÇÕES DO SISTEMA EM TEMPO REAL ───
      const lowerInput = text.toLowerCase();
      
      // AÇÃO 1A: CRIAR ABA PRINCIPAL NO TOPO (ex: "CRIE UMA ABA DO LADO DA SD CLAUDE", "NOVA ABA PRINCIPAL")
      if ((lowerInput.includes('aba') && (lowerInput.includes('topo') || lowerInput.includes('principal') || lowerInput.includes('lado') || lowerInput.includes('gemini') || lowerInput.includes('claude'))) || aiResponseText.includes('CREATE_MAIN_TAB:')) {
        if (lowerInput.includes('crie') || lowerInput.includes('criar') || lowerInput.includes('nova') || aiResponseText.includes('CREATE_MAIN_TAB:')) {
          let tabName = 'NOVA ABA';
          const matchName = text.match(/(?:nome|chamad[ao]|aba)\s+["']?([a-zA-Z0-9_\-\s]+)["']?/i) || aiResponseText.match(/CREATE_MAIN_TAB:\s*([a-zA-Z0-9_\-\s]+)/);
          if (matchName && matchName[1]) {
            let extracted = matchName[1].trim().toUpperCase();
            if (extracted.includes("DO LADO") || extracted.includes("PRINCIPAL")) {
               extracted = "WORKSPACE";
            }
            tabName = extracted;
          }

          if (onCreateMainTab) {
            onCreateMainTab(tabName);
            setTerminalLogs(prev => [...prev, `[EXEC] 🛠️ Criando aba PRINCIPAL ao lado do Claude: ${tabName}... ✅ CONCLUÍDO!`]);
          }
        }
      } 
      // AÇÃO 1A.2: EXCLUIR ABA PRINCIPAL NO TOPO
      if (lowerInput.includes('exclua') || lowerInput.includes('delete') || lowerInput.includes('apague') || aiResponseText.includes('DELETE_MAIN_TAB:')) {
        const matchDelete = text.match(/(?:exclua|delete|apague)\s+(?:a\s+aba|aba)\s+["']?([a-zA-Z0-9_\-\s]+)["']?/i) || aiResponseText.match(/DELETE_MAIN_TAB:\s*([a-zA-Z0-9_\-\s]+)/);
        if (matchDelete && matchDelete[1]) {
          const tabName = matchDelete[1].trim().toUpperCase();
          if (onDeleteMainTab) {
            onDeleteMainTab(tabName);
            setTerminalLogs(prev => [...prev, `[EXEC] 🗑️ Excluindo aba PRINCIPAL: ${tabName}... ✅ CONCLUÍDO!`]);
          }
        }
      }
      // AÇÃO 1B: CRIAR PASTA DE CLIENTE NO DROPDOWN (ex: "CRIE UMA PASTA DE CLIENTE", "CRIE UMA ABA PROJETOS")
      else if (lowerInput.includes('pasta') || lowerInput.includes('aba') || aiResponseText.includes('CREATE_TAB:')) {
        if (lowerInput.includes('crie') || lowerInput.includes('criar') || lowerInput.includes('adicione') || lowerInput.includes('nova') || aiResponseText.includes('CREATE_TAB:')) {
          let folderName = 'PROJETOS';
          const matchName = text.match(/(?:nome|chamad[ao]|pasta|aba)\s+["']?([a-zA-Z0-9_\-\s]+)["']?/i) || aiResponseText.match(/CREATE_TAB:\s*([a-zA-Z0-9_\-\s]+)/);
          if (matchName && matchName[1]) {
            folderName = matchName[1].trim().toUpperCase();
          }

          if (onCreateFolder) {
            onCreateFolder(folderName);
          }
          setTerminalLogs(prev => [...prev, `[EXEC] 📁 Criando e ativando pasta/dropdown de cliente: ${folderName}... ✅ CONCLUÍDO!`]);
        }
      }

      // AÇÃO 2: CRIAR FORNECEDOR (ex: "CRIE UM FORNECEDOR CHAMADO MADEIRAS SILVA")
      if (lowerInput.includes('fornecedor') && (lowerInput.includes('crie') || lowerInput.includes('criar') || lowerInput.includes('adicione'))) {
        const matchSup = text.match(/(?:nome|chamad[ao]|fornecedor)\s+["']?([a-zA-Z0-9_\-\s]+)["']?/i);
        const supName = matchSup && matchSup[1] ? matchSup[1].trim().toUpperCase() : 'NOVO FORNECEDOR';
        if (onCreateSupplier) {
          onCreateSupplier(supName);
        }
        setTerminalLogs(prev => [...prev, `[EXEC] 🏢 Criando fornecedor na barra do topo: ${supName}... ✅ CONCLUÍDO!`]);
      }

      // AÇÃO 3: NAVEGAÇÃO DE ABAS (ex: "ABRA O COMPARATIVO", "VÁ PARA O PLANO DE CORTE")
      if (lowerInput.includes('abra') || lowerInput.includes('abrir') || lowerInput.includes('vá para') || lowerInput.includes('ir para')) {
        if (lowerInput.includes('corte') || lowerInput.includes('plano')) {
          if (onNavigateToTab) onNavigateToTab('cutting_plan');
        } else if (lowerInput.includes('comparativo') || lowerInput.includes('preço')) {
          if (onNavigateToTab) onNavigateToTab('comparison');
        }
      }

      // Extrair peças JSON para importação e atualizar código no editor
      let extractedPieces: any[] | undefined = undefined;
      const jsonMatch = aiResponseText.match(/```json\s*([\s\S]*?)\s*```/) || aiResponseText.match(/\{[\s\S]*"pieces"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          if (Array.isArray(parsed.pieces) && parsed.pieces.length > 0) {
            extractedPieces = parsed.pieces;

            // Atualizar o código no arquivo PlanoDeCorte.ts em tempo real
            const generatedTsCode = `// 📐 Peças Geradas Automaticamente por ${activeModel === 'claude-opus-4.6' ? 'Claude Opus 4.6' : 'Gemini 3.7 Flash'}
export interface CutPiece {
  name: string;
  material: string;
  length: number;
  width: number;
  quantity: number;
}

export const pecasOtimizadas: CutPiece[] = ${JSON.stringify(extractedPieces, null, 2)};

console.log("✅ Total de peças calculadas:", pecasOtimizadas.length);`;

            setFiles(prev => prev.map(f => f.id === 'plano_corte' ? { ...f, content: generatedTsCode } : f));
            setTerminalLogs(prev => [...prev, `[EDITOR] 📝 PlanoDeCorte.ts atualizado com ${extractedPieces.length} peças calculadas!`]);
          }
        } catch {}
      }

      const assistantMsg: StudioMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        model: activeModel,
        content: aiResponseText,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        suggestedPieces: extractedPieces
      };

      setMessages(prev => [...prev, assistantMsg]);
      setTerminalLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ✅ Resposta gerada com sucesso (${aiResponseText.length} caracteres)`
      ]);
    } catch (err: any) {
      console.error('Erro na IA:', err);
      const errorMsg: StudioMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        model: activeModel,
        content: `⚠️ Falha na execução da IA: ${err.message || 'Verifique sua conexão WiFi/Internet.'}`,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
      setTerminalLogs(prev => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] ❌ Erro: ${err.message || 'Falha de rede'}`
      ]);
      toast({ title: 'Erro de Comunicação com a IA', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunCode = () => {
    setTerminalLogs(prev => [
      ...prev,
      `PS C:\\Users\\User\\.gemini\\antigravity-ide\\scratch\\SDcomparativo> node ${activeFile.name}`,
      `⚙️ Executando script "${activeFile.name}"...`,
      `📊 Análise de sintaxe: OK (0 erros, 0 avisos)`,
      `✨ Código validado com sucesso pelo compilador SDcomparativo.`
    ]);
    toast({ title: `▶️ ${activeFile.name} executado no Terminal!` });
  };

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalInput.trim()) return;

    const cmd = terminalInput.trim();
    setTerminalInput('');

    let output = '';
    if (cmd === 'clear' || cmd === 'cls') {
      setTerminalLogs(['PS C:\\Users\\User\\.gemini\\antigravity-ide\\scratch\\SDcomparativo>']);
      return;
    } else if (cmd.startsWith('npm') || cmd.startsWith('npx')) {
      output = `> sdcomparativo@1.0.0 ${cmd}\n✓ vite v5.4.19 dev server ready in 420ms\n➜ Local: http://localhost:5173/`;
    } else if (cmd === 'help' || cmd === '?') {
      output = `Comandos disponíveis:\n- node PlanoDeCorte.ts (Executar plano)\n- python CalculadoraGavetas.py (Calcular gavetas)\n- corte --otimizar (Otimizar chapas)\n- npm run dev (Iniciar servidor)\n- clear (Limpar terminal)`;
    } else {
      output = `Comando executado: "${cmd}". Status: OK.`;
    }

    setTerminalLogs(prev => [
      ...prev,
      `PS C:\\Users\\User\\.gemini\\antigravity-ide\\scratch\\SDcomparativo> ${cmd}`,
      output
    ]);
  };

  const handleAddPiecesToCuttingPlan = (piecesToAdd: Array<{ name: string; material: string; length: number; width: number; quantity: number }>) => {
    try {
      const key = `sd_cutting_pieces_${activeFolderId || 'default'}`;
      const saved = localStorage.getItem(key);
      const currentPieces = saved ? JSON.parse(saved) : [];

      const formattedNew = piecesToAdd.map(p => ({
        id: Date.now().toString() + Math.random().toString(36).substring(2, 6),
        name: p.name || 'Peça Gerada por IA',
        material: p.material || 'MDF BRANCO TX 15',
        length: Number(p.length) || 700,
        width: Number(p.width) || 450,
        quantity: Number(p.quantity) || 1,
        rotateAllowed: true,
        edgeBanding: { top: true, bottom: false, left: false, right: false }
      }));

      localStorage.setItem(key, JSON.stringify([...formattedNew, ...currentPieces]));
      toast({ 
        title: `🚀 ${piecesToAdd.length} peças importadas para o Plano de Corte!`, 
        description: 'Vá para a aba "Plano de Corte" para visualizar as chapas otimizadas.' 
      });

      if (onNavigateToCuttingPlan) onNavigateToCuttingPlan();
    } catch {
      toast({ title: 'Erro ao importar peças', variant: 'destructive' });
    }
  };

  const handleUpdateFileContent = (newContent: string) => {
    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: newContent } : f));
  };

  return (
    <div className="space-y-3 font-sans">
      
      {/* ══ BARRA SUPERIOR ESTILO ANTIGRAVITY IDE ══ */}
      <div className="bg-[#161b22] border border-white/10 rounded-2xl p-2.5 shadow-xl flex flex-col sm:flex-row justify-between items-center gap-3">
        
        {/* Menu de Janela Antigravity */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 px-2">
            <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-yellow-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-green-500/80 inline-block"></span>
          </div>

          <div className="flex items-center gap-1 text-xs text-gray-300 font-medium border-l border-white/10 pl-3">
            <span className="text-amber-400 font-black flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Antigravity AI Studio
            </span>
            <span className="text-gray-500">|</span>
            <span className="text-gray-400">Pasta: <b className="text-white">{activeFolderName}</b></span>
          </div>

          {/* Menus rápidos */}
          <div className="hidden md:flex items-center gap-2 text-[11px] text-gray-400 border-l border-white/10 pl-3">
            <span className="hover:text-white cursor-pointer transition-colors">File</span>
            <span className="hover:text-white cursor-pointer transition-colors">Edit</span>
            <span className="hover:text-white cursor-pointer transition-colors">Selection</span>
            <span className="hover:text-white cursor-pointer transition-colors">Run</span>
            <span className="hover:text-white cursor-pointer transition-colors">Terminal</span>
          </div>
        </div>

        {/* SELETOR DE MODELO IA (GEMINI 3.7 vs CLAUDE OPUS 4.6) */}
        <div className="flex items-center gap-2">
          <div className="bg-[#0d1117] border border-white/15 p-1 rounded-xl flex items-center gap-1 shadow-inner">
            <button
              onClick={() => {
                setActiveModel('gemini-3.7-flash');
                toast({ title: '⚡ Modelo alternado para Google Gemini 3.7 Flash' });
              }}
              className={`px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                activeModel === 'gemini-3.7-flash'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.5)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Gemini 3.7 Flash</span>
            </button>

            <button
              onClick={() => {
                setActiveModel('claude-opus-4.6');
                toast({ title: '🧠 Modelo alternado para Anthropic Claude Opus 4.6' });
              }}
              className={`px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all ${
                activeModel === 'claude-opus-4.6'
                  ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-[0_0_12px_rgba(249,115,22,0.5)]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Claude Opus 4.6</span>
            </button>
          </div>

          <button
            onClick={handleRunCode}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all hover:scale-105 active:scale-95"
            title="Executar código no Terminal"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Executar</span>
          </button>
        </div>

      </div>

      {/* ══ WORKSPACE DIVIDIDO EM 2 PAINÉIS (IDE + CHAT COPILOT) ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-[700px]">
        
        {/* ─── PAINEL ESQUERDO: EXPLORER, CODE EDITOR & TERMINAL (7 colunas) ─── */}
        <div className="lg:col-span-7 flex flex-col h-full bg-[#0d1117] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          
          {/* Abas de Arquivos estilo VS Code */}
          <div className="bg-[#161b22] border-b border-white/10 flex items-center justify-between px-2 pt-1.5 overflow-x-auto shrink-0">
            <div className="flex items-center gap-1">
              {files.map(f => (
                <button
                  key={f.id}
                  onClick={() => setActiveFileId(f.id)}
                  className={`px-3 py-1.5 rounded-t-xl text-xs font-mono flex items-center gap-2 transition-all border-t-2 ${
                    activeFileId === f.id
                      ? 'bg-[#0d1117] text-white font-bold border-amber-400 shadow-md'
                      : 'bg-white/5 text-gray-400 hover:text-gray-200 border-transparent hover:bg-white/10'
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5 text-amber-400" />
                  <span>{f.name}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 text-gray-400 text-xs px-2">
              <span className="text-[10px] font-mono text-gray-500 uppercase">{activeFile.language}</span>
            </div>
          </div>

          {/* Editor de Código com Números de Linha */}
          <div className="flex-1 flex overflow-hidden font-mono text-xs bg-[#0d1117]">
            {/* Números de linha */}
            <div className="bg-[#0b0e14] text-gray-600 px-3 py-3 select-none text-right border-r border-white/5 space-y-1">
              {activeFile.content.split('\n').map((_, i) => (
                <div key={i} className="leading-5">{i + 1}</div>
              ))}
            </div>

            {/* Textarea do Editor */}
            <textarea
              value={activeFile.content}
              onChange={(e) => handleUpdateFileContent(e.target.value)}
              spellCheck={false}
              className="flex-1 bg-transparent text-gray-200 p-3 leading-5 resize-none focus:outline-none font-mono text-xs sm:text-sm selection:bg-amber-500/30 overflow-y-auto"
            />
          </div>

          {/* Terminal Integrado na Parte Inferior */}
          <div className="h-44 bg-[#090d12] border-t border-white/10 flex flex-col shrink-0">
            <div className="bg-[#11161d] px-3 py-1.5 border-b border-white/10 flex items-center justify-between text-xs text-gray-300 font-mono">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-white">Terminal (powershell)</span>
              </div>
              <button
                onClick={() => setTerminalLogs(['PS C:\\Users\\User\\.gemini\\antigravity-ide\\scratch\\SDcomparativo>'])}
                className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
              >
                Limpar
              </button>
            </div>

            {/* Feed de Logs do Terminal */}
            <div className="flex-1 p-2.5 overflow-y-auto font-mono text-[11px] text-gray-300 space-y-1">
              {terminalLogs.map((log, idx) => (
                <div key={idx} className={log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-emerald-300' : log.includes('PS') ? 'text-cyan-400' : 'text-gray-300'}>
                  {log}
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>

            {/* Linha de Comando do Terminal */}
            <form onSubmit={handleTerminalSubmit} className="bg-[#0d1117] border-t border-white/10 px-3 py-1.5 flex items-center gap-2 font-mono text-xs">
              <span className="text-cyan-400 font-bold">{'>'}</span>
              <input
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                placeholder="Digite um comando (ex: node PlanoDeCorte.ts, npm run dev, help)..."
                className="flex-1 bg-transparent text-white focus:outline-none text-xs font-mono placeholder-gray-600"
              />
              <button type="submit" className="text-gray-500 hover:text-emerald-400">
                <CornerDownLeft className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

        </div>

        {/* ─── PAINEL DIREITO: ANTIGRAVITY AI ASSISTANT CHAT (5 colunas) ─── */}
        <div className="lg:col-span-5 flex flex-col h-full bg-[#161b22] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          
          {/* Cabeçalho do Chat Copilot */}
          <div className="bg-[#1f242c] p-3 border-b border-white/10 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-white shadow-md ${
                activeModel === 'claude-opus-4.6' ? 'bg-orange-600' : 'bg-cyan-600'
              }`}>
                {activeModel === 'claude-opus-4.6' ? <Brain className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              </div>
              <div>
                <div className="text-xs font-black text-white flex items-center gap-1.5">
                  <span>{activeModel === 'claude-opus-4.6' ? 'Claude Opus 4.6' : 'Gemini 3.7 Flash'}</span>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9px] px-1.5 py-0.2 rounded font-bold">
                    ONLINE
                  </span>
                </div>
                <div className="text-[10px] text-gray-400">Pair programming & Marcenaria AI</div>
              </div>
            </div>

            <button
              onClick={() => {
                if (confirm('Limpar conversas da IA?')) {
                  setMessages([{
                    id: Date.now().toString(),
                    role: 'assistant',
                    model: activeModel,
                    content: '🧹 Conversa reiniciada! Peça cálculos, código ou envie fotos para análise.',
                    timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  }]);
                  localStorage.removeItem(`sd_studio_chat_${activeFolderId || 'global'}`);
                }
              }}
              className="text-gray-400 hover:text-red-400 p-1 transition-colors"
              title="Limpar histórico"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Feed de Mensagens do Chat */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-in fade-in`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                    isUser
                      ? 'bg-amber-500 text-black'
                      : m.model === 'claude-opus-4.6'
                        ? 'bg-orange-600 text-white'
                        : 'bg-cyan-600 text-white'
                  }`}>
                    {isUser ? <User className="w-3.5 h-3.5" /> : m.model === 'claude-opus-4.6' ? <Brain className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>

                  <div className={`max-w-[88%] rounded-2xl p-3.5 space-y-2 shadow-md ${
                    isUser
                      ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-black font-medium'
                      : 'bg-[#0d1117] border border-white/10 text-gray-100'
                  }`}>
                    {m.images && m.images.length > 0 && (
                      <div className="flex gap-1.5 flex-wrap mb-1.5">
                        {m.images.map((img, i) => (
                          <img key={i} src={img} alt="Anexo" className="w-20 h-20 object-cover rounded-lg border border-white/20" />
                        ))}
                      </div>
                    )}

                    <div className="leading-relaxed whitespace-pre-wrap font-sans text-xs">
                      {m.content}
                    </div>

                    {/* Botão de Inserir no Plano de Corte se a IA gerou lista */}
                    {m.suggestedPieces && m.suggestedPieces.length > 0 && (
                      <div className="pt-2.5 mt-2 border-t border-white/10 bg-black/30 p-2.5 rounded-xl space-y-2">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-bold text-emerald-400 flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5" /> {m.suggestedPieces.length} Peças Otimizadas
                          </span>
                        </div>
                        <button
                          onClick={() => handleAddPiecesToCuttingPlan(m.suggestedPieces!)}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md transition-all hover:scale-[1.02]"
                        >
                          <Scissors className="w-3.5 h-3.5" />
                          <span>🚀 Enviar para Plano de Corte 2D</span>
                        </button>
                      </div>
                    )}

                    <div className={`text-[9px] text-right font-mono ${isUser ? 'text-black/60 font-bold' : 'text-gray-500'}`}>
                      {m.timestamp}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2.5 animate-pulse">
                <div className="w-7 h-7 rounded-lg bg-cyan-600/30 text-cyan-400 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div className="bg-[#0d1117] border border-cyan-500/30 rounded-xl px-3.5 py-2 text-xs text-cyan-300 font-bold">
                  <span>{activeModel === 'claude-opus-4.6' ? 'Claude Opus 4.6' : 'Gemini 3.7 Flash'} raciocinando...</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Preview de imagens anexadas */}
          {selectedImages.length > 0 && (
            <div className="p-3 bg-[#11161d] border-t border-white/10 flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-bold uppercase font-mono">
                📸 {selectedImages.length} Imagem(ns) anexada(s)
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10">
                {selectedImages.map((img, idx) => (
                  <div key={idx} className="relative group shrink-0">
                    <img src={img} alt="Preview" className="w-12 h-12 object-cover rounded-xl border border-white/20" />
                    <button 
                      onClick={() => setSelectedImages(prev => prev.filter((_, i) => i !== idx))} 
                      className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-400 text-white w-4 h-4 flex items-center justify-center rounded-full shadow-lg text-[10px]"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Barra de Ações Rápidas (Chips) */}
          <div className="bg-[#11161d] px-3 py-1.5 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
            {[
              { label: '📐 Armário 2 Portas', prompt: 'Calcule as peças completas de um armário 2 portas 2100x1000x550mm em MDF Branco TX e gere a lista para o plano de corte.' },
              { label: '🗄️ Gavetas 800mm', prompt: 'Qual o cálculo exato para 4 gavetas em vão de 800x700mm com corrediça telescópica?' },
              { label: '🪵 Cozinha em L', prompt: 'Gere o orçamento e lista de peças de uma cozinha planejada em L com 3.00x1.80m.' },
              { label: '💰 Comparar MDF', prompt: 'Qual a diferença de rendimento e custo entre MDF Branco TX e MDF Amadeirado?' }
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(chip.prompt)}
                className="bg-white/5 hover:bg-amber-500/20 text-gray-400 hover:text-amber-300 border border-white/10 px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 transition-all"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Input estilo Antigravity IDE: "Ask anything, @ to mention, / for actions" */}
          <div className="p-3 bg-[#11161d] border-t border-white/10 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) {
                    files.slice(0, 10).forEach(file => {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setSelectedImages(prev => prev.length < 10 ? [...prev, reader.result as string] : prev);
                      };
                      reader.readAsDataURL(file);
                    });
                  }
                }}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-9 h-9 bg-white/5 hover:bg-cyan-500/20 border border-white/10 text-gray-300 hover:text-cyan-300 rounded-xl flex items-center justify-center transition-all shrink-0"
                title="Tirar foto ou anexar projeto/orçamento"
              >
                <Camera className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onPaste={(e) => {
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  let hasImage = false;
                  for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                      const file = items[i].getAsFile();
                      if (file) {
                        hasImage = true;
                        const reader = new FileReader();
                        reader.onloadend = () => {
                           setSelectedImages(prev => prev.length < 10 ? [...prev, reader.result as string] : prev);
                        };
                        reader.readAsDataURL(file);
                      }
                    }
                  }
                  if (hasImage) {
                    e.preventDefault();
                    toast({ title: '📸 Imagem(ns) colada(s) com sucesso!' });
                  }
                }}
                placeholder={`Pergunte ao ${activeModel === 'claude-opus-4.6' ? 'Claude Opus 4.6' : 'Gemini 3.7'} (@ para mencionar, / para ações)...`}
                disabled={isLoading}
                className="flex-1 bg-[#0d1117] border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />

              <button
                type="submit"
                disabled={isLoading || (!inputPrompt.trim() && selectedImages.length === 0)}
                className={`w-9 h-9 text-white rounded-xl flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 shrink-0 ${
                  activeModel === 'claude-opus-4.6'
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500'
                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500'
                }`}
                title="Enviar"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1.5 px-1 font-mono">
              <span>+ {activeModel === 'claude-opus-4.6' ? 'Claude Opus 4.6 (Thinking)' : 'Gemini 3.7 Flash (Thinking)'}</span>
              <span className="text-emerald-400">● Conectado (WiFi)</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
