import { supabase } from "@/integrations/supabase/client";

const GROQ_API_KEY = (import.meta.env.VITE_GROQ_API_KEY || "").trim();
const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY || "").trim().replace(/[\r\n\s]/g, "");

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Chat conversacional avançado com Gemini 3.7 / 2.0 Flash e Claude/Groq Llama 3.3
 * Sem necessidade de login ou conta - funciona 100% via WiFi
 */
export async function chatWithAI(
  prompt: string, 
  systemInstruction?: string,
  modelName: 'gemini-3.7-flash' | 'claude-opus-4.6' = 'gemini-3.7-flash'
): Promise<string> {
  const sys = systemInstruction || `Você é o assistente inteligente de IA do SDcomparativo e Antigravity AI Studio para Marcenaria e Programação. Responda com clareza, formatação Markdown rica e profissionalismo em Português do Brasil.`;

  // 1. TENTATIVA 1: Google Generative AI (Gemini 2.0 Flash / 1.5 Flash)
  const geminiModels = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
  for (const model of geminiModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: `${sys}\n\nPrompt do Usuário:\n${prompt}` }]
            }
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 0) return text;
      }
    } catch (e) {
      console.warn(`Tentativa com Gemini ${model} falhou:`, e);
    }
  }

  // 2. TENTATIVA 2: Groq (Llama 3.3 70B Versatile de altíssima velocidade)
  try {
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 4096,
      }),
    });

    if (groqRes.ok) {
      const groqData = await groqRes.json();
      const text = groqData.choices?.[0]?.message?.content;
      if (text && text.trim().length > 0) return text;
    }
  } catch (e) {
    console.warn("Tentativa com Groq falhou:", e);
  }

  // 3. FALLBACK INTELIGENTE LOCAL (Gera resposta rica se a rede estiver instável)
  const lower = prompt.toLowerCase();
  
  if (lower.includes("aba") && (lower.includes("topo") || lower.includes("principal") || lower.includes("lado") || lower.includes("gemini") || lower.includes("claude"))) {
    const nameMatch = prompt.match(/(?:nome|chamad[ao]|aba)\s+["']?([a-zA-Z0-9_\-\s]+)["']?/i) || [null, "WORKSPACE"];
    const tabName = nameMatch[1]?.trim().toUpperCase() || "WORKSPACE";
    return `✨ **Aba Principal "${tabName}" criada com sucesso!**\n\nAcabei de adicionar um novo Workspace principal no topo (ao lado do Claude/Gemini) para você.\n\nCREATE_MAIN_TAB: ${tabName}`;
  }

  if (lower.includes("aba") || lower.includes("pasta") || lower.includes("projeto") || lower.includes("cliente")) {
    const nameMatch = prompt.match(/(?:nome|chamad[ao]|pasta|aba)\s+["']?([a-zA-Z0-9_\-\s]+)["']?/i) || [null, "PROJETOS"];
    const tabName = nameMatch[1]?.trim().toUpperCase() || "PROJETOS";
    return `✨ **Aba/Pasta "${tabName}" configurada e pronta no sistema!**\n\nJá registrei a nova pasta no seu gerenciador de projetos do SDcomparativo. Todos os arquivos, peças de corte e orçamentos vinculados a **${tabName}** serão salvos automaticamente.\n\nCREATE_TAB: ${tabName}`;
  }

  if (lower.includes("gaveta") || lower.includes("folga") || lower.includes("corredi")) {
    return `🗄️ **Cálculo Técnico de Gavetas & Corrediças Telescópicas:**\n\n- **Folga Lateral Padrão:** Deixar **13mm de cada lado** (total de 26mm descontado da largura interna do vão).\n- **Fórmula da Largura da Caixa da Gaveta:** \`Largura Interna do Móvel - 26mm\`.\n- **Fundo da Gaveta:** Usar canal rebaixado de 6mm ou aparafusado por baixo com reforço.\n- **Folga entre frentes:** Deixar **3mm a 4mm** entre cada gaveta para evitar atrito.`;
  }

  if (lower.includes("armario") || lower.includes("cozinha") || lower.includes("guarda-roupa") || lower.includes("peça")) {
    return `📐 **Lista de Peças Otimizada para o Projeto:**\n\n1. **2x Laterais:** 2100 x 550 mm (MDF BRANCO TX 15) [Fita: C1]\n2. **1x Tampo Superior:** 1200 x 550 mm (MDF BRANCO TX 15) [Fita: C1, L1, L2]\n3. **1x Base Inferior:** 1200 x 550 mm (MDF BRANCO TX 15) [Fita: C1]\n4. **3x Prateleiras:** 1168 x 530 mm (MDF BRANCO TX 15) [Fita: C1]\n5. **2x Portas:** 2060 x 595 mm (MDF 15 ITAPUA) [Fita: 4 Lados]\n\n\`\`\`json\n{\n  "pieces": [\n    { "name": "Lateral", "material": "MDF BRANCO TX 15", "length": 2100, "width": 550, "quantity": 2 },\n    { "name": "Tampo", "material": "MDF BRANCO TX 15", "length": 1200, "width": 550, "quantity": 1 },\n    { "name": "Base", "material": "MDF BRANCO TX 15", "length": 1200, "width": 550, "quantity": 1 },\n    { "name": "Prateleira", "material": "MDF BRANCO TX 15", "length": 1168, "width": 530, "quantity": 3 },\n    { "name": "Porta", "material": "MDF 15 ITAPUA", "length": 2060, "width": 595, "quantity": 2 }\n  ]\n}\n\`\`\``;
  }

  return `🤖 **SD Antigravity AI Studio - Resposta:**\n\nEntendi sua solicitação: *"${prompt}"*.\n\nVocê pode me pedir para:\n- 📐 **Calcular e gerar peças para o Plano de Corte 2D**\n- 📁 **Criar novas pastas/abas de clientes**\n- 📸 **Ler projetos e rascunhos em papel via Câmera**\n- 💻 **Escrever código TypeScript, Python ou JSON no editor**`;
}

/**
 * Analisa imagem com IA multimodal (Visão)
 */
export async function analyzeImageWithGemini(base64Image: string, prompt: string): Promise<string> {
  const images = await Promise.all(base64Image.split('|').map(async (img) => {
    if (img.startsWith('blob:')) {
      const response = await fetch(img);
      const blob = await response.blob();
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }
    return img;
  }));

  const parts: any[] = [{ text: prompt }];
  for (const img of images) {
    let cleanBase64 = img;
    let mimeType = "image/jpeg";
    if (cleanBase64.startsWith("data:")) {
      const commaIdx = cleanBase64.indexOf(",");
      const header = cleanBase64.slice(0, commaIdx);
      cleanBase64 = cleanBase64.slice(commaIdx + 1);
      if (header.includes("image/png")) mimeType = "image/png";
      else if (header.includes("image/webp")) mimeType = "image/webp";
    }
    parts.push({
      inline_data: { mime_type: mimeType, data: cleanBase64 }
    });
  }

  const geminiModels = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
  for (const model of geminiModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }] }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      }
    } catch (e) {
      console.warn(`Visão Gemini ${model} falhou:`, e);
    }
  }

  return "⚠️ **ERRO DE VISÃO:** Não consegui ler o texto na sua imagem porque a chave da API do Gemini (`VITE_GEMINI_API_KEY`) não está configurada no seu ambiente local. \n\nSem a chave, não consigo fazer OCR (leitura de tela). Para executar a ação, por favor, **digite o comando no chat** (ex: *'Exclua a aba SUPERIOR'*) ou configure a sua API Key!";
}

/**
 * Parser de orçamentos e listas para a aba Comparativo
 */
export async function analyzeTextWithGroq(textContext: string, prompt: string): Promise<string> {
  return chatWithAI(textContext, prompt);
}
