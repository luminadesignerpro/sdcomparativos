import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;
const SYNC_RECORD_ID = '00000000-0000-0000-0000-000000000001';
const CHANNEL_NAME = 'sd_comparativo_cloud_sync';

export interface CloudStatePayload {
  comparisons?: any[];
  clientFolders?: any[];
  materialList?: any[];
  suppliers?: any[];
  updatedAt: string;
  sourceDevice?: string;
}

type SyncListener = (payload: CloudStatePayload) => void;
const listeners = new Set<SyncListener>();

let syncChannel: any = null;

export const initCloudSync = (onUpdate?: SyncListener) => {
  if (onUpdate) {
    listeners.add(onUpdate);
  }

  if (!syncChannel) {
    syncChannel = supabase.channel(CHANNEL_NAME, {
      config: { broadcast: { self: false } }
    });

    syncChannel
      .on('broadcast', { event: 'state_changed' }, (payload: any) => {
        if (payload?.payload) {
          const cloudData: CloudStatePayload = payload.payload;
          
          // Atualiza localStorage local
          if (cloudData.comparisons) {
            localStorage.setItem('sd_supplier_comparisons_v3', JSON.stringify(cloudData.comparisons));
          }
          if (cloudData.clientFolders) {
            localStorage.setItem('sd_client_folders_v1', JSON.stringify(cloudData.clientFolders));
            localStorage.setItem('sd_supplier_client_folders_v3', JSON.stringify(cloudData.clientFolders));
          }
          if (cloudData.materialList) {
            localStorage.setItem('sd_material_list_v1', JSON.stringify(cloudData.materialList));
          }
          if (cloudData.suppliers) {
            localStorage.setItem('sd_suppliers_v3', JSON.stringify(cloudData.suppliers));
          }

          // Notifica os componentes React
          listeners.forEach(fn => {
            try { fn(cloudData); } catch (e) { console.error('Sync listener error:', e); }
          });
        }
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          // Quando conectar, busca o estado mais recente da nuvem
          fetchCloudState();
        }
      });
  }

  return () => {
    if (onUpdate) {
      listeners.delete(onUpdate);
    }
  };
};

/**
 * Salva o estado completo no Supabase e transmite via Broadcast para todos os dispositivos (celular e computador)
 */
export const pushCloudState = async (partialState: Partial<CloudStatePayload>) => {
  const currentComparisons = partialState.comparisons ?? (() => {
    try { return JSON.parse(localStorage.getItem('sd_supplier_comparisons_v3') || '[]'); } catch { return []; }
  })();

  const currentFolders = partialState.clientFolders ?? (() => {
    try { return JSON.parse(localStorage.getItem('sd_client_folders_v1') || '[]'); } catch { return []; }
  })();

  const currentMaterialList = partialState.materialList ?? (() => {
    try { return JSON.parse(localStorage.getItem('sd_material_list_v1') || '[]'); } catch { return []; }
  })();

  const currentSuppliers = partialState.suppliers ?? (() => {
    try { return JSON.parse(localStorage.getItem('sd_suppliers_v3') || '[]'); } catch { return []; }
  })();

  const payload: CloudStatePayload = {
    comparisons: currentComparisons,
    clientFolders: currentFolders,
    materialList: currentMaterialList,
    suppliers: currentSuppliers,
    updatedAt: new Date().toISOString(),
    sourceDevice: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop'
  };

  // 1. Salva localmente
  localStorage.setItem('sd_supplier_comparisons_v3', JSON.stringify(payload.comparisons));
  localStorage.setItem('sd_client_folders_v1', JSON.stringify(payload.clientFolders));
  localStorage.setItem('sd_supplier_client_folders_v3', JSON.stringify(payload.clientFolders));
  localStorage.setItem('sd_material_list_v1', JSON.stringify(payload.materialList));
  localStorage.setItem('sd_suppliers_v3', JSON.stringify(payload.suppliers));
  localStorage.setItem('sd_last_cloud_sync', payload.updatedAt);

  // 2. Transmite instantaneamente para todos os outros navegadores/dispositivos conectados
  if (syncChannel) {
    try {
      await syncChannel.send({
        type: 'broadcast',
        event: 'state_changed',
        payload
      });
    } catch (err) {
      console.warn('Broadcast send error:', err);
    }
  }

  // 3. Persiste no Supabase para quando o outro aparelho abrir mais tarde
  try {
    const serialized = JSON.stringify(payload);
    // Armazena no Supabase na tabela de configuração/service_orders
    const { error } = await db.from('service_orders').upsert({
      id: SYNC_RECORD_ID,
      title: 'SD_CLOUD_DATABASE_STATE',
      description: serialized,
      status: 'synced',
      updated_at: new Date().toISOString()
    });
    if (error) {
      // Tenta fallback com profiles ou local
      console.warn('Supabase state sync note:', error.message);
    }
  } catch (err) {
    console.warn('Cloud persistence error:', err);
  }

  return payload;
};

/**
 * Baixa o estado mais recente do Supabase e atualiza o sistema local
 */
export const fetchCloudState = async (): Promise<CloudStatePayload | null> => {
  try {
    const { data, error } = await db
      .from('service_orders')
      .select('description, updated_at')
      .eq('id', SYNC_RECORD_ID)
      .maybeSingle();

    if (!error && data?.description) {
      const parsed: CloudStatePayload = JSON.parse(data.description);
      if (parsed && typeof parsed === 'object') {
        const localLastSync = localStorage.getItem('sd_last_cloud_sync') || '';
        
        // Atualiza o localStorage local com os dados da nuvem
        if (parsed.comparisons) {
          localStorage.setItem('sd_supplier_comparisons_v3', JSON.stringify(parsed.comparisons));
        }
        if (parsed.clientFolders) {
          localStorage.setItem('sd_client_folders_v1', JSON.stringify(parsed.clientFolders));
          localStorage.setItem('sd_supplier_client_folders_v3', JSON.stringify(parsed.clientFolders));
        }
        if (parsed.materialList) {
          localStorage.setItem('sd_material_list_v1', JSON.stringify(parsed.materialList));
        }
        if (parsed.suppliers) {
          localStorage.setItem('sd_suppliers_v3', JSON.stringify(parsed.suppliers));
        }
        localStorage.setItem('sd_last_cloud_sync', parsed.updatedAt || new Date().toISOString());

        // Dispara aviso para atualizar o estado da tela
        listeners.forEach(fn => {
          try { fn(parsed); } catch (e) { console.error('Listener notify error:', e); }
        });

        return parsed;
      }
    }
  } catch (err) {
    console.warn('Error fetching cloud state:', err);
  }
  return null;
};
