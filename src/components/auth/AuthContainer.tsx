import React, { useState } from 'react';
import { Shield, Clock, User, Star, Sparkles, ArrowRight, Home } from 'lucide-react';
import { Card3D } from '@/components/animations/Card3D';
import { AnimatedBackground } from '@/components/animations/AnimatedBackground';
import { WorshipPlayer } from '@/components/WorshipPlayer';
import logoSD from '@/assets/logo-sd.jpeg';

interface AuthContainerProps {
    authState: 'SELECT' | 'LOGIN';
    setAuthState: (state: 'SELECT' | 'LOGIN' | 'ADMIN' | 'CLIENT' | 'EMPLOYEE') => void;
    selectedRole: 'ADMIN' | 'CLIENT' | 'EMPLOYEE';
    setSelectedRole: (role: 'ADMIN' | 'CLIENT' | 'EMPLOYEE') => void;
    employeeName: string;
    setEmployeeName: (name: string) => void;
    password: string;
    setPassword: (password: string) => void;
    handleLogin: () => void;
    // Audio props for continuous music
    currentLouvor: any;
    isPlaying: boolean;
    onPlay: () => void;
    onStop: () => void;
    onNext: () => void;
}

export const AuthContainer: React.FC<AuthContainerProps> = ({
    authState,
    setAuthState,
    selectedRole,
    setSelectedRole,
    employeeName,
    setEmployeeName,
    password,
    setPassword,
    handleLogin,
    currentLouvor,
    isPlaying,
    onPlay,
    onStop,
    onNext
}) => {
    return (
        <>
            {authState === 'SELECT' && (
                <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-950 via-gray-900 to-black flex flex-col items-center justify-center overflow-hidden">
                    <AnimatedBackground />
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-amber-500/8 rounded-full blur-[150px]" />
                        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-amber-600/5 rounded-full blur-[100px]" />
                        <div className="absolute top-1/3 right-0 w-96 h-96 bg-amber-400/5 rounded-full blur-3xl" />
                    </div>

                    <div className="absolute inset-0">
                        <div className="absolute top-1/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
                        <div className="absolute bottom-1/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/15 to-transparent" />
                        <div className="absolute left-1/4 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-amber-500/10 to-transparent" />
                        <div className="absolute right-1/4 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-amber-500/10 to-transparent" />
                    </div>

                    <div className="absolute top-4 md:top-8 text-center px-4 z-10 w-full flex justify-center">
                        <div className="inline-flex items-center gap-2 md:gap-3 bg-black/60 backdrop-blur-xl px-4 md:px-6 py-2 md:py-3 rounded-xl md:2xl border border-amber-500/20 shadow-xl max-w-[90%]">
                            <Star className="w-3 md:w-4 h-3 md:h-4 text-amber-400 shrink-0" />
                            <p className="text-gray-300 text-[10px] md:text-sm italic font-light line-clamp-2 md:line-clamp-none">
                                "Tudo o que fizerem, façam de todo o coração, como para o Senhor"
                            </p>
                            <span className="text-amber-400 text-[8px] md:text-xs font-medium shrink-0">— Col. 3:23</span>
                        </div>
                    </div>

                    <div className="relative z-10 flex flex-col items-center mt-20 md:mt-16 w-full">
                        <h1 className="text-2xl md:text-4xl font-black text-white mb-2 tracking-tight text-center">
                            SD Móveis <span className="text-amber-400">Projetados</span>
                        </h1>
                        <p className="text-gray-400 text-xs md:text-sm mb-6 md:mb-12">Selecione seu tipo de acesso</p>

                        <div className="role-cards-carousel flex flex-col landscape:flex-row overflow-x-auto landscape:snap-x landscape:snap-mandatory gap-4 md:gap-8 relative w-full px-4 landscape:px-8 scrollbar-none items-center md:justify-center pb-8" style={{ touchAction: 'pan-x pan-y', WebkitOverflowScrolling: 'touch' as any }}>
                            <div className="w-[85vw] md:w-72 shrink-0 snap-center">
                                <button
                                    onClick={() => { setSelectedRole('ADMIN'); setAuthState('LOGIN'); }}
                                    className="group relative w-full h-72 rounded-[32px] p-6 flex flex-col items-center justify-center transition-all duration-500 overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-950 to-black rounded-[32px]" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent rounded-[32px]" />
                                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 to-transparent group-hover:from-amber-400/15 rounded-[32px] transition-all duration-500" />
                                    <div className="absolute inset-0 rounded-[32px] border-2 border-amber-500/40 group-hover:border-amber-400 transition-colors shadow-2xl shadow-amber-500/10" />
                                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-amber-400/20 rounded-full blur-3xl group-hover:bg-amber-300/40 transition-all" />
                                    <div className="relative z-10 flex flex-col items-center">
                                        <div className="w-20 h-20 rounded-2xl border-2 border-amber-400/60 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform bg-amber-500/10 backdrop-blur-sm shadow-xl overflow-hidden">
                                            <img src={logoSD} alt="SD" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Shield className="w-5 h-5 text-amber-400" />
                                            <h3 className="text-white text-xl font-black tracking-wide uppercase">Administrador</h3>
                                        </div>
                                        <p className="text-gray-400 text-sm">Acesso completo ao sistema</p>
                                        <div className="mt-4 flex items-center gap-2 text-amber-400/70 text-xs hidden md:flex">
                                            <Sparkles className="w-3.5 h-3.5" />
                                            <span>Dashboard • Projetos • CRM</span>
                                        </div>
                                    </div>
                                </button>
                            </div>

                            <div className="w-[85vw] md:w-72 shrink-0 snap-center">
                                <button
                                    onClick={() => { setSelectedRole('CLIENT'); setAuthState('LOGIN'); }}
                                    className="group relative w-full h-72 rounded-[32px] p-6 flex flex-col items-center justify-center transition-all duration-500 overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-gray-950 rounded-[32px]" />
                                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-amber-600/5 rounded-[32px]" />
                                    <div className="absolute inset-0 bg-gradient-to-br from-amber-400/0 to-transparent group-hover:from-amber-400/10 rounded-[32px] transition-all duration-500" />
                                    <div className="absolute inset-0 rounded-[32px] border-2 border-white/20 group-hover:border-amber-400/60 transition-colors shadow-2xl" />
                                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-white/5 rounded-full blur-3xl group-hover:bg-amber-400/20 transition-all" />
                                    <div className="relative z-10 flex flex-col items-center">
                                        <div className="w-20 h-20 rounded-2xl border-2 border-white/30 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform bg-white/10 backdrop-blur-sm shadow-xl overflow-hidden group-hover:border-amber-400/60">
                                            <img src={logoSD} alt="SD" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <User className="w-5 h-5 text-white/80 group-hover:text-amber-400 transition-colors" />
                                            <h3 className="text-white text-xl font-black tracking-wide uppercase">Cliente</h3>
                                        </div>
                                        <p className="text-gray-400 text-sm">Acompanhe seu projeto</p>
                                        <div className="mt-4 flex items-center gap-2 text-white/50 text-xs group-hover:text-amber-400/70 transition-colors hidden md:flex">
                                            <Home className="w-3.5 h-3.5" />
                                            <span>Galeria • Status • Chat</span>
                                        </div>
                                    </div>
                                </button>
                            </div>

                            <div className="w-[85vw] md:w-72 shrink-0 snap-center">
                                <button
                                    onClick={() => { setSelectedRole('EMPLOYEE'); setAuthState('LOGIN'); }}
                                    className="group relative w-full h-72 rounded-[32px] p-6 flex flex-col items-center justify-center transition-all duration-500 overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-900 to-gray-950 rounded-[32px]" />
                                    <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-green-600/5 rounded-[32px]" />
                                    <div className="absolute inset-0 bg-gradient-to-br from-green-400/0 to-transparent group-hover:from-green-400/10 rounded-[32px] transition-all duration-500" />
                                    <div className="absolute inset-0 rounded-[32px] border-2 border-green-500/30 group-hover:border-green-400/60 transition-colors shadow-2xl" />
                                    <div className="absolute -top-20 -right-20 w-40 h-40 bg-green-500/5 rounded-full blur-3xl group-hover:bg-green-400/20 transition-all" />
                                    <div className="relative z-10 flex flex-col items-center">
                                        <div className="w-20 h-20 rounded-2xl border-2 border-green-500/40 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform bg-green-500/10 backdrop-blur-sm shadow-xl overflow-hidden group-hover:border-green-400/60">
                                            <img src={logoSD} alt="SD" className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Clock className="w-5 h-5 text-green-400/80 group-hover:text-green-400 transition-colors" />
                                            <h3 className="text-white text-xl font-black tracking-wide uppercase">Funcionário</h3>
                                        </div>
                                        <p className="text-gray-400 text-sm">Registre seu ponto</p>
                                        <div className="mt-4 flex items-center gap-2 text-green-400/50 text-xs group-hover:text-green-400/70 transition-colors hidden md:flex">
                                            <Clock className="w-3.5 h-3.5" />
                                            <span>Ponto • Horas • Pagamento</span>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>

                    <WorshipPlayer
                        currentLouvor={currentLouvor}
                        isPlaying={isPlaying}
                        onPlay={onPlay}
                        onStop={onStop}
                        onNext={onNext}
                    />

                    <div className="absolute bottom-4 left-4 md:bottom-8 md:left-8 z-10 scale-75 md:scale-100 origin-bottom-left">
                        <div className="flex items-center gap-3 bg-black/50 backdrop-blur-xl px-4 py-2.5 rounded-xl border border-white/10">
                            <div className="w-8 h-8 rounded-lg overflow-hidden border border-amber-500/50 shadow">
                                <img src={logoSD} alt="SD" className="w-full h-full object-cover" />
                            </div>
                            <div>
                                <p className="text-white font-medium text-sm">SD Móveis Projetados</p>
                                <p className="text-gray-500 text-xs">Sistema PRO AI v5.3</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {authState === 'LOGIN' && (
                <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-950 via-gray-900 to-black flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/8 rounded-full blur-[120px]" />
                        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-600/5 rounded-full blur-3xl" />
                        <div className="absolute top-1/2 right-0 w-80 h-80 bg-amber-400/5 rounded-full blur-3xl" />
                    </div>

                    <div className="absolute inset-0">
                        <div className="absolute top-1/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
                        <div className="absolute bottom-1/4 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/15 to-transparent" />
                    </div>

                    <div className="relative z-10 w-full max-w-[420px] px-4">
                        <div className="absolute -inset-4 bg-gradient-to-b from-amber-500/20 via-amber-600/10 to-transparent rounded-[50px] blur-xl" />
                        <div className="relative bg-gradient-to-b from-gray-900/95 to-gray-950/98 backdrop-blur-xl rounded-[28px] md:rounded-[36px] p-6 md:p-10 text-center border border-amber-500/20 shadow-2xl">
                            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-transparent via-amber-500 to-transparent rounded-full" />

                            <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-8 ${selectedRole === 'ADMIN'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : selectedRole === 'EMPLOYEE'
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                    : 'bg-white/10 text-white border border-white/20'
                                }`}>
                                {selectedRole === 'ADMIN' ? <Shield className="w-3.5 h-3.5" /> : selectedRole === 'EMPLOYEE' ? <Clock className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                                {selectedRole === 'ADMIN' ? 'Administrador' : selectedRole === 'EMPLOYEE' ? 'Funcionário' : 'Cliente'}
                            </div>

                            <div className="relative mx-auto mb-6 w-24 h-24">
                                <div className="absolute inset-0 bg-gradient-to-b from-amber-400/30 to-amber-600/20 rounded-2xl blur-xl" />
                                <div className={`relative w-24 h-24 rounded-2xl overflow-hidden ring-2 ${selectedRole === 'ADMIN' ? 'ring-amber-500' : selectedRole === 'EMPLOYEE' ? 'ring-green-500' : 'ring-white/50'
                                    } shadow-xl`} style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}>
                                    <img src={logoSD} alt="SD Móveis" className="w-full h-full object-cover" style={{ imageRendering: 'auto', transform: 'translateZ(0)' }} />
                                </div>
                            </div>

                            <h2 className="text-2xl font-black text-white mb-2">
                                SD Móveis <span className="text-amber-400">Projetados</span>
                            </h2>
                            <p className="text-gray-400 text-sm mb-8">
                                {selectedRole === 'EMPLOYEE' ? 'Digite seu e-mail corporativo' : 'Digite sua senha para continuar'}
                            </p>

                            <div className="space-y-4">
                                {selectedRole === 'EMPLOYEE' && (
                                    <div className="relative">
                                        <input
                                            type="email"
                                            placeholder="Seu e-mail"
                                            className="w-full h-14 bg-white/5 hover:bg-white/8 rounded-xl px-6 border border-white/10 focus:border-green-500/50 focus:ring-2 focus:ring-green-500/20 text-center text-lg text-white placeholder:text-gray-600 transition-all outline-none"
                                            value={employeeName}
                                            onChange={(e) => setEmployeeName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                                        />
                                    </div>
                                )}
                                <div className="relative">
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        className="w-full h-14 bg-white/5 hover:bg-white/8 rounded-xl px-6 border border-white/10 focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20 text-center text-lg tracking-[0.3em] text-white placeholder:text-gray-600 transition-all outline-none"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                                    />
                                </div>

                                <button
                                    onClick={handleLogin}
                                    className={`w-full h-14 rounded-xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl ${selectedRole === 'ADMIN'
                                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black'
                                        : 'bg-gradient-to-r from-white to-gray-100 hover:from-gray-100 hover:to-white text-gray-900'
                                        }`}
                                >
                                    <ArrowRight className="w-5 h-5" />
                                    Entrar no Sistema
                                </button>
                            </div>

                            <button
                                onClick={() => setAuthState('SELECT')}
                                className="mt-8 text-gray-500 text-sm font-medium hover:text-amber-400 transition-colors flex items-center justify-center gap-2 mx-auto group"
                            >
                                <ArrowRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
                                Voltar à seleção
                            </button>

                            <div className="mt-8 pt-6 border-t border-white/10">
                                <p className="text-gray-500 text-xs italic">
                                    "Tudo o que fizerem, façam de todo coração"
                                </p>
                                <p className="text-amber-500/60 text-[10px] mt-1">Colossenses 3:23</p>
                            </div>
                        </div>
                    </div>

                    <WorshipPlayer
                        currentLouvor={currentLouvor}
                        isPlaying={isPlaying}
                        onPlay={onPlay}
                        onStop={onStop}
                        onNext={onNext}
                    />

                    <div className="absolute bottom-6 left-6">
                        <p className="text-gray-600 text-xs">SD Móveis © 2024</p>
                    </div>
                </div>
            )}
        </>
    );
};






