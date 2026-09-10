import React, { useState, useEffect } from 'react';
import {
    Sparkles, Heart, Zap, TrendingUp, ChevronRight, Layers, FileText,
    MessageCircle, Star, Sparkles as SparklesIcon, MapPin, Clock,
    Package, AlertTriangle, ArrowUpRight, Plus, ClipboardList, Wallet,
    TrendingDown, BarChart3, Users, PlusCircle, Ruler, Box, Download, Monitor, ExternalLink, FileCode, Wrench, CheckCircle
} from 'lucide-react';
import { generatePromobXML, downloadFile, generateDXF } from '@/services/promobService';
import { Card3D } from '@/components/animations/Card3D';
import { DashboardStat } from '@/components/ui/dashboard-stat';
import { ViewMode } from '@/types';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';

const db = supabase as any;

interface AdminDashboardProps {
    contracts: any[];
    setView: (view: ViewMode) => void;
    handleRender: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
    contracts: initialContracts,
    setView,
    handleRender
}) => {
    const [stats, setStats] = useState({
        revenue: 0,
        signedCount: 0,
        inProduction: 0,
        openOS: 0,
        lowStock: 0,
        toReceive: 0,
        toPay: 0,
        assistancePending: 0,
    });
    const [assistanceTickets, setAssistanceTickets] = useState<any[]>([]);
    const [contracts, setContracts] = useState(initialContracts);
    const [studioMeasurements, setStudioMeasurements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const [
                contractsRes,
                osRes,
                stockRes,
                receivableRes,
                payableRes,
                studioRes
            ] = await Promise.all([
                db.from('contracts').select('*, clients(name)').order('created_at', { ascending: false }),
                db.from('service_orders').select('id').eq('status', 'aberta'),
                db.from('products').select('id').lt('stock_quantity', db.raw('min_stock')),
                db.from('accounts_receivable').select('amount').eq('received', false),
                db.from('accounts_payable').select('amount').eq('paid', false),
                db.from('studio_measurements').select('*').order('created_at', { ascending: false }).limit(5),
                db.from('assistance_tickets').select('*').eq('status', 'pendente').order('created_at', { ascending: false }),
            ]);

            const currentContracts = contractsRes.data || [];
            setContracts(currentContracts);

            const revenue = currentContracts.reduce((sum: number, c: any) => sum + (Number(c.value) || 0), 0);
            const signed = currentContracts.filter((c: any) => ['assinado', 'assasinado', 'assassinado', 'producao', 'instalacao', 'concluido'].includes(c.status)).length;
            const production = currentContracts.filter((c: any) => c.status === 'producao').length;
            
            const toReceive = (receivableRes.data || []).reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
            const toPay = (payableRes.data || []).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);

            setStats({
                revenue,
                signedCount: signed,
                inProduction: production,
                openOS: osRes.data?.length || 0,
                lowStock: stockRes.data?.length || 0,
                toReceive,
                toPay,
                assistancePending: (arguments[0][6]?.data || []).length
            });
            setStudioMeasurements(studioRes.data || []);
            setAssistanceTickets(arguments[0][6]?.data || []);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="p-8 space-y-8 overflow-auto h-full relative"
            style={{ background: 'linear-gradient(160deg, #0a0a0a 0%, #111111 50%, #0f0f0f 100%)' }}
        >
            {/* Gold accent orbs */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-32 -right-32 w-[600px] h-[600px] bg-amber-500/8 blur-[160px] rounded-full" />
                <div className="absolute -bottom-48 -left-32 w-[500px] h-[500px] bg-amber-400/5 blur-[120px] rounded-full" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-600/3 blur-[200px] rounded-full" />
            </div>

            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 animate-in fade-in slide-in-from-top-4 duration-700">
                <div>
                    <h1 className="text-4xl font-black tracking-tight flex items-center gap-3" style={{ color: '#ffffff' }}>
                        <div className="p-2 rounded-2xl shadow-lg" style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583, #b8952a)' }}>
                            <Sparkles className="w-8 h-8 text-black" />
                        </div>
                        Gestão Estratégica
                    </h1>
                    <p className="text-gray-400 mt-2 flex items-center gap-2 font-medium">
                        <Heart className="w-4 h-4 text-amber-400 fill-amber-400" />
                        Bem-vindo ao centro de comando SD Móveis
                    </p>
                </div>
                
                <div className="grid grid-cols-2 md:flex gap-3">
                    <div className="border border-white/10 rounded-3xl px-5 py-3 shadow-sm flex flex-col items-center min-w-[120px]" style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Status Sistema</p>
                        <p className="text-amber-400 font-bold flex items-center gap-2 text-sm">
                            <span className="w-2 h-2 bg-amber-400 rounded-full animate-ping" />
                            ONLINE
                        </p>
                    </div>
                    <button
                        onClick={() => setView(ViewMode.BUDGET_QUOTE)}
                        className="px-6 py-3 rounded-3xl font-black text-xs tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl text-black"
                        style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583, #b8952a)', boxShadow: '0 8px 32px rgba(212,175,55,0.35)' }}
                    >
                        <Plus className="w-5 h-5 mr-2 inline" /> NOVO ORÇAMENTO
                    </button>
                </div>
            </header>

                {/* Main Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
                {[
                    { title: "Total Orçamentos", value: `R$ ${(stats.revenue / 1000).toFixed(1)}K`, icon: "💰", trend: "+15% este mês" },
                    { title: "Projetos Ativos", value: contracts.length.toString(), icon: "📁", trend: `${stats.signedCount} assinados` },
                    { title: "Produção", value: stats.inProduction.toString(), icon: "🏭", trend: "Crescimento de 8%" },
                    { title: "Chamados", value: (assistanceTickets.length || 0).toString(), icon: "🔧", trend: "Assistência Técnica" },
                ].map((stat, i) => (
                    <div key={i} className="rounded-[2.5rem] p-0.5" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(255,255,255,0.05))' }}>
                      <Card3D intensity={10} className="rounded-[2.5rem]">
                        <div className="rounded-[2.3rem] overflow-hidden" style={{ background: '#111111' }}>
                            <DashboardStat title={stat.title} value={stat.value} icon={stat.icon} trend={stat.trend} dark />
                        </div>
                      </Card3D>
                    </div>
                ))}
            </div>

            {/* Middle Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
                {/* Left: Wisdom & Core Actions */}
                <div className="lg:col-span-2 space-y-6 animate-in fade-in slide-in-from-left-6 duration-1000">
                    <div className="rounded-[3rem] p-10 text-white relative overflow-hidden shadow-2xl border border-amber-500/20"
                        style={{ background: 'linear-gradient(135deg, #111111 0%, #1a1a1a 100%)' }}>
                        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-[80px]" />
                        <div className="absolute inset-0 rounded-[3rem]" style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.05) 0%, transparent 60%)' }} />
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 rounded-xl" style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.3)' }}>
                                    <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                                </div>
                                <span className="text-amber-400 text-sm font-black uppercase tracking-[0.2em]">Sabedoria do Negócio</span>
                            </div>
                            <blockquote className="text-2xl md:text-3xl font-black text-white mb-10 leading-tight italic">
                                "Consagre ao Senhor tudo o que você faz, e os seus planos serão bem-sucedidos."
                                <span className="block text-amber-400 text-lg mt-4 not-italic font-bold">Provérbios 16:3</span>
                            </blockquote>
                            
                            <div className="flex flex-wrap gap-4">
                                <button
                                    onClick={() => setView(ViewMode.PROMOB)}
                                    className="px-8 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-3 shadow-2xl text-black group"
                                    style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583, #b8952a)', boxShadow: '0 8px 32px rgba(212,175,55,0.4)' }}
                                >
                                    <Layers className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                    NOVO PROJETO 3D
                                </button>
                                <button
                                    onClick={() => setView(ViewMode.CONTRACTS_MGMT)}
                                    className="bg-white/8 backdrop-blur-md px-8 py-5 rounded-[2rem] font-black uppercase text-xs tracking-widest hover:bg-white/15 transition-all duration-300 flex items-center gap-3 active:scale-95 border border-white/15 text-white"
                                >
                                    <FileText className="w-5 h-5" />
                                    GERENCIAR CONTRATOS
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Quick Functional Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'CRM WhatsApp', icon: MessageCircle, view: ViewMode.CRM, accent: '#25D366' },
                            { label: 'Estoque Real', icon: Package, view: ViewMode.PRODUCTS, accent: '#D4AF37' },
                            { label: 'Fluxo de Caixa', icon: Wallet, view: ViewMode.CASH_REGISTER, accent: '#D4AF37' },
                            { label: 'Integração PC', icon: Monitor, view: ViewMode.INTEGRATION, accent: '#D4AF37' },
                            { label: 'Frota & Trips', icon: MapPin, view: ViewMode.FLEET, accent: '#D4AF37' },
                        ].map(({ label, icon: Icon, view, accent }) => (
                            <button key={label} onClick={() => setView(view)}
                                className="p-6 rounded-[2.5rem] border transition-all flex flex-col items-center gap-3 group hover:-translate-y-1"
                                style={{ background: '#111111', borderColor: 'rgba(255,255,255,0.08)' }}
                                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)')}
                                onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                            >
                                <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all"
                                    style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)' }}>
                                    <Icon className="w-7 h-7 text-amber-400" />
                                </div>
                                <span className="font-black text-white text-xs tracking-tight text-center">{label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: Financial Health */}
                <div className="space-y-6 animate-in fade-in slide-in-from-right-6 duration-1000">
                    <div className="rounded-[3rem] p-8 border border-white/8 shadow-sm"
                        style={{ background: '#111111' }}>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-black"
                                style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}>
                                <BarChart3 className="w-5 h-5" />
                            </div>
                            <h3 className="text-xl font-black text-white tracking-tight">Saúde Financeira</h3>
                        </div>
                        
                        <div className="space-y-5">
                            <div className="p-5 rounded-3xl border flex justify-between items-center group cursor-pointer transition-all"
                                style={{ background: 'rgba(212,175,55,0.08)', borderColor: 'rgba(212,175,55,0.2)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,55,0.15)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(212,175,55,0.08)')}
                            >
                                <div>
                                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">A Receber</p>
                                    <p className="text-2xl font-black text-white">R$ {stats.toReceive.toLocaleString('pt-BR')}</p>
                                </div>
                                <TrendingUp className="w-8 h-8 text-amber-400 opacity-40 group-hover:scale-125 transition-transform" />
                            </div>
                            
                            <div className="p-5 rounded-3xl border flex justify-between items-center group cursor-pointer transition-all"
                                style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                            >
                                <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Contas a Pagar</p>
                                    <p className="text-2xl font-black text-white">R$ {stats.toPay.toLocaleString('pt-BR')}</p>
                                </div>
                                <TrendingDown className="w-8 h-8 text-gray-500 opacity-40 group-hover:scale-125 transition-transform" />
                            </div>
                        </div>
                    </div>

                    {/* Alerts */}
                    {(stats.lowStock > 0 || stats.openOS > 5) && (
                        <div className="rounded-[3rem] p-8 border border-amber-500/20 shadow-sm"
                            style={{ background: '#111111' }}>
                            <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-400" />
                                Atenção do Gestor
                            </h3>
                            <div className="space-y-4">
                                {stats.lowStock > 0 && (
                                    <div className="flex items-center gap-4 p-4 rounded-2xl border"
                                        style={{ background: 'rgba(212,175,55,0.08)', borderColor: 'rgba(212,175,55,0.2)' }}>
                                        <Package className="w-5 h-5 text-amber-400" />
                                        <p className="text-xs font-bold text-amber-200 leading-tight">
                                            {stats.lowStock} materiais abaixo do estoque mínimo.
                                        </p>
                                    </div>
                                )}
                                {stats.openOS > 0 && (
                                    <div className="flex items-center gap-4 p-4 rounded-2xl border"
                                        style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' }}>
                                        <ClipboardList className="w-5 h-5 text-gray-400" />
                                        <p className="text-xs font-bold text-gray-300 leading-tight">
                                            {stats.openOS} ordens de serviço pendentes de início.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Assistance Tickets */}
                    <div className="rounded-[3rem] p-8 border border-white/5 shadow-sm"
                        style={{ background: '#111111' }}>
                        <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2">
                            <Wrench className="w-5 h-5 text-amber-500" />
                            Assistência Técnica
                        </h3>
                        <div className="space-y-4">
                            {assistanceTickets.length > 0 ? (
                                assistanceTickets.slice(0, 5).map(ticket => (
                                    <div key={ticket.id} className="p-4 rounded-2xl border bg-white/5 border-white/10 hover:border-amber-500/30 transition-all">
                                        <div className="flex justify-between items-start mb-2">
                                            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">{ticket.client_name}</p>
                                            <span className="text-[8px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-black uppercase">Novo</span>
                                        </div>
                                        <p className="text-xs font-bold text-white leading-tight mb-2">{ticket.subject?.replace(/_/g, ' ')}</p>
                                        <p className="text-[9px] text-gray-500 line-clamp-2 italic mb-4">"{ticket.description}"</p>
                                        <button 
                                          onClick={async () => {
                                            await db.from('assistance_tickets').update({ status: 'concluido' }).eq('id', ticket.id);
                                            fetchDashboardData();
                                          }}
                                          className="w-full py-2 rounded-xl bg-white/5 hover:bg-green-500 hover:text-black transition-all text-[9px] font-black uppercase tracking-widest text-green-500 border border-green-500/20"
                                        >
                                          Marcar Resolvido ✓
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="py-8 text-center border border-dashed border-white/5 rounded-2xl">
                                    <CheckCircle className="w-8 h-8 text-white/10 mx-auto mb-2" />
                                    <p className="text-[10px] font-black text-white/20 uppercase tracking-tighter">Nenhum chamado pendente</p>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Render Shortcut */}
                    <Card3D intensity={15} className="rounded-[3rem]">
                        <button 
                            onClick={handleRender}
                            className="w-full p-8 rounded-[3rem] text-black overflow-hidden group relative"
                            style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #F5E583 50%, #b8952a 100%)', boxShadow: '0 16px 48px rgba(212,175,55,0.4)' }}
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform duration-700" />
                            <div className="relative z-10 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 text-black/70">Inteligência Artificial</p>
                                    <h4 className="text-2xl font-black text-black">GERAR RENDER</h4>
                                </div>
                                <SparklesIcon className="w-10 h-10 group-hover:rotate-45 transition-transform duration-500 text-black/80" />
                            </div>
                        </button>
                    </Card3D>
                </div>
            </div>

            {/* Bottom: Recent Contracts */}
            <section className="relative z-10 animate-in fade-in slide-in-from-bottom-6 duration-1000">
                <div className="rounded-[3.5rem] p-10 border border-white/8 shadow-sm"
                    style={{ background: '#111111' }}>
                    <div className="flex justify-between items-center mb-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-black"
                                style={{ background: 'linear-gradient(135deg, #D4AF37, #F5E583)' }}>
                                <TrendingUp className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tight">Orçamentos Recentes</h3>
                                <p className="text-sm text-gray-500 font-bold uppercase tracking-widest mt-1">Últimos contratos firmados</p>
                            </div>
                        </div>
                        <button onClick={() => setView(ViewMode.CONTRACTS_MGMT)}
                            className="border border-white/10 hover:border-amber-500/40 text-gray-400 hover:text-amber-400 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2"
                            style={{ background: 'rgba(255,255,255,0.04)' }}>
                            Ver todos <ArrowUpRight className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {contracts.slice(0, 3).map((c, i) => (
                            <div key={c.id} className="group p-6 rounded-[2.5rem] transition-all cursor-pointer border border-white/6 hover:border-amber-500/30"
                                style={{ background: 'rgba(255,255,255,0.03)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(212,175,55,0.06)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                            >
                                <div className="flex justify-between items-start mb-6">
                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center border border-white/10 group-hover:border-amber-500/30 transition-colors"
                                        style={{ background: 'rgba(255,255,255,0.05)' }}>
                                        <Users className="w-6 h-6 text-gray-500 group-hover:text-amber-400 transition-colors" />
                                    </div>
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${
                                        c.status === 'concluido' 
                                            ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' 
                                            : c.status === 'producao' 
                                                ? 'text-white border-white/20 bg-white/10' 
                                                : 'text-amber-400/70 border-amber-500/20 bg-amber-500/5'
                                    }`}>
                                        {c.status}
                                    </span>
                                </div>
                                <h4 className="text-xl font-black text-white line-clamp-1">{c.clients?.name || 'Projeto Especial'}</h4>
                                <p className="text-xs text-gray-500 font-bold mt-1 line-clamp-1">{c.title || c.name}</p>
                                <div className="mt-8 pt-6 border-t border-white/8 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <Wallet className="w-4 h-4 text-amber-400/50" />
                                        <span className="text-lg font-black text-white">R$ {(c.value || 0).toLocaleString('pt-BR')}</span>
                                    </div>
                                    <p className="text-[10px] text-gray-600 font-black">{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                                </div>
                            </div>
                        ))}
                        {contracts.length === 0 && (
                            <div className="col-span-3 py-20 text-center border-2 border-dashed border-white/10 rounded-[3rem]">
                                <PlusCircle className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                <p className="font-black text-gray-600 uppercase tracking-widest">Nenhum contrato ativo</p>
                                <button onClick={() => setView(ViewMode.CONTRACTS_MGMT)} className="mt-3 text-amber-400 font-bold text-sm hover:text-amber-300 transition-colors">
                                    Criar Primeiro Contrato
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* NEW: Studio Measurements for Promob */}
            <section className="relative z-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200">
                <div className="rounded-[3.5rem] p-10 border border-blue-500/20 shadow-2xl"
                    style={{ background: 'linear-gradient(135deg, #0f172a 0%, #111111 100%)' }}>
                    <div className="flex justify-between items-center mb-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-blue-500/20 border border-blue-500/30">
                                <Monitor className="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-white tracking-tight italic">Centro de Medição Studio AR</h3>
                                <p className="text-sm text-blue-400/70 font-bold uppercase tracking-widest mt-1">Exportar para Promob Plus (Desktop)</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {studioMeasurements.map((m) => (
                            <div key={m.id} className="group p-6 rounded-[2.5rem] bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all">
                                <div className="aspect-video rounded-3xl overflow-hidden mb-6 relative group/img">
                                    <img src={m.simulation_url || m.image_url} alt="Ambiente" className="w-full h-full object-cover transition-transform group-hover/img:scale-110" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                                      <span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase">{m.ambiente || 'Cozinha'}</span>
                                    </div>
                                </div>
                                <h4 className="text-lg font-black text-white mb-2">{m.client_name}</h4>
                                <div className="flex gap-4 mb-6">
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Largura</span>
                                    <span className="text-sm font-black text-blue-400">{m.dimensions?.width?.toFixed(2)}m</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Altura</span>
                                    <span className="text-sm font-black text-blue-400">{m.dimensions?.height?.toFixed(2)}m</span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Profundidade</span>
                                    <span className="text-sm font-black text-blue-400">{m.dimensions?.depth?.toFixed(2)}m</span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 mt-4">
                                  <button
                                      onClick={() => {
                                        const xml = generatePromobXML({
                                          projectName: `Projeto_${m.client_name}`,
                                          customerName: m.client_name,
                                          dimensions: m.dimensions,
                                          items: m.items || [],
                                          imageUrl: m.image_url
                                        });
                                        downloadFile(xml, `promob-${m.client_name}.xml`, 'text/xml');
                                      }}
                                      className="bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-black text-[10px] flex flex-col items-center justify-center gap-1 transition-all"
                                      title="Exportar XML para Promob"
                                  >
                                      <Download className="w-3 h-3" /> XML
                                  </button>
                                  <button
                                      onClick={() => {
                                        const dxf = generateDXF(m.dimensions?.width, m.dimensions?.depth);
                                        downloadFile(dxf, `planta-${m.client_name}.dxf`, 'image/vnd.dxf');
                                      }}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black text-[10px] flex flex-col items-center justify-center gap-1 transition-all"
                                      title="Exportar DXF (AutoCAD/Promob)"
                                  >
                                      <FileCode className="w-3 h-3" /> DXF
                                  </button>
                                  <button
                                      onClick={() => {
                                        const text = `L: ${m.dimensions?.width?.toFixed(2)}m | A: ${m.dimensions?.height?.toFixed(2)}m | P: ${m.dimensions?.depth?.toFixed(2)}m`;
                                        navigator.clipboard.writeText(text);
                                      }}
                                      className="bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-black text-[10px] flex flex-col items-center justify-center gap-1 transition-all border border-white/10"
                                      title="Copiar medidas para o teclado"
                                  >
                                      <Monitor className="w-3 h-3 text-blue-400" /> COPIAR
                                  </button>
                                </div>
                            </div>
                        ))}
                        {studioMeasurements.length === 0 && (
                            <div className="col-span-3 py-16 text-center border-2 border-dashed border-white/5 rounded-[3rem] bg-white/2">
                                <Ruler className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                                <p className="font-black text-gray-600 uppercase tracking-widest">Nenhuma medição Studio AR recebida</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};
