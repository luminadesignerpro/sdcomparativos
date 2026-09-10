import React from 'react';
import { ViewMode } from '@/types';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { Dashboard3DScene } from '@/components/dashboard3d/Dashboard3DScene';
import SuppliersPage from '@/components/modules/SuppliersPage';
import ProductsPage from '@/components/modules/ProductsPage';
import ServiceOrdersPage from '@/components/modules/ServiceOrdersPage';
import CashRegisterPage from '@/components/modules/CashRegisterPage';
import AccountsPage from '@/components/modules/AccountsPage';
import ContractsPage from '@/components/modules/ContractsPage';
import SalesPage from '@/components/modules/SalesPage';
import TimeTrackingPanel from '@/components/timetracking/TimeTrackingPanel';
import FleetAdminPanel from '@/components/fleet/FleetAdminPanel';
import QualityCheckPanel from '@/components/admin/QualityCheckPanel';
import ProjectCostPanel from '@/components/admin/ProjectCostPanel';
import UserManagement from '@/components/admin/UserManagement';
import { MessageCircle, GitBranch } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WhatsAppCRMReal } from '@/components/crm/WhatsAppCRMReal';
import { ChatFlowPanel } from '@/components/crm/ChatFlowPanel';
import { ClientPortal } from '@/components/client/ClientPortal';
import AfterSalesPanel from '@/components/client/AfterSalesPanel';
import WarrantyCertificate from '@/components/client/WarrantyCertificate';
import EmployeePortal from '@/components/EmployeePortal';
import DriverTripPanel from '@/components/fleet/DriverTripPanel';
import InternalChat from '@/components/chat/InternalChat';
import SettingsPage from '@/pages/Settings';
import BudgetQuote from '@/components/budget/BudgetQuote';
import PromobEditor from '@/components/promob/PromobEditor';

interface AppMainContentProps {
    authState: 'ADMIN' | 'CLIENT' | 'EMPLOYEE';
    view: ViewMode;
    setView: (view: ViewMode) => void;
    contracts: any[];
    handleRenderImage: () => void;
    selectedContract: any | null;
    clientName: string;
    clientProject: any;
    clientInstallments: any[];
    clientProductionSteps: any[];
    clientTimeline: any[];
    galleryItems: any[];
    projectApproved: boolean;
    setProjectApproved: (val: boolean) => void;
    setShowClientContract: (val: boolean) => void;
    setShowClientFinanceiro: (val: boolean) => void;
    setGalleryFullscreen: (val: any) => void;
    employeeName: string;
    toast: any;
}

