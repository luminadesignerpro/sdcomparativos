import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FileDown, Upload, Loader2, CheckCircle, AlertCircle, X, Receipt, User, Package, DollarSign } from 'lucide-react';
import { Card3D } from '@/components/animations/Card3D';

interface ExtractedData {
  identificacao: {
    numero_os: string;
    data: string;
    hora: string;
  };
  cliente: {
    nome: string;
    cidade: string;
    endereco?: string;
    telefone?: string;
  };
  itens: Array<{
    descricao: string;
    valor_unitario: number;
    quantidade: number;
    total_value: number;
  }>;
  financeiro: {
    valor_total_os: number;
    condicoes_pagamento: string;
  };
}

const PdfUploader: React.FC<{ 
  mode?: 'os' | 'venda' | 'contrato',
  onClose?: () => void, 
  onSuccess?: () => void 
}> = ({ mode = 'os', onClose, onSuccess }) => {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setExtractedData(null);
    }
  };

  const processPdf = async () => {
    if (!file) return;

    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('extract-pdf-data', {
        body: formData,
      });

      if (error) throw error;

      setExtractedData(data);
      toast({
        title: "✅ Dados extraídos!",
        description: "Confira as informações antes de salvar no banco de dados.",
      });
    } catch (error: any) {
      console.error("Erro ao processar PDF:", error);
      toast({
        title: "❌ Erro no processamento",
        description: error.message || "Não foi possível extrair os dados do PDF.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const saveToSupabase = async () => {
    if (!extractedData) return;

    setIsSaving(true);
    try {
      // 1. Resolver ou criar cliente
      let clientId: string;
      const { data: existingClient } = await supabase
        .from('clients')
        .select('id')
        .ilike('name', `%${extractedData.cliente.nome}%`)
        .maybeSingle();

      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const { data: newClient, error: clientErr } = await supabase
          .from('clients')
          .insert({
            name: extractedData.cliente.nome,
            address: `${extractedData.cliente.cidade}${extractedData.cliente.endereco ? ', ' + extractedData.cliente.endereco : ''}`,
            phone: extractedData.cliente.telefone || null,
          })
          .select('id')
          .single();
        
        if (clientErr) throw clientErr;
        clientId = newClient.id;
      }

      let recordId: string;
      let tableName: string;

      // 2. Criar o registro conforme o modo
      if (mode === 'venda') {
        tableName = 'client_projects';
        const { data: record, error: err } = await supabase
          .from('client_projects')
          .insert({
            client_id: clientId,
            title: `Projeto - OS #${extractedData.identificacao.numero_os}`,
            description: `Importado via PDF. ${extractedData.identificacao.data}`,
            status: 'em_negociacao',
            value: extractedData.financeiro.valor_total_os,
            notes: `Extraído em: ${new Date().toLocaleString()}`,
            deadline: extractedData.identificacao.data,
          })
          .select('id')
          .single();
        if (err) throw err;
        recordId = record.id;
      } else if (mode === 'contrato') {
        tableName = 'contracts';
        const { data: record, error: err } = await supabase
          .from('contracts')
          .insert({
            client_id: clientId,
            title: `Contrato - OS #${extractedData.identificacao.numero_os}`,
            content: `Condições: ${extractedData.financeiro.condicoes_pagamento}`,
            status: 'rascunho',
            value: extractedData.financeiro.valor_total_os,
            notes: `Importado via PDF em: ${new Date().toLocaleString()}`,
          })
          .select('id')
          .single();
        if (err) throw err;
        recordId = record.id;
      } else {
        // Padrão: OS
        tableName = 'service_orders';
        const { data: os, error: osErr } = await supabase
          .from('service_orders')
          .insert({
            client_id: clientId,
            description: `Importado via PDF - OS #${extractedData.identificacao.numero_os}`,
            status: 'aberta',
            total_value: extractedData.financeiro.valor_total_os,
            notes: `Condições: ${extractedData.financeiro.condicoes_pagamento}\nExtraído em: ${new Date().toLocaleString()}`,
            estimated_date: extractedData.identificacao.data,
          })
          .select('id')
          .single();
        if (osErr) throw osErr;
        recordId = os.id;

        // Inserir itens vinculados (apenas para OS por enquanto, ou se as outras tabelas suportarem)
        if (extractedData.itens && extractedData.itens.length > 0) {
          await supabase
            .from('itens_projeto')
            .insert(
              extractedData.itens.map(item => ({
                service_order_id: recordId,
                description: item.descricao || 'Item sem descrição',
                unit_value: Number(item.valor_unitario ?? 0),
                quantity: Number(item.quantidade ?? 1),
                total_value: Number(item.total_value ?? item.valor_total ?? 0),
              }))
            );
        }
      }

      // 4. Upload do PDF original
      const fileName = `${mode}_${extractedData.identificacao.numero_os}_${Date.now()}.pdf`;
      const folder = mode === 'os' ? 'service_orders' : (mode === 'venda' ? 'projects' : 'contracts');
      const { data: uploadData, error: storageErr } = await supabase.storage
        .from('documents')
        .upload(`${folder}/${fileName}`, file!);
      
      if (!storageErr) {
        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(`${folder}/${fileName}`);
        await supabase.from(tableName).update({ pdf_url: publicUrl }).eq('id', recordId);
      }

      toast({
        title: "🎉 Sucesso!",
        description: `Importação para ${mode.toUpperCase()} realizada com sucesso.`,
      });

      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (error: any) {
      console.error("Erro ao salvar no Supabase:", error);
      toast({
        title: "❌ Erro ao salvar",
        description: error.message || "Ocorreu um erro ao gravar os dados no banco.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls = "w-full h-11 bg-white/5 rounded-xl px-4 border border-white/10 text-white text-sm focus:border-amber-500 outline-none";

  return (
    <div className="bg-[#111111] rounded-[32px] border border-amber-500/20 p-8 w-full max-w-4xl text-white shadow-2xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 flex items-center gap-3">
            <FileDown className="w-8 h-8 text-amber-500" />
            Descarregador de PDF
          </h2>
          <p className="text-gray-400 mt-1">Importação inteligente de Orçamentos SD Móveis</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-2xl transition-all">
            <X className="w-6 h-6 text-gray-500 hover:text-white" />
          </button>
        )}
      </div>

      {!extractedData ? (
        <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-[32px] p-12 bg-white/5 hover:border-amber-500/50 transition-all group">
          <Upload className="w-16 h-16 text-gray-600 group-hover:text-amber-500 transition-all mb-4 group-hover:scale-110" />
          <p className="text-gray-400 font-bold text-center mb-6">
            Arraste o PDF do orçamento aqui ou clique para selecionar
          </p>
          <input 
            type="file" 
            accept="application/pdf" 
            onChange={handleFileChange}
            className="hidden" 
            id="pdf-upload"
          />
          <label 
            htmlFor="pdf-upload"
            className="cursor-pointer bg-white/10 px-8 py-3 rounded-2xl font-bold hover:bg-white/20 transition-all border border-white/10"
          >
            {file ? file.name : "Selecionar Arquivo"}
          </label>

          {file && (
            <button
              onClick={processPdf}
              disabled={isProcessing}
              className="mt-8 bg-gradient-to-r from-amber-500 to-amber-400 text-black px-12 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-glow disabled:opacity-50"
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Processando com IA...
                </span>
              ) : "Extrair Dados Agora"}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Identificação & Cliente */}
            <div className="space-y-6">
              <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
                <h3 className="text-sm font-bold text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Receipt className="w-4 h-4" /> Identificação
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase">OS #</label>
                    <p className="text-xl font-black text-white">{extractedData.identificacao.numero_os}</p>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 font-bold uppercase">Data</label>
                    <p className="text-lg font-bold text-white">{extractedData.identificacao.data}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/5 rounded-3xl p-6 border border-white/10">
                <h3 className="text-sm font-bold text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <User className="w-4 h-4" /> Cliente
                </h3>
                <div>
                  <label className="text-[10px] text-gray-500 font-bold uppercase">Nome</label>
                  <p className="text-xl font-black text-white">{extractedData.cliente.nome}</p>
                </div>
                <div className="mt-4">
                  <label className="text-[10px] text-gray-500 font-bold uppercase">Cidade</label>
                  <p className="text-white font-bold">{extractedData.cliente.cidade}</p>
                </div>
              </div>
            </div>

            {/* Financeiro */}
            <div className="bg-white/5 rounded-3xl p-6 border border-white/10 flex flex-col">
              <h3 className="text-sm font-bold text-amber-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <DollarSign className="w-4 h-4" /> Financeiro
              </h3>
              <div className="mb-6">
                <label className="text-[10px] text-gray-500 font-bold uppercase">Valor Total</label>
                <p className="text-4xl font-black text-amber-400">R$ {(extractedData.financeiro?.valor_total_os ?? 0).toLocaleString('pt-BR')}</p>
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-gray-500 font-bold uppercase">Condições de Pagamento</label>
                <p className="text-gray-300 italic">"{extractedData.financeiro.condicoes_pagamento}"</p>
              </div>
            </div>
          </div>

          {/* Itens */}
          <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-bold text-amber-500 uppercase tracking-widest flex items-center gap-2">
                <Package className="w-4 h-4" /> Itens do Projeto
              </h3>
              <span className="text-xs text-gray-500">{extractedData.itens.length} itens detectados</span>
            </div>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="bg-[#1a1a1a] text-[10px] font-bold text-gray-500 uppercase">
                  <tr>
                    <th className="p-4">Descrição</th>
                    <th className="p-4 text-center">Qtd</th>
                    <th className="p-4 text-right">Unitário</th>
                    <th className="p-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-white/5">
                  {extractedData.itens.map((item, idx) => (
                    <tr key={idx} className="hover:bg-white/5">
                      <td className="p-4 font-bold text-white">{item.descricao}</td>
                      <td className="p-4 text-center text-gray-400">{item.quantidade}</td>
                      <td className="p-4 text-right text-gray-400">R$ {(item.valor_unitario ?? 0).toLocaleString('pt-BR')}</td>
                      <td className="p-4 text-right font-bold text-amber-200">R$ {(item.total_value ?? item.valor_total ?? 0).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              onClick={saveToSupabase}
              disabled={isSaving}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-400 text-black h-16 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
              Gravar no Supabase & Sincronizar App
            </button>
            <button
              onClick={() => setExtractedData(null)}
              className="px-8 bg-white/5 border border-white/10 text-white rounded-2xl font-bold hover:bg-white/10 transition-all"
            >
              Tentar Outro
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PdfUploader;
