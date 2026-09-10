import React, { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ProjectCard, Project } from "@/components/projects/ProjectCard";
import { AIAssistant } from "@/components/ai/AIAssistant";
import { Card3D } from "@/components/animations/Card3D";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  FolderKanban,
  Users,
  DollarSign,
  TrendingUp,
  Plus,
  ArrowRight,
  ClipboardList,
  Calculator,
  UserPlus,
  ArrowUpRight,
  Activity
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const db = supabase as any;

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalProjects: 0,
    activeClients: 0,
    monthlyRevenue: 0,
    conversionRate: 0,
  });
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Stats
      const [projectsRes, clientsRes, ordersRes] = await Promise.all([
        db.from('client_projects').select('id', { count: 'exact' }),
        db.from('clients').select('id', { count: 'exact' }).eq('status', 'active'),
        db.from('service_orders').select('total_value, created_at'),
      ]);

      const totalValue = (ordersRes.data || []).reduce((acc: number, curr: any) => acc + (Number(curr.total_value) || 0), 0);
      
      setStats({
        totalProjects: projectsRes.count || 0,
        activeClients: clientsRes.count || 0,
        monthlyRevenue: totalValue,
        conversionRate: 75, // Mocked for now as we don't have lead vs project data yet
      });

      // 2. Recent Projects
      const { data: projData } = await db
        .from('client_projects')
        .select('*, clients(name)')
        .order('created_at', { ascending: false })
        .limit(4);
      
      if (projData) {
        setRecentProjects(projData.map((p: any) => ({
          id: p.id,
          name: p.title,
          client: p.clients?.name || 'Cliente oculto',
          status: p.status || 'pending',
          value: Number(p.value) || 0,
          createdAt: new Date(p.created_at),
          thumbnail: undefined // Renders fallback in ProjectCard
        })));
      }

      // 3. Recent Activities (Service Orders)
      const { data: activityData } = await db
        .from('service_orders')
        .select('*, clients(name), employees(name)')
        .order('created_at', { ascending: false })
        .limit(5);
      
      setRecentActivities(activityData || []);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const staggerDelay = (index: number) => ({
    opacity: 0,
    animation: `fade-in 0.5s ease-out ${index * 0.1}s forwards`,
  });

  return (
    <MainLayout>
      <div className="space-y-8 pb-12">
        {/* Header with Greeting */}
        <div style={staggerDelay(0)} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-display font-black tracking-tight text-slate-900">
              Painel de Gestão
            </h1>
            <p className="text-slate-500 mt-2 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              Monitoramento em tempo real do Studio SD Móveis.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-xl border-slate-200" onClick={fetchDashboardData}>
              <RotateCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Sincronizar
            </Button>
            <Link to="/projects">
              <Button variant="gradient" size="lg" className="rounded-xl shadow-lg shadow-amber-200">
                <Plus className="w-5 h-5 mr-2" />
                Novo Projeto
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Actions - The "Functional" Part */}
        <section style={staggerDelay(1)} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button 
            onClick={() => navigate('/clients')}
            className="group p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left flex flex-col gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <p className="font-black text-slate-900 text-sm">Cadastrar Cliente</p>
              <p className="text-xs text-slate-400 mt-1">Adicione novos contatos</p>
            </div>
          </button>

          <button 
            onClick={() => navigate('/os')}
            className="group p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left flex flex-col gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <p className="font-black text-slate-900 text-sm">Criar Ordem</p>
              <p className="text-xs text-slate-400 mt-1">Ordens de serviço e montagem</p>
            </div>
          </button>

          <button 
            onClick={() => navigate('/orcamento')}
            className="group p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left flex flex-col gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <p className="font-black text-slate-900 text-sm">Novo Orçamento</p>
              <p className="text-xs text-slate-400 mt-1">Análise de ambiente via IA</p>
            </div>
          </button>

          <button 
            onClick={() => navigate('/crm')}
            className="group p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left flex flex-col gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="font-black text-slate-900 text-sm">Dashboard CRM</p>
              <p className="text-xs text-slate-400 mt-1">Vendas e conversões</p>
            </div>
          </button>
        </section>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: "Projetos Ativos", value: stats.totalProjects, change: "Contagem total", icon: FolderKanban, color: "blue" },
            { title: "Fiel de Clientes", value: stats.activeClients, change: "Cadastrados", icon: Users, color: "amber" },
            { title: "Volume de OS", value: `R$ ${stats.monthlyRevenue.toLocaleString('pt-BR')}`, change: "Valor total em ordens", icon: DollarSign, color: "emerald" },
            { title: "Conversão IA", value: `${stats.conversionRate}%`, change: "Taxa de sucesso", icon: TrendingUp, color: "indigo" },
          ].map((stat, i) => (
            <div key={stat.title} style={staggerDelay(i + 2)}>
              <Card3D intensity={10} className="rounded-[2.5rem] bg-white border border-slate-100/50 shadow-sm">
                <StatsCard
                  title={stat.title}
                  value={stat.value}
                  change={stat.change}
                  changeType="positive"
                  icon={stat.icon}
                />
              </Card3D>
            </div>
          ))}
        </div>

        {/* Main content Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Projects Section */}
          <div className="lg:col-span-2 space-y-6" style={staggerDelay(6)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                  <FolderKanban className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Projetos Recentes</h2>
              </div>
              <Link to="/projects">
                <Button variant="ghost" size="sm" className="font-bold text-slate-400 hover:text-slate-900">
                  Ver todos <ArrowUpRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {recentProjects.length === 0 ? (
                <div className="col-span-2 p-12 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 text-center">
                  <p className="text-slate-400 font-bold">Nenhum projeto encontrado</p>
                  <Button variant="link" onClick={() => navigate('/projects')}>Começar agora</Button>
                </div>
              ) : (
                recentProjects.map((project, i) => (
                  <div key={project.id} style={staggerDelay(7 + i)}>
                    <Card3D intensity={5} className="rounded-3xl overflow-hidden shadow-lg">
                      <ProjectCard project={project} />
                    </Card3D>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Activity Sidebar */}
          <div className="lg:col-span-1 space-y-8">
            <section style={staggerDelay(10)} className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Atividade</h2>
              </div>
              
              <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 shadow-sm space-y-4">
                {recentActivities.map((act, i) => (
                  <div key={act.id} className="flex items-start gap-4 p-3 hover:bg-slate-50 rounded-2xl transition-colors cursor-pointer group">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      act.status === 'aberta' ? 'bg-blue-50 text-blue-500' : 
                      act.status === 'concluida' ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'
                    }`}>
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-sm font-black text-slate-900 truncate">OS #{act.order_number}</p>
                        <span className="text-[10px] text-slate-400 font-bold">{new Date(act.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">{act.clients?.name} — {act.description || 'Sem descrição'}</p>
                      <div className="flex items-center gap-2 mt-2">
                         <span className={`text-[9px] font-black uppercase tracking-tighter px-2 py-0.5 rounded-full ${
                            act.status === 'aberta' ? 'bg-blue-100 text-blue-600' : 
                            act.status === 'concluida' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                         }`}>
                           {act.status}
                         </span>
                         {act.employees?.name && <span className="text-[9px] text-slate-400 font-bold italic">Designado: {act.employees.name.split(' ')[0]}</span>}
                      </div>
                    </div>
                  </div>
                ))}

                {recentActivities.length === 0 && (
                  <p className="text-center text-slate-400 text-xs py-8 font-bold uppercase tracking-widest">Sem atividades recentes</p>
                )}
                
                <Button variant="outline" className="w-full rounded-2xl border-slate-100 text-xs font-black uppercase text-slate-400 hover:text-slate-900" onClick={() => navigate('/os')}>
                  Ver Todas as Ordens
                </Button>
              </div>
            </section>

            <AIAssistant />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

const RotateCcw = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
);
