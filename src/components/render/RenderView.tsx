import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Image,
  Sparkles,
  Download,
  Share2,
  Loader2,
  Camera,
  Sun,
  Palette,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import ARProfessionalXR from "@/components/ar/ARProfessionalXR";

interface RenderSettings {
  quality: "preview" | "standard" | "high";
  lighting: "daylight" | "evening" | "night";
  style: "realistic" | "artistic" | "minimal";
}

export function RenderView() {
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderedImage, setRenderedImage] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [settings, setSettings] = useState<RenderSettings>({
    quality: "standard",
    lighting: "daylight",
    style: "realistic",
  });
  const [aiPrompt, setAiPrompt] = useState("");
  const [roomType, setRoomType] = useState("cozinha");
  const [showAR, setShowAR] = useState(false);

  const qualityOptions = [
    { id: "preview", label: "Preview", time: "~30s" },
    { id: "standard", label: "Standard", time: "~1min" },
    { id: "high", label: "Alta Qualidade", time: "~2min" },
  ];

  const lightingOptions = [
    { id: "daylight", label: "Luz do Dia", icon: "☀️" },
    { id: "evening", label: "Entardecer", icon: "🌅" },
    { id: "night", label: "Noturno", icon: "🌙" },
  ];

  const styleOptions = [
    { id: "realistic", label: "Realista" },
    { id: "artistic", label: "Artístico" },
    { id: "minimal", label: "Minimalista" },
  ];

  const roomTypes = [
    { id: "cozinha", label: "Cozinha" },
    { id: "quarto", label: "Quarto" },
    { id: "escritorio", label: "Escritório" },
    { id: "sala", label: "Sala de Estar" },
    { id: "banheiro", label: "Banheiro" },
    { id: "closet", label: "Closet" },
  ];

  const handleRender = async () => {
    setIsRendering(true);
    setRenderProgress(0);
    setRenderError(null);

    // Simulate progress while waiting for API
    const progressInterval = setInterval(() => {
      setRenderProgress((prev) => Math.min(prev + 2, 90));
    }, 500);

    try {
      const { data, error } = await supabase.functions.invoke("generate-render", {
        body: {
          room: roomType,
          finish: aiPrompt || "madeira natural carvalho com acabamento premium",
          quality: settings.quality,
          lighting: settings.lighting,
          style: settings.style,
          modules: [
            { type: "armário superior", width: 800, height: 700, depth: 350, finish: "MDF branco" },
            { type: "armário inferior", width: 600, height: 850, depth: 560, finish: "MDF carvalho" },
          ],
        },
      });

      clearInterval(progressInterval);

      if (error) {
        console.error("Render error:", error);
        setRenderError(error.message || "Erro ao gerar renderização");
        toast({
          title: "Erro na renderização",
          description: error.message || "Não foi possível gerar a imagem",
          variant: "destructive",
        });
      } else if (data?.imageUrl) {
        setRenderProgress(100);
        setRenderedImage(data.imageUrl);
        toast({
          title: "Renderização concluída!",
          description: "Sua imagem foi gerada com sucesso",
        });
      } else if (data?.error) {
        setRenderError(data.error);
        toast({
          title: "Erro na renderização",
          description: data.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      clearInterval(progressInterval);
      console.error("Render exception:", err);
      setRenderError("Erro de conexão. Tente novamente.");
      toast({
        title: "Erro de conexão",
        description: "Não foi possível conectar ao servidor",
        variant: "destructive",
      });
    } finally {
      setIsRendering(false);
    }
  };

  const handleDownload = () => {
    if (renderedImage) {
      const link = document.createElement("a");
      link.href = renderedImage;
      link.download = `render-${roomType}-${Date.now()}.png`;
      link.click();
    }
  };

  if (showAR) {
    return (
      <ARProfessionalXR 
        onClose={() => setShowAR(false)} 
        onExportBudget={(data) => {
          toast({
            title: "✅ Orçamento WebXR Fechado!",
            description: `Móveis gerados. Total estimado: R$ ${data.estimatedTotal.toFixed(2)}`
          });
          setShowAR(false);
        }}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Render Settings */}
      <Card className="p-6 col-span-1">
        <h3 className="font-semibold flex items-center gap-2 mb-6">
          <Camera className="w-5 h-5 text-primary" />
          Configurações de Renderização
        </h3>

        <div className="space-y-6">
          {/* Room Type */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Tipo de Ambiente</Label>
            <div className="grid grid-cols-3 gap-2">
              {roomTypes.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setRoomType(room.id)}
                  className={cn(
                    "p-2 rounded-lg border-2 text-center transition-all text-sm",
                    roomType === room.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {room.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quality */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Qualidade</Label>
            <div className="grid grid-cols-3 gap-2">
              {qualityOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() =>
                    setSettings((s) => ({
                      ...s,
                      quality: opt.id as RenderSettings["quality"],
                    }))
                  }
                  className={cn(
                    "p-3 rounded-lg border-2 text-center transition-all",
                    settings.quality === opt.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <span className="block text-sm font-medium">{opt.label}</span>
                  <span className="text-xs text-muted-foreground">{opt.time}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Lighting */}
          <div>
            <Label className="text-sm font-medium mb-3 flex items-center gap-2">
              <Sun className="w-4 h-4" />
              Iluminação
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {lightingOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() =>
                    setSettings((s) => ({
                      ...s,
                      lighting: opt.id as RenderSettings["lighting"],
                    }))
                  }
                  className={cn(
                    "p-3 rounded-lg border-2 text-center transition-all",
                    settings.lighting === opt.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <span className="text-xl block mb-1">{opt.icon}</span>
                  <span className="text-xs">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div>
            <Label className="text-sm font-medium mb-3 flex items-center gap-2">
              <Palette className="w-4 h-4" />
              Estilo Visual
            </Label>
            <div className="flex flex-wrap gap-2">
              {styleOptions.map((opt) => (
                <Button
                  key={opt.id}
                  size="sm"
                  variant={settings.style === opt.id ? "default" : "outline"}
                  onClick={() =>
                    setSettings((s) => ({
                      ...s,
                      style: opt.id as RenderSettings["style"],
                    }))
                  }
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* AI Enhancement */}
          <div>
            <Label className="text-sm font-medium mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Descrição do Projeto
            </Label>
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Descreva o projeto: 'cozinha em L com ilha central, armários brancos e bancada de granito preto'..."
              rows={3}
            />
          </div>

          {/* Render Button */}
          <Button
            variant="gradient"
            size="lg"
            className="w-full"
            onClick={handleRender}
            disabled={isRendering}
          >
            {isRendering ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Gerar com IA
              </>
            )}
          </Button>

          {/* AR Studio PRO XR Button */}
          <Button
            variant="outline"
            size="lg"
            className="w-full mt-2 font-black border-amber-500 text-amber-500 hover:bg-amber-500/10"
            onClick={() => setShowAR(true)}
          >
            <Sparkles className="w-5 h-5 mr-2" />
            ABRIR STUDIO AR ELITE (WebXR)
          </Button>

          {isRendering && (
            <div className="space-y-2">
              <Progress value={renderProgress} />
              <p className="text-xs text-muted-foreground text-center">
                {renderProgress < 30 && "Preparando ambiente..."}
                {renderProgress >= 30 && renderProgress < 60 && "Gerando móveis..."}
                {renderProgress >= 60 && renderProgress < 90 && "Aplicando iluminação..."}
                {renderProgress >= 90 && "Finalizando..."}
              </p>
            </div>
          )}

          {renderError && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
              <AlertCircle className="w-4 h-4" />
              {renderError}
            </div>
          )}
        </div>
      </Card>

      {/* Preview Area */}
      <Card className="p-6 col-span-1 lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Image className="w-5 h-5" />
            Visualização
          </h3>
          {renderedImage && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button size="sm" variant="outline">
                <Share2 className="w-4 h-4 mr-2" />
                Compartilhar
              </Button>
            </div>
          )}
        </div>

        <div className="aspect-video rounded-lg bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden">
          {renderedImage ? (
            <div className="relative w-full h-full">
              <img
                src={renderedImage}
                alt="Render 3D"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-4 right-4 bg-card/90 backdrop-blur-sm rounded-lg px-3 py-2 text-xs">
                <span className="text-muted-foreground">Qualidade: </span>
                <span className="font-medium capitalize">{settings.quality}</span>
              </div>
            </div>
          ) : (
            <div className="text-center p-8">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Image className="w-10 h-10 text-primary" />
              </div>
              <h4 className="font-medium mb-2">Nenhuma renderização</h4>
              <p className="text-sm text-muted-foreground max-w-sm">
                Configure as opções ao lado e clique em "Gerar com IA" para criar
                uma visualização fotorrealista do projeto.
              </p>
            </div>
          )}
        </div>

        {/* Previous renders */}
        <div className="mt-6">
          <h4 className="text-sm font-medium mb-3">Renderizações anteriores</h4>
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="aspect-video rounded-lg bg-muted border border-border hover:border-primary cursor-pointer transition-all"
              />
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
