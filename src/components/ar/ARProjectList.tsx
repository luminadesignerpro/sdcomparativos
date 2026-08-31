import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Camera, 
  Ruler, 
  TrendingUp, 
  Calendar, 
  ExternalLink, 
  Package,
  CheckCircle2,
  Clock,
  Eye
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ARProject {
  id: string;
  client_id: string;
  clients?: {
    name: string;
    phone: string;
  };
  title: string;
  data: {
    measurements: string;
    items: any[];
    timestamp: string;
  };
  total_value: number;
  screenshot_url: string;
  created_at: string;
}

const ARProjectList: React.FC = () => {
  const [projects, setProjects] = useState<ARProject[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('ar_measurements')
        .select('*, clients(name, phone)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao buscar projetos AR",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-transparent min-h-screen">
      <header className="flex justify-between items-center bg-gray-900/50 p-6 rounded-3xl border border-white/5 backdrop-blur-xl">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Camera className="w-8 h-8 text-amber-400" />
            Studio AR - Visão de Produção
          </h1>
          <p className="text-gray-400 mt-1">PROJETOS ENVIADOS PELO VENDEDOR (TIREI MEDIDAS NO AR)</p>
        </div>
        <Button 
          onClick={fetchProjects}
          className="bg-amber-600 hover:bg-amber-500 rounded-xl"
        >
          Atualizar Lista
        </Button>
      </header>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card key={project.id} className="bg-gray-900/40 border-white/5 hover:border-amber-500/30 transition-all duration-300 rounded-[32px] overflow-hidden group">
              {project.screenshot_url && (
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={project.screenshot_url} 
                    alt="AR Capture" 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 to-transparent" />
                  <div className="absolute bottom-4 left-4">
                    <span className="bg-amber-500/90 text-black text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-widest">
                      Medição Real
                    </span>
                  </div>
                </div>
              )}
              
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-white text-lg font-bold">{project.clients?.name || 'Cliente Sem Nome'}</CardTitle>
                    <p className="text-gray-500 text-xs mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {new Date(project.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-amber-400 font-black">R$ {project.total_value.toLocaleString()}</p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-gray-500 uppercase font-bold flex items-center gap-1 mb-1">
                      <Ruler className="w-3 h-3 text-amber-500" /> Medida Principal
                    </p>
                    <p className="text-white font-black text-lg">{project.data.measurements}</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-gray-500 uppercase font-bold flex items-center gap-1 mb-1">
                      <Package className="w-3 h-3 text-amber-500" /> Módulos
                    </p>
                    <p className="text-white font-black text-lg">3 Itens</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-xl h-12"
                    onClick={() => window.open(project.screenshot_url, '_blank')}
                  >
                    <Eye className="w-4 h-4 mr-2" /> Ver Foto HD
                  </Button>
                  <Button 
                    className="flex-1 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded-xl h-12"
                    onClick={() => {
                      toast({
                        title: "Importando Medidas",
                        description: "Medidas aplicadas ao editor 3D."
                      });
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" /> Validar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {projects.length === 0 && (
            <div className="col-span-full py-12 text-center bg-white/5 rounded-3xl border border-dashed border-white/10 flex flex-col items-center">
              <Clock className="w-12 h-12 text-gray-600 mb-4" />
              <p className="text-gray-500 font-bold uppercase tracking-widest">Nenhum projeto AR recebido ainda</p>
              <p className="text-gray-600 text-sm mt-1 mb-6">Peça ao vendedor para usar o app "Studio AR Pro"</p>
              <Button 
                variant="outline" 
                className="bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500 hover:text-black transition-all"
                onClick={async () => {
                  const demoProject = {
                    title: 'Projeto Cozinha Demo',
                    data: {
                      measurements: '2.45m x 3.10m',
                      items: ['Balcão Pia', 'Armário Aéreo', 'Torre Quente'],
                      timestamp: new Date().toISOString()
                    },
                    total_value: 12500,
                    screenshot_url: 'https://images.unsplash.com/photo-1556911220-e15224bbaf40?auto=format&fit=crop&q=80',
                  };
                  const { error } = await supabase.from('ar_measurements').insert([demoProject]);
                  if (!error) {
                    fetchProjects();
                    toast({ title: "✅ Projeto Demo Criado", description: "Agora você pode visualizar a interface de produção." });
                  }
                }}
              >
                Criar Projeto Demo para Teste
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ARProjectList;
