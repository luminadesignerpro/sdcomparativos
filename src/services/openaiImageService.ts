import { supabase } from "@/integrations/supabase/client";

export async function generateOpenAIImage(prompt: string, image?: string, mask?: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("openai-image", {
      body: {
        task: image && mask ? "edit" : "generation",
        prompt,
        image,
        mask
      },
    });

    if (error) {
      console.error(`openai-image error:`, error);
      throw error;
    }

    if (data instanceof Blob || data instanceof ArrayBuffer) {
      const buffer = data instanceof Blob ? await data.arrayBuffer() : data;
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      return `data:image/png;base64,${base64}`;
    }

    return data;
  } catch (error) {
    console.error(`Failed to call openai-image:`, error);
    return null;
  }
}
