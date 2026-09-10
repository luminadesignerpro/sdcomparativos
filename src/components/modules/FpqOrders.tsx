import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { HardDrive, RefreshCw, ClipboardList } from 'lucide-react';

interface FpqOrder {
  id: string;
  order_number: string;
  client_name: string;
  order_date: string;
  total_amount: number;
  status: string;
}

export default function FpqOrders() {
  const [orders, setOrders] = useState<FpqOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('service_orders')
      .select('*')
      .order('order_date', { ascending: false });

    if (error) {
      console.error('Erro ao buscar ordens do FPQ:', error);
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();

    // Realtime integration - Atualiza sozinho quando o Agent envia dados
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-white">FPQ SYSTEM</h1>
          <p className="text-gray-400 text-sm">Sincronização Direta da Marcenaria Local</p>
        </div>
        <div className="flex gap-2">
           <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 px-4 py-1">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2" />
             AGENT ONLINE (Desktop)
           </Badge>
           <button 
             onClick={fetchOrders}
             className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white transition-all"
           >
             <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-black/40 border-white/10 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Sincronizado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-white">{orders.length} Pedidos</div>
          </CardContent>
        </Card>
        
        <Card className="bg-black/40 border-white/10 backdrop-blur-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-gray-500 uppercase tracking-widest">Valor em Orçamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-amber-500">
               R$ {orders.reduce((acc, curr) => acc + (curr.total_amount || 0), 0).toLocaleString('pt-BR')}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black/40 border-white/10 backdrop-blur-md text-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-gray-400 uppercase tracking-widest">Status da Ponte</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 font-bold uppercase text-xs">
            <HardDrive className="w-4 h-4" /> LOCAL PC -> SUPABASE OK
          </CardContent>
        </Card>
      </div>

      <Card className="bg-black/40 border-white/10 backdrop-blur-md overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[600px]">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-amber-500 font-bold">Nº Ordem</TableHead>
                  <TableHead className="text-white">Cliente</TableHead>
                  <TableHead className="text-white">Data</TableHead>
                  <TableHead className="text-white">Valor</TableHead>
                  <TableHead className="text-white">Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-500 italic">
                      Nenhum pedido sincronizado ainda. Ligue o Agente no PC Local.
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((order) => (
                    <TableRow key={order.id} className="border-white/5 hover:bg-white/5 transition-all">
                      <TableCell className="font-bold text-amber-500">#{order.order_number}</TableCell>
                      <TableCell className="text-white font-medium uppercase">{order.client_name}</TableCell>
                      <TableCell className="text-gray-400">
                        {new Date(order.order_date).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-white font-black">
                        R$ {Number(order.total_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-amber-500/20 text-amber-500 border-none">
                          {order.status || 'Pendente'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
