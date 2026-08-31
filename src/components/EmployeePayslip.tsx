import React, { useState } from 'react';
import { FileText, Download, Calendar, DollarSign, ChevronDown, ChevronUp, TrendingUp, Minus, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PayslipData {
  id: string;
  month: string;
  year: string;
  salarioBase: number;
  horasExtras: number;
  valorHorasExtras: number;
  adicionalNoturno: number;
  insalubridade: number;
  valeTransporte: number;
  valeAlimentacao: number;
  descontoINSS: number;
  descontoIRRF: number;
  descontoValeTransporte: number;
  descontoValeAlimentacao: number;
  descontoVale: number;
  faltas: number;
  totalProventos: number;
  totalDescontos: number;
  liquido: number;
}

const PAYSLIPS: PayslipData[] = [
  {
    id: '1', month: 'Fevereiro', year: '2026',
    salarioBase: 2800, horasExtras: 12, valorHorasExtras: 315,
    adicionalNoturno: 0, insalubridade: 280, valeTransporte: 0, valeAlimentacao: 0,
    descontoINSS: 271.04, descontoIRRF: 0, descontoValeTransporte: 168,
    descontoValeAlimentacao: 50, descontoVale: 500, faltas: 0,
    totalProventos: 3395, totalDescontos: 989.04, liquido: 2405.96
  },
  {
    id: '2', month: 'Janeiro', year: '2026',
    salarioBase: 2800, horasExtras: 8, valorHorasExtras: 210,
    adicionalNoturno: 0, insalubridade: 280, valeTransporte: 0, valeAlimentacao: 0,
    descontoINSS: 263.20, descontoIRRF: 0, descontoValeTransporte: 168,
    descontoValeAlimentacao: 50, descontoVale: 0, faltas: 1,
    totalProventos: 3290, totalDescontos: 481.20, liquido: 2808.80
  },
  {
    id: '3', month: 'Dezembro', year: '2025',
    salarioBase: 2800, horasExtras: 20, valorHorasExtras: 525,
    adicionalNoturno: 0, insalubridade: 280, valeTransporte: 0, valeAlimentacao: 0,
    descontoINSS: 288.40, descontoIRRF: 22.50, descontoValeTransporte: 168,
    descontoValeAlimentacao: 50, descontoVale: 300, faltas: 0,
    totalProventos: 3605, totalDescontos: 828.90, liquido: 2776.10
  },
];

interface EmployeePayslipProps {
  employeeName: string;
}

const EmployeePayslip: React.FC<EmployeePayslipProps> = ({ employeeName }) => {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>('1');

  const handleDownload = (payslip: PayslipData) => {
    toast({ title: '📄 Download iniciado', description: `Contracheque ${payslip.month}/${payslip.year} sendo gerado...` });
  };

  return (
    <div className="h-full p-8 overflow-auto bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="mb-8">
        <h1 className="text-4xl font-black text-gray-900 flex items-center gap-3">
          <FileText className="w-8 h-8 text-amber-500" /> Meus Contracheques
        </h1>
        <p className="text-gray-500 mt-1">{employeeName} • Histórico de pagamentos</p>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 shadow-lg">
          <p className="text-xs text-gray-500 uppercase font-bold flex items-center gap-1"><DollarSign className="w-3 h-3" /> Último Salário</p>
          <p className="text-3xl font-black text-green-600 mt-1">R$ {PAYSLIPS[0].liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-gray-400 mt-1">{PAYSLIPS[0].month}/{PAYSLIPS[0].year}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-lg">
          <p className="text-xs text-gray-500 uppercase font-bold flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Salário Base</p>
          <p className="text-3xl font-black text-gray-900 mt-1">R$ {PAYSLIPS[0].salarioBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-gray-400 mt-1">Registrado em carteira</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-lg">
          <p className="text-xs text-gray-500 uppercase font-bold flex items-center gap-1"><Calendar className="w-3 h-3" /> Horas Extras (mês)</p>
          <p className="text-3xl font-black text-amber-600 mt-1">{PAYSLIPS[0].horasExtras}h</p>
          <p className="text-xs text-gray-400 mt-1">R$ {PAYSLIPS[0].valorHorasExtras.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Payslip List */}
      <div className="space-y-4">
        {PAYSLIPS.map(payslip => {
          const isExpanded = expandedId === payslip.id;
          return (
            <div key={payslip.id} className="bg-white rounded-3xl shadow-xl overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : payslip.id)}
                className="w-full p-6 flex justify-between items-center hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-amber-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-gray-900">{payslip.month} {payslip.year}</p>
                    <p className="text-sm text-gray-500">Contracheque mensal</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-black text-green-600 text-xl">R$ {payslip.liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p className="text-xs text-gray-400">Líquido</p>
                  </div>
                  {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-6 pb-6 border-t">
                  <div className="grid grid-cols-2 gap-6 mt-6">
                    {/* Proventos */}
                    <div>
                      <h4 className="font-black text-gray-900 mb-3 flex items-center gap-2 text-sm uppercase">
                        <Plus className="w-4 h-4 text-green-500" /> Proventos
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-600">Salário Base</span>
                          <span className="font-bold text-gray-900">R$ {payslip.salarioBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {payslip.valorHorasExtras > 0 && (
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-gray-600">Horas Extras ({payslip.horasExtras}h)</span>
                            <span className="font-bold text-gray-900">R$ {payslip.valorHorasExtras.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        {payslip.insalubridade > 0 && (
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-gray-600">Insalubridade</span>
                            <span className="font-bold text-gray-900">R$ {payslip.insalubridade.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-2 bg-green-50 px-3 rounded-xl font-black">
                          <span className="text-green-700">Total Proventos</span>
                          <span className="text-green-700">R$ {payslip.totalProventos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>

                    {/* Descontos */}
                    <div>
                      <h4 className="font-black text-gray-900 mb-3 flex items-center gap-2 text-sm uppercase">
                        <Minus className="w-4 h-4 text-red-500" /> Descontos
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-600">INSS</span>
                          <span className="font-bold text-red-600">- R$ {payslip.descontoINSS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {payslip.descontoIRRF > 0 && (
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-gray-600">IRRF</span>
                            <span className="font-bold text-red-600">- R$ {payslip.descontoIRRF.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-600">Vale Transporte</span>
                          <span className="font-bold text-red-600">- R$ {payslip.descontoValeTransporte.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-gray-100">
                          <span className="text-gray-600">Vale Alimentação</span>
                          <span className="font-bold text-red-600">- R$ {payslip.descontoValeAlimentacao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        {payslip.descontoVale > 0 && (
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-gray-600">Vale (Adiantamento)</span>
                            <span className="font-bold text-red-600">- R$ {payslip.descontoVale.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        {payslip.faltas > 0 && (
                          <div className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-gray-600">Faltas ({payslip.faltas})</span>
                            <span className="font-bold text-red-600">- desconto aplicado</span>
                          </div>
                        )}
                        <div className="flex justify-between py-2 bg-red-50 px-3 rounded-xl font-black">
                          <span className="text-red-700">Total Descontos</span>
                          <span className="text-red-700">- R$ {payslip.totalDescontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-6 flex justify-between items-center p-4 bg-gray-900 rounded-2xl text-white">
                    <div>
                      <p className="text-sm text-gray-400">Salário Líquido</p>
                      <p className="text-3xl font-black text-amber-400">R$ {payslip.liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                    <button
                      onClick={() => handleDownload(payslip)}
                      className="bg-amber-600 hover:bg-amber-500 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all hover:scale-105"
                    >
                      <Download className="w-5 h-5" /> Baixar PDF
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default EmployeePayslip;
