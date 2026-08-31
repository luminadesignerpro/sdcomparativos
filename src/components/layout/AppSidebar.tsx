import React from 'react';
import { Instagram, Bell, Settings, ArrowRight, Clock, Navigation, MessageSquare, Monitor } from 'lucide-react';
import { ViewMode } from '@/types';
import { NavIcon } from '@/components/ui/nav-icon';
import logoSD from '@/assets/logo-sd.jpeg';
import { useIsMobile } from '@/hooks/use-mobile';

interface AppSidebarProps {
    authState: 'ADMIN' | 'CLIENT' | 'EMPLOYEE';
    view: ViewMode;
    setView: (view: ViewMode) => void;
    setAuthState: (state: 'SELECT' | 'LOGIN' | 'ADMIN' | 'CLIENT' | 'EMPLOYEE') => void;
}

const EmployeeMobileMenu = ({ view, setView, setAuthState }) => {
    const items = [
        { icon: Clock, label: 'MEU PONTO', sub: 'Registre sua presenca', mode: ViewMode.TIME_TRACKING, color: '#1a56a0' },
        { icon: Navigation, label: 'VIAGENS', sub: 'Controle de rotas e frota', mode: ViewMode.FLEET, color: '#d4a017' },
        { icon: MessageSquare, label: 'CHAT', sub: 'Comunicacao interna', mode: ViewMode.CHAT, color: '#2d6a4f' },
    ];

    return (
        <aside className="flex flex-col items-center min-h-screen w-full relative z-10" style={{ background: 'linear-gradient(180deg, hsl(var(--sidebar-background) / 0.97) 0%, hsl(var(--sidebar-background)) 100%)' }}>
            <div className="flex flex-col items-center pt-6 pb-4 w-full px-4">
                <img src={logoSD} alt="SD Moveis" className="w-16 h-16 rounded-2xl border-2 border-primary shadow-lg object-cover mb-2" />
                <p className="text-[11px] text-muted-foreground font-semibold tracking-widest uppercase">SD Moveis Projetados</p>
            </div>
            <nav className="flex flex-col gap-3 w-full px-3 flex-1">
                {items.map(({ icon: Icon, label, sub, mode, color }) => (
                    <button key={label} onClick={() => setView(mode)} className="w-full rounded-2xl p-4 flex items-center gap-4 transition-all duration-200 border" style={{ background: view === mode ? color : 'transparent' }}>
                        <Icon className="w-6 h-6" />
                        <div className="text-left">
                            <p className="font-black text-sm tracking-wide">{label}</p>
                            <p className="text-[11px] font-medium">{sub}</p>
                        </div>
                    </button>
                ))}
            </nav>
        </aside>
    );
};

export const AppSidebar = ({ authState, view, setView, setAuthState }) => {
    const isMobile = useIsMobile();
    if (isMobile && authState === 'EMPLOYEE') return <EmployeeMobileMenu view={view} setView={setView} setAuthState={() => setAuthState('SELECT')} />;

    return (
        <aside className="w-24 flex flex-col items-center py-4 gap-2 h-screen backdrop-blur-xl border-r border-sidebar-border/30" style={{ background: 'linear-gradient(180deg, hsl(var(--sidebar-background) / 0.92) 0%, hsl(var(--sidebar-background) / 0.98) 100%)' }}>
            <button onClick={() => setView(authState === 'ADMIN' ? ViewMode.DASHBOARD : ViewMode.TIME_TRACKING)} className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-primary mb-6">
                <img src={logoSD} alt="SD" className="w-full h-full object-cover" />
            </button>
            <nav className="flex-1 flex flex-col items-center gap-4 w-full overflow-y-auto">
                {authState === 'ADMIN' ? (
                    <>
                        <NavIcon icon="layout-dashboard" label="Inicio" active={view === ViewMode.DASHBOARD} onClick={() => setView(ViewMode.DASHBOARD)} />
                        <NavIcon icon="file-text" label="Projetos" active={view === ViewMode.CONTRACTS} onClick={() => setView(ViewMode.CONTRACTS)} />
                        <NavIcon icon="clipboard-list" label="OS" active={view === ViewMode.SERVICE_ORDERS} onClick={() => setView(ViewMode.SERVICE_ORDERS)} />
                        <NavIcon icon="message-square" label="CRM" active={view === ViewMode.CRM} onClick={() => setView(ViewMode.CRM)} isFab />
                        
                        <button onClick={() => window.location.href = 'fpqsystem://open'} className="flex flex-col items-center gap-1 p-2 rounded-xl text-green-500 hover:bg-green-500/10 transition-all border border-green-500/20 mt-2">
                            <Monitor className="w-5 h-5" />
                            <span className="text-[10px] font-bold">FPQ PC</span>
                        </button>
                        <NavIcon icon="monitor" label="Promob Web" active={view === ViewMode.PROMOB} onClick={() => setView(ViewMode.PROMOB)} />
                        <button onClick={() => window.location.href = 'promobsystem://open'} className="flex flex-col items-center gap-1 p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-all border border-red-500/20 mt-2">
                            <Monitor className="w-5 h-5" />
                            <span className="text-[10px] font-bold">Promob PC</span>
                        </button>
                        <NavIcon icon="settings-2" label="Integração" active={view === ViewMode.INTEGRATION} onClick={() => setView(ViewMode.INTEGRATION)} />
                    </>
                ) : (
                    <NavIcon icon="home" label="Painel" active={view === ViewMode.CLIENT_PORTAL} onClick={() => setView(ViewMode.CLIENT_PORTAL)} />
                )}
            </nav>
            <div className="mt-auto flex flex-col items-center gap-4 pb-4">
                <button onClick={() => setView(ViewMode.SETTINGS)} className="p-3 text-gray-500 hover:text-primary"><Settings className="w-5 h-5" /></button>
                <button onClick={() => setAuthState('SELECT')} className="p-3 text-red-500"><ArrowRight className="w-5 h-5 rotate-180" /></button>
            </div>
        </aside>
    );
};
