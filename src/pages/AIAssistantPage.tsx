import { MainLayout } from "@/components/layout/MainLayout";
import { AIAssistant } from "@/components/ai/AIAssistant";
import { Card } from "@/components/ui/card";
import { Sparkles, Lightbulb, MessageSquare, Calculator } from "lucide-react";

const features = [
  {
    icon: Lightbulb,
    title: "Sugestões de Design",
    description: "Receba recomendações personalizadas de layout e cores",
  },
  {
    icon: Calculator,
    title: "Orçamentos Automáticos",
    description: "Calcule valores estimados baseados nos materiais",
  },
  {
    icon: MessageSquare,
    title: "Respostas para Clientes",
    description: "Gere textos profissionais para comunicação",
  },
];

export default function AIAssistantPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            Assistente IA
          </h1>
          <p className="text-muted-foreground mt-2">
            Seu assistente inteligente para design de móveis e atendimento
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {features.map((feature, index) => (
            <Card key={index} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Chat */}
        <div className="max-w-4xl">
          <AIAssistant />
        </div>
      </div>
    </MainLayout>
  );
}
