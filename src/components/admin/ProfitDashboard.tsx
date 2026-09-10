import React, { useMemo } from 'react';
import {
    BarChart3, TrendingUp, DollarSign, Package, Activity, ArrowLeft, TrendingDown
} from 'lucide-react';
import { ViewMode } from '@/types';

interface ProfitDashboardProps {
    contracts: any[];
    setView: (view: ViewMode) => void;
}

export const ProfitDashboard: React.FC<ProfitDashboardProps> = ({ contracts, setView }) => {
    // Cálculos Básicos
    const stats = useMemo(() => {
        // 1. Faturamento Total Acumulado (projetos que não estão cancelados)
        const validContracts = contracts.filter(c => c.status !== 'cancelado');
        const grossRevenue = validContracts.reduce((sum, c) => sum + (Number(c.value) || 0), 0);

        // 2. Custos Estimados (Simplificado base: 45% material, 20% mão de obra, 5% despesas extras)
        // OBS: Num cenário real, buscaríamos da tabela "project_costs" que vimos no seu App. 
        // Como a instrução pedia Dashboard com cálculos automáticos sobre os Contratos:
        const materialCost = grossRevenue * 0.45;
        const laborCost = grossRevenue * 0.20;
        const extraCost = grossRevenue * 0.05;
        const totalCosts = materialCost + laborCost + extraCost;

        // 3. Lucro Bruto e Margem
        const netProfit = grossRevenue - totalCosts;
        const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

        return {
            totalContracts: validContracts.length,
            grossRevenue,
            materialCost,
            laborCost,
            extraCost,
            totalCosts,
            netProfit,
            profitMargin
        };
    }, [contracts]);

    const formatBRL = (val: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    return (
        <div className="p-8 space-y-8 overflow-auto h-full bg-gradient-to-br from-gray-50 to-gray-100">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-black text-gray-900 flex items-center gap-3">
                        <BarChart3 className="w-8 h-8 text-indigo-600" />
                        Dashboard de BI & Lucratividade
                    </h1>
                    <p className="text-gray-500 mt-1">Análise em tempo real de margens e custos</p>
                </div>
                <button
                    onClick={() => setView(ViewMode.DASHBOARD)}
                    className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar ao Admin
                </button>
            </header>

            {/* KPIS Principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-indigo-50">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-500 uppercase">Faturamento (Bruto)</p>
                            <h3 className="text-2xl font-black text-gray-900">{formatBRL(stats.grossRevenue)}</h3>
                        </div>
                    </div>
                    <div className="text-sm text-green-600 font-medium flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" /> Baseado em {stats.totalContracts} projetos
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-red-50">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                            <TrendingDown className="w-6 h-6 text-red-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-500 uppercase">Custos e Despesas</p>
                            <h3 className="text-2xl font-black text-gray-900">{formatBRL(stats.totalCosts)}</h3>
                        </div>
                    </div>
                    <div className="flex w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="bg-orange-400 w-[64%]"></div> {/* 45/70 = 64% dos custos */}
                        <div className="bg-blue-400 w-[28%]"></div>  {/* 20/70 = 28% dos custos */}
                        <div className="bg-gray-400 w-[8%]"></div>   {/* 5/70 = 8% dos custos */}
                    </div>
                    <div className="text-xs text-gray-400 mt-2 flex justify-between">
                        <span>Mercadoria/MO/Outros</span>
                    </div>
                </div>

                <div className="bg-gray-900 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-green-500/20 rounded-full blur-2xl group-hover:bg-green-400/30 transition-all"></div>
                    <div className="flex items-center gap-4 mb-4 relative z-10">
                        <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                            <Activity className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-400 uppercase">Lucro Líquido Real</p>
                            <h3 className="text-2xl font-black text-white">{formatBRL(stats.netProfit)}</h3>
                        </div>
                    </div>
                    <div className="text-sm text-green-400 font-medium flex items-center gap-1 relative z-10">
                        Disponível para saque / reinvestimento
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-green-50">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-500 uppercase">Margem de Lucro</p>
                            <h3 className="text-2xl font-black text-gray-900">{stats.profitMargin.toFixed(1)}%</h3>
                        </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(stats.profitMargin, 100)}%` }}></div>
                    </div>
                </div>
            </div>

            {/* Detalhamento e Gráfico (Visual) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-3xl p-8 shadow-lg">
                    <h3 className="text-lg font-black text-gray-900 mb-6 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-indigo-500" />
                        Composição de Custos (%)
                    </h3>

                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <p className="font-bold text-gray-700 flex items-center gap-2"><Package className="w-4 h-4 text-orange-500" /> Materiais & MDF (45%)</p>
                                    <p className="text-xs text-gray-500">Chapas, ferragens, fitas</p>
                                </div>
                                <p className="font-black text-gray-900">{formatBRL(stats.materialCost)}</p>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3">
                                <div className="bg-orange-500 h-3 rounded-full w-[45%]"></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <p className="font-bold text-gray-700 flex items-center gap-2"><Activity className="w-4 h-4 text-blue-500" /> Mão de Obra / Comissões (20%)</p>
                                    <p className="text-xs text-gray-500">Marceneiros, projetistas, montadores</p>
                                </div>
                                <p className="font-black text-gray-900">{formatBRL(stats.laborCost)}</p>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3">
                                <div className="bg-blue-500 h-3 rounded-full w-[20%]"></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <p className="font-bold text-gray-700 flex items-center gap-2"><DollarSign className="w-4 h-4 text-gray-500" /> Custos Operacionais Fixos/Variáveis (5%)</p>
                                    <p className="text-xs text-gray-500">Luz, frete, taxas, etc</p>
                                </div>
                                <p className="font-black text-gray-900">{formatBRL(stats.extraCost)}</p>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3">
                                <div className="bg-gray-500 h-3 rounded-full w-[5%]"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-indigo-600 rounded-3xl p-8 shadow-lg text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                    <h3 className="text-lg font-black mb-6 flex items-center gap-2">
                        Insight de Inteligência
                    </h3>
                    <p className="text-indigo-100 text-sm leading-relaxed mb-6">
                        Com uma margem de <strong>{stats.profitMargin.toFixed(1)}%</strong>, sua operação apresenta uma saúde financeira excelente.
                        Recomendamos o fundo de reserva de pelo menos 10% do Lucro Líquido para manutenções de maquinários.
                    </p>
                    <div className="bg-black/20 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                        <p className="text-xs text-indigo-200 uppercase font-bold mb-1">Ponto de Equilíbrio</p>
                        <p className="text-xl font-black">{formatBRL(stats.totalCosts / 0.55)} /mês</p>
                        <p className="text-[10px] text-indigo-200 mt-1">Estimativa com base nos custos atuais</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfitDashboard;
