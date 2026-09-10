import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Users, Search, Printer, Save, CheckSquare, Calculator,
  CreditCard, X, Plus, Trash2, Edit, Camera, Image as ImageIcon,
  LogOut, FileText, RefreshCw, MessageCircle
} from 'lucide-react';
import logoSD from '@/assets/logo-sd.jpeg';

const db = supabase as any;

// ─── Types ──────────────────────────────────────────────────────────────────
type PriceTable = 'avista' | 'aprazo' | 'atacado';

interface OSItem {
  id: string;
  description: string;
  unit: string;
  width: number;
  height: number;
  total_m2: number;
  value: number;
  quantity: number;
  total_value: number;
  price_table: PriceTable;
  price_avista?: number;
  price_aprazo?: number;
  price_atacado?: number;
}

const PRICE_TABLE_LABELS: Record<PriceTable, string> = {
  avista: 'TABELA AVISTA',
  aprazo: 'TABELA APRAZO',
  atacado: 'TABELA ATACADO',
};

// ─── Parse helper (accepts "1.234,56" or "1234.56") ─────────────────────────
const parseMoney = (v: string) =>
  parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;

const fmtMoney = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

// ─── Component ───────────────────────────────────────────────────────────────
const LegacySystemPage: React.FC = () => {
  const { toast } = useToast();

  // ── header state ──────────────────────────────────────────────────────────
  const [orderNo, setOrderNo] = useState('...');
  const [date, setDate] = useState(format(new Date(), 'dd/MM/yyyy'));
  const [time, setTime] = useState(format(new Date(), 'HH:mm'));
  const [isOS, setIsOS] = useState(true);
  const [isOrcamento, setIsOrcamento] = useState(false);
  const [vias, setVias] = useState('1 Via');
  const [tabAvista, setTabAvista] = useState(true);
  const [tabAprazo, setTabAprazo] = useState(false);
  const [tabAtacado, setTabAtacado] = useState(false);
  // tabela de preço ativa no momento (usada como padrão ao incluir itens)
  const activePriceTable: PriceTable = tabAprazo ? 'aprazo' : tabAtacado ? 'atacado' : 'avista';
  const setActivePriceTable = (t: PriceTable) => {
    setTabAvista(t === 'avista');
    setTabAprazo(t === 'aprazo');
    setTabAtacado(t === 'atacado');
  };

  // ── client state ──────────────────────────────────────────────────────────
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientDesc, setClientDesc] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('( ) -');
  const [responsavel, setResponsavel] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  // ── client search modal ────────────────────────────────────────────────────
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientFantasiaSearch, setClientFantasiaSearch] = useState('');
  const [clientPhoneSearch, setClientPhoneSearch] = useState('');
  const [editingClientId, setEditingClientId] = useState<string | null>(null);

  // ── new modals state ────────────────────────────────────────────────────────
  const [showCustomerRegistrationModal, setShowCustomerRegistrationModal] = useState(false);
  const [customerRegistrationTab, setCustomerRegistrationTab] = useState('endereco');
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Customer Form State
  const [customerForm, setCustomerForm] = useState({
    name: '', fantasia: '', rua: '', bairro: '', cidade: '', uf: 'CE', cep: '',
    tel1: '', tel2: '', celular: '', whatsapp: '', complemento: '', email: '', contato: '', skype: '', redeSocial: '',
    cnpj: '', ie: '', im: '', cpf: '', rg: '', orgaoEmissor: '',
    clientStatus: 'liberar' as 'liberar' | 'restringir' | 'bloquear',
    seguimento: 'EMPRESARIO',
  });

  const [showProductSearchModal, setShowProductSearchModal] = useState(false);
  const [productSearchStr, setProductSearchStr] = useState('');
  const [productsList, setProductsList] = useState<any[]>([]);
  const [showOSSearchModal, setShowOSSearchModal] = useState(false);
  const [osSearchStr, setOsSearchStr] = useState('');
  const [searchFolder, setSearchFolder] = useState<'todos' | 'os' | 'orcamento'>('todos');
  const [osList, setOsList] = useState<any[]>([]);
  const osSearchOsCount = osList.filter(o => (o?.description || '').toUpperCase().includes('ORDEM DE SERVIÇO')).length;
  const osSearchOrcCount = osList.filter(o => (o?.description || '').toUpperCase().includes('ORÇAMENTO')).length;

  // ── product registration modal (Cadastro de Produtos de Venda) ─────────────
  const [showProductRegistrationModal, setShowProductRegistrationModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    reference: '', barcode: '', name: '', unit: 'un', brand: '', category: '', location: '',
    complement1: '', complement2: '',
    control_stock: true, sell_zero_stock: true, update_cost_on_purchase: true,
    min_stock: 0, current_stock: 0,
    cost_price: 0, margin_avista: 15, margin_aprazo: 20, margin_atacado: 10,
  });
  const productPriceAvista = +(productForm.cost_price * (1 + productForm.margin_avista / 100)).toFixed(2);
  const productPriceAprazo = +(productForm.cost_price * (1 + productForm.margin_aprazo / 100)).toFixed(2);
  const productPriceAtacado = +(productForm.cost_price * (1 + productForm.margin_atacado / 100)).toFixed(2);

  // ── tabs ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('obs');

  // ── obs tab ───────────────────────────────────────────────────────────────
  const [servicoRealizado, setServicoRealizado] = useState('');
  const [problemasReparos, setProblemasReparos] = useState('');
  const [etapaServico, setEtapaServico] = useState('');

  // ── products tab ──────────────────────────────────────────────────────────
  const [osItems, setOsItems] = useState<OSItem[]>([]);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItem, setEditingItem] = useState<OSItem | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({
    description: '', unit: 'un', width: 0, height: 0, value: 0, quantity: 1,
    price_table: 'avista' as PriceTable,
    price_avista: 0, price_aprazo: 0, price_atacado: 0,
  });

  // ── images tab ────────────────────────────────────────────────────────────
  const [osImages, setOsImages] = useState<{ id: string; url: string; name: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── control tab ───────────────────────────────────────────────────────────
  const [notasInternas, setNotasInternas] = useState('');
  const [historicoServico, setHistoricoServico] = useState('');

  // ── bottom ────────────────────────────────────────────────────────────────
  const [showMetroImp, setShowMetroImp] = useState(false);
  const [showValoresImp, setShowValoresImp] = useState(false);
  const [situacaoAtual, setSituacaoAtual] = useState('Aguardando Aprovação');
  const [dataAprovacao, setDataAprovacao] = useState('');
  const [desconto, setDesconto] = useState('0,00');
  const [frete, setFrete] = useState('0,00');
  const [taxaPercentual, setTaxaPercentual] = useState('0,00');

  // ── payment modal ─────────────────────────────────────────────────────────
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('À Vista');
  const [paymentParcelas, setPaymentParcelas] = useState(1);

  // ── calculator ────────────────────────────────────────────────────────────
  const [showCalc, setShowCalc] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcPrev, setCalcPrev] = useState('');
  const [calcOp, setCalcOp] = useState('');
  const [calcWaitNext, setCalcWaitNext] = useState(false);

  // ── current OS id (for editing) ───────────────────────────────────────────
  const [editingOsId, setEditingOsId] = useState<string | null>(null);

  // ── computed total ────────────────────────────────────────────────────────
  // VALOR MATERIAL = soma automática da Lista de Produtos e Serviços (Total Geral)
  const totalGeralItens = osItems.reduce((s, i) => s + i.total_value, 0);
  const valorMaterialNum = totalGeralItens;
  // VALOR SERVIÇO = Valor Material x Taxa (%)
  const valorServicoCalculado = valorMaterialNum * (parseMoney(taxaPercentual) / 100);
  const total = valorMaterialNum + valorServicoCalculado + parseMoney(frete) - parseMoney(desconto);

  // ─── On mount: load employees, clients, next order number ─────────────────
  useEffect(() => {
    const init = async () => {
      const [empRes, cliRes, osRes, prodRes, allOsRes] = await Promise.all([
        db.from('employees').select('id, name').eq('active', true).order('name'),
        db.from('clients').select('id, name, phone').order('name'),
        db.from('service_orders').select('order_number').order('order_number', { ascending: false }).limit(1),
        db.from('products').select('*').order('name'),
        db.from('service_orders').select('*, clients(name, phone)').order('created_at', { ascending: false }).limit(50)
      ]);
      setEmployees(empRes.data || []);
      setClients(cliRes.data || []);
      const lastNo = osRes.data?.[0]?.order_number;
      setOrderNo(lastNo ? String(Number(lastNo) + 1) : '1001');
      if (prodRes && !prodRes.error && prodRes.data?.length > 0) {
        setProductsList(prodRes.data);
      } else {
        const { data: invData } = await db.from('inventory_items').select('*').limit(100);
        if (invData) setProductsList(invData);
      }
      if (allOsRes && !allOsRes.error) setOsList(allOsRes.data);
    };
    init();

    // clock
    const tick = setInterval(() => setTime(format(new Date(), 'HH:mm')), 30000);
    return () => clearInterval(tick);
  }, []);

  const handleWhatsApp = () => {
    const number = phone.replace(/\D/g, '');
    if (!number) {
      toast({ title: '⚠️ Adicione um telefone válido para enviar WhatsApp', variant: 'destructive' });
      return;
    }
    const text = `Olá${contactName ? ' ' + contactName : ''}, segue em anexo o PDF com o seu ${isOrcamento ? 'Orçamento' : 'Pedido de Serviço'} Nº ${orderNo} no valor total de R$ ${fmtMoney(total)}.`;
    
    // 1. Abre a janela de impressão/PDF
    handlePrint();

    // 2. Notificação amigável
    toast({ 
      title: '📄 PDF + WhatsApp Web', 
      description: 'Escolha "Salvar como PDF" na tela de impressão e anexe o arquivo na conversa do WhatsApp que abriu!',
      duration: 6000,
    });

    // 3. Abre o WhatsApp em seguida
    setTimeout(() => {
      window.open(`https://wa.me/55${number}?text=${encodeURIComponent(text)}`, '_blank');
    }, 400);
  };

  // ─── Save to DB ────────────────────────────────────────────────────────────
  const handleSave = async (itemsOverride?: OSItem[]) => {
    if (!clientDesc.trim()) {
      toast({ title: '⚠️ Informe o cliente', variant: 'destructive' });
      return;
    }

    let cId = clientId;
    if (!cId && clientDesc.trim()) {
      const { data: nc, error: ce } = await db
        .from('clients')
        .insert({ name: clientDesc.trim(), phone: phone.replace(/\D/g, '') || null })
        .select('id').single();
      if (ce) { toast({ title: '❌ Erro ao criar cliente', description: ce.message, variant: 'destructive' }); return; }
      cId = nc.id;
      setClientId(cId);
    }

    const notesArr = [
      servicoRealizado ? `[Serviço a ser Realizado]: ${servicoRealizado}` : '',
      problemasReparos ? `[Problemas a Reparar]: ${problemasReparos}` : '',
      etapaServico ? `[Etapa do Serviço]: ${etapaServico}` : '',
      notasInternas ? `[Notas Internas]: ${notasInternas}` : '',
      historicoServico ? `[Histórico]: ${historicoServico}` : '',
    ].filter(Boolean).join('\n');

    const payload = {
      order_number: orderNo,
      client_id: cId,
      description: [isOS ? 'ORDEM DE SERVIÇO' : '', isOrcamento ? 'ORÇAMENTO' : ''].filter(Boolean).join(' + ') || 'OS',
      status: situacaoAtual === 'Concluído' ? 'concluida' : situacaoAtual === 'Em Andamento' ? 'em_andamento' : 'aberta',
      priority: 'normal',
      assigned_to: responsavel || null,
      total_value: total,
      notes: notesArr || null,
      estimated_date: dataAprovacao ? (() => {
        const [d, m, y] = dataAprovacao.split('/');
        return y && m && d ? `${y}-${m}-${d}` : null;
      })() : null,
    };

    let osId = editingOsId;
    let error;
    if (osId) {
      ({ error } = await db.from('service_orders').update(payload).eq('id', osId));
      if (!error) toast({ title: '✅ OS atualizada com sucesso!' });
    } else {
      const { data: newOs, error: e2 } = await db.from('service_orders').insert(payload).select('id').single();
      error = e2;
      if (!error) {
        osId = newOs.id;
        setEditingOsId(osId);
        toast({ title: `✅ OS #${orderNo} salva com sucesso!` });
      }
    }

    if (error) {
      toast({ title: '❌ Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }

    // ─── Salvar itens da OS na tabela itens_projeto ────────────────────────
    const itemsToSave = itemsOverride ?? osItems;
    if (osId && itemsToSave.length > 0) {
      // Apaga os itens antigos e re-insere (upsert simples)
      await db.from('itens_projeto').delete().eq('service_order_id', osId);
      const itemsPayload = itemsToSave.map(it => ({
        service_order_id: osId,
        description: it.description,
        unit: it.unit,
        unit_value: it.value,
        quantity: it.quantity,
        total_value: it.total_value,
        width: it.width,
        height: it.height,
        total_m2: it.total_m2,
        price_table: it.price_table,
        price_avista: it.price_avista ?? null,
        price_aprazo: it.price_aprazo ?? null,
        price_atacado: it.price_atacado ?? null,
      }));
      const { error: itemErr } = await db.from('itens_projeto').insert(itemsPayload);
      if (itemErr) {
        toast({ title: '⚠️ OS salva, mas erro ao salvar itens', description: itemErr.message, variant: 'destructive' });
      }
    } else if (osId && itemsToSave.length === 0) {
      // Remove todos os itens se a lista estiver vazia
      await db.from('itens_projeto').delete().eq('service_order_id', osId);
    }
  };

  const handleFinalizar = async () => {
    setSituacaoAtual('Concluído');
    setDataAprovacao(format(new Date(), 'dd/MM/yyyy'));
    await handleSave();
    toast({ title: '🏁 OS Finalizada!', description: 'Status alterado para Concluído.' });
  };

  // ─── Nova OS: limpa o formulário para uma nova OS ──────────────────────────
  const handleNovaOS = async () => {
    // Busca o próximo número de ordem
    const { data: osRes } = await db.from('service_orders').select('order_number').order('order_number', { ascending: false }).limit(1);
    const lastNo = osRes?.[0]?.order_number;
    const nextNo = lastNo ? String(Number(lastNo) + 1) : '1001';

    setOrderNo(nextNo);
    setDate(format(new Date(), 'dd/MM/yyyy'));
    setTime(format(new Date(), 'HH:mm'));
    setIsOS(true);
    setIsOrcamento(false);
    setVias('1 Via');
    setTabAvista(true); setTabAprazo(false); setTabAtacado(false);
    setClientId(null);
    setClientDesc('');
    setContactName('');
    setPhone('( ) -');
    setResponsavel('');
    setOsItems([]);
    setOsImages([]);
    setServicoRealizado('');
    setProblemasReparos('');
    setEtapaServico('');
    setNotasInternas('');
    setHistoricoServico('');
    setSituacaoAtual('Aguardando Aprovação');
    setDataAprovacao('');
    setDesconto('0,00');
    setFrete('0,00');
    setTaxaPercentual('0,00');
    setEditingOsId(null);
    setActiveTab('obs');
    setShowOSSearchModal(false);
    toast({ title: `📄 Nova OS #${nextNo} pronta para preenchimento.` });
  };

  // ─── Client search ─────────────────────────────────────────────────────────
  const filteredClients = clients.filter(c => {
    const nameMatch = c.name.toLowerCase().includes(clientSearch.toLowerCase());
    const phoneMatch = !clientPhoneSearch || (c.phone || '').includes(clientPhoneSearch.replace(/\D/g, ''));
    return nameMatch && phoneMatch;
  });

  const selectClient = (c: any) => {
    setClientId(c.id);
    setClientDesc(c.name.toUpperCase());
    setPhone(c.phone ? `(${c.phone.slice(0, 2)}) ${c.phone.slice(2, 7)}-${c.phone.slice(7)}` : '( ) -');
    setShowClientModal(false);
    setClientSearch('');
    setClientFantasiaSearch('');
    setClientPhoneSearch('');
  };

  const handleDeleteClient = async (c: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const confirmed = window.confirm(`Tem certeza que deseja excluir o cliente "${c.name?.toUpperCase() || 'Selecionado'}"?\n\nO cliente e todos os seus registros serão removidos.`);
    if (!confirmed) return;

    try {
      // 1. Buscar todos os IDs de projetos vinculados ao cliente
      let projIds: string[] = [];
      try {
        const { data: projs } = await db.from('client_projects').select('id').eq('client_id', c.id);
        if (projs && projs.length > 0) {
          projIds = projs.map((p: any) => p.id);
        }
      } catch (_) {}

      // 2. Limpar todas as tabelas dependentes dos projetos do cliente
      if (projIds.length > 0) {
        // 2.1 Desvincular project_id nas ordens de serviço, contratos e contas a receber
        try { await db.from('service_orders').update({ project_id: null, client_id: null, client_name: c.name }).in('project_id', projIds); } catch (_) {}
        try { await db.from('contracts').update({ project_id: null, client_id: null }).in('project_id', projIds); } catch (_) {}
        try { await db.from('accounts_receivable').update({ project_id: null, client_id: null }).in('project_id', projIds); } catch (_) {}

        // 2.2 Limpar itens de checklists de qualidade
        try {
          const { data: qcs } = await db.from('quality_checklists').select('id').in('project_id', projIds);
          if (qcs && qcs.length > 0) {
            const qcIds = qcs.map((q: any) => q.id);
            try { await db.from('quality_check_items').delete().in('checklist_id', qcIds); } catch (_) {}
            try { await db.from('quality_checklists').delete().in('id', qcIds); } catch (_) {}
          }
        } catch (_) {}

        // 2.3 Deletar registros filhos de client_projects
        try { await db.from('project_gallery').delete().in('project_id', projIds); } catch (_) {}
        try { await db.from('project_costs').delete().in('project_id', projIds); } catch (_) {}
        try { await db.from('project_installments').delete().in('project_id', projIds); } catch (_) {}
        try { await db.from('project_production_steps').delete().in('project_id', projIds); } catch (_) {}
        try { await db.from('project_timeline').delete().in('project_id', projIds); } catch (_) {}
        try { await db.from('project_updates').delete().in('project_id', projIds); } catch (_) {}
        try { await db.from('client_feedback').delete().in('project_id', projIds); } catch (_) {}

        // 2.4 Deletar os projetos
        try { await db.from('client_projects').delete().in('id', projIds); } catch (_) {}
      }

      // 3. Desvincular ou limpar referências diretas a client_id
      try { await db.from('service_orders').update({ client_id: null, client_name: c.name }).eq('client_id', c.id); } catch (_) {}
      try { await db.from('contracts').update({ client_id: null }).eq('client_id', c.id); } catch (_) {}
      try { await db.from('accounts_receivable').update({ client_id: null }).eq('client_id', c.id); } catch (_) {}
      try { await db.from('appointments').update({ client_id: null }).eq('client_id', c.id); } catch (_) {}
      try { await db.from('budgets').update({ client_id: null }).eq('client_id', c.id); } catch (_) {}
      try { await db.from('financial_transactions').update({ client_id: null }).eq('client_id', c.id); } catch (_) {}
      try { await db.from('client_feedback').delete().eq('client_id', c.id); } catch (_) {}
      try { await db.from('client_projects').delete().eq('client_id', c.id); } catch (_) {}

      // 4. Excluir o cliente da tabela clients
      const { error } = await db.from('clients').delete().eq('id', c.id);
      if (error) throw error;

      setClients((prev: any[]) => prev.filter(item => item.id !== c.id));
      if (clientId === c.id) {
        setClientId('');
        setClientDesc('');
        setPhone('( ) -');
      }
      setShowCustomerRegistrationModal(false);
      toast({ title: '✅ Cliente excluído com sucesso!' });
    } catch (err: any) {
      console.error('Erro ao excluir cliente:', err);
      toast({ title: '❌ Erro ao excluir cliente', description: err.message, variant: 'destructive' });
    }
  };

  const openNewClientForm = () => {
    setEditingClientId(null);
    setCustomerForm({
      name: '', fantasia: '', rua: '', bairro: '', cidade: '', uf: 'CE', cep: '',
      tel1: '', tel2: '', celular: '', whatsapp: '', complemento: '', email: '', contato: '', skype: '', redeSocial: '',
      cnpj: '', ie: '', im: '', cpf: '', rg: '', orgaoEmissor: '',
      clientStatus: 'liberar', seguimento: 'EMPRESARIO',
    });
    setCustomerRegistrationTab('endereco');
    setShowCustomerRegistrationModal(true);
  };

  const openEditClientForm = (c: any) => {
    setEditingClientId(c.id);
    const ph = c.phone || '';
    setCustomerForm({
      name: c.name || '', fantasia: c.fantasia || '', rua: c.rua || '', bairro: c.bairro || '',
      cidade: c.cidade || '', uf: c.uf || 'CE', cep: c.cep || '',
      tel1: c.tel1 || (ph.length >= 10 ? `(${ph.slice(0,2)}) ${ph.slice(2,6)}-${ph.slice(6)}` : ph),
      tel2: c.tel2 || '', celular: c.celular || '', whatsapp: c.whatsapp || ph,
      complemento: c.complemento || '', email: c.email || '', contato: c.contato || '',
      skype: c.skype || '', redeSocial: c.redeSocial || '',
      cnpj: c.cnpj || '', ie: c.ie || '', im: c.im || '', cpf: c.cpf || '',
      rg: c.rg || '', orgaoEmissor: c.orgaoEmissor || '',
      clientStatus: c.client_status || 'liberar', seguimento: c.seguimento || 'EMPRESARIO',
    });
    setCustomerRegistrationTab('endereco');
    setShowCustomerRegistrationModal(true);
  };

  // ─── Items ─────────────────────────────────────────────────────────────────
  const calcM2 = (w: number, h: number) => +(w * h).toFixed(3);
  const calcTotal = (v: number, q: number, m2: number) => m2 > 0 ? +(v * m2).toFixed(2) : +(v * q).toFixed(2);

  const openItemForm = (item?: OSItem) => {
    if (item) {
      const isExistingInList = osItems.some(i => i.id === item.id);
      setEditingItem(isExistingInList ? item : null);
      setItemForm({
        description: item.description, unit: item.unit, width: item.width, height: item.height,
        value: item.value, quantity: item.quantity,
        price_table: item.price_table || activePriceTable,
        price_avista: item.price_avista ?? item.value,
        price_aprazo: item.price_aprazo ?? item.value,
        price_atacado: item.price_atacado ?? item.value,
      });
    } else {
      setEditingItem(null);
      setItemForm({
        description: '', unit: 'un', width: 0, height: 0, value: 0, quantity: 1,
        price_table: activePriceTable, price_avista: 0, price_aprazo: 0, price_atacado: 0,
      });
    }
    setShowItemForm(true);
  };

  // Troca a tabela de preço dentro do formulário de item, atualizando o valor usado
  const selectItemPriceTable = (t: PriceTable) => {
    const priceMap = { avista: itemForm.price_avista, aprazo: itemForm.price_aprazo, atacado: itemForm.price_atacado };
    setItemForm(p => ({ ...p, price_table: t, value: priceMap[t] || p.value }));
  };

  const saveItem = async () => {
    if (!itemForm.description.trim()) {
      toast({ title: '⚠️ Informe a descrição', variant: 'destructive' });
      return;
    }
    const m2 = calcM2(itemForm.width, itemForm.height);
    const tv = calcTotal(itemForm.value, itemForm.quantity, m2);
    let updatedItems: OSItem[];
    const isExisting = editingItem && osItems.some(i => i.id === editingItem.id);
    if (isExisting && editingItem) {
      updatedItems = osItems.map(i => i.id === editingItem.id ? { ...editingItem, ...itemForm, total_m2: m2, total_value: tv } : i);
    } else {
      updatedItems = [...osItems, { id: Date.now().toString(), ...itemForm, total_m2: m2, total_value: tv }];
    }
    setOsItems(updatedItems);
    setShowItemForm(false);
    setEditingItem(null);

    // ── Auto-salvar itens no banco ─────────────────────────────────────────
    if (editingOsId) {
      // OS já existe: salva apenas os itens
      await db.from('itens_projeto').delete().eq('service_order_id', editingOsId);
      const payload = updatedItems.map(it => ({
        service_order_id: editingOsId,
        description: it.description,
        unit: it.unit,
        unit_value: it.value,
        quantity: it.quantity,
        total_value: it.total_value,
        width: it.width,
        height: it.height,
        total_m2: it.total_m2,
        price_table: it.price_table,
        price_avista: it.price_avista ?? null,
        price_aprazo: it.price_aprazo ?? null,
        price_atacado: it.price_atacado ?? null,
      }));
      const { error } = await db.from('itens_projeto').insert(payload);
      if (error) {
        toast({ title: '⚠️ Erro ao salvar item', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: '✅ Item salvo!' });
      }
    } else {
      // OS ainda não existe: chama handleSave apenas se houver cliente preenchido, senão mantém na lista local
      if (clientDesc.trim()) {
        toast({ title: '💾 Salvando OS e itens...' });
        await handleSave(updatedItems);
      } else {
        toast({ title: '✅ Item adicionado à lista!', description: 'Preencha o cliente e salve a OS para gravar no banco.' });
      }
    }
  };

  // Ao trocar a tabela ativa no topo (Avista/Aprazo/Atacado), recalcula automaticamente
  // o valor de todos os itens da OS que possuem os 3 preços cadastrados
  const recalcAllItemsForTable = (t: PriceTable) => {
    setOsItems(prev => prev.map(it => {
      const priceMap = { avista: it.price_avista, aprazo: it.price_aprazo, atacado: it.price_atacado };
      const newValue = priceMap[t];
      if (newValue == null) return it; // item sem tabela de preço cadastrada, mantém como está
      const tv = calcTotal(newValue, it.quantity, it.total_m2);
      return { ...it, value: newValue, price_table: t, total_value: tv };
    }));
  };

  const deleteItem = (id: string) => {
    if (!confirm('Excluir este item?')) return;
    setOsItems(p => p.filter(i => i.id !== id));
    if (selectedItemId === id) setSelectedItemId(null);
  };

  // ─── Product registration (Cadastro de Produtos de Venda) ──────────────────
  const openProductRegistrationForm = (prod?: any) => {
    if (prod) {
      setEditingProductId(prod.id);
      setProductForm({
        reference: prod.reference || '', barcode: prod.barcode || '', name: prod.name || '',
        unit: prod.unit || 'un', brand: prod.brand || '', category: prod.category || '', location: prod.location || '',
        complement1: prod.complement1 || '', complement2: prod.complement2 || '',
        control_stock: prod.control_stock ?? true, sell_zero_stock: prod.sell_zero_stock ?? true,
        update_cost_on_purchase: prod.update_cost_on_purchase ?? true,
        min_stock: prod.min_stock || 0, current_stock: prod.current_stock || 0,
        cost_price: prod.cost_price || 0,
        margin_avista: prod.margin_avista ?? 15, margin_aprazo: prod.margin_aprazo ?? 20, margin_atacado: prod.margin_atacado ?? 10,
      });
    } else {
      setEditingProductId(null);
      setProductForm({
        reference: '', barcode: '', name: '', unit: 'un', brand: '', category: '', location: '',
        complement1: '', complement2: '',
        control_stock: true, sell_zero_stock: true, update_cost_on_purchase: true,
        min_stock: 0, current_stock: 0,
        cost_price: 0, margin_avista: 15, margin_aprazo: 20, margin_atacado: 10,
      });
    }
    setShowProductRegistrationModal(true);
  };

  // ─── Save Customer to DB ────────────────────────────────────────────────────
  const saveCustomer = async () => {
    if (!customerForm.name.trim()) {
      toast({ title: '⚠️ Informe o nome do cliente', variant: 'destructive' });
      return;
    }
    setSavingCustomer(true);
    const phoneVal = customerForm.celular || customerForm.whatsapp || customerForm.tel1 || '';
    const payload = {
      name: customerForm.name.trim().toUpperCase(),
      phone: phoneVal.replace(/\D/g, '') || null,
    };
    try {
      let error;
      let savedClient: any = null;
      if (editingClientId) {
        const { error: e } = await db.from('clients').update(payload).eq('id', editingClientId);
        error = e;
        if (!e) savedClient = { id: editingClientId, ...payload };
      } else {
        const { data: nc, error: e } = await db.from('clients').insert(payload).select('id, name, phone').single();
        error = e;
        if (!e) savedClient = nc;
      }
      if (error) {
        toast({ title: '❌ Erro ao salvar cliente', description: error.message, variant: 'destructive' });
        return;
      }
      // Refresh clients list
      const { data: updatedClients } = await db.from('clients').select('id, name, phone').order('name');
      if (updatedClients) setClients(updatedClients);
      // Auto-select this client in the OS
      if (savedClient) {
        setClientId(savedClient.id);
        setClientDesc(savedClient.name.toUpperCase());
        const ph = savedClient.phone || '';
        setPhone(ph.length >= 10 ? `(${ph.slice(0,2)}) ${ph.slice(2,7)}-${ph.slice(7)}` : ph || '( ) -');
      }
      toast({ title: editingClientId ? '✅ Cliente atualizado com sucesso!' : '✅ Cliente cadastrado com sucesso!' });
      setShowCustomerRegistrationModal(false);
    } finally {
      setSavingCustomer(false);
    }
  };

  const saveProduct = async () => {
    if (!productForm.name.trim()) {
      toast({ title: '⚠️ Informe a descrição do produto', variant: 'destructive' });
      return;
    }
    const name = productForm.name.trim();
    const costPrice = productForm.cost_price || 0;
    const sellPrice = productPriceAvista || 0;
    const stockQty = productForm.current_stock || 0;
    const minStock = productForm.min_stock || 0;
    const skuVal = productForm.reference || productForm.barcode || '';
    const descVal = [productForm.complement1, productForm.complement2].filter(Boolean).join(' ') || '';

    // Standard payload for Supabase 'products' table
    const productsPayload = {
      name,
      description: descVal,
      sku: skuVal,
      category: productForm.category || 'MDF',
      unit: productForm.unit || 'un',
      cost_price: costPrice,
      sell_price: sellPrice,
      stock_quantity: stockQty,
      min_stock: minStock,
      active: true,
    };

    // Full legacy payload (for fallback if inventory_items table is present)
    const legacyPayload = {
      name,
      reference: productForm.reference || null,
      barcode: productForm.barcode || null,
      unit: productForm.unit,
      brand: productForm.brand || null,
      category: productForm.category || null,
      location: productForm.location || null,
      complement1: productForm.complement1 || null,
      complement2: productForm.complement2 || null,
      control_stock: productForm.control_stock,
      sell_zero_stock: productForm.sell_zero_stock,
      update_cost_on_purchase: productForm.update_cost_on_purchase,
      min_stock: minStock,
      current_stock: stockQty,
      cost_price: costPrice,
      margin_avista: productForm.margin_avista,
      margin_aprazo: productForm.margin_aprazo,
      margin_atacado: productForm.margin_atacado,
      price_avista: productPriceAvista,
      price_aprazo: productPriceAprazo,
      price_atacado: productPriceAtacado,
      price: productPriceAvista,
    };

    let error: any = null;
    if (editingProductId) {
      const { error: e1 } = await db.from('products').update(productsPayload).eq('id', editingProductId);
      error = e1;
      if (e1 && e1.message?.includes('inventory_items')) {
        const { error: e2 } = await db.from('inventory_items').update(legacyPayload).eq('id', editingProductId);
        error = e2;
      }
    } else {
      const { error: e1 } = await db.from('products').insert(productsPayload);
      error = e1;
      if (e1 && (e1.message?.includes('inventory_items') || e1.code === 'PGRST204')) {
        const { error: e2 } = await db.from('inventory_items').insert(legacyPayload);
        error = e2;
      }
    }

    if (error) {
      toast({ title: '❌ Erro ao salvar produto', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: '✅ Produto salvo com sucesso!' });
    let { data: refreshed } = await db.from('products').select('*').order('name');
    if (!refreshed || refreshed.length === 0) {
      const { data: invData } = await db.from('inventory_items').select('*').limit(100);
      if (invData) refreshed = invData;
    }
    if (refreshed) setProductsList(refreshed);
    setShowProductRegistrationModal(false);
  };

  const totalItems = totalGeralItens;

  // ─── Images ────────────────────────────────────────────────────────────────
  const handleImageFiles = (files: FileList | null) => {
    if (!files) return;
    const newImgs = Array.from(files).map(f => ({
      id: Date.now() + Math.random() + '',
      url: URL.createObjectURL(f),
      name: f.name,
    }));
    setOsImages(p => [...p, ...newImgs]);
  };

  // ─── Calculator ────────────────────────────────────────────────────────────
  const calcPress = (key: string) => {
    if (key === 'C') { setCalcDisplay('0'); setCalcPrev(''); setCalcOp(''); setCalcWaitNext(false); return; }
    if (key === '←') { setCalcDisplay(p => p.length > 1 ? p.slice(0, -1) : '0'); return; }
    if (['+', '-', '×', '÷'].includes(key)) {
      setCalcPrev(calcDisplay); setCalcOp(key); setCalcWaitNext(true); return;
    }
    if (key === '=') {
      const a = parseFloat(calcPrev), b = parseFloat(calcDisplay);
      let r = 0;
      if (calcOp === '+') r = a + b;
      else if (calcOp === '-') r = a - b;
      else if (calcOp === '×') r = a * b;
      else if (calcOp === '÷') r = b !== 0 ? a / b : 0;
      setCalcDisplay(String(parseFloat(r.toFixed(10))));
      setCalcOp(''); setCalcPrev(''); setCalcWaitNext(false); return;
    }
    if (key === '.') {
      if (!calcWaitNext && calcDisplay.includes('.')) return;
      setCalcDisplay(p => (calcWaitNext ? '0.' : p + '.'));
      setCalcWaitNext(false); return;
    }
    if (key === '%') { setCalcDisplay(p => String(parseFloat(p) / 100)); return; }
    setCalcDisplay(p => calcWaitNext ? key : (p === '0' ? key : p + key));
    setCalcWaitNext(false);
  };

  // ─── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=800,height=600');
    if (!win) return;
    const docTitle = `${clientDesc.trim() ? clientDesc.trim() + ' - ' : ''}${isOrcamento ? 'Orçamento' : 'OS'} #${orderNo}`;
    win.document.write(`
      <html><head><title>${docTitle}</title>
      <style>
        body{font-family:Tahoma,Arial,sans-serif;font-size:12px;padding:16px}
        h2{margin:0 0 4px;font-size:18px}
        table{width:100%;border-collapse:collapse;margin-top:10px}
        th,td{border:1px solid #999;padding:5px 8px;text-align:left}
        th{background:#eee}.total{font-weight:bold;font-size:14px}
        .header-box{display:flex;align-items:center;gap:14px;margin-bottom:12px;border-bottom:2px solid #111;padding-bottom:10px}
        .logo-img{width:60px;height:60px;object-fit:cover;border-radius:12px;border:2px solid #d4af37}
      </style>
      </head><body>
      <div class="header-box">
        <img class="logo-img" src="${logoSD}" alt="SD Móveis" />
        <div>
          <h2>SD Móveis Projetados</h2>
          <div style="font-size:13px;font-weight:bold;color:#444;">${isOrcamento ? 'Orçamento' : 'Ordem de Serviço'} #${orderNo}</div>
        </div>
      </div>
      <p><b>Data:</b> ${date} ${time} | <b>Status:</b> ${situacaoAtual}</p>
      <p><b>Cliente:</b> ${clientDesc} | <b>Tel:</b> ${phone}</p>
      <p><b>Responsável:</b> ${employees.find(e => e.id === responsavel)?.name || '-'}</p>
      <hr style="margin:8px 0;border:none;border-top:1px solid #ccc"/>
      <p><b>Serviço a realizar:</b> ${servicoRealizado || '-'}</p>
      <p><b>Problemas/Reparos:</b> ${problemasReparos || '-'}</p>
      <p><b>Etapa atual:</b> ${etapaServico || '-'}</p>
      <hr style="margin:8px 0;border:none;border-top:1px solid #ccc"/>
      <table><tr><th>#</th><th>Descrição</th><th>Un</th><th>Larg</th><th>Alt</th><th>M²</th><th>Valor</th><th>Qtd</th><th>Total</th></tr>
      ${osItems.map((it, i) => `<tr>
        <td>${i + 1}</td><td>${it.description}</td><td>${it.unit}</td>
        <td>${it.width > 0 ? it.width.toFixed(2) : '-'}</td>
        <td>${it.height > 0 ? it.height.toFixed(2) : '-'}</td>
        <td>${it.total_m2 > 0 ? it.total_m2.toFixed(3) : '-'}</td>
        <td>R$ ${fmtMoney(it.value)}</td><td>${it.quantity}</td>
        <td>R$ ${fmtMoney(it.total_value)}</td>
      </tr>`).join('')}
      </table>
      <p class="total" style="text-align:right;margin-top:12px">
        Material: R$ ${fmtMoney(valorMaterialNum)} &nbsp;|&nbsp;
        Serviço (${taxaPercentual}%): R$ ${fmtMoney(valorServicoCalculado)} &nbsp;|&nbsp;
        Frete: R$ ${frete} &nbsp;|&nbsp;
        Desconto: R$ ${desconto} &nbsp;|&nbsp;
        <span style="font-size:16px;color:#000">TOTAL: R$ ${fmtMoney(total)}</span>
      </p>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  // ─── CSS ──────────────────────────────────────────────────────────────────
  const css = `
    .legacy-container, .legacy-container * {
      box-sizing: border-box;
    }
    .legacy-container {
      font-family: Tahoma, Arial, sans-serif;
      background-color: #f0f0f0;
      color: #000 !important;
      width: 100%;
      height: 100%;
      overflow-y: auto;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior: contain;
      scrollbar-width: none;
      padding: 4px;
      font-size: 11px;
    }
    .legacy-container::-webkit-scrollbar { display: none; }
    .legacy-header {
      background-color: #fce4ec;
      color: #880e4f !important;
      padding: 4px 8px;
      font-size: 11px;
      border: 1px solid #dcdcdc;
      margin-bottom: 8px;
    }
    .legacy-input,
    .legacy-input[type="text"],
    .legacy-input[type="number"],
    select.legacy-input,
    textarea.legacy-input {
      border: 1px solid #a0a0a0;
      border-right-color: #e0e0e0;
      border-bottom-color: #e0e0e0;
      padding: 2px 4px;
      background-color: #fff !important;
      font-size: 12px;
      outline: none;
      color: #000 !important;
      -webkit-text-fill-color: #000;
    }
    .legacy-input::placeholder,
    .legacy-textarea::placeholder {
      color: #888 !important;
      opacity: 1 !important;
      -webkit-text-fill-color: #888;
    }
    .legacy-input:read-only { background-color: #f0f0f0 !important; color: #000 !important; }
    .legacy-input:disabled { background-color: #e8e8e8 !important; color: #555 !important; -webkit-text-fill-color: #555; }
    select.legacy-input { background-color: #fff !important; color: #000 !important; }
    select.legacy-input option { color: #000; background-color: #fff; }
    .legacy-label {
      font-size: 11px; color: #333 !important; margin-bottom: 2px; display: inline-block;
    }
    .legacy-button {
      background: linear-gradient(to bottom, #f0f0f0, #e0e0e0);
      border: 1px solid #a0a0a0;
      border-right-color: #666;
      border-bottom-color: #666;
      padding: 4px 12px;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      color: #000 !important;
      border-radius: 3px;
    }
    .legacy-button:hover { background: linear-gradient(to bottom, #fff, #e8e8e8); }
    .legacy-button:active {
      border: 1px solid #666; border-right-color: #e0e0e0;
      border-bottom-color: #e0e0e0; background: #e0e0e0;
    }
    .legacy-tab-bar {
      display: flex; border-bottom: 1px solid #a0a0a0;
      margin-bottom: 0; background-color: #f0f0f0;
    }
    .legacy-tab {
      padding: 4px 8px; border: 1px solid #a0a0a0; border-bottom: none;
      background-color: #e8e8e8; margin-right: 2px;
      border-top-left-radius: 3px; border-top-right-radius: 3px;
      cursor: pointer; font-size: 11px; color: #555 !important;
      position: relative; top: 1px;
    }
    .legacy-tab.active {
      background-color: #f0f0f0; border-bottom: 1px solid #f0f0f0;
      font-weight: bold; color: #000 !important;
    }
    .legacy-tab-content {
      border: 1px solid #a0a0a0; border-top: none; padding: 8px;
      background-color: #f0f0f0; min-height: 260px; color: #000 !important;
    }
    .legacy-textarea {
      border: 1px solid #a0a0a0; border-right-color: #e0e0e0;
      border-bottom-color: #e0e0e0; background-color: #e8f5e9 !important;
      width: 100%; resize: none; padding: 4px; font-size: 12px; outline: none;
      color: #000 !important; -webkit-text-fill-color: #000;
    }
    .legacy-textarea-label {
      font-weight: bold; color: #666 !important; font-size: 12px;
      display: flex; align-items: center; gap: 4px; margin-bottom: 2px;
    }
    .legacy-money-input {
      text-align: right; font-weight: bold; font-size: 14px;
    }
    .legacy-money-label {
      background-color: #ffffe0 !important; border: 1px solid #a0a0a0;
      padding: 2px 6px; font-size: 11px; color: #000 !important;
      text-transform: uppercase; width: 120px;
    }
    .legacy-checkbox { margin: 0 4px 0 0; vertical-align: middle; }
    .legacy-table { width: 100%; border-collapse: collapse; font-size: 11px; color: #000 !important; }
    .legacy-table th {
      background: #dde; border: 1px solid #a0a0a0; padding: 2px 4px;
      text-align: left; font-size: 11px; color: #000 !important;
    }
    .legacy-table td {
      border: 1px solid #c0c0c0; padding: 2px 4px; color: #000 !important;
    }
    .legacy-table tr:nth-child(even) td { background: #f8f8ff; color: #000 !important; }
    .legacy-table tr.selected td { background: #c8d8ff; }
    .legacy-table tr:hover td { background: #e8eeff; cursor:pointer; }

    /* Garante que QUALQUER input/select/textarea dentro de modais e
       container legacy nunca herde a cor clara do tema global do app. */
    .legacy-container input,
    .legacy-container select,
    .legacy-container textarea,
    .legacy-modal-scope input,
    .legacy-modal-scope select,
    .legacy-modal-scope textarea {
      color: #000 !important;
      -webkit-text-fill-color: #000;
    }
    .legacy-container input::placeholder,
    .legacy-modal-scope input::placeholder {
      color: #999 !important;
      opacity: 1 !important;
      -webkit-text-fill-color: #999;
    }
  `;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      <style>{css}</style>

      {/* ── Client Search Modal ─────────────────────────────────────── */}
      {showClientModal && (
        <div className="legacy-modal-scope fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-400 rounded shadow-lg w-full max-w-4xl" style={{ fontFamily: 'Tahoma,Arial,sans-serif', fontSize: 11, color: '#000' }}>
            <div className="bg-[#dde] px-3 py-1 flex items-center justify-between border-b border-gray-400">
              <span className="font-bold text-xs">Pesquisa em Tela Cadastro de Clientes</span>
              <button onClick={() => setShowClientModal(false)} className="text-gray-600 hover:text-red-600"><X size={14} /></button>
            </div>
            <div className="p-2 bg-[#f0f0f0]">
              <div className="flex gap-2 mb-2 items-end">
                <div className="flex-1">
                  <span className="legacy-label text-[10px]">Pesquisar por Nome Razão Social</span><br />
                  <input
                    autoFocus
                    type="text"
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    className="legacy-input w-full bg-yellow-100"
                    placeholder="Digite o nome..."
                  />
                </div>
                <div className="flex-1">
                  <span className="legacy-label text-[10px]">Pesquisar por Nome Fantasia</span><br />
                  <input type="text" value={clientFantasiaSearch} onChange={e => setClientFantasiaSearch(e.target.value)} className="legacy-input w-full bg-yellow-100" placeholder="Fantasia..." />
                </div>
                <div className="flex-1">
                  <span className="legacy-label text-[10px]">Rastrear por Nome</span><br />
                  <input type="text" className="legacy-input w-full" />
                </div>
                <div className="flex-1">
                  <span className="legacy-label text-[10px]">Rastrear Telefone</span><br />
                  <input type="text" value={clientPhoneSearch} onChange={e => setClientPhoneSearch(e.target.value)} className="legacy-input w-full text-red-600 text-center" placeholder="-" />
                </div>
                <div className="flex gap-1 mb-1">
                  <button title="Novo Cliente" className="bg-green-100 hover:bg-green-200 border border-green-400 p-1 rounded-sm transition-colors" onClick={() => { setShowClientModal(false); openNewClientForm(); }}><Plus size={16} className="text-green-600" /></button>
                  <button title="Editar Cliente Selecionado" className="bg-gray-100 hover:bg-gray-200 border border-gray-400 p-1 rounded-sm transition-colors" onClick={() => {
                    if (filteredClients.length > 0) { setShowClientModal(false); openEditClientForm(filteredClients[0]); }
                    else toast({ title: '⚠️ Selecione um cliente para editar', variant: 'destructive' });
                  }}><Edit size={16} className="text-gray-600" /></button>
                  <button title="Excluir Cliente Selecionado" className="bg-red-100 hover:bg-red-200 border border-red-400 p-1 rounded-sm transition-colors" onClick={() => {
                    if (filteredClients.length > 0) { handleDeleteClient(filteredClients[0]); }
                    else toast({ title: '⚠️ Selecione um cliente para excluir', variant: 'destructive' });
                  }}><Trash2 size={16} className="text-red-600" /></button>
                  <button title="Pesquisar" className="bg-blue-100 hover:bg-blue-200 border border-blue-400 p-1 rounded-sm transition-colors" onClick={() => setClientSearch(clientSearch)}><Search size={16} className="text-blue-600" /></button>
                </div>
              </div>
              <div style={{ height: 350, overflow: 'auto', border: '1px solid #a0a0a0', backgroundColor: '#fff' }}>
                <table className="legacy-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>Código</th>
                      <th>Nome do Cliente / Razão Social</th>
                      <th>Fantasia/Apelido</th>
                      <th style={{ width: '100px' }}>WhatsApp</th>
                      <th style={{ width: '100px' }}>Telefone</th>
                      <th style={{ width: '120px' }}>Tipo Cadastro -&gt;-&gt;-&gt;</th>
                      <th style={{ width: '50px', textAlign: 'center' }}>Excluir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', color: '#888', padding: 8 }}>Nenhum cliente encontrado</td></tr>
                    )}
                    {filteredClients.map(c => (
                      <tr key={c.id}
                        onClick={() => selectClient(c)}
                        onDoubleClick={() => { setShowClientModal(false); openEditClientForm(c); }}
                        style={{ cursor: 'pointer', borderBottom: '1px solid #eee' }}
                        title="Clique para selecionar • Duplo clique para editar"
                      >
                        <td>{String(c.id).substring(0, 5).padStart(5, '0')}</td>
                        <td>{c.name.toUpperCase()}</td>
                        <td>{c.fantasia || ''}</td>
                        <td>{c.phone ? `(${c.phone.slice(0, 2)}) ${c.phone.slice(2, 7)}-${c.phone.slice(7)}` : ''}</td>
                        <td>{c.phone ? `(${c.phone.slice(0, 2)}) ${c.phone.slice(2, 7)}-${c.phone.slice(7)}` : ''}</td>
                        <td>{c.seguimento || ''}</td>
                        <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                          <button
                            title="Excluir este cliente"
                            className="p-1 hover:bg-red-100 rounded text-red-600 border border-transparent hover:border-red-300 transition-colors"
                            onClick={(e) => handleDeleteClient(c, e)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-2 text-[10px] text-gray-500">
                <span>{filteredClients.length} cliente(s) encontrado(s)</span>
                <span>Clique para selecionar • Duplo clique para editar • Botão lixeira para excluir • Botão + para novo</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Payment Modal ───────────────────────────────────────────────── */}
      {showPaymentModal && (
        <div className="legacy-modal-scope fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-400 rounded shadow-lg w-80" style={{ fontFamily: 'Tahoma,Arial,sans-serif', fontSize: 12, color: '#000' }}>
            <div className="bg-[#dde] px-3 py-2 flex items-center justify-between border-b border-gray-400">
              <span className="font-bold text-sm">Formas de Pagamento</span>
              <button onClick={() => setShowPaymentModal(false)}><X size={14} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="legacy-label block mb-1">Forma de Pagamento</label>
                <select className="legacy-input w-full" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option>À Vista</option>
                  <option>Cartão de Crédito</option>
                  <option>Cartão de Débito</option>
                  <option>PIX</option>
                  <option>Boleto</option>
                  <option>Cheque</option>
                  <option>A Prazo</option>
                </select>
              </div>
              {paymentMethod === 'Cartão de Crédito' && (
                <div>
                  <label className="legacy-label block mb-1">Parcelas</label>
                  <select className="legacy-input w-full" value={paymentParcelas} onChange={e => setPaymentParcelas(+e.target.value)}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                      <option key={n} value={n}>{n}x de R$ {fmtMoney(total / n)}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="bg-yellow-50 border border-yellow-300 rounded p-2 text-black">
                <p className="text-[11px] font-bold text-gray-800">🔑 Chaves PIX:</p>
                <p className="text-[11px]">CNPJ: 49.228.811/0001-33</p>
                <p className="text-[11px]">E-mail: sdmoveis48@gmail.com</p>
                <p className="text-[11px]">Cel (Itaú): 85 99760-2237</p>
                <p className="text-[11px] font-bold">Titular: Samuel David C</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-gray-500">Total a pagar:</p>
                <p className="text-lg font-bold text-blue-700">R$ {fmtMoney(total)}</p>
              </div>
              <div className="flex justify-end gap-2">
                <button className="legacy-button" onClick={() => setShowPaymentModal(false)}>Fechar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Calculator Modal ─────────────────────────────────────────────── */}
      {showCalc && (
        <div className="legacy-modal-scope fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-[#e0e0e0] border-2 border-gray-500 rounded shadow-xl w-56" style={{ fontFamily: 'Tahoma,Arial,sans-serif', color: '#000' }}>
            <div className="bg-[#dde] px-3 py-1 flex items-center justify-between border-b border-gray-400">
              <span className="font-bold text-xs">Calculadora</span>
              <button onClick={() => setShowCalc(false)}><X size={13} /></button>
            </div>
            <div className="p-2">
              <div className="bg-[#c8e8c8] border border-gray-500 text-right px-2 py-1 mb-2 font-bold text-lg font-mono text-black" style={{ minHeight: 32 }}>
                {calcDisplay}
              </div>
              {[
                ['C', '←', '%', '÷'],
                ['7', '8', '9', '×'],
                ['4', '5', '6', '-'],
                ['1', '2', '3', '+'],
                ['0', '.', '=', '='],
              ].map((row, ri) => (
                <div key={ri} className="flex gap-1 mb-1">
                  {row.map((key, ki) => {
                    const skip = ri === 4 && ki === 3;
                    if (skip) return null;
                    const wide = ri === 4 && ki === 0;
                    return (
                      <button
                        key={ki}
                        onClick={() => calcPress(key)}
                        style={{ flex: wide ? 2 : 1 }}
                        className={`legacy-button text-sm font-bold py-1 ${['÷', '×', '-', '+', '='].includes(key) ? 'text-blue-700 font-bold' :
                          key === 'C' ? 'text-red-600' : ''
                          }`}
                      >
                        {key}
                      </button>
                    );
                  })}
                </div>
              ))}
              <button
                className="legacy-button w-full text-xs mt-1"
                onClick={() => {
                  setFrete(fmtMoney(parseFloat(calcDisplay) || 0));
                  setShowCalc(false);
                }}
              >
                Usar no Frete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Item Form Modal ───────────────────────────────────────────────── */}
      {showItemForm && (
        <div className="legacy-modal-scope fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-400 rounded shadow-lg w-full max-w-md" style={{ fontFamily: 'Tahoma,Arial,sans-serif', fontSize: 12, color: '#000' }}>
            <div className="bg-[#dde] px-3 py-2 flex items-center justify-between border-b border-gray-400">
              <span className="font-bold text-sm">{editingItem ? 'Alterar Item' : 'Incluir Novo Item'}</span>
              <button onClick={() => setShowItemForm(false)}><X size={14} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="legacy-label block mb-1">Descrição *</label>
                <input className="legacy-input w-full" value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="legacy-label block mb-1">Unidade</label>
                  <select className="legacy-input w-full" value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })}>
                    {['un', 'm²', 'm', 'pç', 'hr', 'vb', 'kg', 'l'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="legacy-label block mb-1">Largura (m)</label>
                  <input type="number" step="0.01" className="legacy-input w-full" value={itemForm.width || ''} onChange={e => setItemForm({ ...itemForm, width: +e.target.value })} />
                </div>
                <div>
                  <label className="legacy-label block mb-1">Altura (m)</label>
                  <input type="number" step="0.01" className="legacy-input w-full" value={itemForm.height || ''} onChange={e => setItemForm({ ...itemForm, height: +e.target.value })} />
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-2">
                <label className="legacy-label block mb-1 font-bold">Tabela de Preço</label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex flex-col items-center gap-1 border border-gray-300 rounded p-1 bg-white cursor-pointer" style={{ borderColor: itemForm.price_table === 'avista' ? '#0000aa' : undefined }}>
                    <span className="flex items-center gap-1 text-[10px] font-bold">
                      <input type="radio" name="itemPriceTable" checked={itemForm.price_table === 'avista'} onChange={() => selectItemPriceTable('avista')} /> Avista
                    </span>
                    <input
                      type="number" step="0.01" className="legacy-input w-full text-center"
                      value={itemForm.price_avista || ''}
                      onChange={e => setItemForm(p => ({ ...p, price_avista: +e.target.value, value: p.price_table === 'avista' ? +e.target.value : p.value }))}
                    />
                  </label>
                  <label className="flex flex-col items-center gap-1 border border-gray-300 rounded p-1 bg-white cursor-pointer" style={{ borderColor: itemForm.price_table === 'aprazo' ? '#0000aa' : undefined }}>
                    <span className="flex items-center gap-1 text-[10px] font-bold">
                      <input type="radio" name="itemPriceTable" checked={itemForm.price_table === 'aprazo'} onChange={() => selectItemPriceTable('aprazo')} /> Aprazo
                    </span>
                    <input
                      type="number" step="0.01" className="legacy-input w-full text-center"
                      value={itemForm.price_aprazo || ''}
                      onChange={e => setItemForm(p => ({ ...p, price_aprazo: +e.target.value, value: p.price_table === 'aprazo' ? +e.target.value : p.value }))}
                    />
                  </label>
                  <label className="flex flex-col items-center gap-1 border border-gray-300 rounded p-1 bg-white cursor-pointer" style={{ borderColor: itemForm.price_table === 'atacado' ? '#0000aa' : undefined }}>
                    <span className="flex items-center gap-1 text-[10px] font-bold">
                      <input type="radio" name="itemPriceTable" checked={itemForm.price_table === 'atacado'} onChange={() => selectItemPriceTable('atacado')} /> Atacado
                    </span>
                    <input
                      type="number" step="0.01" className="legacy-input w-full text-center"
                      value={itemForm.price_atacado || ''}
                      onChange={e => setItemForm(p => ({ ...p, price_atacado: +e.target.value, value: p.price_table === 'atacado' ? +e.target.value : p.value }))}
                    />
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="legacy-label block mb-1">Valor Unitário Usado (R$)</label>
                  <input type="number" step="0.01" className="legacy-input w-full font-bold" value={itemForm.value || ''} onChange={e => setItemForm({ ...itemForm, value: +e.target.value })} />
                </div>
                <div>
                  <label className="legacy-label block mb-1">Quantidade</label>
                  <input type="number" min="1" className="legacy-input w-full" value={itemForm.quantity || ''} onChange={e => setItemForm({ ...itemForm, quantity: +e.target.value })} />
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-300 rounded p-2 text-right">
                <span className="text-[11px] text-gray-500">Total Previsto: </span>
                <span className="font-bold text-blue-700">R$ {fmtMoney(calcTotal(itemForm.value, itemForm.quantity, calcM2(itemForm.width, itemForm.height)))}</span>
                {itemForm.width > 0 && itemForm.height > 0 && (
                  <span className="text-[11px] text-gray-400 ml-2">({calcM2(itemForm.width, itemForm.height).toFixed(3)} m²)</span>
                )}
              </div>
              <div className="flex gap-2 justify-end">
                <button className="legacy-button" onClick={saveItem}><CheckSquare size={13} className="text-green-600" /> {editingItem ? 'Salvar' : 'Incluir'}</button>
                <button className="legacy-button" onClick={() => setShowItemForm(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW: Product Registration Modal (Cadastro de Produtos de Venda) ── */}
      {showProductRegistrationModal && (
        <div className="legacy-modal-scope fixed inset-0 z-[95] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-400 rounded shadow-lg w-full max-w-3xl" style={{ fontFamily: 'Tahoma,Arial,sans-serif', fontSize: 12, color: '#000' }}>
            <div className="bg-[#dde] px-3 py-2 flex items-center justify-between border-b border-gray-400">
              <span className="font-bold text-sm">Cadastro de Produtos de Venda</span>
              <button onClick={() => setShowProductRegistrationModal(false)}><X size={14} /></button>
            </div>
            <div className="p-4 space-y-3" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
              <div className="flex gap-4 items-center">
                <label className="flex items-center gap-1 text-[11px] font-bold"><input type="checkbox" checked readOnly /> Cadastro de Produtos</label>
                <label className="flex items-center gap-1 text-[11px] font-bold"><input type="checkbox" disabled /> Cadastro de Serviço</label>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="legacy-label block mb-1">Referência do Produto</label>
                  <input className="legacy-input w-full" value={productForm.reference} onChange={e => setProductForm({ ...productForm, reference: e.target.value })} />
                </div>
                <div>
                  <label className="legacy-label block mb-1">Código de Barras</label>
                  <input className="legacy-input w-full" value={productForm.barcode} onChange={e => setProductForm({ ...productForm, barcode: e.target.value })} />
                </div>
                <div>
                  <label className="legacy-label block mb-1">Unidade</label>
                  <select className="legacy-input w-full" value={productForm.unit} onChange={e => setProductForm({ ...productForm, unit: e.target.value })}>
                    {['un', 'm²', 'm', 'pç', 'hr', 'vb', 'kg', 'l'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="legacy-label block mb-1">Descrição do Produto ou Serviço *</label>
                <input className="legacy-input w-full font-bold" value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })} />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="legacy-label block mb-1">Marca</label>
                  <input className="legacy-input w-full" value={productForm.brand} onChange={e => setProductForm({ ...productForm, brand: e.target.value })} />
                </div>
                <div>
                  <label className="legacy-label block mb-1">Grupo / Categoria</label>
                  <input className="legacy-input w-full" value={productForm.category} onChange={e => setProductForm({ ...productForm, category: e.target.value })} />
                </div>
                <div>
                  <label className="legacy-label block mb-1">Localização Física</label>
                  <input className="legacy-input w-full" value={productForm.location} onChange={e => setProductForm({ ...productForm, location: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="legacy-label block mb-1">Complemento do Produto <span className="text-gray-400">(aparece somente em ordem de serviço)</span></label>
                <input className="legacy-input w-full bg-yellow-50 mb-1" value={productForm.complement1} onChange={e => setProductForm({ ...productForm, complement1: e.target.value })} />
                <input className="legacy-input w-full bg-yellow-50" value={productForm.complement2} onChange={e => setProductForm({ ...productForm, complement2: e.target.value })} />
              </div>

              <div className="flex gap-4 flex-wrap">
                <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={productForm.control_stock} onChange={e => setProductForm({ ...productForm, control_stock: e.target.checked })} /> Controlar Estoque</label>
                <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={productForm.sell_zero_stock} onChange={e => setProductForm({ ...productForm, sell_zero_stock: e.target.checked })} /> Vender com Estoque Zerado</label>
                <label className="flex items-center gap-1 text-[11px]"><input type="checkbox" checked={productForm.update_cost_on_purchase} onChange={e => setProductForm({ ...productForm, update_cost_on_purchase: e.target.checked })} /> Atualizar Custo em Compras</label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="legacy-label block mb-1">Estoque Mínimo</label>
                    <input type="number" className="legacy-input w-full text-right" value={productForm.min_stock} onChange={e => setProductForm({ ...productForm, min_stock: +e.target.value })} />
                  </div>
                  <div>
                    <label className="legacy-label block mb-1">Estoque Atual</label>
                    <input type="number" className="legacy-input w-full text-right" value={productForm.current_stock} onChange={e => setProductForm({ ...productForm, current_stock: +e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="legacy-label block mb-1">Valor Custo (R$)</label>
                  <input type="number" step="0.01" className="legacy-input w-full text-right font-bold" value={productForm.cost_price} onChange={e => setProductForm({ ...productForm, cost_price: +e.target.value })} />
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-300 rounded p-3">
                <label className="legacy-label block mb-2 font-bold">Margens e Preços Calculados</label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white border border-gray-300 rounded p-2">
                    <label className="legacy-label block mb-1">Margem Avista (%)</label>
                    <input type="number" step="0.01" className="legacy-input w-full text-right mb-2" value={productForm.margin_avista} onChange={e => setProductForm({ ...productForm, margin_avista: +e.target.value })} />
                    <div className="text-[10px] text-gray-500">Valor Avista</div>
                    <div className="font-bold text-green-700 text-right">R$ {fmtMoney(productPriceAvista)}</div>
                  </div>
                  <div className="bg-white border border-gray-300 rounded p-2">
                    <label className="legacy-label block mb-1">Margem Aprazo (%)</label>
                    <input type="number" step="0.01" className="legacy-input w-full text-right mb-2" value={productForm.margin_aprazo} onChange={e => setProductForm({ ...productForm, margin_aprazo: +e.target.value })} />
                    <div className="text-[10px] text-gray-500">Valor Aprazo</div>
                    <div className="font-bold text-purple-700 text-right">R$ {fmtMoney(productPriceAprazo)}</div>
                  </div>
                  <div className="bg-white border border-gray-300 rounded p-2">
                    <label className="legacy-label block mb-1">Margem Atacado (%)</label>
                    <input type="number" step="0.01" className="legacy-input w-full text-right mb-2" value={productForm.margin_atacado} onChange={e => setProductForm({ ...productForm, margin_atacado: +e.target.value })} />
                    <div className="text-[10px] text-gray-500">Valor Atacado</div>
                    <div className="font-bold text-orange-700 text-right">R$ {fmtMoney(productPriceAtacado)}</div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-gray-200">
                <button className="legacy-button" onClick={saveProduct}><CheckSquare size={13} className="text-green-600" /> Salvar</button>
                <button className="legacy-button" onClick={() => setShowProductRegistrationModal(false)}><X size={13} className="text-blue-600" /> Sair</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW: Customer Registration Modal ──────────────────────────────── */}
      {showCustomerRegistrationModal && (
        <div className="legacy-modal-scope fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-400 rounded shadow-lg w-full max-w-5xl flex flex-col" style={{ fontFamily: 'Tahoma,Arial,sans-serif', fontSize: 11, height: '90vh', color: '#000' }}>
            <div className="bg-[#dde] px-3 py-2 flex items-center justify-between border-b border-gray-400">
              <span className="font-bold text-sm">Tela Cadastro de Clientes</span>
              <button onClick={() => setShowCustomerRegistrationModal(false)}><X size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 bg-[#f0f0f0] flex flex-col gap-2">
              <div className="flex gap-2">
                <div className="w-16">
                  <span className="legacy-label text-[10px]">Registro</span>
                  <input className="legacy-input w-full text-right font-bold" value={editingClientId ? String(clients.findIndex(c => c.id === editingClientId) + 1) : clients.length + 1} readOnly />
                </div>
                <div className="w-24">
                  <span className="legacy-label text-[10px]">Data Cadastro</span>
                  <input className="legacy-input w-full text-center" value={format(new Date(), 'dd/MM/yyyy')} readOnly />
                </div>
                <div className="flex-1 flex gap-2 justify-center items-end ml-4">
                  <button className="legacy-button h-6 w-36 flex justify-center items-center" onClick={() => {
                    if (editingClientId) { 
                      setOsSearchStr(customerForm.name);
                      setSearchFolder('orcamento');
                      setShowOSSearchModal(true);
                      setShowCustomerRegistrationModal(false);
                      setShowClientModal(false);
                    }
                    else toast({ title: 'ℹ️ Salve o cliente primeiro para ver seus Orçamentos.' });
                  }}><span className="w-4 h-1 bg-amber-500 mr-2" /> 📁 Pasta Orçamentos</button>
                  <button className="legacy-button h-6 w-36 flex justify-center items-center" onClick={() => {
                    if (editingClientId) { 
                      setOsSearchStr(customerForm.name);
                      setSearchFolder('os');
                      setShowOSSearchModal(true); 
                      setShowCustomerRegistrationModal(false);
                      setShowClientModal(false);
                    }
                    else toast({ title: 'ℹ️ Salve o cliente primeiro para ver suas Ordens de Serviço.' });
                  }}><span className="w-4 h-1 bg-blue-600 mr-2" /> 📁 Pasta Ordens de Serviço</button>
                  <button className="legacy-button h-6 w-36 flex justify-center items-center" onClick={() => {
                    toast({ title: 'Buscando registros financeiros do cliente...' });
                  }}><div className="rounded-full bg-gray-400 w-4 h-4 mr-2" /> Pesquisar Financeiro</button>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <div className="w-48 flex flex-col gap-2">
                  <div className="h-48 bg-gray-100 border border-gray-400 flex items-center justify-center text-gray-400 text-[10px]">Foto do Cliente</div>
                  <div className="flex justify-end gap-1">
                    <button title="Câmera" className="p-1 border bg-white hover:bg-gray-50"><Camera size={14} /></button>
                    <button title="Pesquisar foto" className="p-1 border bg-white hover:bg-gray-50"><Search size={14} /></button>
                    <button title="Adicionar foto" className="p-1 border bg-white hover:bg-gray-50"><Plus size={14} className="text-green-600" /></button>
                  </div>
                  <div className="h-48 bg-gray-100 border border-gray-400 flex items-center justify-center text-gray-400 text-[10px]">Assinatura</div>
                  <div className="flex justify-end gap-1">
                    <button title="Câmera" className="p-1 border bg-white hover:bg-gray-50"><Camera size={14} /></button>
                    <button title="Pesquisar" className="p-1 border bg-white hover:bg-gray-50"><Search size={14} /></button>
                    <button title="Adicionar" className="p-1 border bg-white hover:bg-gray-50"><Plus size={14} className="text-green-600" /></button>
                  </div>
                </div>
                <div className="flex-1 bg-white border border-gray-400 p-2 flex flex-col">
                  <div className="flex gap-2 mb-2">
                    <div className="flex-1">
                      <span className="legacy-label text-[10px]">Nome / Razão Completo *</span>
                      <input className="legacy-input w-full font-bold bg-yellow-50" value={customerForm.name} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value.toUpperCase() })} placeholder="NOME COMPLETO DO CLIENTE" />
                    </div>
                    <div className="w-64">
                      <span className="legacy-label text-[10px]">Seguimento do Cliente ou Tipo</span>
                      <select className="legacy-input w-full" value={customerForm.seguimento} onChange={e => setCustomerForm({ ...customerForm, seguimento: e.target.value })}>
                        <option>EMPRESARIO</option>
                        <option>PESSOA FISICA</option>
                        <option>CLIENTE VIP</option>
                        <option>PARCEIRO</option>
                        <option>FORNECEDOR</option>
                        <option>FUNCIONARIO</option>
                      </select>
                    </div>
                  </div>

                  <div className="legacy-tab-bar mt-2">
                    <div className={`legacy-tab ${customerRegistrationTab === 'endereco' ? 'active' : ''}`} onClick={() => setCustomerRegistrationTab('endereco')}>Endereço e Contatos -&gt;</div>
                    <div className={`legacy-tab ${customerRegistrationTab === 'filiacao' ? 'active' : ''}`} onClick={() => setCustomerRegistrationTab('filiacao')}>Filiação e Avaliação Financeira -&gt;</div>
                    <div className={`legacy-tab ${customerRegistrationTab === 'historico' ? 'active' : ''}`} onClick={() => setCustomerRegistrationTab('historico')}>Informações / Observações / Histórico</div>
                  </div>
                  <div className="legacy-tab-content flex-1 p-2 bg-white" style={{ minHeight: 'auto' }}>
                    {customerRegistrationTab === 'endereco' && (
                      <div className="space-y-2">
                        <div>
                          <span className="legacy-label text-[10px]">Nome Fantasia / Apelido</span>
                          <input className="legacy-input w-full" value={customerForm.fantasia} onChange={e => setCustomerForm({ ...customerForm, fantasia: e.target.value })} />
                        </div>
                        <div>
                          <span className="legacy-label text-[10px]">Nome da Rua / AV</span>
                          <input className="legacy-input w-full" value={customerForm.rua} onChange={e => setCustomerForm({ ...customerForm, rua: e.target.value })} />
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <span className="legacy-label text-[10px]">Bairro</span>
                            <input className="legacy-input w-full" value={customerForm.bairro} onChange={e => setCustomerForm({ ...customerForm, bairro: e.target.value })} />
                          </div>
                          <div className="w-24">
                            <span className="legacy-label text-[10px]">Cidade</span>
                            <input className="legacy-input w-full text-center" value={customerForm.cidade} onChange={e => setCustomerForm({ ...customerForm, cidade: e.target.value })} />
                          </div>
                          <div className="w-16">
                            <span className="legacy-label text-[10px]">UF</span>
                            <select className="legacy-input w-full" value={customerForm.uf} onChange={e => setCustomerForm({ ...customerForm, uf: e.target.value })}>
                              {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => <option key={uf}>{uf}</option>)}
                            </select>
                          </div>
                          <div className="w-24">
                            <span className="legacy-label text-[10px]">CEP</span>
                            <input className="legacy-input w-full text-center" value={customerForm.cep} onChange={e => setCustomerForm({ ...customerForm, cep: e.target.value })} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <div className="w-28">
                            <span className="legacy-label text-[10px]">1º Telefone</span>
                            <input className="legacy-input w-full text-center" value={customerForm.tel1} onChange={e => setCustomerForm({ ...customerForm, tel1: e.target.value })} placeholder="(00) 0000-0000" />
                          </div>
                          <div className="w-28">
                            <span className="legacy-label text-[10px]">2º Telefone</span>
                            <input className="legacy-input w-full text-center" value={customerForm.tel2} onChange={e => setCustomerForm({ ...customerForm, tel2: e.target.value })} />
                          </div>
                          <div className="w-28">
                            <span className="legacy-label text-[10px]">Nº Celular</span>
                            <input className="legacy-input w-full text-center" value={customerForm.celular} onChange={e => setCustomerForm({ ...customerForm, celular: e.target.value })} placeholder="(00) 00000-0000" />
                          </div>
                          <div className="w-28">
                            <span className="legacy-label text-[10px]">Whatsapp</span>
                            <input className="legacy-input w-full text-center" value={customerForm.whatsapp} onChange={e => setCustomerForm({ ...customerForm, whatsapp: e.target.value })} placeholder="(00) 00000-0000" />
                          </div>
                          <div className="flex-1">
                            <span className="legacy-label text-[10px]">Complemento</span>
                            <input className="legacy-input w-full" value={customerForm.complemento} onChange={e => setCustomerForm({ ...customerForm, complemento: e.target.value })} />
                          </div>
                        </div>
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <span className="legacy-label text-[10px]">E-mail</span>
                            <div className="flex gap-1"><input className="legacy-input flex-1" type="email" value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} /><button className="bg-gray-200 border px-2 text-gray-500" onClick={() => customerForm.email && window.open(`mailto:${customerForm.email}`)}>@</button></div>
                          </div>
                          <div className="w-48">
                            <span className="legacy-label text-[10px]">Contato</span>
                            <div className="flex gap-1"><input className="legacy-input flex-1" value={customerForm.contato} onChange={e => setCustomerForm({ ...customerForm, contato: e.target.value })} /><button className="bg-gray-200 border px-2 text-gray-600 text-[10px]" onClick={() => toast({ title: 'ℹ️ Gerenciamento de Contatos disponível em breve.' })}>CONTATOS</button></div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <span className="legacy-label text-[10px]">SKYPE</span>
                            <input className="legacy-input w-full" value={customerForm.skype} onChange={e => setCustomerForm({ ...customerForm, skype: e.target.value })} />
                          </div>
                          <div className="flex-1">
                            <span className="legacy-label text-[10px]">Rede Social</span>
                            <input className="legacy-input w-full" value={customerForm.redeSocial} onChange={e => setCustomerForm({ ...customerForm, redeSocial: e.target.value })} />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <span className="legacy-label text-[10px]">Nº CNPJ</span>
                            <input className="legacy-input w-full text-center" value={customerForm.cnpj} onChange={e => setCustomerForm({ ...customerForm, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
                          </div>
                          <div className="flex-1">
                            <span className="legacy-label text-[10px]">Nº IE</span>
                            <input className="legacy-input w-full" value={customerForm.ie} onChange={e => setCustomerForm({ ...customerForm, ie: e.target.value })} />
                          </div>
                          <div className="flex-1">
                            <span className="legacy-label text-[10px]">Nº IM</span>
                            <input className="legacy-input w-full" value={customerForm.im} onChange={e => setCustomerForm({ ...customerForm, im: e.target.value })} />
                          </div>
                          <div className="flex-1">
                            <span className="legacy-label text-[10px]">Nº CPF</span>
                            <input className="legacy-input w-full" value={customerForm.cpf} onChange={e => setCustomerForm({ ...customerForm, cpf: e.target.value })} placeholder="000.000.000-00" />
                          </div>
                          <div className="flex-1">
                            <span className="legacy-label text-[10px]">Nº RG</span>
                            <input className="legacy-input w-full" value={customerForm.rg} onChange={e => setCustomerForm({ ...customerForm, rg: e.target.value })} />
                          </div>
                          <div className="flex-1">
                            <span className="legacy-label text-[10px]">Orgão Emissor</span>
                            <input className="legacy-input w-full" value={customerForm.orgaoEmissor} onChange={e => setCustomerForm({ ...customerForm, orgaoEmissor: e.target.value })} />
                          </div>
                        </div>
                      </div>
                    )}
                    {customerRegistrationTab === 'filiacao' && (
                      <div className="space-y-2 p-2">
                        <p className="text-[11px] text-gray-500 font-bold">Filiação e Avaliação Financeira</p>
                        <div className="grid grid-cols-2 gap-2">
                          <div><span className="legacy-label text-[10px]">Nome do Pai</span><input className="legacy-input w-full" placeholder="Nome do pai" /></div>
                          <div><span className="legacy-label text-[10px]">Nome da Mãe</span><input className="legacy-input w-full" placeholder="Nome da mãe" /></div>
                          <div><span className="legacy-label text-[10px]">Data de Nascimento</span><input className="legacy-input w-full" placeholder="dd/mm/aaaa" /></div>
                          <div><span className="legacy-label text-[10px]">Limite de Crédito (R$)</span><input type="number" className="legacy-input w-full text-right" defaultValue={0} /></div>
                          <div><span className="legacy-label text-[10px]">Profissão</span><input className="legacy-input w-full" /></div>
                          <div><span className="legacy-label text-[10px]">Empresa onde trabalha</span><input className="legacy-input w-full" /></div>
                        </div>
                      </div>
                    )}
                    {customerRegistrationTab === 'historico' && (
                      <div className="space-y-2 p-2">
                        <p className="text-[11px] text-gray-500 font-bold">Informações / Observações / Histórico</p>
                        <textarea className="legacy-textarea w-full" rows={8} placeholder="Observações gerais, histórico de atendimento, registros importantes..." />
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-2" style={{ minHeight: 80 }}>
                    <div className="w-3/4 flex flex-col relative">
                      <span className="legacy-label text-[10px] absolute -top-2 left-2 bg-white px-1">Observações Gerais</span>
                      <div className="border border-gray-400 p-2 flex-1 bg-yellow-50 flex gap-4 mt-1">
                        <label className="flex items-center gap-1 text-[11px] font-bold cursor-pointer">
                          <input type="radio" name="clientStatusRadio" value="liberar" checked={customerForm.clientStatus === 'liberar'} onChange={() => setCustomerForm({ ...customerForm, clientStatus: 'liberar' })} /> LIBERAR
                        </label>
                        <label className="flex items-center gap-1 text-[11px] font-bold cursor-pointer">
                          <input type="radio" name="clientStatusRadio" value="restringir" checked={customerForm.clientStatus === 'restringir'} onChange={() => setCustomerForm({ ...customerForm, clientStatus: 'restringir' })} /> RESTRINGIR
                        </label>
                        <label className="flex items-center gap-1 text-[11px] font-bold cursor-pointer">
                          <input type="radio" name="clientStatusRadio" value="bloquear" checked={customerForm.clientStatus === 'bloquear'} onChange={() => setCustomerForm({ ...customerForm, clientStatus: 'bloquear' })} /> BLOQUEAR
                        </label>
                      </div>
                    </div>
                    <div className="w-1/4 flex flex-col gap-1">
                      <button className="legacy-button flex-1 flex items-center justify-center gap-2" onClick={() => {
                        const win = window.open('', '_blank', 'width=600,height=400');
                        if (!win) return;
                        win.document.write(`<html><head><title>Ficha do Cliente</title><style>body{font-family:Tahoma,Arial,sans-serif;font-size:12px;padding:16px}h2{margin:0 0 8px}p{margin:2px 0}.section{margin-top:12px;border-top:1px solid #ccc;padding-top:8px}</style></head><body>
                          <h2>SD Móveis Projetados — Ficha de Cliente</h2>
                          <p><b>Nome:</b> ${customerForm.name}</p>
                          <p><b>Fantasia:</b> ${customerForm.fantasia}</p>
                          <p><b>Endereço:</b> ${customerForm.rua}, ${customerForm.bairro} - ${customerForm.cidade}/${customerForm.uf} ${customerForm.cep}</p>
                          <div class="section">
                          <p><b>Tel 1:</b> ${customerForm.tel1} | <b>Cel:</b> ${customerForm.celular} | <b>WhatsApp:</b> ${customerForm.whatsapp}</p>
                          <p><b>E-mail:</b> ${customerForm.email}</p>
                          <p><b>CPF:</b> ${customerForm.cpf} | <b>CNPJ:</b> ${customerForm.cnpj}</p>
                          <p><b>Seguimento:</b> ${customerForm.seguimento} | <b>Status:</b> ${customerForm.clientStatus.toUpperCase()}</p>
                          </div>
                          </body></html>`);
                        win.document.close(); win.print();
                      }}><Printer size={16} className="text-orange-600" /> Imprimir Ficha</button>
                      <button
                        className="legacy-button flex-1 flex items-center justify-center gap-2"
                        disabled={savingCustomer}
                        onClick={saveCustomer}
                      >
                        <CheckSquare size={16} className="text-green-600" />
                        {savingCustomer ? 'Salvando...' : 'Salvar Cadastro'}
                      </button>
                      <button className="legacy-button flex-1 flex items-center justify-center gap-2" onClick={() => setShowCustomerRegistrationModal(false)}><X size={16} className="text-blue-600" /> SAIR</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW: Product Search Modal ─────────────────────────────────────── */}
      {showProductSearchModal && (
        <div className="legacy-modal-scope fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-400 rounded shadow-lg w-full max-w-6xl flex flex-col" style={{ fontFamily: 'Tahoma,Arial,sans-serif', fontSize: 11, height: '90vh', color: '#000' }}>
            <div className="bg-[#dde] px-3 py-2 flex items-center justify-between border-b border-gray-400">
              <span className="font-bold text-sm">PESQUISA DOS PRODUTOS & SERVIÇOS CADASTRADOS &lt;&lt;&lt;</span>
              <button onClick={() => setShowProductSearchModal(false)}><X size={14} /></button>
            </div>
            <div className="p-2 bg-[#f0f0f0] flex-1 flex flex-col gap-2">
              <div className="flex gap-2 items-end">
                <div className="w-32">
                  <span className="legacy-label text-[10px]">Ordenar a Pesquisa</span>
                  <select className="legacy-input w-full"><option>Por Descrição</option></select>
                </div>
                <div className="flex-1">
                  <span className="legacy-label text-[10px]">Filtro Geral</span>
                  <select className="legacy-input w-full"><option>Pesquisar TODOS</option></select>
                </div>
                <div className="flex-1">
                  <span className="legacy-label text-[10px]">Filtro por Categoria</span>
                  <select className="legacy-input w-full"><option>Pesquisar TODOS</option></select>
                </div>
                <div className="flex gap-2">
                  <button className="legacy-button flex flex-col items-center justify-center w-12 h-12" onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = () => { toast({ title: '✅ Imagem anexada para pesquisa com sucesso!' }) };
                    input.click();
                  }}><ImageIcon size={16} className="text-green-600" /><span className="text-[9px]">Imagem</span></button>
                  <button className="legacy-button flex flex-col items-center justify-center w-12 h-12" onClick={() => {
                    const bc = window.prompt('Passe o leitor ou digite o código de barras:');
                    if(bc) { setProductSearchStr(bc); toast({ title: 'Buscando código: ' + bc }); }
                  }}><div className="w-4 h-3 bg-gray-500 mb-1" /><span className="text-[9px]">CodBarra</span></button>
                  <button className="legacy-button flex flex-col items-center justify-center w-12 h-12" onClick={() => { openProductRegistrationForm(); }}><Plus size={16} className="text-green-600" /><span className="text-[9px]">Incluir</span></button>
                </div>
                <div className="w-12"></div>
                <div className="w-12 text-right">
                  <button className="legacy-button flex flex-col items-center justify-center w-12 h-12 ml-auto" onClick={() => setShowProductSearchModal(false)}><LogOut size={16} className="text-blue-600" /><span className="text-[9px]">Sair</span></button>
                </div>
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <span className="legacy-label text-[10px]">Pesquisar por Descrição</span>
                  <input className="legacy-input w-full bg-yellow-50" value={productSearchStr} onChange={e => setProductSearchStr(e.target.value)} />
                </div>
                <div className="flex-1">
                  <span className="legacy-label text-[10px]">Rastrear Palavras</span>
                  <div className="flex"><input className="legacy-input flex-1" /><button className="bg-gray-200 border px-1"><Search size={12} /></button></div>
                </div>
                <div className="w-48">
                  <span className="legacy-label text-[10px]">Referencia</span>
                  <input className="legacy-input w-full bg-yellow-50" />
                </div>
                <div className="flex gap-2 ml-4 mb-1">
                  <label className="flex items-center gap-1 text-[11px]"><input type="radio" name="listType" defaultChecked /> Lista A</label>
                  <label className="flex items-center gap-1 text-[11px]"><input type="radio" name="listType" /> Lista B</label>
                </div>
              </div>

              <div className="flex-1 border border-gray-400 bg-white overflow-hidden mt-1 flex flex-col">
                <div className="flex-1 overflow-auto">
                  <table className="legacy-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                      <tr>
                        <th>Referencia</th>
                        <th>Código</th>
                        <th>Descrição do Produto</th>
                        <th>Uni</th>
                        <th>Valor Avista</th>
                        <th>Valor Aprazo</th>
                        <th>Valor Atacado</th>
                        <th>Est. Atual</th>
                        <th>Grupo / Categoria</th>
                        <th>Marca do Produto</th>
                        <th>Localização do Produto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productsList.filter(prod =>
                        !productSearchStr ||
                        (prod?.name || '').toLowerCase().includes(productSearchStr.toLowerCase()) ||
                        (prod?.reference || '').toLowerCase().includes(productSearchStr.toLowerCase())
                      ).map((prod, i) => {
                        const pAvista = prod?.price_avista ?? prod?.price ?? 0;
                        const pAprazo = prod?.price_aprazo ?? +(pAvista * 1.15).toFixed(2);
                        const pAtacado = prod?.price_atacado ?? +(pAvista * 0.9).toFixed(2);
                        return (
                          <tr key={prod?.id || i} style={{ backgroundColor: '#c8e6c9', borderBottom: '1px solid #a5d6a7', cursor: 'pointer' }}
                            onClick={() => {
                              const usedValue = activePriceTable === 'aprazo' ? pAprazo : activePriceTable === 'atacado' ? pAtacado : pAvista;
                              openItemForm({
                                id: Date.now().toString(), description: prod?.name || '', unit: prod?.unit || 'un',
                                width: 0, height: 0, value: usedValue, quantity: 1, total_m2: 0, total_value: usedValue,
                                price_table: activePriceTable, price_avista: pAvista, price_aprazo: pAprazo, price_atacado: pAtacado,
                              });
                              setShowProductSearchModal(false);
                            }}
                            onDoubleClick={(e) => { e.stopPropagation(); openProductRegistrationForm(prod); }}
                          >
                            <td style={{ width: 80 }}><div className="flex justify-between items-center"><Camera size={10} className="text-gray-500" /></div></td>
                            <td style={{ width: 60, textAlign: 'right' }}>{prod?.reference || String(i + 1)}</td>
                            <td>{prod?.name || ''}</td>
                            <td style={{ width: 40, textAlign: 'center' }}>{(prod?.unit || 'UN').toUpperCase()}</td>
                            <td style={{ width: 75, textAlign: 'right' }}>{fmtMoney(pAvista)}</td>
                            <td style={{ width: 75, textAlign: 'right' }}>{fmtMoney(pAprazo)}</td>
                            <td style={{ width: 75, textAlign: 'right' }}>{fmtMoney(pAtacado)}</td>
                            <td style={{ width: 80, textAlign: 'right' }}>{fmtMoney(prod?.current_stock ?? 0)}</td>
                            <td>{prod?.category || ''}</td>
                            <td>{prod?.brand || ''}</td>
                            <td>{prod?.location || ''}</td>
                          </tr>
                        );
                      })}
                      {productsList.length === 0 && (
                        <tr><td colSpan={10} style={{ textAlign: 'center', padding: 12, color: '#666' }}>Nenhum produto cadastrado. Cadastre produtos na aba de produtos.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="bg-[#f0f0f0] border-t border-gray-400 p-1 flex justify-between text-[10px]">
                  <div className="flex gap-4">
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-600" /> &gt; Habilitar o Gerenciamento do Estoque por Cores</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500" /> Em estoque</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-400" /> Estoque Baixo</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-400" /> Estoque Zerado</span>
                    <span className="text-gray-500">| Item Serviço ou sem Controle de Estoque</span>
                  </div>
                  <span>Para sair ESC ou botão SAIR</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW: OS Search Modal ──────────────────────────────────────────── */}
      {showOSSearchModal && (
        <div className="legacy-modal-scope fixed inset-0 z-[90] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-gray-400 rounded shadow-lg w-full max-w-6xl flex flex-col" style={{ fontFamily: 'Tahoma,Arial,sans-serif', fontSize: 11, height: '90vh', color: '#000' }}>
            <div className="bg-[#dde] px-3 py-2 flex items-center justify-between border-b border-gray-400">
              <span className="font-bold text-sm">Pesquisa e Consultas de Registros (Ordens de Serviço e Orçamentos)</span>
              <button onClick={() => setShowOSSearchModal(false)}><X size={14} /></button>
            </div>
            <div className="p-2 bg-[#f0f0f0] flex-1 flex flex-col gap-2">
              
              {/* 📁 PASTA TABS DE SELEÇÃO DE REGISTROS */}
              <div className="flex gap-2 bg-[#d8d8d8] p-1.5 rounded border border-gray-300">
                <button
                  className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1.5 transition-all ${
                    searchFolder === 'os'
                      ? 'bg-[#0000aa] text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                  onClick={() => setSearchFolder('os')}
                >
                  <ClipboardList size={13} /> 📁 Pasta: Ordens de Serviço ({osSearchOsCount})
                </button>

                <button
                  className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1.5 transition-all ${
                    searchFolder === 'orcamento'
                      ? 'bg-[#aa5500] text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                  onClick={() => setSearchFolder('orcamento')}
                >
                  <FileText size={13} /> 📁 Pasta: Orçamentos ({osSearchOrcCount})
                </button>

                <button
                  className={`px-3 py-1.5 text-xs font-bold rounded flex items-center gap-1.5 transition-all ${
                    searchFolder === 'todos'
                      ? 'bg-gray-700 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                  }`}
                  onClick={() => setSearchFolder('todos')}
                >
                  <Folder size={13} /> 📂 Todos os Registros ({osList.length})
                </button>
              </div>

              <div className="flex gap-2 items-end">
                <div className="w-48">
                  <span className="legacy-label text-[10px]">Filtrar por Pasta</span>
                  <select className="legacy-input w-full" value={searchFolder} onChange={e => setSearchFolder(e.target.value as any)}>
                    <option value="todos">📂 TODOS OS REGISTROS</option>
                    <option value="os">📁 PASTA: ORDENS DE SERVIÇO</option>
                    <option value="orcamento">📁 PASTA: ORÇAMENTOS</option>
                  </select>
                </div>
                <div className="flex-1">
                  <span className="legacy-label text-[10px]">Pesquisar por Nome / Nº</span>
                  <input className="legacy-input w-full bg-yellow-50 font-bold" value={osSearchStr} onChange={e => setOsSearchStr(e.target.value)} placeholder="Digite o nome do cliente ou número..." />
                </div>
                <div className="flex gap-1 mb-1">
                  <button className="legacy-button px-2 py-1 bg-green-100 border border-green-400 rounded flex items-center gap-1" onClick={async () 
