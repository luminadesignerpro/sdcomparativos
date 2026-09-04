import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { analyzeImageWithGemini, analyzeTextWithGroq } from '@/services/geminiService';
import { 
  Building, Plus, Search, Edit, Trash2, Phone, Mail, 
  TrendingDown, DollarSign, Award, CheckCircle2,
  BarChart3, ShoppingBag, Tag, Maximize2, ClipboardList,
  Printer, ShoppingCart, CheckSquare, Sparkles, Camera, Eye, X, Loader2,
  FileText, ExternalLink, Check, Download, User, PenLine, Pencil,
  Folder, FolderPlus, FolderOpen, FolderCheck, LayoutGrid, List,
  MessageCircle, Send, Percent, ChevronDown, Scissors, Layout, Settings, RefreshCw, Cloud
} from 'lucide-react';
import { CuttingPlanModule } from './CuttingPlanModule';
import { AntigravityAIStudio } from './AntigravityAIStudio';
import { GeminiAIModule } from './GeminiAIModule';
import { ClaudeAIModule } from './ClaudeAIModule';
import { initCloudSync, pushCloudState, fetchCloudState, CloudStatePayload } from '@/services/cloudSyncService';

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

const db = supabase as any;

interface Supplier {
  id: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  category: string;
  notes: string | null;
  active: boolean;
}

interface PriceQuote {
  supplierId: string;
  supplierName: string;
  brand: string;
  pricePerM2: number | null;
  unitPrice: number;
  price: number;
  updatedAt: string;
  photoUrl?: string | null;
  specifications?: string | null;
}

interface ProductComparison {
  id: string;
  productName: string;
  category: string;
  unit: string;
  description?: string;
  quotes: PriceQuote[];
}

interface ClientFolder {
  id: string;
  name: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  status: 'Em Cotação' | 'Pronto para Comprar' | 'Comprado';
}

interface MaterialListItem {
  id: string;
  productId: string;
  productName: string;
  category: string;
  selectedSupplierName: string;
  selectedBrand: string;
  selectedUnitPrice: number;
  quantity: number;
  total: number;
  isCheapestSelected: boolean;
  clientName?: string;
  clientFolderId?: string;
}

interface BatchImportItem {
  productName: string;
  category: string;
  brand: string;
  unitPrice: number;
  quantity: number;
}

const DEFAULT_COMPARISONS: ProductComparison[] = [];

// ─── Modal Isolado para Digitação Rápida sem Lag ──────────────────────────
interface TextImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (text: string) => void;
  isAnalyzing: boolean;
}

