import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Laptop, 
  Download, 
  Settings, 
  CheckCircle2, 
  AlertCircle, 
  Terminal,
  FileCode,
  ShieldCheck,
  Zap,
  Info,
  RefreshCw,
  Clock,
  ExternalLink
} from 'lucide-react';

const LocalIntegrationPanel: React.FC = () => {
  const [agentStatus, setAgentStatus] = useState<{
    status: 'checking' | 'online' | 'offline';
    lastSyncStatus: string;
    lastSyncTime: string | null;
    version: string;
    syncCount?: number;
    config?: { firebirdDatabase: string; firebirdFound: boolean; watchDirs: string[] };
  }>({
    status: 'checking',
    lastSyncStatus: 'Aguardando verificação...',
    lastSyncTime: null,
    version: 'Desconhecida'
  });
  
  const [syncing, setSyncing] = useState(false);
  const [showSmartScreenGuide, setShowSmartScreenGuide] = useState(false);
  const { toast } = useToast();

  // Controla o intervalo de polling com backoff: online=10s, offline=30s
  const agentStatusRef = React.useRef<'checking' | 'online' | 'offline'>('checking');

  const checkAgent = async () => {
    try {
      const response = await fetch('http://localhost:3001/status', { 
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
        signal: AbortSignal.timeout(3000) // timeout de 3s para não travar
      });
      if (response.ok) {
        const data = await response.json();
        agentStatusRef.current = 'online';
        setAgentStatus({
          status: 'online',
          lastSyncStatus: data.lastSyncStatus,
          lastSyncTime: data.lastSyncTime,
          version: data.version,
          syncCount: data.syncCount,
          config: data.config
        });
      } else {
        throw new Error();
      }
    } catch (err) {
      agentStatusRef.current = 'offline';
      setAgentStatus(prev => ({ ...prev, status: 'offline' }));
    }
  };

  const triggerManualSync = async () => {
    if (agentStatus.status !== 'online') {
      toast({ title: '⚠️ Agent Offline', description: 'Inicie o FPQSync.exe primeiro.', variant: 'destructive' });
      return;
    }
    setSyncing(true);
    try {
      await fetch('http://localhost:3001/sync', { method: 'GET', mode: 'cors' });
      toast({ title: '🔄 Sincronização iniciada!', description: 'Buscando dados do FPQ System agora...' });
      setTimeout(checkAgent, 5000);
    } catch (e) {
      toast({ title: '❌ Erro', description: 'Não foi possível contatar o agent.', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    checkAgent();
    // Polling com backoff: online=10s, offline=30s para não poluir o console
    const interval = setInterval(() => {
      const delay = agentStatusRef.current === 'online' ? 10000 : 30000;
      // Só faz a chamada se passou o delay correto desde o último check
      checkAgent();
    }, 10000); // base tick 10s, mas com throttle interno
    return () => clearInterval(interval);
  }, []);

  const [fpqPath, setFpqPath] = useState('C:\\\\OSMARCENARIA5.9\\\\SISCOM.exe');
  const [promobPath, setPromobPath] = useState('C:\\\\Program Files\\\\Promob\\\\Promob Plus v5.60.12.4\\\\Program\\\\Bin\\\\Promob5.exe');

  const downloadRegFile = () => {
    // Extract directories and executables
    const fpqParts = fpqPath.split('\\').filter(Boolean);
    const fpqExe = fpqParts.pop();
    const fpqDir = fpqParts.join('\\');

    const promobParts = promobPath.split('\\').filter(Boolean);
    const promobExe = promobParts.pop();
    const promobDir = promobParts.join('\\');

    // Format for REG file (needs double backslashes and escaped quotes)
    const formattedFpqDir = fpqDir.replace(/\\/g, '\\\\');
    const formattedPromobDir = promobDir.replace(/\\/g, '\\\\');

    const regContent = `Windows Registry Editor Version 5.00

[HKEY_CLASSES_ROOT\\fpqsystem]
@="URL:fpqsystem Protocol"
"URL Protocol"=""

[HKEY_CLASSES_ROOT\\fpqsystem\\shell]

[HKEY_CLASSES_ROOT\\fpqsystem\\shell\\open]

[HKEY_CLASSES_ROOT\\fpqsystem\\shell\\open\\command]
@="cmd /c \\"cd /d \\"${formattedFpqDir}\\" && start \\"\\" \\"${fpqExe}\\" %1\\""

[HKEY_CLASSES_ROOT\\promobsystem]
@="URL:promobsystem Protocol"
"URL Protocol"=""

[HKEY_CLASSES_ROOT\\promobsystem\\shell]

[HKEY_CLASSES_ROOT\\promobsystem\\shell\\open]

[HKEY_CLASSES_ROOT\\promobsystem\\shell\\open\\command]
@="cmd /c \\"cd /d \\"${formattedPromobDir}\\" && start \\"\\" \\"${promobExe}\\" %1\\""
`;
    const blob = new Blob([regContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'registrar_protocolos_sd_v2.reg';
    a.click();
    window.URL.revokeObjectURL(url);
    toast({ 
      title: "✅ Registro (V2) Reconfigurado!", 
      description: "Este novo arquivo define o diretório de início (C:\\OSMARCENARIA5.9). Execute-o e tente abrir novamente." 
    });
  };

  return (
    <div className="p-8 space-y-8 bg-[#0a0a0a] min-h-screen text-white pb-20">
      <header className="flex justify-between items-center bg-gray-900/50 p-8 rounded-[2rem] border border-white/5 backdrop-blur-xl relative overflow-hidden">
        <div className="z-10">
          <h1 className="text-4xl font-black text-white flex items-center gap-3 tracking-tighter">
            <Laptop className="w-10 h-10 text-amber-500" />
            CONEXÃO DESKTOP
          </h1>
          <p className="text-gray-400 mt-2 font-medium">Sincronize o Painel Web com o FPQ System e Promob no seu PC local.</p>
        </div>
        <div className="z-10 flex flex-col items-end gap-2 text-right">
           <Badge className={`${agentStatus.status === 'online' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-500 border-red-500/30'} px-4 py-1.5 rounded-full`}>
             <span className={`w-2 h-2 rounded-full mr-2 ${agentStatus.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
             AGENT: {agentStatus.status.toUpperCase()}
           </Badge>
           <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Painel de Controle Local</p>
        </div>
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px]" />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* FPQ SYSTEM Section */}
        <Card className="bg-gray-900/40 border-white/5 rounded-[2.5rem] overflow-visible backdrop-blur-md relative border">
          {agentStatus.status === 'online' && (
            <div className="absolute -top-3 -right-3 z-30">
              <div className="flex items-center gap-2 bg-green-500 text-black px-4 py-1.5 rounded-full text-[10px] font-black shadow-lg shadow-green-500/20">
                <CheckCircle2 className="w-3 h-3" /> ONLINE
              </div>
            </div>
          )}
          <CardHeader className="bg-green-500/10 border-b border-white/5 p-8">
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                <FileCode className="w-6 h-6 text-green-500" />
                FPQ System
              </CardTitle>
              <Badge variant="outline" className="border-green-500/30 text-green-500">fpqsystem://</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <p className="text-gray-400 leading-relaxed text-sm">
              Conexão com banco Firebird DADOS.FDB para orçamentos e pedidos.
            </p>
            
            <div className="grid grid-cols-2 gap-4">
               <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                 <p className="text-[9px] text-gray-500 uppercase font-black mb-1">Última Sincronia</p>
                 <p className="text-sm font-bold text-white flex items-center gap-2">
                   <Clock className="w-4 h-4 text-green-500" />
                   {agentStatus.lastSyncTime ? new Date(agentStatus.lastSyncTime).toLocaleTimeString() : 'Pendente'}
                 </p>
               </div>
               <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                 <p className="text-[9px] text-gray-500 uppercase font-black mb-1">Banco Firebird</p>
                 <p className={`text-xs font-bold flex items-center gap-2 ${agentStatus.config?.firebirdFound ? 'text-green-400' : 'text-red-400'}`}>
                   {agentStatus.config?.firebirdFound ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                   {agentStatus.config?.firebirdFound ? 'DADOS.FDB ✓' : 'Arquivo não encontrado'}
                 </p>
                 {agentStatus.config && (
                   <p className="text-[9px] text-gray-600 mt-1 font-mono truncate" title={agentStatus.config.firebirdDatabase}>
                     {agentStatus.config.firebirdDatabase}
                   </p>
                 )}
               </div>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
              <p className="text-[9px] text-gray-500 uppercase font-black mb-1">Status Sync</p>
              <p className={`text-sm font-bold flex items-center gap-2 ${agentStatus.lastSyncStatus.includes('Erro') ? 'text-red-400' : 'text-green-400'}`}>
                {agentStatus.lastSyncStatus.includes('Sucesso') || agentStatus.lastSyncStatus.includes('sincronizado') ? <CheckCircle2 className="w-4 h-4" /> : agentStatus.status === 'offline' ? <AlertCircle className="w-4 h-4" /> : <RefreshCw className="w-4 h-4 animate-spin" />}
                {agentStatus.status === 'offline' ? 'Agent Offline — Abra o FPQSync.exe' : agentStatus.lastSyncStatus}
              </p>
              {agentStatus.syncCount !== undefined && (
                <p className="text-[9px] text-gray-600 mt-1">Total de syncs nesta sessão: {agentStatus.syncCount}</p>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 font-black uppercase ml-1">Caminho do SISCOM.exe</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ShieldCheck className="w-4 h-4 text-green-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input 
                      value={fpqPath}
                      onChange={(e) => setFpqPath(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-xs font-mono text-green-400 focus:outline-none focus:border-green-500/50 transition-colors"
                      placeholder="C:\\OseuCaminho\\SISCOM.exe"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-3">
              <Button 
                onClick={triggerManualSync}
                disabled={syncing || agentStatus.status !== 'online'}
                className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-black rounded-2xl py-7 text-lg shadow-lg shadow-green-500/20"
              >
                <RefreshCw className={`w-5 h-5 mr-3 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'SINCRONIZANDO...' : '🔄 SINCRONIZAR AGORA'}
              </Button>
              <Button onClick={downloadRegFile} variant="outline" className="w-full border-green-500/30 text-green-400 font-black rounded-2xl py-6 hover:bg-green-500/5">
                <Download className="w-5 h-5 mr-3" /> BAIXAR REGISTRO (.REG)
              </Button>
              <a href="/installers/FpqSyncAgent.exe" download className="w-full" onClick={() => setShowSmartScreenGuide(true)}>
                <Button variant="outline" className="w-full border-white/10 text-white rounded-2xl py-6 hover:bg-white/5 flex items-center justify-center">
                  <Download className="w-5 h-5 mr-3" /> BAIXAR SYNC AGENT (.EXE)
                </Button>
              </a>

              {/* Alerta SmartScreen — aparece após baixar o .exe */}
              {showSmartScreenGuide && (
                <div className="p-5 bg-amber-500/10 rounded-3xl border border-amber-500/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-400" />
                    <p className="text-amber-400 font-black text-xs uppercase tracking-wider">Windows bloqueou o arquivo?</p>
                  </div>
                  <p className="text-amber-200/60 text-[11px] leading-relaxed">
                    O Windows SmartScreen ou antivírus pode bloquear o <span className="font-mono text-amber-300">FpqSyncAgent.exe</span> por ser um aplicativo sem assinatura digital. É seguro — siga os passos abaixo:
                  </p>
                  <ol className="space-y-2">
                    {[
                      'Clique em "Mais informações" na tela azul do Windows',
                      'Clique em "Executar assim mesmo" para liberar',
                      'Se o antivírus bloquear: clique com botão direito no .exe → Propriedades → ✅ Desbloquear → OK',
                      'Execute o FpqSyncAgent.exe — o status acima mudará para ONLINE'
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-amber-100/50">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black flex-shrink-0 mt-0.5">{i + 1}</span>
                        {step}
                      </li>
                    ))}
                  </ol>
                  <button onClick={() => setShowSmartScreenGuide(false)} className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors">Dispensar aviso</button>
                </div>
              )}

              <Button 
                onClick={() => {
                  window.location.href = 'fpqsystem://test';
                  toast({ title: "🚀 Abrindo FPQ...", description: "Se o registro estiver instalado, o FPQ abrirá agora." });
                }}
                className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black rounded-2xl py-6"
              >
                <Zap className="w-5 h-5 mr-3 text-amber-500" /> TESTAR ABERTURA DO FPQ
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* PROMOB Section */}
        <Card className="bg-gray-900/40 border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-md border">
          <CardHeader className="bg-red-500/10 border-b border-white/5 p-8">
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl font-black text-white flex items-center gap-3 uppercase tracking-tighter">
                <Laptop className="w-6 h-6 text-red-500" />
                Promob Plus
              </CardTitle>
              <Badge variant="outline" className="border-red-500/30 text-red-500">promobsystem://</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <p className="text-gray-400 leading-relaxed text-sm">
              Abra seus projetos 3D e exporte medidas do studio AR diretamente para o Promob local.
            </p>

            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 font-black uppercase ml-1">Caminho do Promob.exe</label>
              <div className="relative">
                <Settings className="w-4 h-4 text-red-500 absolute left-4 top-1/2 -translate-y-1/2" />
                <input 
                  value={promobPath}
                  onChange={(e) => setPromobPath(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-xs font-mono text-red-400 focus:outline-none focus:border-red-500/50 transition-colors"
                  placeholder="C:\\Caminho\\Promob.exe"
                />
              </div>
            </div>

            <div className="p-6 bg-amber-500/5 rounded-3xl border border-amber-500/10">
              <div className="flex items-center gap-3 mb-3">
                <Info className="w-4 h-4 text-amber-500" />
                <h4 className="font-black text-amber-500 text-[10px] uppercase">Aviso de Configuração</h4>
              </div>
              <p className="text-[10px] text-amber-200/50 leading-relaxed font-medium">
                Se o seu cliente instalou o Promob em uma pasta diferente, ele deve colar o caminho do <b>Promob.exe</b> acima antes de clicar no botão verde para baixar o registro correto.
              </p>
            </div>

            <div className="pt-2 space-y-4">
              <Button 
                onClick={() => {
                  window.location.href = 'promobsystem://';
                  toast({ title: "🚀 Abrindo Promob...", description: "Tentando iniciar o Promob Plus instalado." });
                }}
                variant="outline"
                className="w-full border-red-500/20 text-white rounded-2xl py-7 hover:bg-red-500/5 group"
              >
                <Laptop className="w-6 h-6 mr-3 text-red-500 group-hover:scale-110 transition-transform" /> 
                <span className="font-black text-lg">TESTAR ABERTURA PROMOB</span>
              </Button>
              
              <div className="flex items-center justify-center gap-4 py-2">
                 <p className="text-[10px] text-gray-500 italic flex items-center gap-1">
                   <RefreshCw className="w-3 h-3 animate-spin-slow" />
                   Interface Dinâmica • v1.3.0
                 </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gray-900/20 border-white/5 rounded-[2.5rem] p-8 border-dashed border-2 relative overflow-hidden group">
        <div className="absolute inset-0 bg-amber-500/0 group-hover:bg-amber-500/2 transition-colors duration-500" />
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber-500" />
          Guia Rápido de Instalação
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-amber-500 shadow-xl">1</div>
            <div>
              <p className="font-bold text-white mb-1">Baixe o .REG</p>
              <p className="text-xs text-gray-500 leading-relaxed">Clique no botão verde acima. Esse arquivo informa ao Windows que o navegador pode abrir seus programas.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-amber-500 shadow-xl">2</div>
            <div>
              <p className="font-bold text-white mb-1">Execute e Confirme</p>
              <p className="text-xs text-gray-500 leading-relaxed">Abra o arquivo baixado, clique em "Sim" em todos os avisos do Windows. Isso é seguro e necessário.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-black text-amber-500 shadow-xl">3</div>
            <div>
              <p className="font-bold text-white mb-1">Ative o Agent</p>
              <p className="text-xs text-gray-500 leading-relaxed">Baixe o Sync Agent e execute-o. Se o Windows bloquear, clique em <span className="text-amber-400 font-bold">"Mais informações" → "Executar assim mesmo"</span>. O status acima mudará para <span className="text-green-500 font-bold uppercase">Online</span>.</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default LocalIntegrationPanel;
