import { createWorker } from 'tesseract.js';

/**
 * Pré-processa a imagem com Canvas para aumentar contraste e binarizar,
 * facilitando a leitura de anotações a lápis ou caneta em folhas de papel.
 */
export async function preprocessImageForOcr(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(dataUrl);
            return;
          }

          let w = img.width;
          let h = img.height;
          const maxDim = 1800;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }

          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(img, 0, 0, w, h);

          const imgData = ctx.getImageData(0, 0, w, h);
          const d = imgData.data;

          // Aumenta o contraste das anotações em papel
          const contrast = 1.35;
          const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

          for (let i = 0; i < d.length; i += 4) {
            // Escala de cinza ponderada
            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const enhanced = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
            d[i] = enhanced;
            d[i + 1] = enhanced;
            d[i + 2] = enhanced;
          }

          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.9));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

/**
 * Executa OCR na imagem usando Tesseract.js diretamente no cliente (navegador/celular)
 * Sem necessidade de chaves de API externas ou dependência de servidores.
 */
export async function extractTextFromImage(
  dataUrl: string,
  onProgress?: (progressText: string) => void
): Promise<string> {
  let worker: any = null;
  try {
    if (onProgress) onProgress('Preparando imagem...');
    const preprocessed = await preprocessImageForOcr(dataUrl);

    if (onProgress) onProgress('Iniciando motor de leitura OCR...');
    worker = await createWorker('eng', 1, {
      logger: (m: any) => {
        if (m.status === 'recognizing text' && onProgress) {
          const pct = Math.round((m.progress || 0) * 100);
          onProgress(`Lendo anotações da folha (${pct}%)...`);
        }
      }
    });

    const ret = await worker.recognize(preprocessed);
    const text = ret.data.text || '';
    return text;
  } catch (err) {
    console.error('Falha no Tesseract OCR:', err);
    return '';
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch {}
    }
  }
}
