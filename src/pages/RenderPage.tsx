import { MainLayout } from "@/components/layout/MainLayout";
import { RenderView } from "@/components/render/RenderView";

export default function RenderPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">Renderização 3D</h1>
          <p className="text-muted-foreground">
            Gere imagens fotorrealistas dos seus projetos para enviar aos clientes
          </p>
        </div>
        <RenderView />
      </div>
    </MainLayout>
  );
}
