import React, { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FileSignature, Download, Sparkles, Loader2, Eye, X, Plus, Trash2, Save } from 'lucide-react';
import jsPDF from 'jspdf';
import logoSrc from '@/assets/logo-sd.jpeg';

interface ContractGeneratorProps {
  templateType: 'contrato_servico' | 'ordem_servico';
  clients: Array<{ id: string; name: string; phone?: string; email?: string; address?: string }>;
  onClose: () => void;
  onSaved?: () => void;
}



const ContractGenerator: React.FC<ContractGeneratorProps> = ({ templateType, clients, onClose, onSaved }) => {
  const { toast } = useToast();
  const [generatedContent, setGeneratedContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editableContent, setEditableContent] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);

  // Form fields
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientBairro, setClientBairro] = useState('');
  const [clientCity, setClientCity] = useState('');
  const [clientCep, setClientCep] = useState('');
  const [clientCpf, setClientCpf] = useState('');

  const [valorTotal, setValorTotal] = useState('');
  const [ambientes, setAmbientes] = useState<string[]>(['']);
  const [formaPagamento, setFormaPagamento] = useState('');
  const [prazoEntrega, setPrazoEntrega] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [customInstructions, setCustomInstructions] = useState('');

  // OS specific
  const [valorMaterial, setValorMaterial] = useState('');
  const [valorServico, setValorServico] = useState('');
  const [valorFrete, setValorFrete] = useState('');
  const [valorDesconto, setValorDesconto] = useState('');

  const selectedClient = clients.find(c => c.id === clientId);

  const handleClientSelect = (id: string) => {
    setClientId(id);
    const c = clients.find(cl => cl.id === id);
    if (c) {
      setClientName(c.name || '');
      setClientPhone(c.phone || '');
      setClientEmail(c.email || '');
      setClientAddress(c.address || '');
    }
  };

  const addAmbiente = () => setAmbientes(prev => [...prev, '']);
  const removeAmbiente = (i: number) => setAmbientes(prev => prev.filter((_, idx) => idx !== i));
  const updateAmbiente = (i: number, val: string) => setAmbientes(prev => prev.map((a, idx) => idx === i ? val : a));

  const generateContract = async () => {
    if (!clientName.trim()) {
      toast({ title: '⚠️ Informe o nome do cliente', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const clientData: Record<string, string> = {
        nome_cliente: clientName,
        telefone_cliente: clientPhone,
        email_cliente: clientEmail,
        endereco_cliente: clientAddress,
        bairro_cliente: clientBairro,
        cidade_cliente: clientCity || 'Fortaleza',
        cep_cliente: clientCep,
        cpf_cliente: clientCpf,
      };

      const projectData: Record<string, any> = {
        valor_total: valorTotal,
        ambientes: ambientes.filter(a => a.trim()).join(', '),
        forma_pagamento: formaPagamento,
        prazo_entrega: prazoEntrega,
        observacoes,
        data_contrato: new Date().toLocaleDateString('pt-BR'),
      };

      if (templateType === 'ordem_servico') {
        projectData.valor_material = valorMaterial;
        projectData.valor_servico = valorServico;
        projectData.valor_frete = valorFrete;
        projectData.valor_desconto = valorDesconto;
      }

      const { data, error } = await supabase.functions.invoke('generate-contract', {
        body: { templateType, clientData, projectData, customInstructions },
      });

      if (error) throw error;

      const content = data?.content || '';
      setGeneratedContent(content);
      setEditableContent(content);
      toast({ title: '✅ Contrato gerado com sucesso!' });
    } catch (err: any) {
      console.error(err);
      toast({ title: '❌ Erro ao gerar contrato', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const saveContract = async () => {
    if (!editableContent.trim()) return;
    setSaving(true);
    try {
      let finalClientId = clientId || null;

      // Create client if needed
      let generatedAccessCode = '';
      if (!finalClientId && clientName.trim()) {
        // Generate access code (6 chars)
        generatedAccessCode = 'SD' + Math.random().toString(36).substring(2, 6).toUpperCase();
        const { data: newClient, error: clientErr } = await (supabase as any).from('clients').insert({
          name: clientName.trim(),
          phone: clientPhone || null,
          email: clientEmail || null,
          address: clientAddress || null,
          access_code: generatedAccessCode,
        }).select('id').single();
        if (clientErr) throw clientErr;
        finalClientId = newClient.id;

        // Send WhatsApp with app link and password
        if (clientPhone) {
          const phone = clientPhone.replace(/\D/g, '');
          const fullPhone = phone.startsWith('55') ? phone : `55${phone}`;
          const appLink = 'https://id-preview--6022537e-6821-48b5-a068-3f599516f310.lovable.app';
          const message = `🏠 *SD Móveis Projetados*\n\nOlá ${clientName.trim()}! Seu cadastro foi realizado com sucesso.\n\n📱 *Acesse nosso app:*\n${appLink}\n\n🔐 *Sua senha de acesso:*\n${generatedAccessCode}\n\nSelecione "Cliente" na tela inicial e use sua senha para acompanhar seu projeto!\n\n_SD Móveis - Transformando sonhos em realidade_`;
          try {
            await supabase.functions.invoke('whatsapp-send', {
              body: { phone: fullPhone, message },
            });
          } catch (whatsErr) {
            console.error('Erro ao enviar WhatsApp:', whatsErr);
          }
        }
      }

      const title = templateType === 'ordem_servico'
        ? `OS - ${clientName}`
        : `Contrato - ${clientName}`;

      const { error } = await (supabase as any).from('contracts').insert({
        client_id: finalClientId,
        title,
        content: editableContent,
        value: parseFloat(valorTotal.replace(/\D/g, '')) / 100 || 0,
        status: 'rascunho',
        notes: observacoes,
      });

      if (error) throw error;
      toast({ title: '✅ Contrato salvo no sistema!' });
      onSaved?.();
      onClose();
    } catch (err: any) {
      toast({ title: '❌ Erro ao salvar', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const downloadPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;

    try { doc.addImage(logoSrc, 'JPEG', margin, 10, 30, 30); } catch { }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('SD MÓVEIS', margin + 35, 22);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('RUA JORGE FIGUEREDO 740 - BARROCÃO - ITAITINGA-CE', margin + 35, 28);
    doc.text('(85) 98574-9686 | (85) 99760-2237 | sdmoveis48@gmail.com | CNPJ: 49.228.811/0001-33', margin + 35, 33);

    doc.setDrawColor(200, 150, 50);
    doc.setLineWidth(0.8);
    doc.line(margin, 42, pageWidth - margin, 42);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const title = templateType === 'ordem_servico' ? 'ORDEM DE SERVIÇO' : 'CONTRATO DE PRESTAÇÃO DE SERVIÇO';
    doc.text(title, pageWidth / 2, 52, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(editableContent || generatedContent, contentWidth);
    let y = 62;

    for (const line of lines) {
      if (y > pageHeight - 30) {
        doc.addPage();
        y = 20;
        try { doc.addImage(logoSrc, 'JPEG', pageWidth - margin - 20, 5, 15, 15); } catch { }
      }
      if (/^\d+\./.test(line.trim()) || (line.trim().length < 60 && line.trim() === line.trim().toUpperCase() && line.trim().length > 3)) {
        doc.setFont('helvetica', 'bold');
      } else {
        doc.setFont('helvetica', 'normal');
      }
      doc.text(line, margin, y);
      y += 5;
    }

    if (y < pageHeight - 50) { y = pageHeight - 45; } else { doc.addPage(); y = 40; }
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);
    doc.line(margin, y, margin + 60, y);
    doc.line(pageWidth - margin - 60, y, pageWidth - margin, y);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTRATANTE', margin + 15, y + 5);
    doc.text('CONTRATADO - SD MÓVEIS', pageWidth - margin - 50, y + 5);

    const fileName = templateType === 'ordem_servico'
      ? `OS_${clientName || 'cliente'}.pdf`
      : `Contrato_${clientName || 'cliente'}.pdf`;
    doc.save(fileName);
    toast({ title: '📄 PDF baixado com sucesso!' });
  };

  const isOS = templateType === 'ordem_servico';
  const inputClass = "w-full p-3 rounded-xl border border-white/10 bg-[#1a1a1a] text-white text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none placeholder-gray-600";
  const labelClass = "text-xs font-bold text-gray-400 uppercase mb-1 block";

  return (
    <div className="bg-[#111111] border border-amber-500/20 rounded-3xl shadow-2xl overflow-hidden">
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-4 flex justify-between items-center text-black">
        <h3 className="font-black text-lg flex items-center gap-2" style={{ color: '#000' }}>
          <FileSignature className="w-5 h-5 text-black" />
          {isOS ? 'Gerar Ordem de Serviço' : 'Gerar Contrato de Serviço'}
        </h3>
        <button onClick={onClose} className="text-black/70 hover:text-black transition-colors"><X className="w-5 h-5" /></button>
      </div>

      <div className="p-6 space-y-5 max-h-[80vh] overflow-auto custom-scrollbar">
        {/* ── Cliente ── */}
        <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-black text-white flex items-center gap-2">📋 Dados do Cliente</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelClass}>Cliente cadastrado</label>
              <select value={clientId} onChange={e => handleClientSelect(e.target.value)} className={inputClass}>
                <option value="">— Selecionar ou preencher abaixo —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Nome *</label>
              <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nome completo" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>CPF / CNPJ</label>
              <input value={clientCpf} onChange={e => setClientCpf(e.target.value)} placeholder="000.000.000-00" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Telefone</label>
              <input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="(85) 99999-9999" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="email@email.com" className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className={labelClass}>Endereço completo</label>
              <input value={clientAddress} onChange={e => setClientAddress(e.target.value)} placeholder="Rua, número, complemento" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Bairro</label>
              <input value={clientBairro} onChange={e => setClientBairro(e.target.value)} placeholder="Bairro" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Cidade</label>
              <input value={clientCity} onChange={e => setClientCity(e.target.value)} placeholder="Fortaleza" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>CEP</label>
              <input value={clientCep} onChange={e => setClientCep(e.target.value)} placeholder="00000-000" className={inputClass} />
            </div>
          </div>
        </div>

        {/* ── Ambientes ── */}
        <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm font-black text-white flex items-center gap-2">📦 Ambientes</p>
            <button onClick={addAmbiente} className="text-amber-500 text-xs font-bold flex items-center gap-1 hover:text-amber-400 transition-colors">
              <Plus className="w-4 h-4" /> Adicionar
            </button>
          </div>
          {ambientes.map((amb, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={amb}
                onChange={e => updateAmbiente(i, e.target.value)}
                placeholder={`Ex: Suite Casal, Closet, Cozinha Planejada...`}
                className={inputClass}
              />
              {ambientes.length > 1 && (
                <button onClick={() => removeAmbiente(i)} className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* ── Valores ── */}
        <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-black text-white flex items-center gap-2">💰 Valores e Pagamento</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Valor Total (R$)</label>
              <input value={valorTotal} onChange={e => setValorTotal(e.target.value)} placeholder="15.000,00" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Prazo de Entrega</label>
              <input value={prazoEntrega} onChange={e => setPrazoEntrega(e.target.value)} placeholder="60 dias" className={inputClass} />
            </div>
            {isOS && (
              <>
                <div>
                  <label className={labelClass}>Valor Material (R$)</label>
                  <input value={valorMaterial} onChange={e => setValorMaterial(e.target.value)} placeholder="8.000,00" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Valor Serviço (R$)</label>
                  <input value={valorServico} onChange={e => setValorServico(e.target.value)} placeholder="5.000,00" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Frete (R$)</label>
                  <input value={valorFrete} onChange={e => setValorFrete(e.target.value)} placeholder="500,00" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Desconto (R$)</label>
                  <input value={valorDesconto} onChange={e => setValorDesconto(e.target.value)} placeholder="0,00" className={inputClass} />
                </div>
              </>
            )}
            <div className="col-span-2">
              <label className={labelClass}>Forma de Pagamento</label>
              <input value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)} placeholder="Ex: 50% entrada + 50% na entrega" className={inputClass} />
            </div>
          </div>
        </div>

        {/* ── Observações ── */}
        <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-black text-white flex items-center gap-2">📝 Observações e Instruções</p>
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Observações gerais do contrato..." className={inputClass} rows={2} />
          <textarea value={customInstructions} onChange={e => setCustomInstructions(e.target.value)} placeholder="Instruções adicionais para a IA (opcional)..." className={inputClass} rows={2} />
        </div>

        {/* Generate Button */}
        <button
          onClick={generateContract}
          disabled={loading}
          className="w-full text-black py-4 rounded-xl font-bold transition-transform hover:scale-105 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg text-lg"
          style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
          {loading ? 'Gerando com IA...' : '✨ Gerar Contrato Preenchido com IA'}
        </button>

        {/* Preview */}
        {(generatedContent || editableContent) && (
          <div className="space-y-3 mt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <p className="text-xs font-black text-amber-500 uppercase flex items-center gap-2">
                <Eye className="w-4 h-4" /> Pré-visualização (editável)
              </p>
              <div className="flex gap-2 w-full sm:w-auto">
                <button onClick={saveContract} disabled={saving} className="flex-1 sm:flex-none border border-amber-500/50 bg-amber-500/10 text-amber-500 px-4 py-2 rounded-xl text-sm font-bold hover:bg-amber-500 hover:text-black transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                </button>
                <button onClick={downloadPDF} className="flex-1 sm:flex-none bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-black hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2">
                  <Download className="w-4 h-4" /> PDF
                </button>
              </div>
            </div>

            <div ref={previewRef} className="border border-white/10 rounded-2xl p-6 bg-white max-h-[500px] overflow-auto shadow-2xl">
              <div className="flex items-center gap-4 mb-4 pb-4 border-b-2 border-gray-200">
                <img src={logoSrc} alt="SD Móveis" className="w-16 h-16 object-contain rounded-lg" />
                <div>
                  <h2 className="font-black text-xl text-gray-900">SD MÓVEIS</h2>
                  <p className="text-xs text-gray-500 font-bold">RUA JORGE FIGUEREDO 740 - BARROCÃO - ITAITINGA-CE</p>
                  <p className="text-xs text-gray-500 font-bold">(85) 98574-9686 | sdmoveis48@gmail.com | CNPJ: 49.228.811/0001-33</p>
                </div>
              </div>
              <textarea
                value={editableContent}
                onChange={e => setEditableContent(e.target.value)}
                className="w-full min-h-[300px] text-sm font-mono leading-relaxed border-none outline-none resize-none bg-transparent text-gray-900"
                style={{ whiteSpace: 'pre-wrap' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractGenerator;
