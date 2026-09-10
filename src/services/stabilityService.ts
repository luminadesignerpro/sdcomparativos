import { supabase } from "@/integrations/supabase/client";

export interface StabilityCleanupParams {
  image: string; // base64
  mask: string;  // base64
}

/**
 * Chama a Edge Function segura para processamento de imagem com Stability AI/ClipDrop
 */
async function callStabilityEdgeFunction(task: string, params: any): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("stability-ai", {
      body: {
        task,
        image: params.image,
        mask: params.mask,
        prompt: params.prompt,
      },
    });

    if (error) {
      console.error(`stability-ai (${task}) error:`, error);
      throw error;
    }

    if (!data) return null;

    try {
      let blob: Blob;
      if (data instanceof Blob) {
        blob = data;
      } else if (data instanceof ArrayBuffer) {
        blob = new Blob([data]);
      } else if (typeof data === 'string' && data.startsWith('data:')) {
        return data; // Já é base64
      } else {
        // Fallback para dados binários em string
        const buffer = typeof data === 'string' ? new TextEncoder().encode(data) : data;
        blob = new Blob([buffer]);
      }

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Erro na conversão final da imagem:", e);
      return null;
    }
  } catch (error) {
    console.error(`Failed to call stability-ai (${task}):`, error);
    return null;
  }
}

export async function cleanupObject(params: StabilityCleanupParams): Promise<string | null> {
  return callStabilityEdgeFunction("cleanup", params);
}

export async function relightImage(image: string, prompt: string): Promise<string | null> {
  return callStabilityEdgeFunction("relight", { image, prompt });
}

export async function inpaintObject(image: string, mask: string, prompt: string): Promise<string | null> {
  return callStabilityEdgeFunction("inpaint", { image, mask, prompt });
}

export async function generativeFill(image: string, prompt: string, mask?: string): Promise<string | null> {
  return callStabilityEdgeFunction("inpaint", { image, mask, prompt });
}

export async function styleTransfer(image: string, prompt: string): Promise<string | null> {
  return callStabilityEdgeFunction("style", { image, prompt });
}
