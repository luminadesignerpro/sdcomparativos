import { createWorker } from 'tesseract.js';

/**
 * Pré-processa a imagem com Canvas para aumentar contraste e nitidez,
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
          const maxDim = 2000;
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

          // Aumento equilibrado de contraste (+35%) com fator estritamente positivo
          // Fórmula padrão de contraste: factor > 0
          const contrastLevel = 35; // escala -100 a +100
          const factor = (259 * (contrastLevel + 255)) / (255 * (259 - contrastLevel)); // ~ 1.264

          for (let i = 0; i < d.length; i += 4) {
            // Escala de cinza padrão ITU-R BT.601
            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            const enhanced = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
            d[i] = enhanced;
            d[i + 1] = enhanced;
            d[i + 2] = enhanced;
          }

          ctx.putImageData(imgData, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
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
 * Executa OCR na imagem para extrair TODAS as peças anotadas (ex: 15 peças na foto)
 * 1. Tenta Gemini Vision se a chave de API estiver disponível (reconhecimento multimodal de manuscritos).
 * 2. Se não houver chave ou falhar, utiliza Tesseract.js (por + eng) com PSM 6 e duas passagens.
 */
export async function extractTextFromImage(
  dataUrl: string,
  onProgress?: (progressText: string) => void
): Promise<string> {
  // 1. TENTATIVA 1: GEMINI VISION MULTIMODAL (Se chave configurada)
  const geminiKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim().replace(/[\r\n\s]/g, '');
  if (geminiKey && geminiKey.startsWith('AIzaSy')) {
    try {
      if (onProgress) onProgress('Analisando anotações com IA Vision...');
      let cleanBase64 = dataUrl;
      let mimeType = 'image/jpeg';
      if (cleanBase64.startsWith('data:')) {
        const commaIdx = cleanBase64.indexOf(',');
        const header = cleanBase64.slice(0, commaIdx);
        cleanBase64 = cleanBase64.slice(commaIdx + 1);
        if (header.includes('image/png')) mimeType = 'image/png';
        else if (header.includes('image/webp')) mimeType = 'image/webp';
      }

      const visionPrompt = `Você é um leitor técnico especialista em planos de corte e listas de peças de marcenaria escritas à mão em papel ou caderno.
Analise a foto e transcreva TODAS as peças visíveis na lista (sem omitir nenhuma, mesmo que sejam 15 ou mais peças).
Para cada peça, retorne exatamente uma linha no formato:
QUANTIDADE DE COMPRIMENTO * LARGURA NOME
Exemplos:
1 DE 94 * 60 TB
2 DE 72 * 60 LAT
1 DE 91 * 60 MEIO
4 DE 57 * 18.5 FRENTE
8 DE 50 * 14 LAT
Retorne apenas a lista de peças, sem explicações ou saudações.`;

      const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash'];
      for (const model of geminiModels) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: visionPrompt },
                  { inline_data: { mime_type: mimeType, data: cleanBase64 } }
                ]
              }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 2048 }
            })
          });

          if (res.ok) {
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text && text.trim().length > 10) {
              console.log('[OCR] Gemini Vision detectou:', text);
              return text;
            }
          }
        } catch (e) {
          console.warn(`[OCR] Gemini Vision ${model} falhou, tentando fallback:`, e);
        }
      }
    } catch (err) {
      console.warn('[OCR] Erro no Gemini Vision:', err);
    }
  }

  // 2. TENTATIVA 2: TESSERACT.JS OCR CLIENT-SIDE APRIMORADO
  let worker: any = null;
  try {
    if (onProgress) onProgress('Preparando imagem para leitura...');
    const preprocessed = await preprocessImageForOcr(dataUrl);

    if (onProgress) onProgress('Iniciando motor de leitura OCR...');
    
    // Tenta carregar modelo português + inglês para reconhecer termos de marcenaria
    try {
      worker = await createWorker(['por', 'eng'], 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text' && onProgress) {
            const pct = Math.round((m.progress || 0) * 100);
            onProgress(`Lendo todas as peças da folha (${pct}%)...`);
          }
        }
      });
    } catch {
      worker = await createWorker('por', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text' && onProgress) {
            const pct = Math.round((m.progress || 0) * 100);
            onProgress(`Lendo todas as peças da folha (${pct}%)...`);
          }
        }
      });
    }

    try {
      // PSM 6: Assume um bloco único uniforme de texto (ideal para listas linha a linha)
      await worker.setParameters({
        tessedit_pageseg_mode: '6' as any,
      });
    } catch {}

    const ret = await worker.recognize(preprocessed);
    let text = ret.data.text || '';

    // Se a leitura da imagem com contraste pegou poucas linhas (< 3), tenta na imagem original
    const linesPre = text.trim().split('\n').filter(Boolean);
    if (linesPre.length < 3) {
      try {
        const retOrig = await worker.recognize(dataUrl);
        const textOrig = retOrig.data.text || '';
        const linesOrig = textOrig.trim().split('\n').filter(Boolean);
        if (linesOrig.length > linesPre.length) {
          text = textOrig;
        }
      } catch {}
    }

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
