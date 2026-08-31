import React from 'react';
import {
    Home, Heart, Calendar, Timer, Package, CheckCircle, Wrench, Truck,
    Camera, Sparkles, ArrowRight, Clock, Eye, Download, Share2, ThumbsUp, Shield
} from 'lucide-react';
import { ViewMode } from '@/types';

interface ClientPortalProps {
    clientName: string;
    clientProject: any;
    clientInstallments: any[];
    clientProductionSteps: any[];
    clientTimeline: any[];
    galleryItems: any[];
    projectApproved: boolean;
    setProjectApproved: (approved: boolean) => void;
    setView: (view: ViewMode) => void;
    setShowClientContract: (show: boolean) => void;
    setShowClientFinanceiro: (show: boolean) => void;
    setGalleryFullscreen: (item: any) => void;
    toast: any;
}

export const ClientPortal: React.FC<ClientPortalProps> = ({
    clientName,
    clientProject,
    clientInstallments,
    clientProductionSteps,
    clientTimeline,
    galleryItems,
    projectApproved,
    setProjectApproved,
    setView,
    setShowClientContract,
    setShowClientFinanceiro,
    setGalleryFullscreen,
    toast
}) => {
    return (
        <div className="p-8 space-y-6 overflow-auto h-full bg-[#0a0a0a] text-white">
            <header className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div>
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500 flex items-center gap-3">
                        <Home className="w-8 h-8 text-amber-500" />
                        Minha Casa SD
                    </h1>
                    <p className="text-white/40 mt-1 flex items-center gap-2 font-bold uppercase text-[10px] tracking-widest">
                        <Heart className="w-3 h-3 text-red-500" />
                        {clientName ? `Olá, ${clientName}! Acompanhando seu sonho` : 'Acompanhando cada detalhe do seu sonho'}
                    </p>
                </div>
                {clientProject?.estimated_delivery && (
                    <div className="bg-white/5 border border-amber-500/20 rounded-2xl px-6 py-3 shadow-2xl backdrop-blur-md">
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1 mb-1">
                            <Calendar className="w-3 h-3" /> Previsão de Instalação
                        </p>
                        <p className="text-white font-black text-lg">
                            {new Date(clientProject.estimated_delivery + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </p>
                        <div className="flex items-center gap-2 mt-2 bg-amber-500/10 rounded-xl px-3 py-1.5 border border-amber-500/10">
                            <Timer className="w-4 h-4 text-amber-500" />
                            <p className="text-amber-400 font-black text-xs uppercase tracking-tighter">
                                {(() => {
                                    const days = Math.max(0, Math.ceil((new Date(clientProject.estimated_delivery + 'T00:00:00').getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                                    return days > 0 ? `Faltam ${days} dias! ✨` : 'O grande dia chegou! 🎉';
                                })()}
                            </p>
                        </div>
                    </div>
                )}
            </header>

            {/* Status Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/5 border border-white/5 rounded-3xl p-8 shadow-xl backdrop-blur-sm">
                    <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center text-3xl mb-4 border border-blue-500/20">🏭</div>
                    <p className="text-lg font-black text-white mb-6 flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-400" />
                        Status: {clientProject?.status || 'Produção'}
                    </p>
                    <div className="space-y-6">
                        {clientProductionSteps.length > 0 ? clientProductionSteps.map((step) => (
                            <div key={step.id}>
                                <div className="flex justify-between text-[11px] font-black uppercase tracking-widest mb-2">
                                    <span className="text-white/40 flex items-center gap-2">
                                        {step.progress === 100 ? <CheckCircle className="w-4 h-4 text-green-500" /> : step.progress > 0 ? <Wrench className="w-4 h-4 text-blue-400" /> : <Truck className="w-4 h-4 text-white/20" />}
                                        {step.label}
                                    </span>
                                    <span className={step.progress === 100 ? 'text-green-400' : step.progress > 0 ? 'text-blue-400' : 'text-white/20'}>
                                        {step.progress === 100 ? 'Concluído' : step.progress > 0 ? `${step.progress}%` : (step.status || 'Aguardando')}
                                    </span>
                                </div>
                                <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden border border-white/5">
                                    <div className={`h-1.5 rounded-full transition-all duration-1000 ${step.progress === 100 ? 'bg-green-500' : step.progress > 0 ? 'bg-blue-500' : 'bg-white/5'}`} style={{ width: `${step.progress}%` }} />
                                </div>
                            </div>
                        )) : (
                            <p className="text-white/20 text-sm italic py-4">As etapas de produção serão exibidas aqui em breve.</p>
                        )}
                    </div>
                </div>

                <button
                    onClick={() => setView(ViewMode.PORTFOLIO)}
                    className="relative overflow-hidden bg-gradient-to-br from-neutral-900 to-black border border-white/10 rounded-3xl p-8 text-white text-left hover:border-amber-500/40 transition-all shadow-2xl group"
                >
                    <div className="absolute top-0 right-0 p-12 opacity-5 scale-150 rotate-12">
                        <Camera className="w-32 h-32 text-amber-500" />
                    </div>
                    <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform border border-amber-500/20">
                        <Camera className="w-8 h-8 text-amber-500" />
                    </div>
                    <h3 className="text-2xl font-black flex items-center gap-2 group-hover:text-amber-400 transition-colors">
                        <Sparkles className="w-6 h-6 text-amber-500 animate-pulse" />
                        Galeria de Renders 4K
                    </h3>
                    <p className="text-white/40 mt-2 text-sm leading-relaxed max-w-sm">Veja o seu sonho materializado com nossa tecnologia de fotorrealismo ultra-HD.</p>
                    <span className="inline-flex items-center gap-1 mt-6 text-amber-500 font-black uppercase text-[10px] tracking-widest group-hover:gap-3 transition-all">
                        Abrir Portfolio <ArrowRight className="w-4 h-4" />
                    </span>
                </button>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <button onClick={() => setShowClientFinanceiro(true)} className="bg-white/5 border border-white/5 rounded-3xl p-6 shadow-xl text-center hover:border-amber-500/30 transition-all group overflow-hidden relative">
                    <div className="absolute -top-4 -right-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Package className="w-20 h-20" />
                    </div>
                    <span className="text-4xl mb-4 block group-hover:scale-110 transition-transform">💳</span>
                    <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-2">Financeiro</p>
                    {(() => {
                        const paid = clientInstallments.filter(i => i.status === 'Pago').length;
                        const total = clientInstallments.length;
                        const next = clientInstallments.find(i => i.status === 'Pendente');
                        return (
                            <>
                                <p className="text-xl font-black text-white">{total > 0 ? `${paid}/${total} Parcelas` : clientProject?.payment_status || '—'}</p>
                                <p className="text-sm font-bold mt-1 text-green-400">Em dia ✓</p>
                                {next && (
                                    <div className="mt-4 pt-4 border-t border-white/5">
                                        <p className="text-[9px] text-white/20 uppercase font-bold tracking-widest mb-1">Próximo Vencimento</p>
                                        <p className="text-sm font-black text-amber-500">
                                            {new Date(next.due_date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} — R$ {Number(next.amount).toLocaleString('pt-BR')}
                                        </p>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </button>

                <div className="bg-white/5 border border-white/5 rounded-3xl p-6 shadow-xl text-center hover:border-amber-500/30 transition-all group">
                    <span className="text-4xl mb-4 block group-hover:scale-110 transition-transform">💬</span>
                    <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-2">Suporte</p>
                    <button onClick={() => setView(ViewMode.CRM)} className="text-xl font-black text-white hover:text-amber-500 transition-colors">
                        Falar com Projetista
                    </button>
                    <p className="text-[10px] text-amber-500/60 font-bold uppercase mt-2">Resposta em até 2h</p>
                </div>

                <button onClick={() => setShowClientContract(true)} className="bg-white/5 border border-white/5 rounded-3xl p-6 shadow-xl text-center hover:border-amber-500/30 transition-all group">
                    <span className="text-4xl mb-4 block group-hover:scale-110 transition-transform">📝</span>
                    <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mb-2">Contrato</p>
                    <p className="text-xl font-black text-white">{clientProject?.status || 'Assinado'}</p>
                    <p className="text-sm text-green-400 font-bold mt-1 flex items-center justify-center gap-1">
                        <Shield className="w-4 h-4" /> Detalhes Jurídicos
                    </p>
                </button>
            </div>

            {/* Timeline */}
            <div className="bg-white/5 border border-white/5 rounded-3xl p-8 shadow-xl">
                <h3 className="font-black text-white mb-8 flex items-center gap-3">
                    <Clock className="w-5 h-5 text-amber-500" />
                    Jornada do Projeto
                </h3>
                <div className="flex items-center justify-between relative px-4">
                    {(() => {
                        const steps = clientTimeline.length > 0 ? clientTimeline : [
                            { label: 'Assinatura', step_date: '', done: true, icon: '✍️' },
                            { label: 'Projeto 3D', step_date: '', done: true, icon: '🖥️' },
                            { label: 'Produção', step_date: '', done: true, icon: '🏭' },
                            { label: 'Expedição', step_date: '', done: false, icon: '📦' },
                            { label: 'Instalação', step_date: '', done: false, icon: '🔧' },
                        ];
                        const doneCount = steps.filter(s => s.done).length;
                        const progressPct = steps.length > 0 ? Math.round(((doneCount - 1) / (steps.length - 1)) * 100) : 0;
                        return (
                            <>
                                <div className="absolute top-5 left-10 right-10 h-0.5 bg-white/5 z-0">
                                    <div className="h-0.5 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] transition-all duration-1000" style={{ width: `${progressPct}%` }} />
                                </div>
                                {steps.map((step: any, i: number) => (
                                    <div key={step.id || i} className="flex flex-col items-center relative z-10 w-20">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm mb-3 border-2 transition-all duration-500 ${step.done 
                                            ? 'bg-amber-500 border-amber-600 text-black font-black' 
                                            : 'bg-black border-white/10 text-white/20'
                                        }`}>
                                            {step.done ? '✓' : (i + 1)}
                                        </div>
                                        <p className={`text-[10px] font-black uppercase tracking-tighter text-center h-4 ${step.done ? 'text-white' : 'text-white/20'}`}>{step.label}</p>
                                        <p className="text-[9px] text-amber-500/50 font-bold mt-1">{step.step_date || ''}</p>
                                    </div>
                                ))}
                            </>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
};
