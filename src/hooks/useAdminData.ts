import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { generateRealisticRender } from '@/services/geminiService';

const db = supabase as any;

export const useAdminData = (authState: string) => {
    const { toast } = useToast();
    const [contracts, setContracts] = useState<any[]>([]);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiLoadingMessage, setAiLoadingMessage] = useState("");
    const [renderResult, setRenderResult] = useState<string | null>(null);

    useEffect(() => {
        if (authState === 'ADMIN') {
            const fetchDashboardData = async () => {
                const { data } = await db.from('client_projects').select('*, clients(name, phone, email)').order('created_at', { ascending: false });
                if (data) setContracts(data);
            };
            fetchDashboardData();
        }
    }, [authState]);

    const handleRenderImage = async () => {
        setAiLoadingMessage("Gerando renderização fotorrealista com IA...");
        setIsAiLoading(true);
        const result = await generateRealisticRender({ room: "Ambiente Projetado", finish: "Premium", modules: [] });
        if (result) {
            setRenderResult(result);
            toast({ title: "🎨 Renderização concluída!", description: "Sua imagem fotorrealista foi gerada com sucesso." });
        } else {
            toast({ title: "❌ Erro na renderização", description: "Não foi possível gerar a imagem. Tente novamente.", variant: "destructive" });
        }
        setIsAiLoading(false);
    };

    return {
        contracts,
        isAiLoading,
        aiLoadingMessage,
        renderResult,
        handleRenderImage,
    };
};
