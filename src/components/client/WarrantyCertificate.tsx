import React from 'react';
import { Shield, Calendar, CheckCircle, FileText } from 'lucide-react';

interface WarrantyCertificateProps {
  projectName: string;
  clientName: string;
  signedAt: string | null;
  warranty: string | null;
  material: string | null;
  projectType: string | null;
}

export default function WarrantyCertificate({ projectName, clientName, signedAt, warranty, material, projectType }: WarrantyCertificateProps) {
  const warrantyYears = warranty || '5 Anos';
  const startDate = signedAt ? new Date(signedAt) : new Date();
  const endDate = new Date(startDate);
  const yearsNum = parseInt(warrantyYears) || 5;
  endDate.setFullYear(endDate.getFullYear() + yearsNum);

  const coverage = [
    'Estrutura e carcaça dos módulos',
    'Ferragens de portas e gavetas',
    'Acabamento e revestimento de superfícies',
    'Nivelamento e alinhamento das peças',
    'Defeitos de fabricação em geral',
  ];

  return (
    <div className="bg-[#0a0a0a] rounded-3xl p-8 shadow-2xl border border-amber-500/20 relative overflow-hidden text-white">
      {/* Decorative */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -mr-32 -mt-32" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl -ml-32 -mb-32" />

      <div className="relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <Shield className="w-16 h-16 text-amber-500 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]" />
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">Certificado de Garantia</h2>
          <p className="text-white/40 text-[10px] uppercase font-black tracking-[0.2em] mt-1">SD Móveis Projetados</p>
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-1">Cliente</p>
            <p className="font-bold text-white">{clientName}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-1">Projeto</p>
            <p className="font-bold text-white">{projectName}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-1">Material</p>
            <p className="font-bold text-white">{material || 'MDF Premium'}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-1">Tipo</p>
            <p className="font-bold text-white">{projectType || 'Móvel sob medida'}</p>
          </div>
        </div>

        {/* Validity */}
        <div className="bg-green-500/5 rounded-2xl p-6 border border-green-500/20 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-green-400" />
            <p className="font-black text-white uppercase text-xs tracking-widest">Validade da Garantia: <span className="text-green-400">{warrantyYears}</span></p>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-[9px] text-green-400/50 font-black uppercase tracking-widest mb-1">Início</p>
              <p className="font-black text-white text-lg">{startDate.toLocaleDateString('pt-BR')}</p>
            </div>
            <div>
              <p className="text-[9px] text-green-400/50 font-black uppercase tracking-widest mb-1">Término</p>
              <p className="font-black text-white text-lg">{endDate.toLocaleDateString('pt-BR')}</p>
            </div>
          </div>
        </div>

        {/* Coverage */}
        <div className="mb-10">
          <h3 className="font-black text-white text-xs uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" /> COBERTURA PREMIUM
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-6">
            {coverage.map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-xs text-white/60">
                <span className="w-5 h-5 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center text-[10px] font-black italic">SD</span>
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-8 border-t border-white/5">
          <p className="text-[10px] text-white/20 italic leading-relaxed max-w-xs mx-auto">
            Este certificado digital tem validade legal conforme os termos do contrato assinado.
          </p>
          <div className="mt-4 inline-block px-4 py-1.5 bg-amber-500 text-black text-[9px] font-black uppercase tracking-[0.3em] rounded-full">
            Qualidade & Confiança
          </div>
        </div>
      </div>
    </div>
  );
}
