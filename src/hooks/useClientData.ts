import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

export const useClientData = (authState: string, password: string) => {
    const [clientName, setClientName] = useState('');
    const [clientProject, setClientProject] = useState<any>(null);
    const [clientInstallments, setClientInstallments] = useState<any[]>([]);
    const [clientProductionSteps, setClientProductionSteps] = useState<any[]>([]);
    const [clientTimeline, setClientTimeline] = useState<any[]>([]);
    const [galleryItems, setGalleryItems] = useState<any[]>([]);
    const [projectApproved, setProjectApproved] = useState(false);
    const [showClientContract, setShowClientContract] = useState(false);
    const [showClientFinanceiro, setShowClientFinanceiro] = useState(false);
    const [galleryFullscreen, setGalleryFullscreen] = useState<any | null>(null);

    useEffect(() => {
        if (authState === 'CLIENT') {
            const fetchClientData = async () => {
                // Busca o funcionário com role=Cliente e a senha fornecida
                const { data: emps } = await db
                    .from('employees')
                    .select('email, name')
                    .eq('password', password.trim())
                    .eq('role', 'Cliente')
                    .limit(1);

                const emp = emps && emps.length > 0 ? emps[0] : null;
                if (!emp) return;

                setClientName(emp.name);

                // Extrai o client_id do email: cliente_UUID@sdmoveis.com
                const match = emp.email?.match(/cliente_(.+)@sdmoveis\.com/);
                const clientId = match ? match[1] : null;

                if (clientId) {
                    const { data: projects } = await db
                        .from('client_projects')
                        .select('*')
                        .eq('client_id', clientId)
                        .limit(1);

                    const project = projects && projects.length > 0 ? projects[0] : null;
                    if (project) {
                        setClientProject(project);

                        const [installRes, stepsRes, timelineRes, galleryRes] = await Promise.all([
                            db.from('project_installments').select('*').eq('project_id', project.id).order('installment_number'),
                            db.from('project_production_steps').select('*').eq('project_id', project.id).order('sort_order'),
                            db.from('project_timeline').select('*').eq('project_id', project.id).order('sort_order'),
                            db.from('project_gallery').select('*').eq('project_id', project.id).order('created_at'),
                        ]);

                        if (installRes.data) setClientInstallments(installRes.data);
                        if (stepsRes.data) setClientProductionSteps(stepsRes.data);
                        if (timelineRes.data) setClientTimeline(timelineRes.data);
                        if (galleryRes.data && galleryRes.data.length > 0) {
                            setGalleryItems(galleryRes.data.map((g: any) => ({ title: g.title, desc: g.description || '', url: g.image_url })));
                        }
                    }
                }
            };
            fetchClientData();
        }
    }, [authState, password]);

    return {
        clientName,
        clientProject,
        clientInstallments,
        clientProductionSteps,
        clientTimeline,
        galleryItems,
        projectApproved,
        setProjectApproved,
        showClientContract,
        setShowClientContract,
        showClientFinanceiro,
        setShowClientFinanceiro,
        galleryFullscreen,
        setGalleryFullscreen,
    };
};