export const AppMainContent: React.FC<AppMainContentProps> = ({
    authState,
    view,
    setView,
    contracts,
    handleRenderImage,
    selectedContract,
    clientName,
    clientProject,
    clientInstallments,
    clientProductionSteps,
    clientTimeline,
    galleryItems,
    projectApproved,
    setProjectApproved,
    setShowClientContract,
    setShowClientFinanceiro,
    setGalleryFullscreen,
    employeeName,
    toast,
}) => {
    return (
        <>
            {/* ADMIN VIEWS */}
            {authState === 'ADMIN' && (
                <>
                    {view === ViewMode.DASHBOARD && <AdminDashboard contracts={contracts} setView={setView} handleRender={handleRenderImage} />}
                    {view === ViewMode.DASHBOARD_3D && <div className="h-full p-4 overflow-auto"><Dashboard3DScene /></div>}                    {view === ViewMode.SUPPLIERS && <SuppliersPage />}
                    {view === ViewMode.PRODUCTS && <ProductsPage />}
                    {view === ViewMode.SERVICE_ORDERS && <ServiceOrdersPage />}
                    {view === ViewMode.CASH_REGISTER && <CashRegisterPage />}
                    {view === ViewMode.ACCOUNTS_PAYABLE && <AccountsPage type="payable" />}
                    {view === ViewMode.ACCOUNTS_RECEIVABLE && <AccountsPage type="receivable" />}
                    {view === ViewMode.CONTRACTS_MGMT && <ContractsPage />}
                    {view === ViewMode.USER_MANAGEMENT && <UserManagement />}
                    {view === ViewMode.CONTRACTS && <SalesPage />}
                    {view === ViewMode.TIME_TRACKING && <TimeTrackingPanel />}
                    {view === ViewMode.FLEET && <FleetAdminPanel />}
                    {view === ViewMode.CHAT && <InternalChat userName="Administrador" userRole="ADMIN" />}
                    {view === ViewMode.SETTINGS && <div className="h-full overflow-auto"><SettingsPage /></div>}
                    {view === ViewMode.BUDGET_QUOTE && <BudgetQuote />}
                    {view === ViewMode.QUALITY_CHECK && selectedContract && <QualityCheckPanel projectId={selectedContract.id} projectName={selectedContract.name} />}
                    {view === ViewMode.PROJECT_COSTS && selectedContract && <ProjectCostPanel projectId={selectedContract.id} projectName={selectedContract.name} totalValue={selectedContract.value} />}
                    {view === ViewMode.PROMOB && <div className="h-full p-6 overflow-auto bg-[#0f0f0f] min-h-screen"><PromobEditor /></div>}
                    {view === ViewMode.CRM && (
                        <div className="h-full p-6 overflow-auto bg-[#0f0f0f]">
                            <header className="mb-6">
                                <h1 className="text-3xl font-black text-gray-900 flex items-center gap-3">
                                    <MessageCircle className="w-8 h-8 text-green-500" />
                                    CRM WhatsApp
                                </h1>
                            </header>
                            <Tabs defaultValue="crm" className="w-full">
                                <TabsList className="mb-4">
                                    <TabsTrigger value="crm" className="gap-2"><MessageCircle className="w-4 h-4" /> Conversas</TabsTrigger>
                                    <TabsTrigger value="flow" className="gap-2"><GitBranch className="w-4 h-4" /> Fluxo</TabsTrigger>
                                </TabsList>
                                <TabsContent value="crm"><WhatsAppCRMReal /></TabsContent>
                                <TabsContent value="flow"><ChatFlowPanel /></TabsContent>
                            </Tabs>
                        </div>
                    )}
                </>
            )}

            {/* CLIENT VIEWS */}
            {authState === 'CLIENT' && (
                <>
                    {view === ViewMode.CLIENT_PORTAL && (
                        <ClientPortal
                            clientName={clientName}
                            clientProject={clientProject}
                            clientInstallments={clientInstallments}
                            clientProductionSteps={clientProductionSteps}
                            clientTimeline={clientTimeline}
                            galleryItems={galleryItems}
                            projectApproved={projectApproved}
                            setProjectApproved={setProjectApproved}
                            setView={setView}
                            setShowClientContract={setShowClientContract}
                            setShowClientFinanceiro={setShowClientFinanceiro}
                            setGalleryFullscreen={setGalleryFullscreen}
                            toast={toast}
                        />
                    )}
                    {view === ViewMode.AFTER_SALES && <AfterSalesPanel />}
                    {view === ViewMode.WARRANTY && (
                        <div className="p-8 overflow-auto h-full bg-[#0f0f0f]">
                            <WarrantyCertificate
                                projectName={clientProject?.name || 'Projeto SD'}
                                clientName={clientName || 'Cliente'}
                                signedAt={clientProject?.signed_at}
                                warranty={clientProject?.warranty}
                                material={clientProject?.material}
                                projectType={clientProject?.project_type}
                            />
                        </div>
                    )}
                    {view === ViewMode.CRM && <div className="p-8 h-full bg-[#0f0f0f] rounded-3xl m-4 border border-white/5 shadow-xl overflow-auto"><WhatsAppCRMReal /></div>}
                    {view === ViewMode.CHAT && <InternalChat userName={clientName || 'Cliente'} userRole="CLIENT" />}
                </>
            )}

            {/* EMPLOYEE VIEWS */}
            {authState === 'EMPLOYEE' && (
                <>
                    {view === ViewMode.TIME_TRACKING && <EmployeePortal employeeName={employeeName} />}
                    <div style={{ display: view === ViewMode.FLEET ? "block" : "none" }} className="p-8 h-full bg-[#0f0f0f] overflow-auto"><DriverTripPanel employeeId="" employeeName={employeeName} /></div>
                    {view === ViewMode.CHAT && <InternalChat userName={employeeName || 'Funcionário'} userRole="EMPLOYEE" />}
                </>
            )}
        </>
    );
};