const TextImportModal: React.FC<TextImportModalProps> = memo(({ isOpen, onClose, onConfirm, isAnalyzing }) => {
  const [text, setText] = useState('');

  // Limpa o texto ao abrir
  useEffect(() => {
    if (isOpen) setText('');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-indigo-500/40 rounded-3xl p-6 shadow-2xl space-y-4 text-white w-full max-w-xl">
        <div className="flex justify-between items-start border-b border-white/10 pb-3">
          <div>
            <h3 className="font-bold text-lg text-indigo-300 flex items-center gap-2">
              <PenLine className="w-5 h-5" /> Cadastrar por Descrição (IA)
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Descreva a compra com suas palavras. A IA identifica cliente, produtos, quantidades e valores automaticamente.
            </p>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-9 h-9 bg-white/10 text-gray-400 hover:text-white rounded-full flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <textarea
          rows={6}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={'Ex: Cliente Sandra comprou 9 chapas de MDF branco a 259,64 cada, mais 20 dobradiças Häfele a 8,50 cada, fornecedor Leo Madeiras...'}
          className="w-full p-4 rounded-2xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
          autoFocus
        />

        <div className="flex gap-3">
          <button 
            type="button"
            onClick={() => onConfirm(text)}
            disabled={isAnalyzing || !text.trim()}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors text-sm w-full flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isAnalyzing ? 'Lendo com IA...' : 'Gerar Cadastro com IA'}
          </button>
          <button 
            type="button"
            onClick={onClose} 
            className="bg-white/10 border border-white/20 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors text-sm"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Editor de Descrição Isolado (Sem Re-renderizar a Tabela Inteira) ──────────
interface OriginalDescriptionEditorProps {
  initialText: string;
  onUpdateText: (newText: string) => void;
  onReExtract: (text: string) => void;
  isAnalyzing: boolean;
}

const OriginalDescriptionEditor: React.FC<OriginalDescriptionEditorProps> = memo(({
  initialText,
  onUpdateText,
  onReExtract,
  isAnalyzing
}) => {
  const [localText, setLocalText] = useState(initialText);

  useEffect(() => {
    setLocalText(initialText);
  }, [initialText]);

  return (
    <div className="w-full h-full flex flex-col p-2.5 space-y-2">
      <textarea
        value={localText}
        onChange={e => {
          setLocalText(e.target.value);
          onUpdateText(e.target.value);
        }}
        placeholder={'Digite ou cole sua descrição aqui...\n\nExemplo:\nCliente Sandra comprou:\n- 4 chapas MDF 15mm Branco TX a 198,50\n- 10 pares corrediças telescópicas 450mm a 28,00\n- 20 dobradiças 35mm curva a 6,90'}
        className="w-full flex-1 p-3 rounded-xl border border-white/10 bg-[#121212] text-white placeholder-gray-500 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none leading-relaxed font-mono"
      />
      <button
        type="button"
        onClick={() => onReExtract(localText)}
        disabled={isAnalyzing || !localText.trim()}
        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-40 shrink-0"
      >
        {isAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
        <span>{isAnalyzing ? 'Lendo com IA...' : '⚡ Re-extrair Produtos do Texto com IA'}</span>
      </button>
    </div>
  );
});

// ─── Modal Dedicado para Editar Item da Lista de Compras ──────────────────
interface EditMaterialItemModalProps {
  item: MaterialListItem | null;
  onClose: () => void;
  onSave: (updatedItem: MaterialListItem) => void;
  suppliers: Supplier[];
  comparisons: ProductComparison[];
}

const EditMaterialItemModal: React.FC<EditMaterialItemModalProps> = memo(({
  item,
  onClose,
  onSave,
  suppliers,
  comparisons
}) => {
  const [form, setForm] = useState({
    productName: '',
    selectedSupplierName: '',
    selectedBrand: '',
    selectedUnitPrice: '0',
    quantity: 1,
    category: 'MDF/MDP'
  });

  // Obter conjunto de nomes de fornecedores atualmente CADASTRADOS no sistema
  const registeredSupplierNames = useMemo(() => {
    return new Set(suppliers.map(s => s.name.trim().toLowerCase()));
  }, [suppliers]);

  // Encontrar o produto correspondente no comparativo
  const compProd = useMemo(() => {
    if (!item) return null;
    return comparisons.find(c => c.id === item.productId || c.productName.toLowerCase() === item.productName.toLowerCase()) || null;
  }, [item, comparisons]);

  const productQuotes = useMemo(() => {
    if (!compProd?.quotes) return [];
    // FILTRA SOMENTE cotações de fornecedores CADASTRADOS no sistema
    return compProd.quotes.filter(q => 
      q && q.supplierName && registeredSupplierNames.has(q.supplierName.trim().toLowerCase())
    );
  }, [compProd, registeredSupplierNames]);

  useEffect(() => {
    if (item) {
      setForm({
        productName: item.productName || '',
        selectedSupplierName: item.selectedSupplierName || '',
        selectedBrand: item.selectedBrand || 'Geral',
        selectedUnitPrice: item.selectedUnitPrice !== undefined ? String(item.selectedUnitPrice) : '0',
        quantity: item.quantity || 1,
        category: item.category || 'MDF/MDP'
      });
    }
  }, [item]);

  if (!item) return null;

  const handleSupplierChange = (supplierName: string) => {
    // Buscar se este fornecedor tem cotação cadastrada para este produto
    const matchingQuote = productQuotes.find(
      q => q.supplierName.toLowerCase() === supplierName.toLowerCase()
    );

    if (matchingQuote) {
      const price = matchingQuote.unitPrice || matchingQuote.price || 0;
      setForm(prev => ({
        ...prev,
        selectedSupplierName: matchingQuote.supplierName,
        selectedUnitPrice: String(price),
        selectedBrand: matchingQuote.brand || prev.selectedBrand || 'Geral'
      }));
    } else {
      setForm(prev => ({
        ...prev,
        selectedSupplierName: supplierName
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const unitPrice = parseFloat(String(form.selectedUnitPrice).replace(',', '.')) || 0;
    const qty = Math.max(1, Number(form.quantity) || 1);
    const total = qty * unitPrice;

    onSave({
      ...item,
      productName: form.productName.trim() || item.productName,
      selectedSupplierName: form.selectedSupplierName.trim() || item.selectedSupplierName,
      selectedBrand: form.selectedBrand.trim() || 'Geral',
      selectedUnitPrice: unitPrice,
      quantity: qty,
      total: total,
      category: form.category
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-4 text-white max-w-lg w-full animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <h3 className="font-bold text-lg text-amber-400 flex items-center gap-2">
            <Pencil className="w-5 h-5" /> Editar Item da Lista de Compras
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 bg-white/10 text-gray-400 hover:text-white rounded-full flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs text-emerald-400 font-bold block mb-1">Nome do Produto / Material *</label>
            <input
              value={form.productName}
              onFocus={e => e.target.select()}
              onChange={e => setForm({ ...form, productName: e.target.value })}
              className="w-full p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-amber-400 font-bold block mb-1">Fornecedor Cadastrado *</label>
              <select
                value={form.selectedSupplierName}
                onChange={e => handleSupplierChange(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-amber-500/40 bg-[#1a1a1a] text-white text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                required
              >
                <option value="">Selecione o Fornecedor...</option>
                {productQuotes.length > 0 && (
                  <optgroup label="Cotações Cadastradas Neste Produto">
                    {productQuotes.map((q, idx) => (
                      <option key={idx} value={q.supplierName}>
                        🏢 {q.supplierName} — R$ {(q.unitPrice || q.price).toFixed(2)} {q.brand ? `[${q.brand}]` : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                {suppliers.filter(s => !productQuotes.some(q => q.supplierName.toLowerCase() === s.name.toLowerCase())).length > 0 && (
                  <optgroup label="Outros Fornecedores Cadastrados">
                    {suppliers
                      .filter(s => !productQuotes.some(q => q.supplierName.toLowerCase() === s.name.toLowerCase()))
                      .map(s => (
                        <option key={s.id} value={s.name}>
                          🏢 {s.name} ({s.category})
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>

            <div>
              <label className="text-xs text-blue-400 font-bold block mb-1">Marca</label>
              <input
                value={form.selectedBrand}
                onFocus={e => e.target.select()}
                onChange={e => setForm({ ...form, selectedBrand: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-white/10 bg-[#1a1a1a] text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 font-bold block mb-1">Quantidade *</label>
              <input
                type="number"
                min="1"
                value={form.quantity === '' ? '' : form.quantity}
                onFocus={e => e.target.select()}
                onChange={e => {
                  const v = e.target.value;
                  setForm({ ...form, quantity: v === '' ? ('' as any) : parseInt(v) });
                }}
                className="w-full p-2.5 rounded-xl border border-white/10 bg-[#1a1a1a] text-white text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none text-center"
                required
              />
            </div>

            <div>
              <label className="text-xs text-emerald-400 font-bold block mb-1">Valor Unitário (R$) *</label>
              <input
                type="text"
                value={form.selectedUnitPrice}
                onFocus={e => e.target.select()}
                onChange={e => setForm({ ...form, selectedUnitPrice: e.target.value })}
                className="w-full p-2.5 rounded-xl border border-emerald-500/40 bg-[#1a1a1a] text-white text-sm font-bold text-emerald-400 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* Subtotal preview */}
          <div className="bg-[#181818] p-3 rounded-xl border border-white/10 flex justify-between items-center text-xs">
            <span className="text-gray-400">Subtotal Calculado:</span>
            <span className="text-base font-black text-emerald-400">
              R$ {(
                (parseFloat(String(form.selectedUnitPrice).replace(',', '.')) || 0) * 
                (Math.max(1, Number(form.quantity) || 1))
              ).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-xl font-bold transition-colors text-sm w-full shadow-lg"
            >
              💾 Salvar Alterações
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-white/10 border border-white/20 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});

const SuppliersPage: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>('comparison');
  
  // Custom Main Tabs
  const [customMainTabs, setCustomMainTabs] = useState<{id: string, name: string}[]>(() => {
    try {
      const saved = localStorage.getItem('sd_custom_main_tabs');
      const tabs = saved ? JSON.parse(saved) : [];
      const filtered = tabs.filter((t: any) => t.name.toUpperCase() !== 'SUPERIOR');
      if (filtered.length !== tabs.length) {
        localStorage.setItem('sd_custom_main_tabs', JSON.stringify(filtered));
      }
      return filtered;
    } catch { return []; }
  });
  
  // Suppliers state
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', cnpj: '', phone: '', email: '', address: '', category: 'Geral', notes: '' });
  const [quickAddSupplierName, setQuickAddSupplierName] = useState('');
  const [showQuickAddSupplier, setShowQuickAddSupplier] = useState(false);

  // Comparisons state
  const [comparisons, setComparisons] = useState<ProductComparison[]>(() => {
    try {
      const saved = localStorage.getItem('sd_supplier_comparisons_v3');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [compSearch, setCompSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [supplierProdSearch, setSupplierProdSearch] = useState('');
  
  // Detail Modal State
  const [selectedProdDetail, setSelectedProdDetail] = useState<ProductComparison | null>(null);
  // Inline Quick Quote State (item.id + '_' + supplier.id)
  const [inlineQuoteKey, setInlineQuoteKey] = useState<string | null>(null);

  // Photo & AI Extraction State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);

  // Text-Description AI Import State (free-text registration, like the Newbox app)
  const [showTextImportModal, setShowTextImportModal] = useState(false);
  const [textImportInput, setTextImportInput] = useState('');
  const [analyzingText, setAnalyzingText] = useState(false);

  // Batch PDF / Image / Text Confirmation Modal State
  const [batchImportModal, setBatchImportModal] = useState<{
    isOpen: boolean;
    clientName: string;
    supplierName: string;
    fileUrl: string;
    isPdf: boolean;
    sourceType: 'file' | 'text';
    sourceText?: string;
    items: BatchImportItem[];
    addToMaterialList: boolean;
  } | null>(null);

  // New Product Modal State
  const [showProdForm, setShowProdForm] = useState(false);
  const [prodForm, setProdForm] = useState({
    supplierName: '',
    supplierId: '',
    productName: '',
    brand: '',
    pricePerM2: '',
    unitPrice: '',
    category: 'MDF/MDP',
    description: '',
    specifications: '',
    photoUrl: ''
  });

  // New Quote Modal State
  const [quoteModalProdId, setQuoteModalProdId] = useState<string | null>(null);
  const [quoteForm, setQuoteForm] = useState({
    supplierId: '',
    supplierName: '',
    productName: '',
    brand: '',
    pricePerM2: '',
    unitPrice: '',
    specifications: '',
    photoUrl: ''
  });

  // Client Folders State (Pastas de Clientes)
  const [clientFolders, setClientFolders] = useState<ClientFolder[]>(() => {
    const saved = localStorage.getItem('sd_client_folders_v1');
    return saved ? JSON.parse(saved) : [
      { id: 'f_samuel', name: 'SAMUEL', createdAt: new Date().toISOString(), status: 'Pronto para Comprar', notes: 'Lista criada via descrição' }
    ];
  });
  const [selectedClientFolderId, setSelectedClientFolderId] = useState<string>(() => {
    return localStorage.getItem('sd_selected_folder_id') || 'all';
  });

  useEffect(() => {
    localStorage.setItem('sd_selected_folder_id', selectedClientFolderId);
  }, [selectedClientFolderId]);

  const [showClientFolderModal, setShowClientFolderModal] = useState(false);
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);
  const [editingClientFolder, setEditingClientFolder] = useState<ClientFolder | null>(null);
  const [clientFolderForm, setClientFolderForm] = useState({ name: '', phone: '', notes: '', status: 'Pronto para Comprar' as const });
  const [clientFolderSearch, setClientFolderSearch] = useState('');
  const [clientFolderStatusFilter, setClientFolderStatusFilter] = useState<'Todos' | 'Pronto para Comprar' | 'Em Cotação' | 'Comprado'>('Todos');
  const [folderViewMode, setFolderViewMode] = useState<'grid' | 'table'>('grid');
  
  // Modal de Exportação e Envio (Com ou Sem Valores para PDF e WhatsApp)
  const [exportModal, setExportModal] = useState<{
    isOpen: boolean;
    targetSupplierName?: string;
  } | null>(null);

  // Modal de Reajuste de Preços em Porcentagem (%)
  const [showPriceAdjustmentModal, setShowPriceAdjustmentModal] = useState(false);
  const [priceAdjForm, setPriceAdjForm] = useState({
    targetSupplierName: 'all',
    filterType: 'all',
    operation: 'increase' as 'increase' | 'decrease',
    percentage: 5,
  });

  useEffect(() => {
    localStorage.setItem('sd_client_folders_v1', JSON.stringify(clientFolders));
  }, [clientFolders]);

  // Material List State (Tab 3)
  const [materialList, setMaterialList] = useState<MaterialListItem[]>(() => {
    const saved = localStorage.getItem('sd_material_list_v1');
    return saved ? JSON.parse(saved) : [];
  });

  const [showAddMatForm, setShowAddMatForm] = useState(false);
  const [addMatMode, setAddMatMode] = useState<'select' | 'new'>('select');
  const [editingMatId, setEditingMatId] = useState<string | null>(null);
  const [editingMatItem, setEditingMatItem] = useState<MaterialListItem | null>(null);

  const [matForm, setMatForm] = useState({
    productId: '',
    supplierName: '',
    brand: '',
    unitPrice: 0,
    quantity: 1,
    isCheapest: true,
    clientFolderId: '',
    customClientName: ''
  });

  const [newMatForm, setNewMatForm] = useState({
    supplierName: '',
    supplierId: '',
    productName: '',
    brand: '',
    pricePerM2: '',
    unitPrice: '',
    quantity: 1,
    category: 'MDF/MDP',
    photoUrl: '',
    specifications: '',
    clientFolderId: '',
    customClientName: ''
  });

  const [isCloudSyncing, setIsCloudSyncing] = useState(false);

  // ─── SINCRONIZAÇÃO EM TEMPO REAL ENTRE CELULAR E COMPUTADOR ─────────────
  useEffect(() => {
    // 1. Inicializa o canal Realtime do Supabase
    const cleanup = initCloudSync((cloudData) => {
      if (cloudData.comparisons && Array.isArray(cloudData.comparisons)) {
        setComparisons(cloudData.comparisons);
      }
      if (cloudData.clientFolders && Array.isArray(cloudData.clientFolders)) {
        setClientFolders(cloudData.clientFolders);
      }
      if (cloudData.materialList && Array.isArray(cloudData.materialList)) {
        setMaterialList(cloudData.materialList);
      }
      if (cloudData.suppliers && Array.isArray(cloudData.suppliers) && cloudData.suppliers.length > 0) {
        setSuppliers(cloudData.suppliers);
      }
    });

    // 2. Ao focar na janela ou voltar para a aba no Computador/Celular, busca os dados atualizados
    const handleRefreshOnFocus = async () => {
      setIsCloudSyncing(true);
      await fetchCloudState();
      setIsCloudSyncing(false);
    };

    window.addEventListener('focus', handleRefreshOnFocus);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) handleRefreshOnFocus();
    });

    // 3. Busca inicial ao carregar a página
    fetchCloudState().finally(() => setLoading(false));

    return () => {
      cleanup();
      window.removeEventListener('focus', handleRefreshOnFocus);
    };
  }, []);

  // Transmite e salva na Nuvem qualquer alteração em Comparações
  useEffect(() => {
    pushCloudState({ comparisons });
  }, [comparisons]);

  // Transmite e salva na Nuvem qualquer alteração em Pastas de Clientes
  useEffect(() => {
    pushCloudState({ clientFolders });
  }, [clientFolders]);

  // Transmite e salva na Nuvem qualquer alteração na Lista de Materiais
  useEffect(() => {
    pushCloudState({ materialList });
  }, [materialList]);

  // Transmite e salva na Nuvem qualquer alteração em Fornecedores
  useEffect(() => {
    if (suppliers.length > 0) {
      pushCloudState({ suppliers });
    }
  }, [suppliers]);

  const fetchSuppliers = async () => {
    setLoading(true);
    const { data } = await db.from('suppliers').select('*').eq('active', true).order('name');
    if (data && data.length > 0) {
      setSuppliers(data);
    }
    setLoading(false);
  };

  useEffect(() => { fetchSuppliers(); }, []);

  // Garante que a RIO BRANCO tenha exatamente suas cotações nos produtos do comparativo (estilo idêntico à imagem)
  useEffect(() => {
    setComparisons(prev => {
      let changed = false;
      const rioPrices: Record<string, number> = {
        'MDF 06 ITAPUA': 340.00,
        'MDF 15 ITAPUA': 489.00,
        'MDF BRANCO TX 15': 298.86,
      };

      const updated = prev.map(comp => {
        const pName = comp.productName.trim().toUpperCase();
        const price = rioPrices[pName];
        if (price) {
          const hasRio = comp.quotes.some(q => q.supplierName.trim().toUpperCase() === 'RIO BRANCO' && (q.unitPrice || q.price || 0) > 0);
          if (!hasRio) {
            changed = true;
            const newQuote: PriceQuote = {
              supplierId: 'rio_branco',
              supplierName: 'RIO BRANCO',
              brand: pName.includes('BRANCO') ? 'Duratex' : 'Guararapes',
              pricePerM2: null,
              unitPrice: price,
              price: price,
              updatedAt: new Date().toISOString(),
              specifications: 'Chapa padrão'
            };
            return {
              ...comp,
              quotes: [...comp.quotes, newQuote]
            };
          }
        }
        return comp;
      });

      if (changed) {
        localStorage.setItem('sd_supplier_comparisons_v3', JSON.stringify(updated));
        return updated;
      }
      return prev;
    });
  }, []);

  // Excluir todos os produtos do sistema
  const handleClearAllProducts = () => {
    if (window.confirm('⚠️ Tem certeza que deseja excluir TODOS os produtos e cotações cadastrados no sistema? Esta ação limpará o comparativo por completo.')) {
      setComparisons([]);
      localStorage.setItem('sd_supplier_comparisons_v3', JSON.stringify([]));
      toast({ title: '🗑️ Todos os produtos foram excluídos com sucesso!' });
    }
  };

  // Excluir todas as cotações de um fornecedor específico
  const handleClearSupplierProducts = (supplierName: string) => {
    if (window.confirm(`⚠️ Deseja excluir todas as cotações do fornecedor "${supplierName}"?`)) {
      setComparisons(prev => {
        const updated = prev.map(c => ({
          ...c,
          quotes: c.quotes.filter(q => q.supplierName.toLowerCase() !== supplierName.toLowerCase())
        })).filter(c => c.quotes.length > 0);
        localStorage.setItem('sd_supplier_comparisons_v3', JSON.stringify(updated));
        return updated;
      });
      toast({ title: `🗑️ Todas as cotações de ${supplierName} foram excluídas!` });
    }
  };

  


  // ─── PDF Render & Text Extraction Helper ────────────────────────────────────
  const convertFileToImageAndText = async (file: File): Promise<{ base64Image: string; text: string }> => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    
    if (isPdf) {
      try {
        if (!window.pdfjsLib) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
              if (window.pdfjsLib) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                resolve(true);
              } else {
                reject(new Error('pdfjsLib não disponível'));
              }
            };
            script.onerror = () => reject(new Error('Erro ao baixar PDF.js CDN'));
            document.head.appendChild(script);
          });
        }

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        for (let p = 1; p <= Math.min(pdf.numPages, 5); p++) {
          try {
            const pageObj = await pdf.getPage(p);
            const textContent = await pageObj.getTextContent();
            const pageStrings = textContent.items.map((it: any) => it.str).filter(Boolean);
            fullText += `\n--- PÁGINA ${p} ---\n` + pageStrings.join(' ');
          } catch (e) {
            console.warn(`Erro ao extrair texto da página ${p}:`, e);
          }
        }

        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        return { base64Image: imgData, text: fullText.trim() };
      } catch (pdfErr) {
        console.error("Erro ao renderizar PDF com PDF.js:", pdfErr);
        throw new Error('Não foi possível ler o PDF. Por favor, tire uma foto do documento com a câmera.');
      }
    } else {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      return { base64Image: base64, text: '' };
    }
  };

  const convertFileToImageBase64 = async (file: File): Promise<string> => {
    const res = await convertFileToImageAndText(file);
    return res.base64Image;
  };

  // ─── Single Photo Capture (AI extraction) ──────────────────────────────
  const handleCapturePhoto = async (e: React.ChangeEvent<HTMLInputElement>, targetForm: 'prod' | 'quote' | 'newMat') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAnalyzingImage(true);
    toast({ title: '📸 Lendo arquivo com IA...', description: 'Extraindo dados do produto, marca, especificações e valor!' });

    try {
      const { base64Image, text } = await convertFileToImageAndText(file);

      const prompt = `Analise este documento/foto de um produto/material de marcenaria.
Extraia e retorne EXATAMENTE um JSON válido neste formato:
{
  "productName": "Nome do produto",
  "brand": "Marca ou fabricante se houver",
  "unitPrice": "Preço em numero com ponto ou vazio",
  "pricePerM2": "Preço por m2 se houver ou vazio",
  "specifications": "Resumo detalhado das características"
}`;

      let aiResponse = "";
      if (text && text.length > 30) {
        try {
          aiResponse = await analyzeTextWithGroq(text, prompt);
        } catch (tErr) {
          console.warn("Falha ao analisar texto do PDF, tentando visão:", tErr);
        }
      }
      if (!aiResponse) {
        aiResponse = await analyzeImageWithGemini(base64Image, prompt);
      }

      let extractedData: any = {};
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) extractedData = JSON.parse(jsonMatch[0]);
      } catch (err) {
        console.warn("Parse error:", aiResponse);
      }

      if (targetForm === 'prod') {
        setProdForm(prev => ({
          ...prev,
          productName: extractedData.productName || prev.productName,
          brand: extractedData.brand || prev.brand,
          unitPrice: extractedData.unitPrice ? String(extractedData.unitPrice) : prev.unitPrice,
          pricePerM2: extractedData.pricePerM2 ? String(extractedData.pricePerM2) : prev.pricePerM2,
          specifications: extractedData.specifications || prev.specifications || aiResponse.slice(0, 150),
          photoUrl: base64Image
        }));
      } else if (targetForm === 'quote') {
        setQuoteForm(prev => ({
          ...prev,
          brand: extractedData.brand || prev.brand,
          unitPrice: extractedData.unitPrice ? String(extractedData.unitPrice) : prev.unitPrice,
          pricePerM2: extractedData.pricePerM2 ? String(extractedData.pricePerM2) : prev.pricePerM2,
          specifications: extractedData.specifications || prev.specifications || aiResponse.slice(0, 150),
          photoUrl: base64Image
        }));
      } else if (targetForm === 'newMat') {
        setNewMatForm(prev => ({
          ...prev,
          productName: extractedData.productName || prev.productName,
          brand: extractedData.brand || prev.brand,
          unitPrice: extractedData.unitPrice ? String(extractedData.unitPrice) : prev.unitPrice,
          pricePerM2: extractedData.pricePerM2 ? String(extractedData.pricePerM2) : prev.pricePerM2,
          specifications: extractedData.specifications || prev.specifications || aiResponse.slice(0, 150),
          photoUrl: base64Image
        }));
      }

      toast({ title: '✨ Dados extraídos com sucesso!', description: 'Os campos foram preenchidos automaticamente.' });
    } catch (err) {
      console.error("Erro na leitura:", err);
      toast({ title: '📸 Foto anexada com sucesso!' });
    } finally {
      setAnalyzingImage(false);
    }
  };

  // ─── Batch PDF & Photo Budget Scan Processing ────────────────────────────
  const handleImportBatchFromBudgetPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const objectUrl = URL.createObjectURL(file);

    setAnalyzingImage(true);
    toast({ 
      title: isPdf ? '📄 Lendo Arquivo PDF com IA...' : '📸 Lendo Foto de Orçamento com IA...', 
      description: 'Identificando cliente, produtos, quantidades e valores unitários...' 
    });

    try {
      const { base64Image, text } = await convertFileToImageAndText(file);

      const prompt = `Analise esta foto ou arquivo PDF de uma folha de orçamento, pedido de compra ou lista de materiais de marcenaria.
Localize o Nome do Cliente (ex: "SANDRA", "SANDRA - COZINHA") ou Fornecedor no topo do documento.
Extraia SOMENTE a lista de produtos/materiais, suas quantidades e seus valores unitários.

Retorne EXATAMENTE um JSON válido com esta estrutura:
{
  "clientName": "Nome do cliente encontrado na nota ex: SANDRA",
  "supplierName": "Nome do fornecedor ou 'Orçamento Importado'",
  "items": [
    {
      "productName": "Nome exato do produto ex: MDF 15 2F BRANCO TX",
      "category": "MDF/MDP ou Ferragens ou Acessórios ou Outros",
      "brand": "Marca se constar ou Geral",
      "unitPrice": 259.64,
      "quantity": 9
    }
  ]
}`;

      let aiResponse = "";
      if (text && text.length > 30) {
        try {
          aiResponse = await analyzeTextWithGroq(text, prompt);
        } catch (tErr) {
          console.warn("Falha ao analisar texto do PDF com Groq, tentando visão:", tErr);
        }
      }
      if (!aiResponse) {
        aiResponse = await analyzeImageWithGemini(base64Image, prompt);
      }
      let parsedData: any = {};
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsedData = JSON.parse(jsonMatch[0]);
      } catch (err) {
        console.warn("Parse error em lote:", aiResponse);
      }

      const extractedItems: BatchImportItem[] = [];
      if (parsedData && Array.isArray(parsedData.items)) {
        parsedData.items.forEach((it: any) => {
          if (!it.productName) return;
          const uVal = typeof it.unitPrice === 'number' 
            ? it.unitPrice 
            : parseFloat(String(it.unitPrice).replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
          
          extractedItems.push({
            productName: String(it.productName).trim(),
            category: it.category || 'MDF/MDP',
            brand: it.brand || 'Geral',
            unitPrice: uVal,
            quantity: Math.max(1, parseInt(String(it.quantity)) || 1)
          });
        });
      }

      if (extractedItems.length > 0) {
        // Opens Modal for Side-by-Side PDF/Photo preview & validation!
        setBatchImportModal({
          isOpen: true,
          clientName: parsedData.clientName || 'Cliente Importado',
          supplierName: parsedData.supplierName || 'Orçamento Importado',
          fileUrl: objectUrl,
          isPdf: isPdf,
          sourceType: 'file',
          items: extractedItems,
          addToMaterialList: true
        });

        toast({ 
          title: `📄 ${extractedItems.length} Produtos lidos no documento!`, 
          description: 'Visualize o PDF ao lado e confirme para criar a Lista de Compras!' 
        });
      } else {
        toast({ title: '⚠️ Não foi possível extrair a lista de produtos do documento', variant: 'destructive' });
      }

    } catch (err: any) {
      console.error("Erro no processamento do documento:", err);
      const msg = err?.message || 'Erro desconhecido';
      toast({ 
        title: '❌ Erro ao processar documento', 
        description: msg.includes('PDF') 
          ? 'Não foi possível renderizar o PDF. Tente tirar uma foto da folha impressa com a câmera do celular.' 
          : `Falha na leitura com IA: ${msg.slice(0, 120)}`,
        variant: 'destructive' 
      });
    } finally {
      setAnalyzingImage(false);
    }
  };

  // ─── Free-Text AI Registration (describe the purchase, AI fills everything) ──
  const handleImportFromTextDescription = async (overrideText?: string) => {
    const text = (typeof overrideText === 'string' ? overrideText : textImportInput).trim();
    if (!text || text.length < 3) {
      toast({ title: '⚠️ Descreva o que deseja cadastrar', description: 'Ex: Cliente Sandra comprou 9 chapas de MDF branco a 259,64 cada...', variant: 'destructive' });
      return;
    }

    setAnalyzingText(true);
    toast({ title: '🤖 Lendo sua descrição com IA...', description: 'Montando o cadastro de cliente, produtos e valores...' });

    try {
      const prompt = `Analise esta descrição em texto livre, escrita por um marceneiro, sobre uma compra ou orçamento de materiais.
Localize o Nome do Cliente (se houver) e o Nome do Fornecedor (se houver).
Extraia a lista de produtos/materiais citados, com quantidade e valor unitário de cada um.

Retorne EXATAMENTE um JSON válido com esta estrutura:
{
  "clientName": "Nome do cliente citado ou 'Cliente Importado'",
  "supplierName": "Nome do fornecedor citado ou 'Cadastro por Texto (IA)'",
  "items": [
    {
      "productName": "Nome do produto ex: Chapa MDF Branco",
      "category": "MDF/MDP ou Ferragens ou Vidros ou Pedras ou Tintas ou Acessórios ou Outros",
      "brand": "Marca se citada ou Geral",
      "unitPrice": 259.64,
      "quantity": 9
    }
  ]
}`;

      const aiResponse = await analyzeTextWithGroq(text, prompt);

      let parsedData: any = {};
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsedData = JSON.parse(jsonMatch[0]);
      } catch (err) {
        console.warn("Parse error na descrição de texto:", aiResponse);
      }

      const extractedItems: BatchImportItem[] = [];
      if (parsedData && Array.isArray(parsedData.items)) {
        parsedData.items.forEach((it: any) => {
          if (!it.productName) return;
          const uVal = typeof it.unitPrice === 'number'
            ? it.unitPrice
            : parseFloat(String(it.unitPrice).replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;

          extractedItems.push({
            productName: String(it.productName).trim(),
            category: it.category || 'MDF/MDP',
            brand: it.brand || 'Geral',
            unitPrice: uVal,
            quantity: Math.max(1, parseInt(String(it.quantity)) || 1)
          });
        });
      }

      if (extractedItems.length > 0) {
        setBatchImportModal(prev => ({
          isOpen: true,
          clientName: (prev?.clientName && prev.clientName !== 'Cliente Importado') ? prev.clientName : (parsedData.clientName || 'Cliente Importado'),
          supplierName: (prev?.supplierName && prev.supplierName !== 'Cadastro por Texto (IA)') ? prev.supplierName : (parsedData.supplierName || 'Cadastro por Texto (IA)'),
          fileUrl: prev?.fileUrl || '',
          isPdf: prev?.isPdf || false,
          sourceType: 'text',
          sourceText: text,
          items: extractedItems,
          addToMaterialList: prev?.addToMaterialList ?? true
        }));
        setShowTextImportModal(false);
        setTextImportInput('');

        toast({
          title: `✨ ${extractedItems.length} Produtos identificados na sua descrição!`,
          description: 'Confira e confirme para criar a Lista de Compras!'
        });
      } else {
        toast({ title: '⚠️ Não consegui identificar produtos na sua descrição', description: 'Tente detalhar nome, quantidade e valor de cada item.', variant: 'destructive' });
      }
    } catch (err: any) {
      console.error("Erro ao processar descrição por texto:", err);
      toast({ title: '❌ Erro ao processar sua descrição', description: (err?.message || 'Erro desconhecido').slice(0, 120), variant: 'destructive' });
    } finally {
      setAnalyzingText(false);
    }
  };

  // Save Modal Batch Confirmation (Creates Material List AND Comparativo Quotes!)
  const handleConfirmBatchImport = () => {
    if (!batchImportModal || batchImportModal.items.length === 0) return;

    const suppName = batchImportModal.supplierName.trim() || 'Orçamento Importado';
    const cName = batchImportModal.clientName.trim() || 'Cliente Importado';

    // Cria ou atualiza a pasta do cliente automaticamente
    let targetFolder = clientFolders.find(f => f.name.toLowerCase() === cName.toLowerCase());
    if (!targetFolder) {
      targetFolder = {
        id: 'f_' + Date.now().toString(),
        name: cName,
        createdAt: new Date().toISOString(),
        status: 'Pronto para Comprar',
        notes: batchImportModal.sourceText || ''
      };
      setClientFolders(prev => [targetFolder!, ...prev]);
    }

    let newComparisons = [...comparisons];
    let newMaterialItems: MaterialListItem[] = [];

    batchImportModal.items.forEach(it => {
      // Find existing product in comparisons by name
      const existingIndex = newComparisons.findIndex(c => 
        c.productName.toLowerCase().trim() === it.productName.toLowerCase().trim()
      );

      const quote: PriceQuote = {
        supplierId: Date.now().toString() + Math.random().toString().slice(2, 6),
        supplierName: suppName,
        brand: it.brand || 'Geral',
        pricePerM2: null,
        unitPrice: it.unitPrice,
        price: it.unitPrice,
        updatedAt: new Date().toISOString().split('T')[0],
        specifications: `Importado via PDF/Orçamento de ${cName}. Qtd: ${it.quantity}`
      };

      let prodId = '';

      if (existingIndex >= 0) {
        prodId = newComparisons[existingIndex].id;
        const existingQuotes = newComparisons[existingIndex].quotes.filter(q => q.supplierName.toLowerCase() !== suppName.toLowerCase());
        newComparisons[existingIndex] = {
          ...newComparisons[existingIndex],
          quotes: [...existingQuotes, quote]
        };
      } else {
        prodId = Date.now().toString() + Math.random().toString().slice(2, 6);
        newComparisons.unshift({
          id: prodId,
          productName: it.productName,
          category: it.category || 'MDF/MDP',
          unit: 'Un',
          quotes: [quote]
        });
      }

      // Add to Material Purchase List with Cheapest Quote Selection
      if (batchImportModal.addToMaterialList) {
        const allQuotes = existingIndex >= 0 ? newComparisons[existingIndex].quotes : [quote];
        const cheapestQuote = allQuotes.reduce((prev, curr) => 
          (curr.unitPrice || curr.price) < (prev.unitPrice || prev.price) ? curr : prev
        );

        newMaterialItems.push({
          id: Date.now().toString() + Math.random().toString().slice(2, 6),
          productId: prodId,
          productName: it.productName,
          category: it.category || 'MDF/MDP',
          selectedSupplierName: cheapestQuote.supplierName,
          selectedBrand: cheapestQuote.brand || 'Geral',
          selectedUnitPrice: cheapestQuote.unitPrice || cheapestQuote.price,
          quantity: it.quantity,
          total: it.quantity * (cheapestQuote.unitPrice || cheapestQuote.price),
          isCheapestSelected: true,
          clientName: cName,
          clientFolderId: targetFolder!.id
        });
      }
    });

    setComparisons(newComparisons);
    if (newMaterialItems.length > 0) {
      setMaterialList([...newMaterialItems, ...materialList]);
    }

    setBatchImportModal(null);
    setSelectedClientFolderId(targetFolder.id); // Abre direto na pasta do cliente criado!
    setActiveTab('material_list');

    toast({ 
      title: `📁 Pasta do Cliente "${cName}" criada com sucesso!`, 
      description: `${batchImportModal.items.length} produtos foram adicionados à pasta do cliente e comparados!` 
    });
  };

  const handleSaveSupplier = async () => {
    const sName = form.name.trim();
    if (!sName) { toast({ title: '⚠️ Nome do fornecedor obrigatório', variant: 'destructive' }); return; }

    if (editingId) {
      await db.from('suppliers').update(form).eq('id', editingId);
      toast({ title: '✅ Fornecedor atualizado' });
    } else {
      await db.from('suppliers').insert(form);
      toast({ title: `✅ Fornecedor "${sName}" cadastrado com catálogo 100% limpo!` });
    }
    setForm({ name: '', cnpj: '', phone: '', email: '', address: '', category: 'Geral', notes: '' });
    setShowForm(false);
    setEditingId(null);
    fetchSuppliers();
  };

  const handleQuickAddSupplier = async () => {
    const name = quickAddSupplierName.trim();
    if (!name) { toast({ title: '⚠️ Digite o nome do fornecedor', variant: 'destructive' }); return; }
    await db.from('suppliers').insert({ name, cnpj: null, phone: null, email: null, address: null, category: 'Geral', notes: null, active: true });
    toast({ title: `✅ Fornecedor "${name}" cadastrado com catálogo 100% limpo!` });
    setQuickAddSupplierName('');
    setShowQuickAddSupplier(false);
    fetchSuppliers();
  };

  const handleEditSupplier = (s: Supplier) => {
    setForm({ name: s.name, cnpj: s.cnpj || '', phone: s.phone || '', email: s.email || '', address: s.address || '', category: s.category, notes: s.notes || '' });
    setEditingId(s.id);
    setShowForm(true);
  };

  const handleDeleteSupplier = async (id: string) => {
    const sToDelete = suppliers.find(s => s.id === id);
    if (!sToDelete) return;

    if (confirm(`Deseja realmente excluir o fornecedor "${sToDelete.name}"?`)) {
      if (activeTab === `supplier_${id}`) setActiveTab('suppliers_overview');
      await db.from('suppliers').update({ active: false }).eq('id', id);

      // Limpar cotações vinculadas a este fornecedor para manter tudo limpo
      setComparisons(prev => {
        const updated = prev.map(p => ({
          ...p,
          quotes: p.quotes.filter(q => q.supplierId !== id && q.supplierName.toLowerCase() !== sToDelete.name.toLowerCase())
        }));
        localStorage.setItem('sd_supplier_comparisons_v3', JSON.stringify(updated));
        return updated;
      });

      toast({ title: `🗑️ Fornecedor "${sToDelete.name}" removido com sucesso!` });
      fetchSuppliers();
    }
  };

  // Product + First Quote Handler
  const handleAddProductWithQuote = () => {
    if (!prodForm.productName.trim()) {
      toast({ title: '⚠️ Informe o nome do produto', variant: 'destructive' });
      return;
    }

    const unitPriceNum = parseFloat(prodForm.unitPrice.replace(',', '.'));
    if (isNaN(unitPriceNum) || unitPriceNum <= 0) {
      toast({ title: '⚠️ Informe um valor unitário válido', variant: 'destructive' });
      return;
    }

    let isAll = prodForm.supplierId === 'ALL_SUPPLIERS' || prodForm.supplierName.toUpperCase().includes('TODOS');
    let sName = prodForm.supplierName.trim();
    if (!isAll && prodForm.supplierId) {
      const found = suppliers.find(s => s.id === prodForm.supplierId);
      if (found) sName = found.name;
    }
    if (!sName && !isAll) {
      toast({ title: '⚠️ Informe o nome do fornecedor', variant: 'destructive' });
      return;
    }

    const m2Num = prodForm.pricePerM2 ? parseFloat(prodForm.pricePerM2.replace(',', '.')) : null;

    let targetSuppliers: { id: string; name: string }[] = [];
    if (isAll) {
      let all = [...suppliers];
      const defaultNames = ['ITAIPU', 'REVESTI', 'GEOVANE', 'RIO BRANCO'];
      defaultNames.forEach(dName => {
        if (!all.some(s => s.name.toUpperCase().includes(dName))) {
          all.push({
            id: dName.toLowerCase(),
            name: dName,
            cnpj: null,
            phone: null,
            email: null,
            address: null,
            category: 'Geral',
            notes: null,
            active: true
          });
        }
      });
      targetSuppliers = all.map(s => ({ id: s.id, name: s.name }));
    } else {
      targetSuppliers = [{ id: prodForm.supplierId || Date.now().toString(), name: sName }];
    }

    const quotesList: PriceQuote[] = targetSuppliers.map(s => ({
      supplierId: s.id,
      supplierName: s.name,
      brand: prodForm.brand.trim() || 'Geral',
      pricePerM2: isNaN(m2Num as number) ? null : m2Num,
      unitPrice: unitPriceNum,
      price: unitPriceNum,
      updatedAt: new Date().toISOString().split('T')[0],
      photoUrl: prodForm.photoUrl || null,
      specifications: prodForm.specifications || null
    }));

    const newProd: ProductComparison = {
      id: Date.now().toString(),
      productName: prodForm.productName.trim(),
      category: prodForm.category,
      unit: 'Un',
      description: prodForm.description || undefined,
      quotes: quotesList
    };

    setComparisons(prev => {
      const updated = [newProd, ...prev];
      localStorage.setItem('sd_supplier_comparisons_v3', JSON.stringify(updated));
      return updated;
    });
    setProdForm({ supplierName: '', supplierId: '', productName: '', brand: '', pricePerM2: '', unitPrice: '', category: 'MDF/MDP', description: '', specifications: '', photoUrl: '' });
    setShowProdForm(false);
    toast({ title: isAll ? '✅ Produto cadastrado em TODOS os fornecedores!' : `✅ Produto salvo para ${sName}!` });
  };

  const handleDeleteProduct = (id: string) => {
    setComparisons(prev => {
      const updated = prev.filter(c => c.id !== id);
      localStorage.setItem('sd_supplier_comparisons_v3', JSON.stringify(updated));
      return updated;
    });
    toast({ title: '🗑️ Produto removido do comparativo' });
  };

  // Quote Only Handler
  const handleAddQuote = () => {
    if (!quoteModalProdId) return;
    const unitPriceNum = parseFloat(quoteForm.unitPrice.replace(',', '.'));
    if (isNaN(unitPriceNum) || unitPriceNum <= 0) {
      toast({ title: '⚠️ Informe um valor unitário válido', variant: 'destructive' });
      return;
    }

    let isAll = quoteForm.supplierId === 'ALL_SUPPLIERS' || quoteForm.supplierName.toUpperCase().includes('TODOS');
    let sName = quoteForm.supplierName.trim();
    if (!isAll && quoteForm.supplierId) {
      const found = suppliers.find(s => s.id === quoteForm.supplierId);
      if (found) sName = found.name;
    }
    if (!sName && !isAll) {
      toast({ title: '⚠️ Informe o fornecedor', variant: 'destructive' });
      return;
    }

    const m2Num = quoteForm.pricePerM2 ? parseFloat(quoteForm.pricePerM2.replace(',', '.')) : null;

    setComparisons(prev => {
      const updated = prev.map(p => {
        if (p.id !== quoteModalProdId) return p;
        let newQuotes = [...p.quotes];
        if (isAll) {
          let all = [...suppliers];
          const defaultNames = ['ITAIPU', 'REVESTI', 'GEOVANE', 'RIO BRANCO'];
          defaultNames.forEach(dName => {
            if (!all.some(s => s.name.toUpperCase().includes(dName))) {
              all.push({ id: dName.toLowerCase(), name: dName, cnpj: null, phone: null, email: null, address: null, category: 'Geral', notes: null, active: true });
            }
          });
          all.forEach(target => {
            newQuotes = newQuotes.filter(q => q.supplierName.toLowerCase() !== target.name.toLowerCase());
            newQuotes.push({
              supplierId: target.id,
              supplierName: target.name,
              brand: quoteForm.brand.trim() || 'Geral',
              pricePerM2: isNaN(m2Num as number) ? null : m2Num,
              unitPrice: unitPriceNum,
              price: unitPriceNum,
              updatedAt: new Date().toISOString().split('T')[0],
              photoUrl: quoteForm.photoUrl || null,
              specifications: quoteForm.specifications || null
            });
          });
        } else {
          newQuotes = newQuotes.filter(q => q.supplierName.toLowerCase() !== sName.toLowerCase());
          newQuotes.push({
            supplierId: quoteForm.supplierId || Date.now().toString(),
            supplierName: sName,
            brand: quoteForm.brand.trim() || 'Geral',
            pricePerM2: isNaN(m2Num as number) ? null : m2Num,
            unitPrice: unitPriceNum,
            price: unitPriceNum,
            updatedAt: new Date().toISOString().split('T')[0],
            photoUrl: quoteForm.photoUrl || null,
            specifications: quoteForm.specifications || null
          });
        }
        return { ...p, productName: quoteForm.productName.trim() || p.productName, quotes: newQuotes };
      });
      localStorage.setItem('sd_supplier_comparisons_v3', JSON.stringify(updated));
      return updated;
    });

    setQuoteModalProdId(null);
    setQuoteForm({ supplierId: '', supplierName: '', productName: '', brand: '', pricePerM2: '', unitPrice: '', specifications: '', photoUrl: '' });
    toast({ title: isAll ? '💰 Cotação salva em TODOS os fornecedores!' : `💰 Cotação salva para ${sName}!` });
  };

  const handleDeleteQuote = (prodId: string, supplierNameOrId: string) => {
    const cleanTarget = (supplierNameOrId || '').trim().toLowerCase();
    setComparisons(prev => {
      const updated = prev.map(p => {
        if (p.id !== prodId) return p;
        const filteredQuotes = (p.quotes || []).filter(q => {
          const qName = (q.supplierName || '').trim().toLowerCase();
          const qId = (q.supplierId || '').trim().toLowerCase();
          const matches = qName === cleanTarget || qId === cleanTarget || (cleanTarget && qName.includes(cleanTarget)) || (cleanTarget && cleanTarget.includes(qName));
          return !matches;
        });
        return { ...p, quotes: filteredQuotes };
      }).filter(p => {
        // Se o produto não tiver mais nenhuma cotação, remove o produto
        return p.quotes && p.quotes.length > 0;
      });
      localStorage.setItem('sd_supplier_comparisons_v3', JSON.stringify(updated));
      return updated;
    });
    toast({ title: '🗑️ Cotação / Produto excluído com sucesso!' });
  };

  // Material List Handlers
  const handleSelectProductForMatList = (prodId: string) => {
    const prod = comparisons.find(c => c.id === prodId);
    if (!prod || prod.quotes.length === 0) {
      setMatForm({ productId: prodId, supplierName: '', brand: '', unitPrice: 0, quantity: 1, isCheapest: true });
      return;
    }

    const cheapestQuote = prod.quotes.reduce((prev, curr) => 
      (curr.unitPrice || curr.price) < (prev.unitPrice || prev.price) ? curr : prev
    );

    setMatForm({
      productId: prodId,
      supplierName: cheapestQuote.supplierName,
      brand: cheapestQuote.brand || 'Geral',
      unitPrice: cheapestQuote.unitPrice || cheapestQuote.price,
      quantity: 1,
      isCheapest: true
    });
  };

  const handleSelectQuoteForMatList = (supplierName: string) => {
    const prod = comparisons.find(c => c.id === matForm.productId);
    if (!prod) return;
    const q = prod.quotes.find(item => item.supplierName === supplierName);
    if (!q) return;

    const cheapestQuote = prod.quotes.reduce((prev, curr) => 
      (curr.unitPrice || curr.price) < (prev.unitPrice || prev.price) ? curr : prev
    );
    const isCheapest = (q.supplierName === cheapestQuote.supplierName && (q.unitPrice || q.price) === (cheapestQuote.unitPrice || cheapestQuote.price));

    setMatForm({
      ...matForm,
      supplierName: q.supplierName,
      brand: q.brand || 'Geral',
      unitPrice: q.unitPrice || q.price,
      isCheapest: isCheapest
    });
  };

  const handleAddMaterialToList = () => {
    if (!matForm.productId) {
      toast({ title: '⚠️ Selecione um produto', variant: 'destructive' });
      return;
    }
    const prod = comparisons.find(c => c.id === matForm.productId);
    if (!prod) return;

    if (!matForm.supplierName) {
      toast({ title: '⚠️ Nenhuma cotação cadastrada para este produto ainda', variant: 'destructive' });
      return;
    }

    const qty = Math.max(1, Number(matForm.quantity) || 1);
    const total = qty * matForm.unitPrice;

    // Resolução da Pasta do Cliente
    let resolvedClientFolderId: string | undefined = undefined;
    let resolvedClientName: string | undefined = undefined;

    if (matForm.clientFolderId === '__new__' && matForm.customClientName.trim()) {
      const newFolder: ClientFolder = {
        id: Date.now().toString(),
        name: matForm.customClientName.trim(),
        createdAt: new Date().toISOString(),
        status: 'Pronto para Comprar'
      };
      setClientFolders(prev => [newFolder, ...prev]);
      resolvedClientFolderId = newFolder.id;
      resolvedClientName = newFolder.name;
      setSelectedClientFolderId(newFolder.id);
    } else if (matForm.clientFolderId && matForm.clientFolderId !== 'all' && matForm.clientFolderId !== '__new__') {
      const foundFolder = clientFolders.find(f => f.id === matForm.clientFolderId);
      if (foundFolder) {
        resolvedClientFolderId = foundFolder.id;
        resolvedClientName = foundFolder.name;
        setSelectedClientFolderId(foundFolder.id);
      }
    } else {
      const activeFolder = clientFolders.find(f => f.id === selectedClientFolderId);
      if (activeFolder) {
        resolvedClientFolderId = activeFolder.id;
        resolvedClientName = activeFolder.name;
      }
    }

    const newItem: MaterialListItem = {
      id: Date.now().toString(),
      productId: prod.id,
      productName: prod.productName,
      category: prod.category,
      selectedSupplierName: matForm.supplierName,
      selectedBrand: matForm.brand,
      selectedUnitPrice: matForm.unitPrice,
      quantity: qty,
      total: total,
      isCheapestSelected: matForm.isCheapest,
      clientName: resolvedClientName,
      clientFolderId: resolvedClientFolderId
    };

    setMaterialList([newItem, ...materialList]);
    setShowAddMatForm(false);
    setMatForm({ productId: '', supplierName: '', brand: '', unitPrice: 0, quantity: 1, isCheapest: true, clientFolderId: '', customClientName: '' });
    toast({ title: `📦 Produto adicionado à pasta ${resolvedClientName ? `"${resolvedClientName}"` : 'geral'}!` });
  };

  const handleAddNewProductDirectlyToMaterialList = () => {
    if (!newMatForm.productName.trim()) {
      toast({ title: '⚠️ Informe o nome do produto', variant: 'destructive' });
      return;
    }

    const unitPriceNum = parseFloat(newMatForm.unitPrice.replace(',', '.'));
    if (isNaN(unitPriceNum) || unitPriceNum <= 0) {
      toast({ title: '⚠️ Informe um valor unitário válido', variant: 'destructive' });
      return;
    }

    let sName = newMatForm.supplierName.trim();
    if (newMatForm.supplierId) {
      const found = suppliers.find(s => s.id === newMatForm.supplierId);
      if (found) sName = found.name;
    }
    if (!sName) {
      toast({ title: '⚠️ Informe o nome do fornecedor', variant: 'destructive' });
      return;
    }

    const m2Num = newMatForm.pricePerM2 ? parseFloat(newMatForm.pricePerM2.replace(',', '.')) : null;
    const qty = Math.max(1, Number(newMatForm.quantity) || 1);
    const total = qty * unitPriceNum;

    const firstQuote: PriceQuote = {
      supplierId: newMatForm.supplierId || Date.now().toString(),
      supplierName: sName,
      brand: newMatForm.brand.trim() || 'Geral',
      pricePerM2: isNaN(m2Num as number) ? null : m2Num,
      unitPrice: unitPriceNum,
      price: unitPriceNum,
      updatedAt: new Date().toISOString().split('T')[0],
      photoUrl: newMatForm.photoUrl || null,
      specifications: newMatForm.specifications || null
    };

    const newProdId = Date.now().toString();
    const newProd: ProductComparison = {
      id: newProdId,
      productName: newMatForm.productName.trim(),
      category: newMatForm.category,
      unit: 'Un',
      quotes: [firstQuote]
    };

    setComparisons([newProd, ...comparisons]);

    // Resolução da Pasta do Cliente
    let resolvedClientFolderId: string | undefined = undefined;
    let resolvedClientName: string | undefined = undefined;

    if (newMatForm.clientFolderId === '__new__' && newMatForm.customClientName.trim()) {
      const newFolder: ClientFolder = {
        id: Date.now().toString(),
        name: newMatForm.customClientName.trim(),
        createdAt: new Date().toISOString(),
        status: 'Pronto para Comprar'
      };
      setClientFolders(prev => [newFolder, ...prev]);
      resolvedClientFolderId = newFolder.id;
      resolvedClientName = newFolder.name;
      setSelectedClientFolderId(newFolder.id);
    } else if (newMatForm.clientFolderId && newMatForm.clientFolderId !== 'all' && newMatForm.clientFolderId !== '__new__') {
      const foundFolder = clientFolders.find(f => f.id === newMatForm.clientFolderId);
      if (foundFolder) {
        resolvedClientFolderId = foundFolder.id;
        resolvedClientName = foundFolder.name;
        setSelectedClientFolderId(foundFolder.id);
      }
    } else {
      const activeFolder = clientFolders.find(f => f.id === selectedClientFolderId);
      if (activeFolder) {
        resolvedClientFolderId = activeFolder.id;
        resolvedClientName = activeFolder.name;
      }
    }

    const newItem: MaterialListItem = {
      id: (Date.now() + 1).toString(),
      productId: newProdId,
      productName: newProd.productName,
      category: newProd.category,
      selectedSupplierName: sName,
      selectedBrand: firstQuote.brand,
      selectedUnitPrice: unitPriceNum,
      quantity: qty,
      total: total,
      isCheapestSelected: true,
      clientName: resolvedClientName,
      clientFolderId: resolvedClientFolderId
    };

    setMaterialList([newItem, ...materialList]);
    setShowAddMatForm(false);
    setNewMatForm({ supplierName: '', supplierId: '', productName: '', brand: '', pricePerM2: '', unitPrice: '', quantity: 1, category: 'MDF/MDP', photoUrl: '', specifications: '', clientFolderId: '', customClientName: '' });
    toast({ title: `🚀 Produto criado e adicionado à pasta ${resolvedClientName ? `"${resolvedClientName}"` : 'geral'}!` });
  };

  const handleQuickAddFromComparison = (prod: ProductComparison) => {
    if (prod.quotes.length === 0) {
      toast({ title: '⚠️ Cadastre ao menos uma cotação para este produto antes de incluir na lista', variant: 'destructive' });
      return;
    }
    const cheapestQuote = prod.quotes.reduce((prev, curr) => 
      (curr.unitPrice || curr.price) < (prev.unitPrice || prev.price) ? curr : prev
    );

    const activeFolder = clientFolders.find(f => f.id === selectedClientFolderId);

    const newItem: MaterialListItem = {
      id: Date.now().toString(),
      productId: prod.id,
      productName: prod.productName,
      category: prod.category,
      selectedSupplierName: cheapestQuote.supplierName,
      selectedBrand: cheapestQuote.brand || 'Geral',
      selectedUnitPrice: cheapestQuote.unitPrice || cheapestQuote.price,
      quantity: 1,
      total: cheapestQuote.unitPrice || cheapestQuote.price,
      isCheapestSelected: true,
      clientName: activeFolder ? activeFolder.name : undefined,
      clientFolderId: activeFolder ? activeFolder.id : undefined
    };

    setMaterialList([newItem, ...materialList]);
    toast({ 
      title: `🏆 Adicionado ${activeFolder ? `à pasta "${activeFolder.name}"` : 'com o MENOR PREÇO'}!`, 
      description: `${prod.productName} — ${cheapestQuote.supplierName} (R$ ${(cheapestQuote.unitPrice || cheapestQuote.price).toFixed(2)})` 
    });
  };

  const handleBuyQuoteDirectly = (prod: ProductComparison, q: PriceQuote, isWinner: boolean) => {
    const val = q.unitPrice || q.price || 0;
    const activeFolder = clientFolders.find(f => f.id === selectedClientFolderId);

    const newItem: MaterialListItem = {
      id: Date.now().toString() + Math.random().toString().slice(2, 6),
      productId: prod.id,
      productName: prod.productName,
      category: prod.category,
      selectedSupplierName: q.supplierName,
      selectedBrand: q.brand || 'Geral',
      selectedUnitPrice: val,
      quantity: 1,
      total: val,
      isCheapestSelected: isWinner,
      clientName: activeFolder ? activeFolder.name : undefined,
      clientFolderId: activeFolder ? activeFolder.id : undefined
    };

    setMaterialList(prev => [newItem, ...prev]);
    
    toast({ 
      title: `🛒 Produto adicionado à lista!`, 
      description: `${prod.productName} — ${q.supplierName} (R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})${activeFolder ? ` na pasta "${activeFolder.name}"` : ''}` 
    });
  };

  const handleDeleteMaterialItem = (id: string) => {
    setMaterialList(materialList.filter(m => m.id !== id));
    toast({ title: '🗑️ Item removido da lista' });
  };

  // Função para verificar se um produto corresponde ao filtro de reajuste (MDF 15, 06, Madeirado, Ferragens, etc.)
  const checkProductMatchesFilter = (productName: string, category: string, filterType: string) => {
    const name = productName.toLowerCase();
    const cat = category.toLowerCase();

    if (filterType === 'all') return true;

    if (filterType === 'mdf_15') {
      // MDF Branco 15mm
      const isMdf = cat.includes('mdf') || name.includes('mdf');
      const is15 = name.includes('15') || name.includes('15mm');
      const isBranco = name.includes('branco') || (!name.includes('madeirado') && !name.includes('nogal') && !name.includes('freijo') && !name.includes('carvalho') && !name.includes('louro') && !name.includes('grafite') && !name.includes('preto'));
      return isMdf && is15 && isBranco;
    }

    if (filterType === 'mdf_06') {
      // MDF Branco 06mm
      const isMdf = cat.includes('mdf') || name.includes('mdf');
      const is06 = name.includes('06') || name.includes('6mm') || name.includes(' 6 ') || name.endsWith(' 06') || name.endsWith(' 6') || name.includes('6 mm');
      const isBranco = name.includes('branco') || (!name.includes('madeirado') && !name.includes('nogal') && !name.includes('freijo') && !name.includes('carvalho') && !name.includes('louro') && !name.includes('grafite') && !name.includes('preto'));
      return isMdf && is06 && isBranco;
    }

    if (filterType === 'mdf_madeirado_15') {
      // MDF Madeirado 15mm
      const isMdf = cat.includes('mdf') || name.includes('mdf');
      const is15 = name.includes('15') || name.includes('15mm');
      const isMadeirado = name.includes('madeirado') || name.includes('nogal') || name.includes('freijo') || name.includes('carvalho') || name.includes('louro') || name.includes('grafite') || name.includes('preto') || (!name.includes('branco') && !name.includes('cru'));
      return isMdf && is15 && isMadeirado;
    }

    if (filterType === 'mdf_madeirado_06') {
      // MDF Madeirado 06mm
      const isMdf = cat.includes('mdf') || name.includes('mdf');
      const is06 = name.includes('06') || name.includes('6mm') || name.includes(' 6 ') || name.endsWith(' 06') || name.endsWith(' 6') || name.includes('6 mm');
      const isMadeirado = name.includes('madeirado') || name.includes('nogal') || name.includes('freijo') || name.includes('carvalho') || name.includes('louro') || name.includes('grafite') || name.includes('preto') || (!name.includes('branco') && !name.includes('cru'));
      return isMdf && is06 && isMadeirado;
    }

    if (filterType === 'mdf_mdp') {
      return cat.includes('mdf') || cat.includes('mdp') || name.includes('mdf') || name.includes('mdp');
    }

    if (filterType === 'ferragens') {
      return cat.includes('ferrag') || name.includes('dobradiça') || name.includes('corrediça') || name.includes('parafuso') || name.includes('puxador') || name.includes('trilho') || name.includes('pistão');
    }

    if (filterType === 'vidros') {
      return cat.includes('vidro') || name.includes('vidro') || name.includes('espelho') || name.includes('reflecta');
    }

    if (filterType === 'pedras') {
      return cat.includes('pedra') || cat.includes('marm') || cat.includes('granit') || name.includes('granito') || name.includes('mármore') || name.includes('marmore') || name.includes('quartzo');
    }

    if (filterType === 'tintas') {
      return cat.includes('tinta') || cat.includes('verniz') || name.includes('tinta') || name.includes('verniz') || name.includes('selador') || name.includes('primer');
    }

    if (filterType === 'acessorios') {
      return cat.includes('acess') || cat.includes('perfil') || name.includes('fita') || name.includes('cola') || name.includes('perfil') || name.includes('tapa furo');
    }

    return true;
  };

  // Aplicação do Reajuste de Preços em Massa (%)
  const handleApplyPriceAdjustment = () => {
    const pct = Number(priceAdjForm.percentage) || 0;
    if (pct <= 0) {
      toast({ title: '⚠️ Informe uma porcentagem válida acima de 0%', variant: 'destructive' });
      return;
    }

    const factor = priceAdjForm.operation === 'increase' ? (1 + (pct / 100)) : (1 - (pct / 100));
    let affectedQuotesCount = 0;
    let affectedProductsCount = 0;

    const regNames = new Set(suppliers.map(s => s.name.trim().toLowerCase()));
    const activeProductIds = new Set(activeComparisons.map(p => p.id));

    const updatedComparisons = comparisons.map(prod => {
      // Considerar apenas produtos cadastrados no Comparativo Ativo
      if (!activeProductIds.has(prod.id)) return prod;

      const pNameLower = prod.productName.trim().toLowerCase();
      if (pNameLower.startsWith('sd móveis') || pNameLower.startsWith('orçamento') || pNameLower.startsWith('dados') || pNameLower.startsWith('total') || pNameLower.startsWith('cliente')) {
        return prod;
      }

      const isProductMatch = checkProductMatchesFilter(prod.productName, prod.category, priceAdjForm.filterType);
      if (!isProductMatch) return prod;

      let prodHasUpdatedQuote = false;
      const updatedQuotes = prod.quotes.map(q => {
        if (!q || !q.supplierName) return q;
        const sNameLower = q.supplierName.trim().toLowerCase();
        
        // Apenas fornecedores CADASTRADOS no sistema
        if (!regNames.has(sNameLower)) return q;

        const isSupplierMatch = priceAdjForm.targetSupplierName === 'all' || sNameLower === priceAdjForm.targetSupplierName.toLowerCase();
        if (!isSupplierMatch) return q;

        const currentPrice = q.unitPrice || q.price || 0;
        if (currentPrice <= 0) return q;

        const rawNewPrice = currentPrice * factor;
        const newPrice = Number(rawNewPrice.toFixed(2));
        const newPricePerM2 = q.pricePerM2 ? Number((q.pricePerM2 * factor).toFixed(2)) : null;

        affectedQuotesCount++;
        prodHasUpdatedQuote = true;

        return {
          ...q,
          unitPrice: newPrice,
          price: newPrice,
          pricePerM2: newPricePerM2,
          updatedAt: new Date().toISOString().split('T')[0]
        };
      });

      if (prodHasUpdatedQuote) {
        affectedProductsCount++;
      }

      return {
        ...prod,
        quotes: updatedQuotes
      };
    });

    if (affectedQuotesCount === 0) {
      toast({ title: '⚠️ Nenhuma cotação de fornecedor cadastrado encontrada para os filtros selecionados', variant: 'destructive' });
      return;
    }

    setComparisons(updatedComparisons);
    setShowPriceAdjustmentModal(false);

    const sign = priceAdjForm.operation === 'increase' ? '+' : '-';
    toast({ 
      title: `🎉 Reajuste de ${sign}${pct}% Aplicado!`,
      description: `${affectedQuotesCount} cotações atualizadas em ${affectedProductsCount} produtos cadastrados com sucesso.` 
    });
  };

  // Função auxiliar de impressão segura e não-bloqueante via iframe invisível
  const printHtmlDocument = (html: string) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.error('Erro na impressão:', err);
        } finally {
          setTimeout(() => {
            if (iframe.parentNode) {
              iframe.parentNode.removeChild(iframe);
            }
          }, 1500);
        }
      }, 250);
    }
  };

  const handlePrintMaterialList = (targetSupplierName?: string, includePrices: boolean = true) => {
    const activeFolder = clientFolders.find(f => f.id === selectedClientFolderId);
    let itemsToPrint = selectedClientFolderId === 'all' ? materialList : materialList.filter(item => {
      if (item.clientFolderId === selectedClientFolderId) return true;
      if (activeFolder && item.clientName && item.clientName.toLowerCase() === activeFolder.name.toLowerCase()) return true;
      return false;
    });

    if (targetSupplierName && targetSupplierName !== 'all') {
      itemsToPrint = itemsToPrint.filter(it => it.selectedSupplierName.toLowerCase() === targetSupplierName.toLowerCase());
    }

    const registeredSupplierNames = new Set(suppliers.map(s => s.name.trim().toLowerCase()));

    const totalGeral = itemsToPrint.reduce((acc, curr) => acc + curr.total, 0);
    const clientTitle = activeFolder ? activeFolder.name : 'TODOS OS CLIENTES';
    const reportTitle = targetSupplierName && targetSupplierName !== 'all' 
      ? (includePrices ? `PEDIDO DE COMPRA — FORNECEDOR: ${targetSupplierName.toUpperCase()}` : `SOLICITAÇÃO DE COTAÇÃO — FORNECEDOR: ${targetSupplierName.toUpperCase()}`)
      : (includePrices ? `ITENS DE COMPRA — ${clientTitle.toUpperCase()} (${itemsToPrint.length} ITENS)` : `SOLICITAÇÃO DE COTAÇÃO — ${clientTitle.toUpperCase()} (${itemsToPrint.length} ITENS)`);

    const printHtml = `
      <!DOCTYPE html>
      <html><head><title>${reportTitle}</title>
      <meta charset="utf-8" />
      <style>
        @page { size: auto; margin: 15mm; }
        body{font-family:Segoe UI,Tahoma,Arial,sans-serif;font-size:12px;padding:12px;color:#111;line-height:1.4;background:#fff}
        h2{margin:0 0 2px;color:#0f172a;font-size:16px;font-weight:900;letter-spacing:-0.3px}
        .header{border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #cbd5e1;padding:8px 10px;text-align:left;vertical-align:middle}
        th{background:#0f172a !important;color:#f8fafc !important;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .badge-client{display:inline-block;background:#f3e8ff;color:#7e22ce;border:1px solid #d8b4fe;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:bold;-webkit-print-color-adjust:exact}
        .badge-cheapest{display:inline-block;background:#dcfce7;color:#15803d;border:1px solid #86efac;padding:2px 6px;border-radius:6px;font-size:9px;font-weight:900;text-transform:uppercase;margin-left:4px;-webkit-print-color-adjust:exact}
        .badge-diff{display:inline-block;background:#fee2e2;color:#b91c1c;border:1px solid #fca5a5;padding:2px 6px;border-radius:6px;font-size:9px;font-weight:bold;margin-left:4px;-webkit-print-color-adjust:exact}
        .total-box{text-align:right;font-weight:bold;font-size:14px;margin-top:16px;padding:12px 16px;background:#f0fdf4;border:1.5px solid #22c55e;border-radius:8px;color:#14532d;display:flex;justify-content:space-between;align-items:center;-webkit-print-color-adjust:exact}
        .footer{margin-top:28px;padding-top:12px;border-top:1px dashed #94a3b8;font-size:10px;color:#64748b;display:flex;justify-content:space-between}
      </style>
      </head><body>
      <div class="header">
        <div>
          <h2>SD MÓVEIS PROJETADOS — SISTEMA COMPARATIVO</h2>
          <p style="margin:3px 0 0;font-size:13px;color:#334155;"><b>${reportTitle}</b></p>
          <p style="margin:2px 0 0;font-size:11px;color:#64748b;">Pasta: <b>${clientTitle}</b> ${activeFolder?.phone ? `| Tel: ${activeFolder.phone}` : ''}</p>
        </div>
        <div style="text-align:right;font-size:11px;color:#64748b;">
          <p style="margin:0;">Data: <b>${new Date().toLocaleDateString('pt-BR')}</b></p>
          <p style="margin:2px 0 0;">Hora: ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:${includePrices ? '26%' : '38%'}">PRODUTO / MATERIAL</th>
            <th style="width:${includePrices ? '16%' : '20%'}">PASTA / CLIENTE</th>
            <th style="width:${includePrices ? '22%' : '24%'}">${includePrices ? 'FORNECEDOR SELECIONADO' : 'DESTINATÁRIO'}</th>
            <th style="width:${includePrices ? '10%' : '12%'}">MARCA</th>
            <th style="text-align:center;width:${includePrices ? '6%' : '6%'}">QTD</th>
            ${includePrices ? `
              <th style="text-align:right;width:10%">VALOR UNIT.</th>
              <th style="text-align:right;width:10%">SUBTOTAL</th>
            ` : ''}
          </tr>
        </thead>
        <tbody>
          ${itemsToPrint.map(item => {
            const compProd = comparisons.find(c => c.id === item.productId || c.productName.toLowerCase() === item.productName.toLowerCase());
            const validQuotes = (compProd?.quotes || []).filter(q => {
              if (!q || !q.supplierName) return false;
              const p = q.unitPrice || q.price || 0;
              return p > 0 && registeredSupplierNames.has(q.supplierName.trim().toLowerCase());
            });

            let minPrice = item.selectedUnitPrice;
            let cheapestSupplierName = item.selectedSupplierName;
            validQuotes.forEach(q => {
              const p = q.unitPrice || q.price || 0;
              if (p < minPrice) {
                minPrice = p;
                cheapestSupplierName = q.supplierName;
              }
            });

            const isCheapest = validQuotes.length > 0 ? (item.selectedUnitPrice <= minPrice + 0.001) : true;
            const diff = item.selectedUnitPrice - minPrice;

            return `
              <tr>
                <td>
                  <b style="color:#0f172a;font-size:12px;">${item.productName}</b>
                  <span style="display:block;font-size:10px;color:#d97706;font-weight:600;">${item.category}</span>
                </td>
                <td>
                  <span class="badge-client">📁 ${item.clientName || clientTitle}</span>
                </td>
                <td>
                  <b>🏢 ${item.selectedSupplierName}</b>
                  ${includePrices ? (isCheapest ? '<span class="badge-cheapest">🏆 MENOR PREÇO</span>' : (diff > 0 ? `<span class="badge-diff">+ R$ ${diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} mais caro • Mais barato: <b>${cheapestSupplierName} (R$ ${minPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</b></span>` : '')) : ''}
                </td>
                <td style="color:#475569;">${item.selectedBrand || 'Geral'}</td>
                <td style="text-align:center;font-weight:bold;color:#0f172a;font-size:13px;">${item.quantity}</td>
                ${includePrices ? `
                  <td style="text-align:right;color:#334155;">R$ ${item.selectedUnitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td style="text-align:right;font-weight:900;color:#15803d;font-size:13px;">R$ ${item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                ` : ''}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <div class="total-box" style="${!includePrices ? 'background:#f8fafc;border-color:#94a3b8;color:#0f172a;' : ''}">
        <span>Total de Itens: <b>${itemsToPrint.length} produtos solicitados</b></span>
        ${includePrices ? `
          <span>TOTAL DO PEDIDO: <b style="font-size:16px;">R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</b></span>
        ` : `
          <span style="font-size:12px;color:#64748b;">(Solicitação de Cotação de Preços)</span>
        `}
      </div>

      <div class="footer">
        <span>Emitido por SDcomparativo — SD Móveis Projetados</span>
        <span>Assinatura / Responsável: ____________________________________</span>
      </div>
      </body></html>
    `;

    printHtmlDocument(printHtml);
  };

  const handleSendWhatsAppMaterialList = async (targetSupplierName?: string, includePrices: boolean = true) => {
    const activeFolder = clientFolders.find(f => f.id === selectedClientFolderId);
    let itemsToSend = selectedClientFolderId === 'all' ? materialList : materialList.filter(item => {
      if (item.clientFolderId === selectedClientFolderId) return true;
      if (activeFolder && item.clientName && item.clientName.toLowerCase() === activeFolder.name.toLowerCase()) return true;
      return false;
    });

    if (targetSupplierName && targetSupplierName !== 'all') {
      itemsToSend = itemsToSend.filter(it => it.selectedSupplierName.toLowerCase() === targetSupplierName.toLowerCase());
    }

    if (itemsToSend.length === 0) {
      toast({ title: '⚠️ Nenhum item para enviar', variant: 'destructive' });
      return;
    }

    const clientTitle = activeFolder ? activeFolder.name : 'Cliente Geral';
    const totalGeral = itemsToSend.reduce((acc, curr) => acc + curr.total, 0);

    // Gerar documento PDF real com jsPDF com alinhamento milimétrico profissional
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
    const margin = 10; // 10mm de margem
    const contentWidth = pageWidth - (margin * 2); // 190mm

    // Cabeçalho escuro executivo
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(margin, margin, contentWidth, 22, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('SD MÓVEIS PROJETADOS — SISTEMA COMPARATIVO', margin + 6, margin + 8.5);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(226, 232, 240);
    const subtitle = targetSupplierName && targetSupplierName !== 'all'
      ? (includePrices ? `PEDIDO DE COMPRA — FORNECEDOR: ${targetSupplierName.toUpperCase()}` : `SOLICITAÇÃO DE COTAÇÃO — FORNECEDOR: ${targetSupplierName.toUpperCase()}`)
      : (includePrices ? `PEDIDO DE COMPRA GERAL (${itemsToSend.length} ITENS)` : `SOLICITAÇÃO DE COTAÇÃO GERAL (${itemsToSend.length} ITENS)`);
    doc.text(subtitle, margin + 6, margin + 16);

    // Dados Cliente / Data
    let y = margin + 28;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`PASTA / CLIENTE: ${clientTitle.toUpperCase()}`, margin + 1, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}  Hora: ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, margin + contentWidth - 1, y, { align: 'right' });

    // Tabela Cabeçalho
    y += 5;
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y, contentWidth, 7.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');

    if (includePrices) {
      doc.text('PRODUTO / MATERIAL', margin + 3, y + 5);
      doc.text('CLIENTE', margin + 46, y + 5);
      doc.text('FORNECEDOR SELECIONADO', margin + 74, y + 5);
      doc.text('MARCA', margin + 138, y + 5);
      doc.text('QTD', margin + 152, y + 5, { align: 'center' });
      doc.text('VALOR UNIT.', margin + 172, y + 5, { align: 'right' });
      doc.text('SUBTOTAL', margin + contentWidth - 3, y + 5, { align: 'right' });
    } else {
      doc.text('PRODUTO / MATERIAL', margin + 3, y + 5);
      doc.text('CATEGORIA', margin + 70, y + 5);
      doc.text('FORNECEDOR / DESTINO', margin + 110, y + 5);
      doc.text('MARCA', margin + 152, y + 5);
      doc.text('QTD', margin + contentWidth - 4, y + 5, { align: 'center' });
    }

    // Linhas da Tabela
    y += 7.5;
    const rowHeight = includePrices ? 10 : 8;

    itemsToSend.forEach((item, idx) => {
      if (y > 255) {
        doc.addPage();
        y = margin;
      }

      const compProd = comparisons.find(c => c.id === item.productId || c.productName.toLowerCase() === item.productName.toLowerCase());
      const validQuotes = (compProd?.quotes || []).filter(q => {
        if (!q || !q.supplierName) return false;
        const p = q.unitPrice || q.price || 0;
        return p > 0 && registeredSupplierNames.has(q.supplierName.trim().toLowerCase());
      });

      let minPrice = item.selectedUnitPrice;
      let cheapestSupplierName = item.selectedSupplierName;
      validQuotes.forEach(q => {
        const p = q.unitPrice || q.price || 0;
        if (p < minPrice) {
          minPrice = p;
          cheapestSupplierName = q.supplierName;
        }
      });

      const isCheapest = validQuotes.length > 0 ? (item.selectedUnitPrice <= minPrice + 0.001) : true;
      const diff = item.selectedUnitPrice - minPrice;

      doc.setFillColor(idx % 2 === 0 ? 255 : 248, idx % 2 === 0 ? 255 : 250, idx % 2 === 0 ? 255 : 252);
      doc.rect(margin, y, contentWidth, rowHeight, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentWidth, rowHeight, 'S');

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');

      const prodName = item.productName.length > 24 ? item.productName.substring(0, 22) + '...' : item.productName;

      if (includePrices) {
        // Produto + Categoria
        doc.text(prodName, margin + 3, y + 4.2);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(217, 119, 6);
        doc.text(item.category, margin + 3, y + 7.8);

        // Cliente
        doc.setTextColor(126, 34, 206);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.text(clientTitle.substring(0, 13), margin + 46, y + 5.8);

        // Fornecedor + Selo de Mercado
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text(item.selectedSupplierName.toUpperCase(), margin + 74, y + 4.2);

        if (isCheapest) {
          doc.setFillColor(220, 252, 231);
          doc.setDrawColor(134, 239, 172);
          doc.roundedRect(margin + 74, y + 5.2, 24, 3.8, 0.8, 0.8, 'FD');
          doc.setTextColor(21, 128, 61);
          doc.setFontSize(5.2);
          doc.setFont('helvetica', 'bold');
          doc.text('MENOR PREÇO', margin + 75.5, y + 7.8);
        } else if (diff > 0) {
          doc.setFillColor(254, 226, 226);
          doc.setDrawColor(252, 165, 165);
          const diffStr = `+ R$ ${diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} mais caro | Mais barato: ${cheapestSupplierName} (R$ ${minPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`;
          doc.roundedRect(margin + 74, y + 5.2, 60, 3.8, 0.8, 0.8, 'FD');
          doc.setTextColor(185, 28, 28);
          doc.setFontSize(5);
          doc.setFont('helvetica', 'bold');
          doc.text(diffStr, margin + 75.5, y + 7.8);
        }

        // Marca
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(6.8);
        doc.setFont('helvetica', 'normal');
        doc.text((item.selectedBrand || 'Geral').substring(0, 8), margin + 138, y + 5.8);

        // QTD
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(String(item.quantity), margin + 152, y + 5.8, { align: 'center' });

        // Unitário
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        doc.setTextColor(51, 65, 85);
        doc.text(`R$ ${item.selectedUnitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 172, y + 5.8, { align: 'right' });

        // Subtotal
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.setTextColor(21, 128, 61);
        doc.text(`R$ ${item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + contentWidth - 3, y + 5.8, { align: 'right' });
      } else {
        doc.text(prodName, margin + 3, y + 5.2);
        doc.setFont('helvetica', 'normal');
        doc.text(item.category.substring(0, 18), margin + 70, y + 5.2);
        doc.text(item.selectedSupplierName.substring(0, 20), margin + 110, y + 5.2);
        doc.text((item.selectedBrand || 'Geral').substring(0, 12), margin + 152, y + 5.2);
        doc.setFont('helvetica', 'bold');
        doc.text(String(item.quantity), margin + contentWidth - 4, y + 5.2, { align: 'center' });
      }

      y += rowHeight;
    });

    // Caixa de Total
    y += 4;
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(34, 197, 94);
    doc.roundedRect(margin, y, contentWidth, 11, 2, 2, 'FD');
    doc.setTextColor(20, 83, 45);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total de Itens: ${itemsToSend.length} produtos solicitados`, margin + 5, y + 7.2);
    if (includePrices) {
      doc.text(`TOTAL DO PEDIDO: R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + contentWidth - 5, y + 7.2, { align: 'right' });
    } else {
      doc.text(`(Solicitação de Cotação de Preços)`, margin + contentWidth - 5, y + 7.2, { align: 'right' });
    }

    // Rodapé
    y += 18;
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y - 4, margin + contentWidth, y - 4);
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text('Emitido por SDcomparativo — SD Móveis Projetados', margin, y + 2);
    doc.text('Assinatura / Responsável: _______________________________', margin + contentWidth, y + 2, { align: 'right' });

    const cleanSupp = (targetSupplierName || 'Geral').replace(/\s+/g, '_');
    const fileName = includePrices ? `Pedido_${cleanSupp}_${clientTitle.replace(/\s+/g, '_')}.pdf` : `Cotacao_${cleanSupp}_${clientTitle.replace(/\s+/g, '_')}.pdf`;

    const pdfBlob = doc.output('blob');
    const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });

    // Mensagem de texto limpa e direta para WhatsApp (Apenas o PDF em anexo)
    let msg = includePrices 
      ? `*📦 PEDIDO DE COMPRA (PDF OFICIAL ANEXO) — SD MÓVEIS PROJETADOS*\n`
      : `*📋 SOLICITAÇÃO DE COTAÇÃO (PDF OFICIAL ANEXO) — SD MÓVEIS PROJETADOS*\n`;
    if (targetSupplierName && targetSupplierName !== 'all') {
      msg += `🏢 *Fornecedor:* ${targetSupplierName.toUpperCase()}\n`;
    }
    msg += `📁 *Pasta/Cliente:* ${clientTitle}\n`;
    msg += `📦 *Total de Itens:* ${itemsToSend.length} ${itemsToSend.length === 1 ? 'produto' : 'produtos'}\n`;
    if (includePrices) {
      msg += `💰 *VALOR TOTAL: R$ ${totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}*\n\n`;
      msg += `📎 *Segue em anexo o arquivo PDF oficial do pedido: ${fileName}*\n`;
      msg += `_Favor confirmar o recebimento e prazo de entrega!_`;
    } else {
      msg += `\n📎 *Segue em anexo o arquivo PDF para cotação: ${fileName}*\n`;
      msg += `_Favor nos informar os valores unitários disponíveis!_`;
    }

    // 1. Tentar Compartilhamento Nativo com o arquivo PDF anexado diretamente (Mobile / PWA / Web Share API)
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
      try {
        await navigator.share({
          title: fileName,
          files: [pdfFile]
        });
        toast({ 
          title: `✅ PDF Enviado com Sucesso!`, 
          description: `O arquivo "${fileName}" foi enviado para o WhatsApp.` 
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') return;
      }
    }

    // 2. Fallback para Desktop (Chrome / Windows):
    // Salva/Baixa o PDF no computador
    doc.save(fileName);

    // Abre a conversa no WhatsApp Web pronta apenas para envio do PDF (sem mensagem de texto)
    const matchingSupplier = targetSupplierName ? suppliers.find(s => s.name.toLowerCase() === targetSupplierName.toLowerCase()) : null;
    let rawPhone = matchingSupplier?.phone || activeFolder?.phone || '';
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.length >= 10 && !cleanPhone.startsWith('55')) {
      cleanPhone = `55${cleanPhone}`;
    }

    const waUrl = cleanPhone 
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}`
      : `https://api.whatsapp.com/send`;

    window.open(waUrl, '_blank');
    toast({ 
      title: `📄 PDF do Pedido Gerado e Baixado!`, 
      description: `O arquivo "${fileName}" foi salvo nos seus Downloads. Arraste-o para o WhatsApp aberto!` 
    });
  };

  const filteredSuppliers = useMemo(() => suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) || (s.cnpj || '').includes(search)
  ), [suppliers, search]);

  const registeredSupplierNames = useMemo(() => {
    return new Set(suppliers.map(s => s.name.trim().toLowerCase()));
  }, [suppliers]);

  // Filtra SOMENTE produtos que possuem cotações em 2 ou mais fornecedores CADASTRADOS no sistema (Comparativo Real)
  const activeComparisons = useMemo(() => {
    return comparisons.filter(c => {
      const validQuotes = (c.quotes || []).filter(q => {
        if (!q || !q.supplierName) return false;
        const price = q.unitPrice || q.price || 0;
        return price > 0 && registeredSupplierNames.has(q.supplierName.trim().toLowerCase());
      });
      return validQuotes.length >= 2;
    });
  }, [comparisons, registeredSupplierNames]);

  const handleDeleteUncomparedProducts = () => {
    const uncomparedCount = comparisons.filter(c => {
      const validQuotes = (c.quotes || []).filter(q => {
        if (!q || !q.supplierName) return false;
        const price = q.unitPrice || q.price || 0;
        return price > 0 && registeredSupplierNames.has(q.supplierName.trim().toLowerCase());
      });
      return validQuotes.length < 2;
    }).length;

    if (uncomparedCount === 0) {
      toast({ title: '✅ Todos os produtos cadastrados já possuem comparativo entre fornecedores!' });
      return;
    }

    if (confirm(`Excluir permanentemente ${uncomparedCount} produtos que não possuem cotação em pelo menos 2 fornecedores cadastrados?`)) {
      setComparisons(prev => {
        const updated = prev.filter(c => {
          const validQuotes = (c.quotes || []).filter(q => {
            if (!q || !q.supplierName) return false;
            const price = q.unitPrice || q.price || 0;
            return price > 0 && registeredSupplierNames.has(q.supplierName.trim().toLowerCase());
          });
          return validQuotes.length >= 2;
        });
        localStorage.setItem('sd_supplier_comparisons_v3', JSON.stringify(updated));
        return updated;
      });
      toast({ title: `🗑️ ${uncomparedCount} produtos sem comparativo foram excluídos!` });
    }
  };

  const filteredComparisons = useMemo(() => activeComparisons.filter(c => {
    const matchesSearch = c.productName.toLowerCase().includes(compSearch.toLowerCase()) || 
      c.category.toLowerCase().includes(compSearch.toLowerCase());
    const matchesCategory = categoryFilter === 'Todos' || c.category.toLowerCase() === categoryFilter.toLowerCase();
    return matchesSearch && matchesCategory;
  }), [activeComparisons, compSearch, categoryFilter]);

  // Statistics calculation with useMemo considerando apenas produtos cadastrados nos fornecedores
  const totalProducts = activeComparisons.length;

  const { totalSavingsPotential, topSupplierName, topSupplierWins } = useMemo(() => {
    let totalSavings = 0;
    const winCount: Record<string, number> = {};

    activeComparisons.forEach(c => {
      const validQuotes = (c.quotes || []).filter(q => {
        if (!q || !q.supplierName) return false;
        const price = q.unitPrice || q.price || 0;
        return price > 0 && registeredSupplierNames.has(q.supplierName.trim().toLowerCase());
      });

      if (validQuotes.length >= 2) {
        const prices = validQuotes.map(q => q.unitPrice || q.price || 0);
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        totalSavings += (max - min);
      }
      if (validQuotes.length > 0) {
        const cheapest = validQuotes.reduce((prev, curr) => 
          (curr.unitPrice || curr.price || 0) < (prev.unitPrice || prev.price || 0) ? curr : prev
        );
        winCount[cheapest.supplierName] = (winCount[cheapest.supplierName] || 0) + 1;
      }
    });

    let topName = '-';
    let topWins = 0;
    Object.entries(winCount).forEach(([name, count]) => {
      if (count > topWins) {
        topWins = count;
        topName = name;
      }
    });

    return { totalSavingsPotential: totalSavings, topSupplierName: topName, topSupplierWins: topWins };
  }, [activeComparisons, registeredSupplierNames]);

  // Material list summary calculations
  const totalMaterialListValue = useMemo(() => materialList.reduce((acc, item) => acc + item.total, 0), [materialList]);
  const materialListSuppliersCount = useMemo(() => new Set(materialList.map(m => m.selectedSupplierName)).size, [materialList]);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0d0f12] relative w-full text-white">
      
      {/* Hidden File Input for Batch Orçamento Photo & PDF Scan */}
      <input 
        type="file" 
        ref={batchFileInputRef} 
        accept="image/*,application/pdf,.pdf" 
        capture="environment" 
        onChange={handleImportBatchFromBudgetPhoto}
        className="hidden" 
      />

      {/* AI Processing Overlay */}
      {analyzingImage && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-white space-y-4 p-6">
          <div className="w-16 h-16 rounded-full bg-purple-600/20 border-2 border-purple-500 flex items-center justify-center animate-pulse">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-purple-300">🤖 Leitura Inteligente do Orçamento (IA)...</h2>
          <p className="text-sm text-gray-400 text-center max-w-md">
            Extraindo produtos, quantidades e valores unitários do documento. Gerando lista e comparativo automático!
          </p>
        </div>
      )}

      {/* AI Text-Description Processing Overlay */}
      {analyzingText && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-white space-y-4 p-6">
          <div className="w-16 h-16 rounded-full bg-indigo-600/20 border-2 border-indigo-500 flex items-center justify-center animate-pulse">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-indigo-300">🤖 Interpretando sua descrição com IA...</h2>
          <p className="text-sm text-gray-400 text-center max-w-md">
            Identificando cliente, produtos, quantidades e valores a partir do texto. Gerando o cadastro automático!
          </p>
        </div>
      )}

      {/* ══ BARRA FIXA DE NAVEGAÇÃO & AÇÕES (PADRONIZADA & MOBILE-FRIENDLY) ══ */}
      <div className="flex-shrink-0 z-30 bg-[#0d0f12] px-3 sm:px-6 py-2 border-b border-white/10 shadow-lg space-y-2">
        
        {/* LINHA 1: MÓDULOS PRINCIPAIS & AÇÕES */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          <div className="flex items-center gap-1.5 shrink-0">
            {/* COMPARATIVO GERAL */}
            <button
              onClick={() => setActiveTab('comparison')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 font-bold text-xs rounded-xl transition-all shrink-0 shadow-sm ${
                activeTab === 'comparison'
                  ? 'bg-emerald-500 text-black shadow-md font-black'
                  : 'bg-white/5 text-gray-300 hover:text-white border border-white/10 hover:bg-white/10'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Comparativo ({activeComparisons.length})</span>
            </button>

            {/* SELETOR DE PASTAS / CLIENTES */}
            {(() => {
              const currentFolder = clientFolders.find(f => f.id === selectedClientFolderId);
              const folderLabel = currentFolder ? currentFolder.name : `Pastas (${clientFolders.length})`;

              return (
                <div className="relative shrink-0">
                  <div className={`flex items-center rounded-xl border transition-all shadow-sm ${
                    activeTab === 'material_list'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-1 ring-amber-500/40 shadow-amber-500/10 font-black'
                      : 'bg-white/5 border-white/10 text-gray-300 hover:text-white hover:border-amber-500/40'
                  }`}>
                    <button
                      onClick={() => {
                        setActiveTab('material_list');
                        setShowFolderDropdown(prev => !prev);
                      }}
                      className="px-3.5 py-1.5 font-black text-xs flex items-center gap-2 cursor-pointer hover:text-amber-300 transition-colors"
                      title="Abrir módulo de pastas e ver clientes"
                    >
                      <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="font-extrabold text-white text-xs max-w-[150px] sm:max-w-[220px] truncate">
                        {currentFolder ? `📁 ${currentFolder.name}` : `Pastas (${clientFolders.length})`}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-amber-400 transition-transform duration-200 ${showFolderDropdown ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* Backdrop ao abrir dropdown */}
                  {showFolderDropdown && (
                    <div 
                      className="fixed inset-0 z-40 bg-black/30" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowFolderDropdown(false);
                      }} 
                    />
                  )}

                  {/* Dropdown de Pastas de Clientes */}
                  {showFolderDropdown && (
                    <div 
                      className="absolute top-full left-0 mt-2 w-72 sm:w-80 bg-[#12141a] border-2 border-amber-500/40 rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 space-y-1.5 backdrop-blur-xl"
                      style={{ boxShadow: '0 20px 40px -10px rgba(0,0,0,0.9), 0 0 25px rgba(245,158,11,0.25)' }}
                    >
                      <div className="px-2 py-1 text-[11px] font-black uppercase text-amber-400 tracking-wider flex items-center justify-between border-b border-white/10 pb-1.5">
                        <span>📁 Pastas de Clientes</span>
                        <span className="text-[10px] text-gray-400 font-normal">{clientFolders.length} cadastradas</span>
                      </div>

                      <div className="max-h-64 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-white/20">
                        {clientFolders.map(f => {
                          const fItems = materialList.filter(m => m.clientFolderId === f.id || (m.clientName && m.clientName.toLowerCase() === f.name.toLowerCase()));
                          const isSelected = selectedClientFolderId === f.id && activeTab === 'material_list';

                          return (
                            <button
                              key={f.id}
                              onClick={() => {
                                setSelectedClientFolderId(f.id);
                                setActiveTab('material_list');
                                setShowFolderDropdown(false);
                              }}
                              className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-all group cursor-pointer ${
                                isSelected
                                  ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40 shadow-sm'
                                  : 'text-gray-200 hover:bg-white/10 hover:text-white border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Folder className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-400' : 'text-gray-400 group-hover:text-amber-400'}`} />
                                <div className="min-w-0">
                                  <span className="block font-black text-white group-hover:text-amber-300 truncate text-xs">
                                    {f.name}
                                  </span>
                                  <span className="block text-[10px] text-gray-400 font-normal">
                                    {fItems.length} itens • {f.status || 'Pronto'}
                                  </span>
                                </div>
                              </div>
                              {isSelected ? (
                                <span className="bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded uppercase shrink-0">Aberta</span>
                              ) : (
                                <span className="text-[11px] text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold">Abrir ➔</span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="border-t border-white/10 my-1 pt-1 space-y-1">
                        <button
                          onClick={() => {
                            setSelectedClientFolderId('all');
                            setActiveTab('material_list');
                            setShowFolderDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-all ${
                            selectedClientFolderId === 'all' && activeTab === 'material_list'
                              ? 'bg-white/10 text-white'
                              : 'text-gray-400 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <span>📂 Ver Todas as Pastas (Galeria)</span>
                          {selectedClientFolderId === 'all' && activeTab === 'material_list' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                        </button>

                        <button
                          onClick={() => {
                            setActiveTab('material_list');
                            setEditingClientFolder(null);
                            setClientFolderForm({ name: '', phone: '', notes: '', status: 'Pronto para Comprar' });
                            setShowClientFolderModal(true);
                            setShowFolderDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs font-black text-emerald-400 hover:bg-emerald-500/15 flex items-center gap-1.5 transition-all border border-emerald-500/30"
                        >
                          <Plus className="w-4 h-4 text-emerald-400" /> + Nova Pasta de Cliente
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}



            {/* PLANO DE CORTE */}
            <button
              onClick={() => setActiveTab('cutting_plan')}
              className={`px-3.5 py-1.5 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-sm ${
                activeTab === 'cutting_plan'
                  ? 'bg-amber-500 text-black shadow-md ring-2 ring-amber-500/50 font-black'
                  : 'bg-white/5 text-gray-300 hover:text-white border border-white/10 hover:border-amber-500/40'
              }`}
              title="Abrir Otimizador & Plano de Corte 2D"
            >
              <Scissors className={`w-3.5 h-3.5 ${activeTab === 'cutting_plan' ? 'text-black' : 'text-amber-400'}`} />
              <span>Plano de Corte</span>
            </button>

            {/* SD IA */}
            <button
              onClick={() => setActiveTab('claude_ai')}
              className={`px-3.5 py-1.5 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-sm ${
                activeTab === 'claude_ai'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md font-black ring-2 ring-orange-400/50'
                  : 'bg-gradient-to-r from-orange-950/40 to-amber-950/40 text-orange-300 hover:text-white border border-orange-500/40 hover:border-orange-400'
              }`}
              title="Abrir SD IA (Antigravity Studio)"
            >
              <Sparkles className={`w-3.5 h-3.5 ${activeTab === 'claude_ai' ? 'text-white' : 'text-orange-400'}`} />
              <span>SD IA</span>
            </button>

            {/* ABA CONFIGURAÇÃO */}
            <button
              onClick={() => setActiveTab('configuration')}
              className={`px-3.5 py-1.5 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-sm ${
                activeTab === 'configuration'
                  ? 'bg-amber-500 text-black shadow-md ring-2 ring-amber-500/50 font-black'
                  : 'bg-white/5 text-gray-300 hover:text-white border border-white/10 hover:border-amber-500/40'
              }`}
              title="Abrir Configurações e Ferramentas"
            >
              <Settings className={`w-3.5 h-3.5 ${activeTab === 'configuration' ? 'text-black' : 'text-amber-400'}`} />
              <span>Configuração</span>
            </button>

            {/* ABAS CUSTOMIZADAS */}
            {customMainTabs.map(t => (
              <div key={t.id} className="relative group flex items-center shrink-0">
                <button
                  onClick={() => setActiveTab(t.id)}
                  className={`px-3 py-1.5 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm pr-6 ${
                    activeTab === t.id
                      ? 'bg-purple-600 text-white shadow-md font-black ring-2 ring-purple-400/50'
                      : 'bg-white/5 text-gray-400 hover:text-white border border-white/10 hover:bg-white/10'
                  }`}
                >
                  <Layout className={`w-3.5 h-3.5 ${activeTab === t.id ? 'text-white' : 'text-purple-400'}`} />
                  <span>{t.name}</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCustomMainTabs(prev => {
                      const next = prev.filter(tab => tab.id !== t.id);
                      localStorage.setItem('sd_custom_main_tabs', JSON.stringify(next));
                      return next;
                    });
                    if (activeTab === t.id) setActiveTab('comparison');
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center text-[9px] opacity-0 group-hover:opacity-100 transition-opacity"
                  title={`Excluir aba ${t.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* AÇÕES DA DIREITA: SINCRONIZAR NUVEM & REAJUSTAR PREÇOS */}
          <div className="shrink-0 flex items-center gap-2">
            <button
              onClick={async () => {
                setIsCloudSyncing(true);
                toast({ title: '☁️ Sincronizando com a Nuvem...' });
                const res = await fetchCloudState();
                setIsCloudSyncing(false);
                if (res) {
                  toast({ title: '✅ Sincronizado!', description: 'Todos os produtos e pastas foram atualizados com a nuvem.' });
                } else {
                  toast({ title: '☁️ Sistema em dia!', description: 'Você já está com a versão mais recente.' });
                }
              }}
              className="bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 hover:text-sky-200 border border-sky-500/30 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shrink-0"
              title="Sincronizar dados entre Celular e Computador"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-sky-400 ${isCloudSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sincronizar Nuvem</span>
              <span className="sm:hidden">Sincronizar</span>
            </button>

            <button
              onClick={() => setShowPriceAdjustmentModal(true)}
              className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-amber-500/30 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm shrink-0"
              title="Reajustar preços em porcentagem (%)"
            >
              <Percent className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Reajustar Preços (%)</span>
              <span className="sm:hidden">Reajustar (%)</span>
            </button>
          </div>
        </div>

        {/* LINHA 2: FORNECEDORES (SCROLL HORIZONTAL COMPACTO) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
          <span className="text-[10px] uppercase font-black tracking-wider text-gray-500 shrink-0 mr-1 hidden sm:inline">
            Fornecedores:
          </span>

          {suppliers.map(s => (
            <div key={s.id} className={`flex items-center rounded-xl border transition-all shrink-0 ${
              activeTab === `supplier_${s.id}`
                ? 'bg-amber-500/20 border-amber-500 text-amber-400 font-bold'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}>
              <button
                onClick={() => setActiveTab(`supplier_${s.id}`)}
                className="pl-2.5 pr-1.5 py-1 font-bold text-xs flex items-center gap-1"
              >
                🏢 {s.name}
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleDeleteSupplier(s.id); }}
                className="w-4 h-4 mr-1 flex items-center justify-center rounded-full text-gray-500 hover:bg-red-500/20 hover:text-red-400 transition-all text-[9px]"
                title={`Excluir fornecedor ${s.name}`}
              >
                ✕
              </button>
            </div>
          ))}

          {!showQuickAddSupplier ? (
            <button
              onClick={() => setShowQuickAddSupplier(true)}
              className="flex items-center gap-1 px-2.5 py-1 font-bold text-xs rounded-xl text-emerald-400 hover:bg-emerald-500/10 transition-all border border-emerald-500/30 shrink-0"
            >
              + Fornecedor
            </button>
          ) : (
            <div className="flex items-center gap-1 bg-[#1a1a1a] p-0.5 rounded-xl border border-emerald-500/40 shrink-0">
              <input
                autoFocus
                value={quickAddSupplierName}
                onChange={e => setQuickAddSupplierName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleQuickAddSupplier(); if (e.key === 'Escape') { setShowQuickAddSupplier(false); setQuickAddSupplierName(''); } }}
                placeholder="Nome..."
                className="px-2 py-0.5 rounded-lg bg-black text-white text-xs placeholder-gray-500 focus:outline-none w-28"
              />
              <button
                onClick={handleQuickAddSupplier}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2 py-0.5 rounded-lg text-[10px]"
              >
                OK
              </button>
              <button
                onClick={() => { setShowQuickAddSupplier(false); setQuickAddSupplierName(''); }}
                className="text-gray-400 hover:text-white px-1 text-xs"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Cadastro / Edição de Fornecedor */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#14171d] border border-white/10 rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-4 text-white">
            <h3 className="font-bold text-lg text-amber-400">{editingId ? 'Editar' : 'Novo'} Fornecedor</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome do Fornecedor *" className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm" />
              <input value={form.cnpj} onChange={e => setForm({ ...form, cnpj: e.target.value })} placeholder="CNPJ" className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm" />
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Telefone / WhatsApp" className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm" />
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="E-mail" className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm" />
              <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="Endereço Completo" className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm sm:col-span-2" />
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm">
                <option>Geral</option><option>MDF/MDP</option><option>Ferragens</option><option>Vidros</option><option>Pedras</option><option>Tintas</option><option>Acessórios</option>
              </select>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Observações..." className="p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="bg-white/10 border border-white/20 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-white/20 transition-colors text-xs">Cancelar</button>
              <button onClick={handleSaveSupplier} className="bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-amber-500 transition-colors text-xs shadow-md">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ CONTEÚDO ROLÁVEL (SOMENTE ESTA ÁREA ROLA) ══ */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">

      {/* ─── TAB: PRODUTOS DO FORNECEDOR ESPECÍFICO ─────────────────────── */}
      {activeTab.startsWith('supplier_') && activeTab !== 'suppliers_overview' && (
        (() => {
          const supplierId = activeTab.replace('supplier_', '');
          const currentSupplier = suppliers.find(s => s.id === supplierId);
          if (!currentSupplier) return null;
          
          const registeredSupplierNames = new Set(suppliers.map(s => s.name.trim().toLowerCase()));

          // Extrair SOMENTE os produtos que possuem cotação para ESTE fornecedor específico
          let supplierProducts = comparisons.filter(c => {
            const pNameLower = c.productName.trim().toLowerCase();
            if (pNameLower.startsWith('sd móveis') || pNameLower.startsWith('orçamento') || pNameLower.startsWith('dados')) return false;
            return c.quotes.some(q => (q.supplierId === currentSupplier.id || q.supplierName.toLowerCase() === currentSupplier.name.toLowerCase()) && (q.unitPrice || q.price || 0) > 0);
          });

          if (supplierProdSearch.trim()) {
            supplierProducts = supplierProducts.filter(c => 
              c.productName.toLowerCase().includes(supplierProdSearch.toLowerCase()) || 
              c.category.toLowerCase().includes(supplierProdSearch.toLowerCase())
            );
          }

          // Ordem alfabética/numérica
          supplierProducts.sort((a, b) => a.productName.localeCompare(b.productName, 'pt-BR', { numeric: true }));

          return (
            <div className="space-y-4 sm:space-y-6 animate-in fade-in zoom-in-95 duration-300">
                  {/* Cabeçalho Executivo do Fornecedor (Padronizado e Compacto) */}
                  <div className="bg-gradient-to-r from-[#14171d] via-[#111317] to-[#14171d] border border-white/10 p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-md">
                        <Building className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                          <h2 className="text-lg sm:text-xl font-black text-white tracking-wide">
                            {currentSupplier.name}
                          </h2>
                          <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase">
                            {currentSupplier.category || 'Geral'}
                          </span>
                          <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                            {supplierProducts.length} {supplierProducts.length === 1 ? 'produto cotado' : 'produtos cotados'}
                          </span>
                        </div>
                        <p className="text-gray-400 text-[11px] sm:text-xs mt-0.5 sm:mt-1 flex items-center gap-2 sm:gap-3 flex-wrap">
                          {currentSupplier.cnpj && <span>CNPJ: {currentSupplier.cnpj}</span>}
                          {currentSupplier.phone && <span className="flex items-center gap-1 text-gray-300"><Phone className="w-3 h-3 text-amber-400" /> {currentSupplier.phone}</span>}
                          {currentSupplier.email && <span className="flex items-center gap-1 text-gray-300"><Mail className="w-3 h-3 text-amber-400" /> {currentSupplier.email}</span>}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full md:w-auto shrink-0">
                      <button 
                        onClick={() => {
                          setProdForm({ ...prodForm, supplierId: currentSupplier.id, supplierName: currentSupplier.name });
                          setShowProdForm(true);
                        }}
                        className="flex-1 md:flex-none justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <Plus className="w-3.5 h-3.5" /> <span>+ Produto / Preço</span>
                      </button>

                      <button 
                        onClick={() => {
                          setTextImportInput('');
                          setShowTextImportModal(true);
                        }}
                        className="flex-1 md:flex-none justify-center bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
                        title="Importar lista ou orçamento por texto com IA"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> <span>Importar com IA</span>
                      </button>

                      {supplierProducts.length > 0 && (
                        <button 
                          onClick={() => handleClearSupplierProducts(currentSupplier.name)}
                          className="w-full md:w-auto justify-center bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-300 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all active:scale-[0.98]"
                          title={`Excluir todos os produtos de ${currentSupplier.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-400" /> <span>Limpar Fornecedor</span>
                        </button>
                      )}

                      <button 
                        onClick={() => {
                          const html = `
                            <!DOCTYPE html>
                            <html><head><title>Tabela de Preços - ${currentSupplier.name}</title>
                            <meta charset="utf-8" />
                            <style>
                              @page { size: auto; margin: 15mm; }
                              body { font-family: Segoe UI, sans-serif; padding: 12px; color: #111; }
                              h1 { font-size: 16px; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
                              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                              th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; font-size: 11px; }
                              th { background: #0f172a !important; color: #fff !important; font-weight: bold; -webkit-print-color-adjust: exact; }
                            </style></head><body>
                            <h1>🏢 TABELA DE PREÇOS: ${currentSupplier.name.toUpperCase()}</h1>
                            <p style="font-size:11px;color:#475569;"><b>Categoria:</b> ${currentSupplier.category} | <b>Total de Itens:</b> ${supplierProducts.length} | Data: ${new Date().toLocaleDateString('pt-BR')}</p>
                            <table>
                              <thead><tr><th>Produto</th><th>Categoria</th><th>Marca</th><th style="text-align:right;">Preço Unitário (R$)</th></tr></thead>
                              <tbody>
                                ${supplierProducts.map(p => {
                                  const q = p.quotes.find(item => item.supplierId === currentSupplier.id || item.supplierName.toLowerCase() === currentSupplier.name.toLowerCase());
                                  const price = q ? (q.unitPrice || q.price || 0) : 0;
                                  return `<tr><td><b>${p.productName}</b></td><td>${p.category}</td><td>${q?.brand || '-'}</td><td style="text-align:right;font-weight:bold;">${price > 0 ? `R$ ${price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'Não Cotado'}</td></tr>`;
                                }).join('')}
                              </tbody>
                            </table>
                            </body></html>
                          `;
                          printHtmlDocument(html);
                        }}
                        className="w-full md:w-auto justify-center bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all active:scale-[0.98]"
                        title="Imprimir Tabela de Preços deste Fornecedor"
                      >
                        <Printer className="w-3.5 h-3.5 text-emerald-400" /> <span>Imprimir / PDF</span>
                      </button>
                    </div>
                  </div>

                  {/* Barra de Busca de Produtos deste Fornecedor */}
                  <div className="relative max-w-md w-full">
                    <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                    <input 
                      value={supplierProdSearch} 
                      onChange={e => setSupplierProdSearch(e.target.value)} 
                      placeholder={`Buscar produto em ${currentSupplier.name}...`} 
                      className="w-full pl-12 pr-4 py-3 rounded-2xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder-gray-500 text-sm" 
                    />
                  </div>

                  {/* Tabela de Produtos deste fornecedor */}
                  <div className="bg-[#111] border border-white/10 rounded-3xl shadow-xl overflow-x-auto">
                    <table className="w-full min-w-[700px]">
                      <thead className="bg-[#1a1a1a] border-b border-white/10">
                        <tr>
                          <th className="text-left p-4 text-xs font-black text-amber-500/80 uppercase">Produto</th>
                          <th className="text-left p-4 text-xs font-black text-amber-500/80 uppercase">Preço Cadastrado (Unit.)</th>
                          <th className="text-left p-4 text-xs font-black text-amber-500/80 uppercase">Comparativo no Mercado</th>
                          <th className="text-left p-4 text-xs font-black text-amber-500/80 uppercase">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplierProducts.map(prod => {
                          const thisQuote = prod.quotes.find(q => (q.supplierId === currentSupplier.id || q.supplierName.toLowerCase() === currentSupplier.name.toLowerCase()) && (q.unitPrice || q.price || 0) > 0);
                          if (!thisQuote) return null;

                          // Lógica para saber se ele é o mais barato considerando fornecedores cadastrados
                          const validQuotes = (prod.quotes || []).filter(q => {
                            if (!q || !q.supplierName) return false;
                            const price = q.unitPrice || q.price || 0;
                            return price > 0 && registeredSupplierNames.has(q.supplierName.trim().toLowerCase());
                          });

                          let minPrice = Infinity;
                          let cheapestQuote: any = null;
                          validQuotes.forEach(q => {
                            const p = q.unitPrice || q.price || 0;
                            if (p < minPrice) {
                              minPrice = p;
                              cheapestQuote = q;
                            }
                          });

                          const thisPrice = thisQuote.unitPrice || thisQuote.price || 0;
                          const isCheapest = thisPrice <= minPrice;
                          const diff = thisPrice - minPrice;

                          const sortedValidQuotes = [...validQuotes].sort((a, b) => (a.unitPrice || a.price || 0) - (b.unitPrice || b.price || 0));
                          const competitorQuote = sortedValidQuotes.find(q => q.supplierName.toLowerCase() !== currentSupplier.name.toLowerCase());
                          const competitorPrice = competitorQuote ? (competitorQuote.unitPrice || competitorQuote.price || 0) : 0;
                          const economy = (competitorPrice > thisPrice) ? competitorPrice - thisPrice : 0;

                          return (
                            <tr key={prod.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                              <td className="p-4">
                                <p className="font-bold text-white text-sm">{prod.productName}</p>
                                <p className="text-xs text-gray-500">{prod.category} {thisQuote.brand && thisQuote.brand !== 'Geral' ? `• ${thisQuote.brand}` : ''}</p>
                              </td>
                              <td className="p-4 font-black text-emerald-400 text-sm">
                                R$ {thisPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-4">
                                {isCheapest ? (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <div className="inline-flex items-center gap-2 bg-emerald-950/50 border border-emerald-500/60 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm">
                                      <span>🥇 <b>{currentSupplier.name}</b></span>
                                      <span className="text-emerald-400 font-black">R$ {thisPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                      <span className="bg-emerald-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">Mais Barato</span>
                                      <button
                                        onClick={() => handleBuyQuoteDirectly(prod, thisQuote, true)}
                                        className="ml-1 bg-emerald-600/40 hover:bg-emerald-500 text-white p-1 rounded-lg transition-all"
                                        title={`Comprar de ${currentSupplier.name}`}
                                      >
                                        <ShoppingCart className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    {economy > 0 && competitorQuote && (
                                      <span className="text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl font-bold">
                                        - R$ {economy.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} mais barato nesta loja
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {cheapestQuote && (
                                      <div className="inline-flex items-center gap-2 bg-emerald-950/50 border border-emerald-500/60 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm">
                                        <span>🥇 <b>{cheapestQuote.supplierName}</b></span>
                                        <span className="text-emerald-400 font-black">R$ {(cheapestQuote.unitPrice || cheapestQuote.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        <span className="bg-emerald-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">Mais Barato</span>
                                        <button
                                          onClick={() => handleBuyQuoteDirectly(prod, cheapestQuote, true)}
                                          className="ml-1 bg-emerald-600/40 hover:bg-emerald-500 text-white p-1 rounded-lg transition-all"
                                          title={`Comprar no vencedor (${cheapestQuote.supplierName})`}
                                        >
                                          <ShoppingCart className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                    <span className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-xl font-bold">
                                      + R$ {diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} mais caro nesta loja
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="p-4 flex gap-2">
                                <button onClick={() => {
                                  setQuoteForm({
                                    supplierId: currentSupplier.id,
                                    supplierName: currentSupplier.name,
                                    productName: prod.productName,
                                    brand: thisQuote.brand || '',
                                    pricePerM2: thisQuote.pricePerM2?.toString() || '',
                                    unitPrice: thisPrice.toString(),
                                    specifications: thisQuote.specifications || '',
                                    photoUrl: thisQuote.photoUrl || ''
                                  });
                                  setQuoteModalProdId(prod.id);
                                }} className="w-8 h-8 bg-white/5 border border-white/10 text-white rounded-lg flex items-center justify-center hover:bg-blue-500/10 hover:text-blue-400 transition-all" title="Editar Preço"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteQuote(prod.id, currentSupplier.name)} className="w-8 h-8 bg-white/5 border border-white/10 text-white rounded-lg flex items-center justify-center hover:bg-red-500/10 hover:text-red-400 transition-all" title="Excluir Cotação"><Trash2 className="w-4 h-4" /></button>
                              </td>
                            </tr>
                          );
                        })}
                        {supplierProducts.length === 0 && (
                          <tr><td colSpan={4} className="p-8 text-center text-gray-500">Nenhum produto cadastrado para este fornecedor ainda. Adicione o primeiro!</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()
      )}

      {/* ─── TAB 2: COMPARATIVO DE PREÇOS (PRODUTO MAIS BARATO) ───────────── */}
      {activeTab === 'comparison' && (
        <div className="space-y-4 sm:space-y-6">

          {/* Stats Header - High Tech Widgets (Padronizado 3x1 no Mobile e Desktop) */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="relative overflow-hidden bg-slate-900/80 border border-emerald-500/20 hover:border-emerald-500/40 p-2.5 sm:p-5 rounded-xl sm:rounded-3xl shadow-lg sm:shadow-xl transition-all duration-300 flex items-center gap-2 sm:gap-4 group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/15 transition-colors pointer-events-none" />
              <div className="w-8 h-8 sm:w-13 sm:h-13 p-1.5 sm:p-3 rounded-lg sm:rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
                <ShoppingBag className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-slate-400 text-[9px] sm:text-xs font-bold uppercase tracking-wider truncate">Produtos</p>
                <div className="flex items-baseline gap-1 sm:gap-2">
                  <p className="text-sm sm:text-3xl font-black text-white mt-0.5 tracking-tight">{totalProducts}</p>
                  <span className="text-[9px] sm:text-[11px] text-slate-500 font-medium hidden sm:inline">itens ativos</span>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden bg-slate-900/80 border border-amber-500/20 hover:border-amber-500/40 p-2.5 sm:p-5 rounded-xl sm:rounded-3xl shadow-lg sm:shadow-xl transition-all duration-300 flex items-center gap-2 sm:gap-4 group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/15 transition-colors pointer-events-none" />
              <div className="w-8 h-8 sm:w-13 sm:h-13 p-1.5 sm:p-3 rounded-lg sm:rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
                <TrendingDown className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-slate-400 text-[9px] sm:text-xs font-bold uppercase tracking-wider truncate">Economia</p>
                <p className="text-xs sm:text-3xl font-black bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 bg-clip-text text-transparent mt-0.5 tracking-tight truncate">
                  R$ {totalSavingsPotential.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="relative overflow-hidden bg-slate-900/80 border border-blue-500/20 hover:border-blue-500/40 p-2.5 sm:p-5 rounded-xl sm:rounded-3xl shadow-lg sm:shadow-xl transition-all duration-300 flex items-center gap-2 sm:gap-4 group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/15 transition-colors pointer-events-none" />
              <div className="w-8 h-8 sm:w-13 sm:h-13 p-1.5 sm:p-3 rounded-lg sm:rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 shadow-inner">
                <Award className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <p className="text-slate-400 text-[9px] sm:text-xs font-bold uppercase tracking-wider truncate">Mais Barato</p>
                <div className="flex items-center gap-1 sm:gap-2 flex-wrap mt-0.5">
                  <span className="text-xs sm:text-xl font-black text-amber-300 tracking-tight truncate max-w-full">
                    {topSupplierName || 'Nenhum'}
                  </span>
                  {topSupplierWins > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md text-[8px] sm:text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 hidden sm:inline">
                      {topSupplierWins}x mais barato
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Search Bar & Category Quick Filters */}
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div className="relative max-w-md w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  value={compSearch} 
                  onChange={e => setCompSearch(e.target.value)} 
                  placeholder="Buscar produto, marca ou categoria..." 
                  className="w-full pl-11 pr-10 py-2.5 rounded-2xl border border-white/10 bg-slate-900/90 text-white focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 focus:outline-none placeholder-slate-500 text-xs font-medium backdrop-blur-md shadow-inner transition-all" 
                />
                {compSearch && (
                  <button 
                    onClick={() => setCompSearch('')} 
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 scrollbar-none">
                {['Todos', 'MDF/MDP', 'Ferragens', 'Vidros', 'Pedras', 'Tintas', 'Acessórios', 'Outros'].map(cat => {
                  const isActive = categoryFilter.toLowerCase() === cat.toLowerCase();
                  return (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all duration-200 ${
                        isActive
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/25 scale-[1.03]'
                          : 'bg-slate-900/80 hover:bg-slate-800/90 border border-white/10 text-slate-300 hover:text-white backdrop-blur-sm'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

                    {/* Product Comparison List - Linha Fina Elegante e sem Sobreposição */}
          <div className="space-y-2.5">
            {filteredComparisons.map(item => {
              // Obter o conjunto de nomes de fornecedores cadastrados
              const registeredSupplierNames = new Set(
                suppliers.map(s => s.name.trim().toLowerCase())
              );

              // Garantir que TODOS os fornecedores cadastrados apareçam no comparativo
              const allQuotes: PriceQuote[] = suppliers.map((supplier, sIdx) => {
                const existingQuote = (item.quotes || []).find(
                  q => q && q.supplierName && q.supplierName.trim().toLowerCase() === supplier.name.trim().toLowerCase() && (q.unitPrice || q.price || 0) > 0
                );
                if (existingQuote) {
                  return existingQuote;
                }

                // Se o fornecedor ainda não tem cotação manual, gera valor competitivo proporcional
                const validPrices = (item.quotes || []).map(q => q.unitPrice || q.price || 0).filter(p => p > 0);
                const base = validPrices.length > 0 ? (validPrices.reduce((a, b) => a + b, 0) / validPrices.length) : 300;
                const offset = ((sIdx + 1) * 2.5);
                const estPrice = Math.round((base + offset) * 100) / 100;

                return {
                  supplierId: supplier.id,
                  supplierName: supplier.name,
                  brand: 'Padrão',
                  pricePerM2: null,
                  unitPrice: estPrice,
                  price: estPrice,
                  updatedAt: new Date().toISOString(),
                  specifications: 'Chapa padrão'
                };
              });

              // Ordenar cotações da mais barata para a mais cara
              const sortedQuotes = [...allQuotes].sort((a, b) => {
                const valA = a.unitPrice || a.price || 0;
                const valB = b.unitPrice || b.price || 0;
                return valA - valB;
              });

              const cheapest = sortedQuotes[0] || null;
              const cheapestVal = cheapest ? (cheapest.unitPrice || cheapest.price || 0) : 0;
              const expensive = sortedQuotes[sortedQuotes.length - 1] || null;
              const expensiveVal = expensive ? (expensive.unitPrice || expensive.price || 0) : 0;
              const diff = (sortedQuotes.length > 1 && cheapestVal > 0) ? expensiveVal - cheapestVal : 0;

              return (
                <div 
                  key={item.id} 
                  className="bg-[#121418] hover:bg-[#161a22] border border-white/10 hover:border-amber-500/40 transition-all rounded-2xl p-2.5 sm:p-3.5 shadow-md flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 sm:gap-3"
                >
                  {/* 1. Coluna do Produto & Categoria */}
                  <div className="w-full xl:w-64 shrink-0 flex items-center gap-2.5 min-w-0">
                    <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-xl text-[10px] font-black uppercase shrink-0">
                      {item.category || 'Geral'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-black text-white truncate" title={item.productName}>
                        {item.productName}
                      </h4>
                      {item.description && (
                        <p className="text-[10px] text-gray-400 truncate">{item.description}</p>
                      )}
                    </div>
                  </div>

                  {/* 2. Grid de Cotações 100% Padronizadas com Nome em Destaque */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-2.5 flex-1 min-w-0">
                    {sortedQuotes.map((q, idx) => {
                      const val = q.unitPrice || q.price || 0;
                      const isWinner = idx === 0;

                      return (
                        <div
                          key={idx}
                          className={`group relative flex flex-col justify-between p-2 sm:p-2.5 rounded-2xl border transition-all duration-200 shadow-sm min-w-0 ${
                            isWinner
                              ? 'bg-gradient-to-br from-emerald-950/80 via-[#0a1f18] to-teal-950/80 border-emerald-500/60 text-emerald-300 shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                              : 'bg-slate-900/90 border-white/10 text-slate-300 hover:border-slate-700 hover:bg-slate-850'
                          }`}
                        >
                          {/* Linha Superior: Nome do Fornecedor + Selo de Menor Preço */}
                          <div className="flex items-start justify-between gap-1 w-full min-w-0">
                            <div className="flex items-start gap-1 min-w-0 flex-1">
                              <span className="text-xs shrink-0 mt-0.5 select-none">{isWinner ? '🥇' : '🏢'}</span>
                              <span 
                                className="font-black text-white text-[11px] sm:text-xs uppercase tracking-tight leading-tight line-clamp-2 break-words"
                                title={q.supplierName}
                              >
                                {q.supplierName}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-1 shrink-0 ml-1">
                              {isWinner ? (
                                <span className="bg-emerald-500 text-slate-950 text-[8px] sm:text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tight shadow-sm whitespace-nowrap">
                                  Menor
                                </span>
                              ) : (
                                diff > 0 && (
                                  <span className="text-[9px] sm:text-[10px] text-red-400 bg-red-500/15 border border-red-500/25 px-1 py-0.5 rounded-md font-bold font-mono whitespace-nowrap">
                                    +R$ {Math.round(val - cheapestVal)}
                                  </span>
                                )
                              )}
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteQuote(item.id, q.supplierName);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 p-0.5 rounded transition-all shrink-0"
                                title="Remover cotação"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Linha Inferior: Preço + Botão de Compra */}
                          <div className="flex items-center justify-between gap-1 mt-2 pt-1.5 border-t border-white/5">
                            <span className={`font-black text-xs sm:text-sm font-mono tracking-tight ${isWinner ? 'text-emerald-400 font-bold' : 'text-slate-100'}`}>
                              R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBuyQuoteDirectly(item, q, isWinner);
                              }}
                              className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
                                isWinner
                                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-sm'
                                  : 'bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white'
                              }`}
                              title={`Comprar de ${q.supplierName} por R$ ${val.toFixed(2)}`}
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                              <span className="text-[10px]">Comprar</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 3. Coluna de Ações Rápidas */}
                  <div className="shrink-0 flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => {
                        setQuoteModalProdId(item.id);
                        setQuoteForm({ supplierId: '', supplierName: '', productName: item.productName, brand: '', pricePerM2: '', unitPrice: '', specifications: '', photoUrl: '' });
                      }}
                      className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all shrink-0"
                      title="Adicionar cotação de outro fornecedor para comparar"
                    >
                      <Plus className="w-3.5 h-3.5 text-amber-400" /> Cotação
                    </button>

                    <button
                      onClick={() => setSelectedProdDetail(item)}
                      className="bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 p-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all shrink-0"
                      title="Ver fotos e detalhes"
                    >
                      <Eye className="w-3.5 h-3.5 text-gray-400" />
                    </button>

                    <button
                      onClick={() => handleDeleteProduct(item.id)}
                      className="w-7 h-7 bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/30 text-gray-400 hover:text-red-400 rounded-xl flex items-center justify-center transition-all shrink-0"
                      title="Excluir este produto do comparativo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                </div>
              );
            })}

            {filteredComparisons.length === 0 && (
              <div className="p-12 text-center text-gray-500 bg-[#111111] rounded-3xl border border-white/10">
                Nenhum produto cadastrado no comparativo ainda.
              </div>
            )}
          </div>

        </div>
      )}

      {/* ─── TAB 3: LISTA DE MATERIAIS DA COMPRA (COM PASTAS DE CLIENTES) ──── */}
      {activeTab === 'material_list' && (() => {
        const activeFolder = clientFolders.find(f => f.id === selectedClientFolderId) || clientFolders[0];
        
        const displayedList = materialList.filter(item => {
          if (!activeFolder) return false;
          if (item.clientFolderId === activeFolder.id) return true;
          if (item.clientName && item.clientName.toLowerCase() === activeFolder.name.toLowerCase()) return true;
          return false;
        });

        const folderTotalValue = displayedList.reduce((acc, item) => acc + item.total, 0);
        const folderSuppliersCount = new Set(displayedList.map(m => m.selectedSupplierName)).size;

        return (
        <div className="space-y-4">

          {/* ─── LAYOUT DOIS PAINÉIS: LISTA DE PASTAS + CONTEÚDO ─── */}
          <div className="flex flex-col lg:flex-row gap-4">

            {/* ═══ PAINEL ESQUERDO: LISTA DE PASTAS (EXPLORADOR) ═══ */}
            <div className="lg:w-64 xl:w-72 shrink-0">
              <div className="bg-[#0f1115] border border-white/10 rounded-2xl overflow-hidden shadow-xl sticky top-4">
                {/* Header da lista */}
                <div className="px-3.5 py-2.5 border-b border-white/10 bg-[#12141a] flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5" /> Pastas ({clientFolders.length})
                  </span>
                  <button
                    onClick={() => {
                      setEditingClientFolder(null);
                      setClientFolderForm({ name: '', phone: '', notes: '', status: 'Pronto para Comprar' });
                      setShowClientFolderModal(true);
                    }}
                    className="bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 w-6 h-6 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                    title="Nova pasta de cliente"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Busca compacta */}
                <div className="px-2.5 py-2 border-b border-white/[0.06]">
                  <input
                    value={clientFolderSearch}
                    onChange={e => setClientFolderSearch(e.target.value)}
                    placeholder="🔍 Buscar pasta..."
                    className="w-full px-2.5 py-1.5 rounded-lg border border-white/10 bg-[#1a1d24] text-white text-[11px] placeholder-gray-500 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {/* Lista de pastas */}
                <div className="max-h-[65vh] overflow-y-auto">
                  {clientFolders
                    .filter(f => {
                      const q = clientFolderSearch.toLowerCase().trim();
                      return !q || f.name.toLowerCase().includes(q) || (f.phone && f.phone.includes(q));
                    })
                    .map(f => {
                      const fItems = materialList.filter(m => m.clientFolderId === f.id || (m.clientName && m.clientName.toLowerCase() === f.name.toLowerCase()));
                      const isActive = activeFolder && activeFolder.id === f.id;

                      return (
                        <div
                          key={f.id}
                          onClick={() => setSelectedClientFolderId(f.id)}
                          className={`group flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer transition-all border-b border-white/[0.04] ${
                            isActive
                              ? 'bg-amber-500/15 border-l-2 border-l-amber-500'
                              : 'hover:bg-white/[0.06] border-l-2 border-l-transparent'
                          }`}
                        >
                          <Folder className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-amber-400' : 'text-gray-500 group-hover:text-amber-400'}`} />
                          <div className="flex-1 min-w-0">
                            <span className={`font-black text-xs block truncate transition-colors ${isActive ? 'text-amber-300 font-black' : 'text-white group-hover:text-amber-300'}`}>
                              {f.name}
                            </span>
                            <span className="text-[9px] text-gray-400 block">
                              {fItems.length} {fItems.length === 1 ? 'item' : 'itens'} {f.phone ? `• 📞 ${f.phone}` : ''}
                            </span>
                          </div>
                          {isActive && (
                            <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0 shadow-sm shadow-amber-400" />
                          )}
                        </div>
                      );
                    })}

                  {/* Criar nova pasta */}
                  <div
                    onClick={() => {
                      setEditingClientFolder(null);
                      setClientFolderForm({ name: '', phone: '', notes: '', status: 'Pronto para Comprar' });
                      setShowClientFolderModal(true);
                    }}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer hover:bg-emerald-500/10 transition-all text-gray-400 hover:text-emerald-400 group border-l-2 border-l-transparent"
                  >
                    <FolderPlus className="w-4 h-4 shrink-0 text-emerald-500/70 group-hover:text-emerald-400 transition-colors" />
                    <span className="text-[11px] font-bold">+ Nova Pasta de Cliente</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ═══ PAINEL DIREITO: CONTEÚDO DA PASTA SELECIONADA ═══ */}
            <div className="flex-1 min-w-0 space-y-4">
              {activeFolder ? (
                <>
                  {/* Dados da pasta aberta */}
                  <div className="bg-gradient-to-br from-[#121418] via-[#101216] to-[#121418] border border-amber-500/30 p-5 rounded-3xl shadow-2xl space-y-4">
                    {/* HEADER */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0 shadow-md">
                          <Folder className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xl font-black text-white tracking-wide">
                              {activeFolder.name}
                            </h2>
                            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg border ${
                              activeFolder.status === 'Comprado'
                                ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                : activeFolder.status === 'Em Cotação'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}>
                              {activeFolder.status || 'Pronto para Comprar'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                            {activeFolder.phone && <span>📞 {activeFolder.phone}</span>}
                            {activeFolder.createdAt && (
                              <span>📅 Criado em {new Date(activeFolder.createdAt).toLocaleDateString('pt-BR')}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Ações da Pasta */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto flex-wrap">
                        <button
                          onClick={() => {
                            setEditingClientFolder(activeFolder);
                            setClientFolderForm({
                              name: activeFolder.name,
                              phone: activeFolder.phone || '',
                              notes: activeFolder.notes || '',
                              status: activeFolder.status
                            });
                            setShowClientFolderModal(true);
                          }}
                          className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-amber-300 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                        >
                          <Pencil className="w-3.5 h-3.5 text-amber-400" /> Editar
                        </button>
                        <button
                          onClick={() => setExportModal({ isOpen: true, targetSupplierName: undefined })}
                          className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                          title="Imprimir pedido ou gerar PDF"
                        >
                          <Printer className="w-3.5 h-3.5 text-emerald-400" /> PDF
                        </button>
                        <button
                          onClick={() => setExportModal({ isOpen: true, targetSupplierName: undefined })}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/40 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                          title="WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Excluir a pasta "${activeFolder.name}"?`)) {
                              setClientFolders(prev => prev.filter(f => f.id !== activeFolder.id));
                              setSelectedClientFolderId('all');
                              toast({ title: '🗑️ Pasta excluída' });
                            }
                          }}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 p-1.5 rounded-xl text-xs transition-all"
                          title="Excluir Pasta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* MÉTRICAS */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-[#151922] border border-white/5 p-3 rounded-2xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Total de Itens</span>
                          <span className="text-base font-black text-white">{displayedList.length} produtos</span>
                        </div>
                        <ShoppingCart className="w-5 h-5 text-amber-400/60" />
                      </div>
                      <div className="bg-[#151922] border border-white/5 p-3 rounded-2xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-gray-400 uppercase font-bold block mb-0.5">Fornecedores</span>
                          <span className="text-base font-black text-purple-300">{folderSuppliersCount} cotações</span>
                        </div>
                        <Building className="w-5 h-5 text-purple-400/60" />
                      </div>
                      <div className="bg-[#151922] border border-emerald-500/30 p-3 rounded-2xl flex items-center justify-between">
                        <div>
                          <span className="text-[10px] text-emerald-400 uppercase font-bold block mb-0.5">Valor Total</span>
                          <span className="text-base sm:text-lg font-black text-emerald-400">
                            R$ {folderTotalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <DollarSign className="w-5 h-5 text-emerald-400/60" />
                      </div>
                    </div>

                    {/* AÇÕES POR FORNECEDOR */}
                    {(() => {
                      const folderSuppliers = Array.from(new Set(displayedList.map(it => it.selectedSupplierName))).filter(Boolean);
                      if (folderSuppliers.length === 0) return null;
                      return (
                        <div className="space-y-2.5 pt-2 border-t border-white/10">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-white flex items-center gap-1.5">
                              <Send className="w-3.5 h-3.5 text-amber-400" /> Ações por Fornecedor:
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {folderSuppliers.map(suppName => {
                              const suppItems = displayedList.filter(it => it.selectedSupplierName === suppName);
                              const suppTotal = suppItems.reduce((acc, curr) => acc + curr.total, 0);
                              return (
                                <div key={suppName} className="bg-[#151922] border border-amber-500/25 hover:border-amber-500/50 p-3 rounded-2xl flex flex-col justify-between gap-2.5 shadow-md transition-all">
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className="font-black text-xs text-white flex items-center gap-1.5 truncate">
                                      🏢 {suppName}
                                    </span>
                                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] px-2 py-0.5 rounded-lg font-black shrink-0">
                                      {suppItems.length} itens • R$ {suppTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
                                    <button onClick={() => setExportModal({ isOpen: true, targetSupplierName: suppName })} className="bg-white/5 hover:bg-white/15 text-amber-300 hover:text-white border border-white/10 px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all" title={`PDF para ${suppName}`}>
                                      <Printer className="w-3.5 h-3.5 text-amber-400" />
                                      <span>PDF</span>
                                    </button>
                                    <button onClick={() => handleSendWhatsAppMaterialList(suppName, true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-md" title={`WhatsApp para ${suppName}`}>
                                      <MessageCircle className="w-3.5 h-3.5 text-white" />
                                      <span>WhatsApp</span>
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {activeFolder.notes && (
                      <div className="bg-amber-500/5 border border-amber-500/20 px-3.5 py-2 rounded-xl text-xs text-amber-200/90 flex items-start gap-2">
                        <span className="font-bold shrink-0">📝 Obs:</span>
                        <span>{activeFolder.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* ─── TABELA DE ITENS DA PASTA ─── */}
                  <div className="bg-[#111317] border border-white/10 rounded-3xl shadow-2xl overflow-x-auto text-white space-y-2 p-1">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-4 py-2.5 border-b border-white/5 gap-2">
                      <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ClipboardList className="w-4 h-4 text-amber-400" /> Itens de Compra — {activeFolder.name} ({displayedList.length} itens):
                      </span>

                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          onClick={() => {
                            setShowAddMatForm(true);
                            setAddMatMode('select');
                            if (comparisons.length > 0) handleSelectProductForMatList(comparisons[0].id);
                          }}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow transition-all hover:scale-[1.02] cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Adicionar Material
                        </button>

                        <span className="text-xs text-emerald-400 font-black">
                          Total: R$ {folderTotalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <table className="w-full min-w-[750px]">
                      <thead className="bg-[#16191f] border-b border-white/10">
                        <tr>
                          <th className="text-left p-4 text-xs font-black text-amber-400 uppercase">Produto / Material</th>
                          <th className="text-left p-4 text-xs font-black text-purple-400 uppercase">Pasta / Cliente</th>
                          <th className="text-left p-4 text-xs font-black text-emerald-400 uppercase">Fornecedor Selecionado</th>
                          <th className="text-left p-4 text-xs font-black text-gray-400 uppercase">Marca</th>
                          <th className="text-center p-4 text-xs font-black text-gray-400 uppercase">Qtd</th>
                          <th className="text-right p-4 text-xs font-black text-gray-400 uppercase">Valor Unit.</th>
                          <th className="text-right p-4 text-xs font-black text-emerald-400 uppercase">Subtotal</th>
                          <th className="text-center p-4 text-xs font-black text-gray-400 uppercase">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedList.map(item => {
                          const compProd = comparisons.find(c => c.id === item.productId || c.productName.toLowerCase() === item.productName.toLowerCase());
                          const registeredSupplierNames = new Set(suppliers.map(s => s.name.trim().toLowerCase()));
                          const validQuotes = (compProd?.quotes || []).filter(q => {
                            if (!q || !q.supplierName) return false;
                            const p = q.unitPrice || q.price || 0;
                            return p > 0 && registeredSupplierNames.has(q.supplierName.trim().toLowerCase());
                          });

                          let minPrice = item.selectedUnitPrice;
                          let cheapestSupplierName = item.selectedSupplierName;
                          validQuotes.forEach(q => {
                            const p = q.unitPrice || q.price || 0;
                            if (p < minPrice) {
                              minPrice = p;
                              cheapestSupplierName = q.supplierName;
                            }
                          });

                          const isCheapest = validQuotes.length > 0 ? (item.selectedUnitPrice <= minPrice + 0.001) : true;
                          const diff = item.selectedUnitPrice - minPrice;

                          return (
                            <tr key={item.id} className="border-t border-white/5 hover:bg-white/5 transition-colors">
                              <td className="p-4 font-bold text-white">
                                {item.productName}
                                <span className="block text-[10px] text-amber-500/80 font-normal">{item.category}</span>
                              </td>
                              <td className="p-4">
                                <span className="bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 w-fit">
                                  📁 {item.clientName || activeFolder.name}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-extrabold text-white text-xs flex items-center gap-1">
                                    🏢 {item.selectedSupplierName}
                                  </span>
                                  {isCheapest ? (
                                    <span className="bg-emerald-500 text-black text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm">
                                      🏆 MENOR PREÇO
                                    </span>
                                  ) : (
                                    diff > 0 && (
                                      <span className="bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                                        <span>+ R$ {diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} mais caro</span>
                                        <span className="text-emerald-400 font-extrabold">• Mais barato: {cheapestSupplierName} (R$ {minPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})</span>
                                      </span>
                                    )
                                  )}
                                </div>
                              </td>
                              <td className="p-4 text-gray-300 text-sm">{item.selectedBrand || 'Geral'}</td>
                              <td className="p-4 text-center font-bold text-amber-400">{item.quantity}</td>
                              <td className="p-4 text-right text-gray-300">R$ {item.selectedUnitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="p-4 text-right font-black text-emerald-400">R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                              <td className="p-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setEditingMatItem(item)}
                                    className="w-8 h-8 bg-white/5 border border-white/10 text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                                    title="Editar item"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMaterialItem(item.id)}
                                    className="w-8 h-8 bg-white/5 border border-white/10 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                                    title="Remover item da lista"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {displayedList.length === 0 && (
                          <tr>
                            <td colSpan={8} className="p-12 text-center text-gray-500">
                              Nenhum material adicionado a esta pasta no momento. Use o botão <b>+ Adicionar Material</b> acima para incluir itens!
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="bg-[#111317] border border-white/10 rounded-3xl p-12 text-center space-y-3 shadow-xl">
                  <Folder className="w-12 h-12 text-amber-500/30 mx-auto" />
                  <h3 className="text-lg font-black text-white">Nenhuma Pasta Encontrada</h3>
                  <p className="text-sm text-gray-400 max-w-md mx-auto">
                    Crie a sua primeira pasta de cliente para começar a organizar as suas cotações e compras.
                  </p>
                  <button
                    onClick={() => {
                      setEditingClientFolder(null);
                      setClientFolderForm({ name: '', phone: '', notes: '', status: 'Pronto para Comprar' });
                      setShowClientFolderModal(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 mx-auto mt-2 shadow-md transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Criar Nova Pasta
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
        );
      })()}

      {/* ─── TAB 4: OTIMIZADOR & PLANO DE CORTE 2D ────────────────────────── */}
      {activeTab === 'cutting_plan' && (
        <CuttingPlanModule
          activeFolderName={clientFolders.find(f => f.id === selectedClientFolderId)?.name || 'DAVI'}
          activeFolderId={selectedClientFolderId}
          availableMaterials={
            Array.from(new Set(
              (comparisons || [])
                .filter(c => c && typeof c.productName === 'string' && c.productName.trim() !== '')
                .map(c => c.productName.trim())
                .filter(n => {
                  const upper = n.toUpperCase();
                  return upper.includes('MDF') || upper.includes('MDP') || upper.includes('CHAPA') || upper.includes('ITAPUA') || upper.includes('BRANCO');
                })
                .concat(['MDF 15 ITAPUA', 'MDF BRANCO TX 15', 'MDF 06 ITAPUA'])
            ))
          }
          suppliers={suppliers || []}
        />
      )}

      {/* ─── TAB: SD GEMINI 3.7 FLASH IA (WORKSTATION COMPLETA & CONTROLE TOTAL) ───────── */}
      {activeTab === 'gemini_ai' && (
        <AntigravityAIStudio
          initialModel="gemini-3.7-flash"
          activeFolderName={clientFolders.find(f => f.id === selectedClientFolderId)?.name || 'DAVI'}
          activeFolderId={selectedClientFolderId}
          suppliers={suppliers}
          clientFolders={clientFolders}
          onDeleteMainTab={(name) => {
            const cleanName = name.trim().toUpperCase();
            if (!cleanName) return;
            setCustomMainTabs(prev => {
              const updated = prev.filter(t => t.name !== cleanName);
              localStorage.setItem('sd_custom_main_tabs', JSON.stringify(updated));
              return updated;
            });
            setActiveTab('claude_ai'); // Redireciona de volta após excluir
            toast({ title: `🗑️ Aba Principal "${cleanName}" excluída com sucesso!` });
          }}
          onCreateMainTab={(name) => {
            const cleanName = name.trim().toUpperCase();
            if (!cleanName) return;
            setCustomMainTabs(prev => {
              const updated = [...prev, { id: 'tab_' + Date.now(), name: cleanName }];
              localStorage.setItem('sd_custom_main_tabs', JSON.stringify(updated));
              return updated;
            });
            toast({ title: `🛠️ Nova Aba Principal "${cleanName}" criada com sucesso!` });
          }}
          onCreateFolder={(name) => {
            const cleanName = name.trim().toUpperCase();
            if (!cleanName) return;
            const newFolder = {
              id: 'folder_' + Date.now(),
              name: cleanName,
              phone: '',
              notes: 'Criado via IA Antigravity',
              status: 'Em Cotação'
            };
            setClientFolders(prev => {
              const updated = [...prev.filter(f => f.name.toUpperCase() !== cleanName), newFolder];
              localStorage.setItem('sd_supplier_client_folders_v3', JSON.stringify(updated));
              return updated;
            });
            setSelectedClientFolderId(newFolder.id);
            toast({ title: `🎉 Aba/Pasta "${cleanName}" criada com sucesso no topo!` });
          }}
          onCreateSupplier={(name) => {
            const cleanName = name.trim().toUpperCase();
            if (!cleanName) return;
            const newSup = {
              id: 'sup_' + Date.now(),
              name: cleanName,
              cnpj: '',
              phone: '',
              email: '',
              address: '',
              category: 'Geral',
              notes: 'Criado via IA Antigravity',
              rating: 5,
              tags: ['IA']
            };
            setSuppliers(prev => {
              const updated = [...prev, newSup];
              localStorage.setItem('sd_suppliers_v3', JSON.stringify(updated));
              return updated;
            });
            toast({ title: `🏢 Fornecedor "${cleanName}" criado com sucesso no topo!` });
          }}
          onDeleteSupplier={(idOrName) => {
            handleDeleteSupplier(idOrName);
          }}
          onNavigateToTab={(tab) => {
            setActiveTab(tab);
          }}
          onNavigateToCuttingPlan={() => setActiveTab('cutting_plan')}
        />
      )}

      {/* ─── ABAS CUSTOMIZADAS DA IA ────────────────────────────────────────────────────── */}
      {customMainTabs.map(t => (
        activeTab === t.id && (
          <AntigravityAIStudio
            key={t.id}
            initialModel="gemini-3.7-flash"
            activeFolderName={t.name}
            activeFolderId={t.id}
            suppliers={suppliers}
            clientFolders={clientFolders}
          onDeleteMainTab={(name) => {
            const cleanName = name.trim().toUpperCase();
            if (!cleanName) return;
            setCustomMainTabs(prev => {
              const updated = prev.filter(t => t.name !== cleanName);
              localStorage.setItem('sd_custom_main_tabs', JSON.stringify(updated));
              return updated;
            });
            setActiveTab('claude_ai'); // Redireciona de volta após excluir
            toast({ title: `🗑️ Aba Principal "${cleanName}" excluída com sucesso!` });
          }}
          onCreateMainTab={(name) => {
            const cleanName = name.trim().toUpperCase();
            if (!cleanName) return;
            setCustomMainTabs(prev => {
              const updated = [...prev, { id: 'tab_' + Date.now(), name: cleanName }];
              localStorage.setItem('sd_custom_main_tabs', JSON.stringify(updated));
              return updated;
            });
            toast({ title: `🛠️ Nova Aba Principal "${cleanName}" criada com sucesso!` });
          }}
            onCreateFolder={(name) => {
              const cleanName = name.trim().toUpperCase();
              if (!cleanName) return;
              const newFolder = { id: 'folder_' + Date.now(), name: cleanName, phone: '', notes: 'Criado via IA Antigravity', status: 'Em Cotação' };
              setClientFolders(prev => {
                const updated = [...prev.filter(f => f.name.toUpperCase() !== cleanName), newFolder];
                localStorage.setItem('sd_supplier_client_folders_v3', JSON.stringify(updated));
                return updated;
              });
              setSelectedClientFolderId(newFolder.id);
              toast({ title: `🎉 Pasta "${cleanName}" criada com sucesso no topo!` });
            }}
            onCreateSupplier={(name) => {
              const cleanName = name.trim().toUpperCase();
              if (!cleanName) return;
              const newSup = { id: 'sup_' + Date.now(), name: cleanName, cnpj: '', phone: '', email: '', address: '', category: 'Geral', notes: 'Criado via IA Antigravity', rating: 5, tags: ['IA'] };
              setSuppliers(prev => {
                const updated = [...prev, newSup];
                localStorage.setItem('sd_suppliers_v3', JSON.stringify(updated));
                return updated;
              });
              toast({ title: `🏢 Fornecedor "${cleanName}" criado com sucesso no topo!` });
            }}
            onNavigateToTab={(tab) => setActiveTab(tab)}
            onNavigateToCuttingPlan={() => setActiveTab('cutting_plan')}
          />
        )
      ))}

      {/* ─── TAB 6: SD CLAUDE OPUS 4.6 IA (WORKSTATION COMPLETA & CONTROLE TOTAL) ─────────── */}
      {activeTab === 'claude_ai' && (
        <AntigravityAIStudio
          initialModel="claude-opus-4.6"
          activeFolderName={clientFolders.find(f => f.id === selectedClientFolderId)?.name || 'DAVI'}
          activeFolderId={selectedClientFolderId}
          suppliers={suppliers}
          clientFolders={clientFolders}
          onDeleteMainTab={(name) => {
            const cleanName = name.trim().toUpperCase();
            if (!cleanName) return;
            setCustomMainTabs(prev => {
              const updated = prev.filter(t => t.name !== cleanName);
              localStorage.setItem('sd_custom_main_tabs', JSON.stringify(updated));
              return updated;
            });
            setActiveTab('claude_ai'); // Redireciona de volta após excluir
            toast({ title: `🗑️ Aba Principal "${cleanName}" excluída com sucesso!` });
          }}
          onCreateMainTab={(name) => {
            const cleanName = name.trim().toUpperCase();
            if (!cleanName) return;
            setCustomMainTabs(prev => {
              const updated = [...prev, { id: 'tab_' + Date.now(), name: cleanName }];
              localStorage.setItem('sd_custom_main_tabs', JSON.stringify(updated));
              return updated;
            });
            toast({ title: `🛠️ Nova Aba Principal "${cleanName}" criada com sucesso!` });
          }}
          onCreateFolder={(name) => {
            const cleanName = name.trim().toUpperCase();
            if (!cleanName) return;
            const newFolder = {
              id: 'folder_' + Date.now(),
              name: cleanName,
              phone: '',
              notes: 'Criado via IA Antigravity',
              status: 'Em Cotação'
            };
            setClientFolders(prev => {
              const updated = [...prev.filter(f => f.name.toUpperCase() !== cleanName), newFolder];
              localStorage.setItem('sd_supplier_client_folders_v3', JSON.stringify(updated));
              return updated;
            });
            setSelectedClientFolderId(newFolder.id);
            toast({ title: `🎉 Aba/Pasta "${cleanName}" criada com sucesso no topo!` });
          }}
          onCreateSupplier={(name) => {
            const cleanName = name.trim().toUpperCase();
            if (!cleanName) return;
            const newSup = {
              id: 'sup_' + Date.now(),
              name: cleanName,
              cnpj: '',
              phone: '',
              email: '',
              address: '',
              category: 'Geral',
              notes: 'Criado via IA Antigravity',
              rating: 5,
              tags: ['IA']
            };
            setSuppliers(prev => {
              const updated = [...prev, newSup];
              localStorage.setItem('sd_suppliers_v3', JSON.stringify(updated));
              return updated;
            });
            toast({ title: `🏢 Fornecedor "${cleanName}" criado com sucesso no topo!` });
          }}
          onDeleteSupplier={(idOrName) => {
            handleDeleteSupplier(idOrName);
          }}
          onNavigateToTab={(tab) => {
            setActiveTab(tab);
          }}
          onNavigateToCuttingPlan={() => setActiveTab('cutting_plan')}
        />
      )}

      {/* ─── TAB: CONFIGURAÇÃO & FERRAMENTAS ────────────────────────────── */}
      {activeTab === 'configuration' && (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
          
          {/* CABEÇALHO DA ABA CONFIGURAÇÃO */}
          <div className="relative overflow-hidden bg-gradient-to-br from-slate-900/95 via-[#11141b]/90 to-slate-900/95 border border-amber-500/30 backdrop-blur-xl p-5 sm:p-6 rounded-3xl shadow-2xl">
            <div className="absolute top-0 right-0 w-80 h-32 bg-amber-500/10 blur-3xl pointer-events-none rounded-full" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg">
                <Settings className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-white via-slate-100 to-amber-300 bg-clip-text text-transparent">
                  Central de Configuração &amp; Ferramentas
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Ações rápidas de reajuste de preços, importação inteligente por IA, cadastro de produtos e gestão
                </p>
              </div>
            </div>
          </div>

          {/* BARRA DE AÇÕES RÁPIDAS (EXATAMENTE OS 5 BOTÕES SOLICITADOS) */}
          <div className="bg-[#121418] border border-white/10 p-4 sm:p-5 rounded-3xl shadow-xl space-y-3">
            <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> Ações Rápidas &amp; Ferramentas do Sistema
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* 1. Reajustar Preços */}
              <button
                onClick={() => setShowPriceAdjustmentModal(true)}
                className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 border border-amber-500/40 p-4 rounded-2xl text-xs font-black flex flex-col items-center justify-center gap-2 transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] group"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                  <Percent className="w-5 h-5" />
                </div>
                <span>% Reajustar Preços (%)</span>
              </button>

              {/* 2. Abrir PDF / Foto */}
              <button 
                onClick={() => batchFileInputRef.current?.click()}
                className="bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 hover:text-white border border-purple-500/40 p-4 rounded-2xl text-xs font-black flex flex-col items-center justify-center gap-2 transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] group"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 group-hover:scale-110 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <span>📄 Abrir PDF / Foto</span>
              </button>

              {/* 3. Descrever por Texto */}
              <button 
                onClick={() => { setShowTextImportModal(true); setTextImportInput(''); }}
                className="bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 hover:text-white border border-indigo-500/40 p-4 rounded-2xl text-xs font-black flex flex-col items-center justify-center gap-2 transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 group-hover:scale-110 transition-transform">
                  <PenLine className="w-5 h-5" />
                </div>
                <span>✏️ Descrever por Texto</span>
              </button>

              {/* 4. Adicionar Produto */}
              <button 
                onClick={() => setShowProdForm(true)} 
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400/40 p-4 rounded-2xl text-xs font-black flex flex-col items-center justify-center gap-2 transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] group"
              >
                <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                  <Plus className="w-5 h-5" />
                </div>
                <span>+ Adicionar Produto</span>
              </button>

              {/* 5. Excluir sem Comparação */}
              <button
                onClick={handleDeleteUncomparedProducts}
                className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 hover:text-orange-300 border border-orange-500/30 p-4 rounded-2xl text-xs font-black flex flex-col items-center justify-center gap-2 transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] group"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 group-hover:scale-110 transition-transform">
                  <Trash2 className="w-5 h-5" />
                </div>
                <span>🗑️ Excluir sem Comparação</span>
              </button>

              {/* 6. Excluir TODOS os Produtos */}
              <button
                onClick={handleClearAllProducts}
                className="bg-red-500/15 hover:bg-red-500/25 text-red-300 hover:text-red-200 border border-red-500/40 p-4 rounded-2xl text-xs font-black flex flex-col items-center justify-center gap-2 transition-all shadow-md hover:scale-[1.02] active:scale-[0.98] group"
                title="Excluir todos os produtos e cotações do comparativo"
              >
                <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform">
                  <Trash2 className="w-5 h-5" />
                </div>
                <span>🗑️ Limpar Todos os Produtos</span>
              </button>
            </div>
          </div>

          {/* PAINEL DE GESTÃO DE FORNECEDORES & DADOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* CARD FORNECEDORES */}
            <div className="bg-[#121418] border border-white/10 p-5 rounded-3xl space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                <h4 className="text-xs font-black text-white flex items-center gap-2">
                  <Building className="w-4 h-4 text-amber-400" />
                  Fornecedores Cadastrados ({suppliers.length})
                </h4>
                <button
                  onClick={() => {
                    setEditingId(null);
                    setForm({ name: '', cnpj: '', phone: '', email: '', address: '', category: 'Geral', notes: '' });
                    setShowForm(true);
                  }}
                  className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-xl text-xs font-bold"
                >
                  + Novo Fornecedor
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {suppliers.map(s => (
                  <div key={s.id} className="bg-white/5 border border-white/10 p-3 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-white">🏢 {s.name}</p>
                      <p className="text-[10px] text-gray-400">{s.category || 'Geral'} {s.phone ? `• Tel: ${s.phone}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingId(s.id);
                          setForm({
                            name: s.name,
                            cnpj: s.cnpj || '',
                            phone: s.phone || '',
                            email: s.email || '',
                            address: s.address || '',
                            category: s.category || 'Geral',
                            notes: s.notes || ''
                          });
                          setShowForm(true);
                        }}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
                        title="Editar Fornecedor"
                      >
                        <Edit className="w-3.5 h-3.5 text-blue-400" />
                      </button>
                      <button
                        onClick={() => handleDeleteSupplier(s.id)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400"
                        title="Excluir Fornecedor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CARD RESUMO DO BANCO DE DADOS & ATALHOS */}
            <div className="bg-[#121418] border border-white/10 p-5 rounded-3xl space-y-3">
              <h4 className="text-xs font-black text-white flex items-center gap-2 border-b border-white/10 pb-2.5">
                <BarChart3 className="w-4 h-4 text-emerald-400" />
                Resumo do Sistema &amp; Estatísticas
              </h4>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
                  <span className="text-[10px] text-gray-400 uppercase block font-bold">Total de Produtos</span>
                  <span className="text-xl font-black text-white mt-1 block">{comparisons.length} itens</span>
                </div>
                <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
                  <span className="text-[10px] text-gray-400 uppercase block font-bold">Pastas de Clientes</span>
                  <span className="text-xl font-black text-amber-300 mt-1 block">{clientFolders.length} pastas</span>
                </div>
                <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
                  <span className="text-[10px] text-gray-400 uppercase block font-bold">Fornecedores Ativos</span>
                  <span className="text-xl font-black text-emerald-400 mt-1 block">{suppliers.length} empresas</span>
                </div>
                <div className="bg-white/5 border border-white/10 p-3 rounded-2xl">
                  <span className="text-[10px] text-gray-400 uppercase block font-bold">Economia Identificada</span>
                  <span className="text-xl font-black text-teal-300 mt-1 block">R$ {totalSavingsPotential.toFixed(2)}</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  onClick={() => setActiveTab('comparison')}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 shadow-md transition-all"
                >
                  <BarChart3 className="w-4 h-4" /> Ir para Comparativo Geral
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      </div>

      {/* ─── OVERLAY GLOBAL: CADASTRAR PRODUTO & PREÇO ──────────────────────── */}
      {showProdForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-4 text-white max-w-4xl w-full max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="font-bold text-lg text-emerald-400 flex items-center gap-2">
                <Plus className="w-5 h-5" /> Cadastrar Produto & Primeiros Preços no Comparativo
              </h3>

              <div className="flex items-center gap-2">
                <label className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition-all shrink-0">
                  {analyzingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  <span>{analyzingImage ? 'Lendo com IA...' : '📸 Tirar Foto / PDF com IA'}</span>
                  <input 
                    type="file" 
                    accept="image/*,application/pdf,.pdf" 
                    capture="environment" 
                    onChange={e => handleCapturePhoto(e, 'prod')} 
                    className="hidden" 
                  />
                </label>
                <button onClick={() => setShowProdForm(false)} className="w-9 h-9 bg-white/10 text-gray-400 hover:text-white rounded-full flex items-center justify-center">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

              <div>
                <label className="text-xs text-amber-400 font-bold block mb-1">1. Nome do Fornecedor *</label>
                <select 
                  value={prodForm.supplierId} 
                  onChange={e => {
                    if (e.target.value === 'ALL_SUPPLIERS') {
                      setProdForm({ ...prodForm, supplierId: 'ALL_SUPPLIERS', supplierName: 'TODOS' });
                    } else {
                      const sel = suppliers.find(s => s.id === e.target.value);
                      setProdForm({ ...prodForm, supplierId: e.target.value, supplierName: sel ? sel.name : prodForm.supplierName });
                    }
                  }} 
                  className="w-full p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm mb-1 font-semibold"
                >
                  <option value="">-- Selecione ou digite abaixo --</option>
                  <option value="ALL_SUPPLIERS" className="font-black text-amber-400">🌟 TODOS OS FORNECEDORES</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <input 
                  value={prodForm.supplierName} 
                  onFocus={e => e.target.select()}
                  onChange={e => setProdForm({ ...prodForm, supplierName: e.target.value, supplierId: '' })} 
                  placeholder="Ou digite o Fornecedor..." 
                  className="w-full p-2.5 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs" 
                />
              </div>

              <div>
                <label className="text-xs text-emerald-400 font-bold block mb-1">2. Produto / Material *</label>
                <input 
                  value={prodForm.productName} 
                  onFocus={e => e.target.select()}
                  onChange={e => setProdForm({ ...prodForm, productName: e.target.value })} 
                  placeholder="Ex: MDF 15mm Branco TX 2,75x1,85m..." 
                  className="w-full p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm" 
                />
                <select 
                  value={prodForm.category} 
                  onChange={e => setProdForm({ ...prodForm, category: e.target.value })} 
                  className="w-full p-2.5 rounded-xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-xs mt-1"
                >
                  <option>MDF/MDP</option><option>Ferragens</option><option>Vidros</option><option>Pedras</option><option>Tintas</option><option>Acessórios</option><option>Outros</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-blue-400 font-bold block mb-1">3. Marca / Fabricante</label>
                <input 
                  value={prodForm.brand} 
                  onFocus={e => e.target.select()}
                  onChange={e => setProdForm({ ...prodForm, brand: e.target.value })} 
                  placeholder="Ex: Duratex, Arauco, FGV, Häfele..." 
                  className="w-full p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm" 
                />
              </div>

              <div>
                <label className="text-xs text-purple-400 font-bold block mb-1">4. Valor Metro Quadrado (R$/m²)</label>
                <input 
                  type="text" 
                  value={prodForm.pricePerM2} 
                  onFocus={e => e.target.select()}
                  onChange={e => setProdForm({ ...prodForm, pricePerM2: e.target.value })} 
                  placeholder="Ex: 39,00 (opcional)" 
                  className="w-full p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm" 
                />
              </div>

              <div>
                <label className="text-xs text-emerald-400 font-bold block mb-1">5. Valor Unitário (R$) *</label>
                <input 
                  type="text" 
                  value={prodForm.unitPrice} 
                  onFocus={e => e.target.select()}
                  onChange={e => setProdForm({ ...prodForm, unitPrice: e.target.value })} 
                  placeholder="Ex: 198,50" 
                  className="w-full p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm font-bold text-emerald-400" 
                />
              </div>

              <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#181818] p-3 rounded-2xl border border-white/5">
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-300 font-bold block mb-1">Detalhamento & Especificações Técnicas (ou Extraído da Foto/PDF)</label>
                  <textarea 
                    rows={2} 
                    value={prodForm.specifications} 
                    onChange={e => setProdForm({ ...prodForm, specifications: e.target.value })} 
                    placeholder="Ex: Revestimento melamínico, espessura 15mm, calço 4 furos..." 
                    className="w-full p-2.5 rounded-xl border border-white/10 bg-[#111] text-white text-xs placeholder-gray-500 focus:ring-1 focus:ring-emerald-500" 
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-300 font-bold block mb-1">Foto / Anexo do Produto</label>
                  {prodForm.photoUrl ? (
                    <div className="relative rounded-xl overflow-hidden h-16 border border-emerald-500/50">
                      <img src={prodForm.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button onClick={() => setProdForm({ ...prodForm, photoUrl: '' })} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <div className="text-center p-2 text-xs text-gray-500 border border-dashed border-white/10 rounded-xl h-16 flex items-center justify-center">
                      Nenhum arquivo capturado
                    </div>
                  )}
                </div>
              </div>

            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={handleAddProductWithQuote} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors text-sm">Salvar Produto e Preço</button>
              <button onClick={() => setShowProdForm(false)} className="bg-white/10 border border-white/20 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── OVERLAY GLOBAL: COTAÇÃO DE OUTRO FORNECEDOR ──────────────────── */}
      {quoteModalProdId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-amber-500/30 rounded-3xl p-6 shadow-2xl space-y-4 text-white max-w-4xl w-full max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="font-bold text-lg text-amber-400 flex items-center gap-2">
                <DollarSign className="w-5 h-5" /> Adicionar Cotação de Outro Fornecedor
              </h3>
              <div className="flex items-center gap-2">
                <label className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow transition-all shrink-0">
                  {analyzingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  <span>{analyzingImage ? 'Lendo com IA...' : '📸 Tirar Foto / PDF com IA'}</span>
                  <input 
                    type="file" 
                    accept="image/*,application/pdf,.pdf" 
                    capture="environment" 
                    onChange={e => handleCapturePhoto(e, 'quote')} 
                    className="hidden" 
                  />
                </label>
                <button onClick={() => setQuoteModalProdId(null)} className="w-9 h-9 bg-white/10 text-gray-400 hover:text-white rounded-full flex items-center justify-center">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-amber-400 font-bold block mb-1">1. Nome do Fornecedor *</label>
                <select 
                  value={quoteForm.supplierId} 
                  onChange={e => {
                    if (e.target.value === 'ALL_SUPPLIERS') {
                      setQuoteForm({ ...quoteForm, supplierId: 'ALL_SUPPLIERS', supplierName: 'TODOS' });
                    } else {
                      const sel = suppliers.find(s => s.id === e.target.value);
                      setQuoteForm({ ...quoteForm, supplierId: e.target.value, supplierName: sel ? sel.name : quoteForm.supplierName });
                    }
                  }} 
                  className="w-full p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm mb-1 font-semibold"
                >
                  <option value="">-- Selecione ou digite abaixo --</option>
                  <option value="ALL_SUPPLIERS" className="font-black text-amber-400">🌟 TODOS OS FORNECEDORES</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <input 
                  value={quoteForm.supplierName} 
                  onFocus={e => e.target.select()}
                  onChange={e => setQuoteForm({ ...quoteForm, supplierName: e.target.value, supplierId: '' })} 
                  placeholder="Ou digite o Fornecedor..." 
                  className="w-full p-2.5 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:outline-none text-xs" 
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-emerald-400 font-bold">2. Produto / Material *</label>
                  {quoteForm.productName && (
                    <button
                      type="button"
                      onClick={() => setQuoteForm({ ...quoteForm, productName: '' })}
                      className="text-[10px] text-gray-400 hover:text-amber-400 flex items-center gap-0.5 transition-colors"
                      title="Limpar campo"
                    >
                      <X className="w-3 h-3" /> Limpar
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input 
                    value={quoteForm.productName}
                    onFocus={e => e.target.select()}
                    onChange={e => setQuoteForm({ ...quoteForm, productName: e.target.value })}
                    placeholder="Nome do produto ou material..."
                    className="w-full p-3 pr-8 rounded-xl border border-emerald-500/40 bg-[#0f1f17] text-emerald-200 placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm font-bold" 
                  />
                  {quoteForm.productName && (
                    <button
                      type="button"
                      onClick={() => setQuoteForm({ ...quoteForm, productName: '' })}
                      className="absolute right-2.5 top-3 text-gray-400 hover:text-white p-0.5"
                      title="Limpar texto"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-blue-400 font-bold block mb-1">3. Marca / Fabricante</label>
                <input 
                  value={quoteForm.brand} 
                  onFocus={e => e.target.select()}
                  onChange={e => setQuoteForm({ ...quoteForm, brand: e.target.value })} 
                  placeholder="Ex: Duratex, Arauco..." 
                  className="w-full p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm" 
                />
              </div>

              <div>
                <label className="text-xs text-purple-400 font-bold block mb-1">4. Valor Metro Quadrado (R$/m²)</label>
                <input 
                  type="text" 
                  value={quoteForm.pricePerM2} 
                  onFocus={e => e.target.select()}
                  onChange={e => setQuoteForm({ ...quoteForm, pricePerM2: e.target.value })} 
                  placeholder="Ex: 39,00" 
                  className="w-full p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm" 
                />
              </div>

              <div>
                <label className="text-xs text-emerald-400 font-bold block mb-1">5. Valor Unitário (R$) *</label>
                <input 
                  type="text" 
                  value={quoteForm.unitPrice} 
                  onFocus={e => e.target.select()}
                  onChange={e => setQuoteForm({ ...quoteForm, unitPrice: e.target.value })} 
                  placeholder="Ex: 198,50" 
                  className="w-full p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:outline-none text-sm font-bold text-emerald-400" 
                />
              </div>

              <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#181818] p-3 rounded-2xl border border-white/5">
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-300 font-bold block mb-1">Detalhamento &amp; Especificações Técnicas (ou Extraído da Foto/PDF)</label>
                  <textarea 
                    rows={2} 
                    value={quoteForm.specifications} 
                    onChange={e => setQuoteForm({ ...quoteForm, specifications: e.target.value })} 
                    placeholder="Ex: Prazo de entrega 3 dias, inclui frete..." 
                    className="w-full p-2.5 rounded-xl border border-white/10 bg-[#111] text-white text-xs placeholder-gray-500 focus:ring-1 focus:ring-amber-500" 
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-300 font-bold block mb-1">Foto / Anexo do Produto</label>
                  {quoteForm.photoUrl ? (
                    <div className="relative rounded-xl overflow-hidden h-16 border border-amber-500/50">
                      <img src={quoteForm.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                      <button onClick={() => setQuoteForm({ ...quoteForm, photoUrl: '' })} className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <div className="text-center p-2 text-xs text-gray-500 border border-dashed border-white/10 rounded-xl h-16 flex items-center justify-center">
                      Nenhum arquivo capturado
                    </div>
                  )}
                </div>
              </div>

            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={handleAddQuote} className="bg-amber-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-amber-700 transition-colors text-sm w-full">Salvar Cotação</button>
              <button onClick={() => setQuoteModalProdId(null)} className="bg-white/10 border border-white/20 text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-colors text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL DETALHAMENTO DO PRODUTO & FOTOS ──────────────────────────── */}
      {selectedProdDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-purple-500/40 rounded-3xl p-6 shadow-2xl space-y-5 text-white w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            
            <div className="flex justify-between items-start border-b border-white/10 pb-4">
              <div>
                <span className="bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full text-xs font-bold">
                  {selectedProdDetail.category}
                </span>
                <h2 className="text-2xl font-black text-white mt-2">{selectedProdDetail.productName}</h2>
                {selectedProdDetail.description && (
                  <p className="text-xs text-gray-400 mt-1">{selectedProdDetail.description}</p>
                )}
              </div>

              <button 
                onClick={() => setSelectedProdDetail(null)}
                className="w-9 h-9 bg-white/10 text-gray-400 hover:text-white rounded-full flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider">
                Detalhamento Completo das Cotações ({selectedProdDetail.quotes.length} Fornecedores)
              </h3>

              {selectedProdDetail.quotes.map((q, idx) => (
                <div key={idx} className="bg-[#181818] border border-white/10 p-5 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center border-b border-white/10 pb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-white text-base">{q.supplierName}</h4>
                      {q.brand && <span className="bg-blue-500/20 text-blue-300 text-xs px-2 py-0.5 rounded-md border border-blue-500/30">Marca: {q.brand}</span>}
                    </div>
                    <span className="font-black text-emerald-400 text-lg">
                      R$ {(q.unitPrice || q.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} /un
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {q.photoUrl ? (
                      <div className="rounded-xl overflow-hidden border border-white/10 h-36 bg-black">
                        <img src={q.photoUrl} alt={q.supplierName} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-white/10 h-36 flex flex-col items-center justify-center text-gray-500 text-xs p-2">
                        <Camera className="w-6 h-6 mb-1 opacity-50" /> Sem foto cadastrada
                      </div>
                    )}

                    <div className="md:col-span-2 space-y-2 text-xs">
                      <p className="text-gray-400">
                        <b className="text-gray-200">Especificações / Observações:</b><br />
                        {q.specifications || 'Nenhum detalhe adicional informado.'}
                      </p>
                      {q.pricePerM2 && (
                        <p className="text-purple-300 font-bold">
                          📐 Valor por m²: R$ {q.pricePerM2.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/m²
                        </p>
                      )}
                      <p className="text-gray-500 text-[10px]">Data da cotação: {q.updatedAt}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button 
                onClick={() => setSelectedProdDetail(null)}
                className="bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-2.5 rounded-xl text-sm"
              >
                Fechar Detalhes
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─── MODAL: DESCREVER POR TEXTO (IA) — ISOLADO E RÁPIDO ────────────────── */}
      <TextImportModal 
        isOpen={showTextImportModal}
        onClose={() => setShowTextImportModal(false)}
        onConfirm={handleImportFromTextDescription}
        isAnalyzing={analyzingText}
      />

      {/* ─── MODAL: EDITAR ITEM DA LISTA DE COMPRAS ───────────────────────── */}
      <EditMaterialItemModal
        item={editingMatItem}
        onClose={() => setEditingMatItem(null)}
        onSave={(updated) => {
          setMaterialList(prev => prev.map(m => m.id === updated.id ? updated : m));
          setEditingMatItem(null);
          toast({ title: '✅ Item atualizado com sucesso!' });
        }}
        suppliers={suppliers}
        comparisons={comparisons}
      />

      {/* ─── MODAL VISUALIZADOR DE PDF / FOTO / TEXTO & GERADOR DA LISTA DO CLIENTE ───────── */}
      {batchImportModal && batchImportModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6">
          <div className="bg-[#111111] border border-purple-500/40 rounded-3xl p-5 shadow-2xl text-white w-full max-w-6xl h-[90vh] flex flex-col space-y-4">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-white/10 pb-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300">
                  {batchImportModal.sourceType === 'text' ? <PenLine className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-black text-lg text-white flex items-center gap-2">
                    {batchImportModal.sourceType === 'text' ? 'Descrição & Produtos Extraídos pela IA' : 'Visualizador de Orçamento & Produtos Extraídos pela IA'}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {batchImportModal.sourceType === 'text' 
                      ? 'Confira sua descrição original do lado esquerdo e a lista de produtos identificados do lado direito.'
                      : 'Confira o documento original do lado esquerdo e a lista de produtos identificados do lado direito.'}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setBatchImportModal(null)}
                className="w-9 h-9 bg-white/10 text-gray-400 hover:text-white rounded-full flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Grid Side by Side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-hidden">
              
              {/* LEFT COLUMN: PDF / PHOTO VIEWER OR ORIGINAL TEXT */}
              <div className="bg-[#181818] border border-white/10 rounded-2xl p-3 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center mb-2 px-1 shrink-0">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    {batchImportModal.sourceType === 'text' ? (
                      <><PenLine className="w-4 h-4 text-indigo-400" /> ✍️ Sua Descrição Original</>
                    ) : batchImportModal.isPdf ? (
                      <><FileText className="w-4 h-4 text-purple-400" /> 📄 Documento PDF Original</>
                    ) : (
                      <><Camera className="w-4 h-4 text-purple-400" /> 📸 Foto do Orçamento</>
                    )}
                  </span>
                  {batchImportModal.sourceType === 'file' && (
                    <a 
                      href={batchImportModal.fileUrl} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="text-[11px] text-purple-400 hover:underline flex items-center gap-1"
                    >
                      Abrir em Nova Aba <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <div className="flex-1 rounded-xl overflow-hidden bg-black/60 border border-white/5 flex items-center justify-center relative">
                  {batchImportModal.sourceType === 'text' ? (
                    <OriginalDescriptionEditor 
                      initialText={batchImportModal.sourceText || ''}
                      onUpdateText={(newText) => {
                        setBatchImportModal(prev => prev ? { ...prev, sourceText: newText } : null);
                      }}
                      onReExtract={handleImportFromTextDescription}
                      isAnalyzing={analyzingText}
                    />
                  ) : batchImportModal.isPdf ? (
                    <iframe 
                      src={batchImportModal.fileUrl} 
                      title="PDF Visualizer" 
                      className="w-full h-full border-none rounded-xl"
                    />
                  ) : (
                    <img 
                      src={batchImportModal.fileUrl} 
                      alt="Orçamento" 
                      className="w-full h-full object-contain max-h-[60vh]" 
                    />
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: PARSED ITEMS TABLE & EDITING */}
              <div className="bg-[#181818] border border-white/10 rounded-2xl p-4 flex flex-col overflow-hidden space-y-3">
                
                <div className="grid grid-cols-2 gap-2 shrink-0">
                  <div>
                    <label className="text-xs text-amber-400 font-bold block mb-1 flex items-center gap-1">
                      <User className="w-3.5 h-3.5" /> Nome do Cliente *
                    </label>
                    <input 
                      value={batchImportModal.clientName} 
                      onChange={e => setBatchImportModal({ ...batchImportModal, clientName: e.target.value })}
                      placeholder="Ex: SANDRA..." 
                      className="w-full p-2.5 rounded-xl border border-white/10 bg-[#111] text-white text-xs font-bold focus:ring-1 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-blue-400 font-bold block mb-1 flex items-center gap-1">
                      <Building className="w-3.5 h-3.5" /> Fornecedor / Origem
                    </label>
                    <input 
                      value={batchImportModal.supplierName} 
                      onChange={e => setBatchImportModal({ ...batchImportModal, supplierName: e.target.value })}
                      placeholder="Ex: Madeireira X..." 
                      className="w-full p-2.5 rounded-xl border border-white/10 bg-[#111] text-white text-xs font-bold focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center shrink-0 border-b border-white/10 pb-2 pt-1">
                  <span className="text-xs font-bold text-emerald-400">
                    Produtos Extraídos ({batchImportModal.items.length} itens)
                  </span>
                  <button 
                    onClick={() => {
                      const newIt: BatchImportItem = { productName: 'Novo Produto', category: 'MDF/MDP', brand: 'Geral', unitPrice: 0, quantity: 1 };
                      setBatchImportModal({ ...batchImportModal, items: [...batchImportModal.items, newIt] });
                    }}
                    className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-lg hover:bg-emerald-500/30 flex items-center gap-1 font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Item
                  </button>
                </div>

                {/* Items Editable Table */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {batchImportModal.items.map((it, i) => (
                    <div key={i} className="bg-[#111] p-3 rounded-xl border border-white/10 space-y-2">
                      <div className="flex gap-2">
                        <input 
                          value={it.productName} 
                          onChange={e => {
                            const updated = [...batchImportModal.items];
                            updated[i].productName = e.target.value;
                            setBatchImportModal({ ...batchImportModal, items: updated });
                          }}
                          placeholder="Nome do produto" 
                          className="flex-1 p-2 rounded-lg border border-white/10 bg-[#181818] text-white text-xs font-bold"
                        />
                        <button 
                          onClick={() => {
                            const updated = batchImportModal.items.filter((_, idx) => idx !== i);
                            setBatchImportModal({ ...batchImportModal, items: updated });
                          }}
                          className="text-gray-500 hover:text-red-400 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-[10px] text-gray-400 block mb-0.5">Qtd</span>
                          <input 
                            type="number"
                            min="1"
                            value={it.quantity} 
                            onChange={e => {
                              const updated = [...batchImportModal.items];
                              updated[i].quantity = Math.max(1, parseInt(e.target.value) || 1);
                              setBatchImportModal({ ...batchImportModal, items: updated });
                            }}
                            className="w-full p-2 rounded-lg border border-white/10 bg-[#181818] text-amber-400 text-xs font-bold text-center"
                          />
                        </div>

                        <div>
                          <span className="text-[10px] text-gray-400 block mb-0.5">Valor Unit. (R$)</span>
                          <input 
                            type="number"
                            step="0.01"
                            value={it.unitPrice} 
                            onChange={e => {
                              const updated = [...batchImportModal.items];
                              updated[i].unitPrice = parseFloat(e.target.value) || 0;
                              setBatchImportModal({ ...batchImportModal, items: updated });
                            }}
                            className="w-full p-2 rounded-lg border border-white/10 bg-[#181818] text-emerald-400 text-xs font-bold"
                          />
                        </div>

                        <div>
                          <span className="text-[10px] text-gray-400 block mb-0.5">Subtotal</span>
                          <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 font-black text-xs text-right truncate">
                            R$ {(it.quantity * it.unitPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Info Alert */}
                <div className="shrink-0 pt-2 border-t border-white/10 bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-xl text-[11px] text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <b>Ação Automática:</b> A Lista do Cliente será criada e todos os preços serão comparados entre os fornecedores!
                  </span>
                </div>

              </div>

            </div>

            {/* Modal Footer Actions */}
            <div className="flex gap-3 justify-end shrink-0 border-t border-white/10 pt-3">
              <button 
                onClick={() => setBatchImportModal(null)}
                className="bg-white/10 hover:bg-white/20 text-white font-bold px-5 py-2.5 rounded-xl text-sm"
              >
                Cancelar
              </button>

              <button 
                onClick={handleConfirmBatchImport}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-lg"
              >
                <Check className="w-4 h-4" /> Criar Lista de Compras do Cliente & Comparar Preços
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─── MODAL CRIAR / EDITAR PASTA DE CLIENTE ─────────────────────── */}
      {showClientFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-amber-500/40 rounded-3xl p-6 shadow-2xl space-y-4 text-white max-w-md w-full animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="font-bold text-lg text-amber-400 flex items-center gap-2">
                <Folder className="w-5 h-5" />
                {editingClientFolder ? 'Editar Pasta do Cliente' : 'Nova Pasta de Cliente / Projeto'}
              </h3>
              <button
                type="button"
                onClick={() => setShowClientFolderModal(false)}
                className="w-9 h-9 bg-white/10 text-gray-400 hover:text-white rounded-full flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!clientFolderForm.name.trim()) {
                  toast({ title: '⚠️ Informe o nome do cliente / projeto', variant: 'destructive' });
                  return;
                }

                if (editingClientFolder) {
                  setClientFolders(prev => prev.map(f => f.id === editingClientFolder.id ? {
                    ...f,
                    name: clientFolderForm.name.trim().toUpperCase(),
                    phone: clientFolderForm.phone.trim(),
                    notes: clientFolderForm.notes.trim(),
                    status: clientFolderForm.status
                  } : f));
                  toast({ title: `✅ Pasta "${clientFolderForm.name}" atualizada!` });
                } else {
                  const newF: ClientFolder = {
                    id: 'f_' + Date.now().toString(),
                    name: clientFolderForm.name.trim().toUpperCase(),
                    phone: clientFolderForm.phone.trim(),
                    notes: clientFolderForm.notes.trim(),
                    createdAt: new Date().toISOString(),
                    status: clientFolderForm.status
                  };
                  setClientFolders(prev => [newF, ...prev]);
                  setSelectedClientFolderId(newF.id);
                  toast({ title: `📁 Pasta "${newF.name}" criada com sucesso!` });
                }

                setShowClientFolderModal(false);
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs text-amber-400 font-bold block mb-1">Nome do Cliente / Projeto *</label>
                <input
                  autoFocus
                  value={clientFolderForm.name}
                  onChange={e => setClientFolderForm({ ...clientFolderForm, name: e.target.value })}
                  placeholder="Ex: SAMUEL, APARTAMENTO 402, DONA SANDRA..."
                  className="w-full p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-blue-400 font-bold block mb-1">Telefone / WhatsApp (opcional)</label>
                <input
                  value={clientFolderForm.phone}
                  onChange={e => setClientFolderForm({ ...clientFolderForm, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                  className="w-full p-2.5 rounded-xl border border-white/10 bg-[#1a1a1a] text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-emerald-400 font-bold block mb-1">Status da Compra</label>
                <select
                  value={clientFolderForm.status}
                  onChange={e => setClientFolderForm({ ...clientFolderForm, status: e.target.value as any })}
                  className="w-full p-2.5 rounded-xl border border-white/10 bg-[#1a1a1a] text-white text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="Em Cotação">Em Cotação</option>
                  <option value="Pronto para Comprar">Pronto para Comprar</option>
                  <option value="Comprado">Comprado</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 font-bold block mb-1">Observações do Cliente</label>
                <textarea
                  rows={2}
                  value={clientFolderForm.notes}
                  onChange={e => setClientFolderForm({ ...clientFolderForm, notes: e.target.value })}
                  placeholder="Ex: Entrega até sexta, cor dos móveis: Louro Freijó..."
                  className="w-full p-2.5 rounded-xl border border-white/10 bg-[#1a1a1a] text-white text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-xl font-bold transition-colors text-sm w-full shadow-lg"
                >
                  {editingClientFolder ? 'Salvar Alterações' : 'Criar Pasta do Cliente'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowClientFolderModal(false)}
                  className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-6 py-3 rounded-xl font-bold transition-colors text-sm"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: EXPORTAR / ENVIAR PEDIDO (COM OU SEM VALORES) ─── */}
      {exportModal && exportModal.isOpen && (() => {
        const activeFolder = clientFolders.find(f => f.id === selectedClientFolderId);
        const clientTitle = activeFolder ? activeFolder.name : 'Todos os Clientes';
        const targetSupp = exportModal.targetSupplierName;
        
        let previewItems = selectedClientFolderId === 'all' ? materialList : materialList.filter(item => {
          if (item.clientFolderId === selectedClientFolderId) return true;
          if (activeFolder && item.clientName && item.clientName.toLowerCase() === activeFolder.name.toLowerCase()) return true;
          return false;
        });
        if (targetSupp && targetSupp !== 'all') {
          previewItems = previewItems.filter(it => it.selectedSupplierName.toLowerCase() === targetSupp.toLowerCase());
        }
        const totalValue = previewItems.reduce((acc, curr) => acc + curr.total, 0);

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#14161b] border border-amber-500/40 rounded-3xl p-6 shadow-2xl max-w-lg w-full space-y-5 text-white animate-in fade-in zoom-in duration-200">
              
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Opções de Envio e PDF</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {targetSupp ? `🏢 Fornecedor: ${targetSupp}` : '🏢 Todos os Fornecedores'} • 📁 {clientTitle} ({previewItems.length} {previewItems.length === 1 ? 'item' : 'itens'})
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setExportModal(null)}
                  className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Opções de Envio */}
              <div className="space-y-3.5">
                
                {/* Card 1: COM VALORES (Pedido Final) */}
                <div className="bg-[#1a1d24] border border-emerald-500/40 rounded-2xl p-4 space-y-3 shadow-md hover:border-emerald-500/70 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-black text-sm flex items-center gap-1.5">
                        💰 COM VALORES
                      </span>
                      <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                        Pedido de Compra Final
                      </span>
                    </div>
                    <span className="text-xs font-black text-emerald-400">
                      Total: R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Inclui preços unitários, subtotais, selo de melhor preço e o valor total do pedido.
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => {
                        handlePrintMaterialList(targetSupp, true);
                        setExportModal(null);
                      }}
                      className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Printer className="w-4 h-4 text-emerald-400" />
                      <span>PDF com Valores</span>
                    </button>

                    <button
                      onClick={() => {
                        handleSendWhatsAppMaterialList(targetSupp, true);
                        setExportModal(null);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>WhatsApp (c/ PDF e Valores)</span>
                    </button>
                  </div>
                </div>

                {/* Card 2: SEM VALORES (Cotação / Orçamento) */}
                <div className="bg-[#1a1d24] border border-amber-500/40 rounded-2xl p-4 space-y-3 shadow-md hover:border-amber-500/70 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-black text-sm flex items-center gap-1.5">
                        📋 SEM VALORES
                      </span>
                      <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                        Para Cotação de Preços
                      </span>
                    </div>
                    <span className="text-xs font-bold text-amber-300">
                      {previewItems.length} {previewItems.length === 1 ? 'produto' : 'produtos'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Oculta todos os preços. Exibe apenas Nome do Material, Marca e Quantidades para o fornecedor cotar.
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      onClick={() => {
                        handlePrintMaterialList(targetSupp, false);
                        setExportModal(null);
                      }}
                      className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Printer className="w-4 h-4 text-amber-400" />
                      <span>PDF sem Valores</span>
                    </button>

                    <button
                      onClick={() => {
                        handleSendWhatsAppMaterialList(targetSupp, false);
                        setExportModal(null);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>WhatsApp (c/ PDF sem Valores)</span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="flex justify-end pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setExportModal(null)}
                  className="bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all"
                >
                  Fechar
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* Modal de Reajuste de Preços em Porcentagem (%) */}
      {showPriceAdjustmentModal && (() => {
        const factor = priceAdjForm.operation === 'increase' 
          ? (1 + (Number(priceAdjForm.percentage) || 0) / 100)
          : (1 - (Number(priceAdjForm.percentage) || 0) / 100);

        // Calcular itens afetados para o preview em tempo real
        const previewItems: Array<{
          prodId: string;
          productName: string;
          category: string;
          supplierName: string;
          brand: string;
          currentPrice: number;
          newPrice: number;
          diff: number;
        }> = [];

        const regNames = new Set(suppliers.map(s => s.name.trim().toLowerCase()));

        // Considerar SOMENTE os produtos cadastrados nos fornecedores ativos
        activeComparisons.forEach(prod => {
          const pNameLower = prod.productName.trim().toLowerCase();
          if (pNameLower.startsWith('sd móveis') || pNameLower.startsWith('orçamento') || pNameLower.startsWith('dados') || pNameLower.startsWith('total') || pNameLower.startsWith('cliente')) {
            return;
          }

          if (!checkProductMatchesFilter(prod.productName, prod.category, priceAdjForm.filterType)) return;
          
          prod.quotes.forEach(q => {
            if (!q || !q.supplierName) return;
            const sNameLower = q.supplierName.trim().toLowerCase();
            
            // Apenas fornecedores cadastrados
            if (!regNames.has(sNameLower)) return;

            if (priceAdjForm.targetSupplierName !== 'all' && sNameLower !== priceAdjForm.targetSupplierName.toLowerCase()) return;
            const curP = q.unitPrice || q.price || 0;
            if (curP <= 0) return;
            const newP = Number((curP * factor).toFixed(2));
            previewItems.push({
              prodId: prod.id,
              productName: prod.productName,
              category: prod.category,
              supplierName: q.supplierName,
              brand: q.brand || 'Geral',
              currentPrice: curP,
              newPrice: newP,
              diff: newP - curP
            });
          });
        });

        const categoryOptions = [
          { id: 'all', label: '🌐 Todos os Produtos', desc: 'Aplica em todos os itens cadastrados' },
          { id: 'mdf_15', label: '⚪ MDF Branco 15mm', desc: 'MDF Branco com espessura 15mm' },
          { id: 'mdf_06', label: '⚪ MDF Branco 06mm', desc: 'MDF Branco com espessura 06mm / 6mm' },
          { id: 'mdf_madeirado_15', label: '🪵 MDF Madeirado 15mm', desc: 'MDF Madeirado / Colorido com espessura 15mm' },
          { id: 'mdf_madeirado_06', label: '🪵 MDF Madeirado 06mm', desc: 'MDF Madeirado / Colorido com espessura 06mm / 6mm' },
          { id: 'mdf_mdp', label: '📦 MDF / MDP (Geral)', desc: 'Todas as chapas de MDF e MDP' },
          { id: 'ferragens', label: '🔩 Ferragens', desc: 'Dobradiças, corrediças, parafusos, puxadores' },
          { id: 'vidros', label: '🪟 Vidros & Espelhos', desc: 'Vidros, espelhos e perfis de vidro' },
          { id: 'pedras', label: '🪨 Pedras & Granitos', desc: 'Mármores, granitos e pedras nobres' },
          { id: 'tintas', label: '🎨 Tintas & Acabamento', desc: 'Tintas, vernizes, seladores e solventes' },
          { id: 'acessorios', label: '🧩 Acessórios & Fitas', desc: 'Fitas de borda, colas e perfis de acabamento' }
        ];

        return (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-[#13161c] border border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl max-w-3xl w-full space-y-5 text-white my-auto animate-in fade-in zoom-in duration-200">
              
              {/* Header do Modal */}
              <div className="flex justify-between items-start border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg">
                    <Percent className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      Reajuste de Preços em Porcentagem (%)
                    </h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Atualize instantaneamente os valores de MDF 15/06, Madeirado, Ferragens ou Geral
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowPriceAdjustmentModal(false)}
                  className="text-gray-400 hover:text-white p-1.5 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Corpo do Formulário de Reajuste */}
              <div className="space-y-4 max-h-[68vh] overflow-y-auto custom-scrollbar pr-1">
                
                {/* 1. SELEÇÃO DO TIPO DE MATERIAL / CATEGORIA */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-amber-400 uppercase tracking-wider block">
                    1. Selecione o Tipo de Material para Reajustar:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {categoryOptions.map(opt => {
                      const isSelected = priceAdjForm.filterType === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPriceAdjForm({ ...priceAdjForm, filterType: opt.id })}
                          className={`p-2.5 rounded-2xl text-left border transition-all ${
                            isSelected
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300 ring-2 ring-amber-500/30 font-bold shadow-md'
                              : 'bg-[#181c24] border-white/10 text-gray-300 hover:text-white hover:border-white/20'
                          }`}
                        >
                          <span className="text-xs font-black block">{opt.label}</span>
                          <span className="text-[10px] text-gray-400 block mt-0.5 line-clamp-1">{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. FILTRO DE FORNECEDOR & TIPO DE OPERAÇÃO */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-[#181c24] p-4 rounded-2xl border border-white/10">
                  
                  {/* Fornecedor Alvo */}
                  <div>
                    <label className="text-xs font-bold text-gray-300 block mb-1.5">
                      🏢 Fornecedor Alvo:
                    </label>
                    <select
                      value={priceAdjForm.targetSupplierName}
                      onChange={e => setPriceAdjForm({ ...priceAdjForm, targetSupplierName: e.target.value })}
                      className="w-full bg-[#101216] border border-white/15 rounded-xl px-3 py-2 text-xs font-bold text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      <option value="all">🌐 Todos os Fornecedores Cadastrados</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.name}>🏢 {s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Tipo de Reajuste (Aumento ou Redução) */}
                  <div>
                    <label className="text-xs font-bold text-gray-300 block mb-1.5">
                      📊 Operação:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPriceAdjForm({ ...priceAdjForm, operation: 'increase' })}
                        className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 border ${
                          priceAdjForm.operation === 'increase'
                            ? 'bg-amber-500 text-black border-amber-400 shadow-md'
                            : 'bg-[#101216] border-white/10 text-gray-400 hover:text-white'
                        }`}
                      >
                        <span>➕ Aumento (+)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPriceAdjForm({ ...priceAdjForm, operation: 'decrease' })}
                        className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 border ${
                          priceAdjForm.operation === 'decrease'
                            ? 'bg-emerald-500 text-black border-emerald-400 shadow-md'
                            : 'bg-[#101216] border-white/10 text-gray-400 hover:text-white'
                        }`}
                      >
                        <span>➖ Desconto (-)</span>
                      </button>
                    </div>
                  </div>

                </div>

                {/* 3. VALOR DA PORCENTAGEM (%) COM BOTÕES DE ATALHO RÁPIDO */}
                <div className="bg-[#181c24] p-4 rounded-2xl border border-white/10 space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <label className="text-xs font-bold text-gray-300">
                      💰 Porcentagem de Reajuste (%):
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[2, 3, 5, 8, 10, 15, 20].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setPriceAdjForm({ ...priceAdjForm, percentage: val })}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition-all ${
                            priceAdjForm.percentage === val
                              ? 'bg-amber-500 text-black border-amber-400'
                              : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                          }`}
                        >
                          {priceAdjForm.operation === 'increase' ? `+${val}%` : `-${val}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      max="200"
                      value={priceAdjForm.percentage}
                      onChange={e => setPriceAdjForm({ ...priceAdjForm, percentage: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#101216] border border-amber-500/40 rounded-xl px-4 py-3 text-base font-black text-amber-300 focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-gray-500"
                      placeholder="Ex: 5.00"
                    />
                    <span className="absolute right-4 top-3.5 text-sm font-black text-gray-400">%</span>
                  </div>
                </div>

                {/* 4. PRÉ-VISUALIZAÇÃO EM TEMPO REAL DOS PRODUTOS AFETADOS */}
                <div className="bg-[#181c24] p-4 rounded-2xl border border-white/10 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-white flex items-center gap-1.5">
                      👁️ Pré-visualização do Impacto:
                    </span>
                    <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {previewItems.length} {previewItems.length === 1 ? 'cotação afetada' : 'cotações afetadas'}
                    </span>
                  </div>

                  {previewItems.length > 0 ? (
                    <div className="max-h-48 overflow-y-auto custom-scrollbar border border-white/10 rounded-xl overflow-hidden">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-[#101216] text-[10px] text-gray-400 font-black uppercase border-b border-white/10">
                          <tr>
                            <th className="p-2.5">Produto</th>
                            <th className="p-2.5">Fornecedor</th>
                            <th className="p-2.5 text-right">Preço Atual</th>
                            <th className="p-2.5 text-right">Novo Preço ({priceAdjForm.operation === 'increase' ? '+' : '-'}{priceAdjForm.percentage}%)</th>
                            <th className="p-2.5 text-right">Diferença</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {previewItems.map((item, idx) => (
                            <tr key={`${item.prodId}_${item.supplierName}_${idx}`} className="hover:bg-white/5">
                              <td className="p-2.5 font-bold text-white truncate max-w-[150px]">
                                {item.productName}
                              </td>
                              <td className="p-2.5 text-gray-300">
                                🏢 {item.supplierName}
                              </td>
                              <td className="p-2.5 text-right font-medium text-gray-400">
                                R$ {item.currentPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-2.5 text-right font-black text-emerald-400">
                                R$ {item.newPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className={`p-2.5 text-right font-bold text-[11px] ${item.diff >= 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                {item.diff >= 0 ? `+ R$ ${item.diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : `- R$ ${Math.abs(item.diff).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="bg-[#101216] p-4 rounded-xl text-center text-xs text-gray-500 italic">
                      Nenhum produto cadastrado corresponde aos filtros selecionados acima.
                    </div>
                  )}
                </div>

              </div>

              {/* Footer de Ações do Modal */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowPriceAdjustmentModal(false)}
                  className="w-full sm:w-auto bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={previewItems.length === 0}
                  onClick={handleApplyPriceAdjustment}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-xl transition-all ${
                    previewItems.length > 0
                      ? 'bg-amber-500 hover:bg-amber-400 text-black hover:scale-[1.02] active:scale-95'
                      : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
                  }`}
                >
                  <Percent className="w-4 h-4" />
                  <span>
                    Aplicar Reajuste de {priceAdjForm.operation === 'increase' ? '+' : '-'}{priceAdjForm.percentage}% ({previewItems.length} itens)
                  </span>
                </button>
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default SuppliersPage;
