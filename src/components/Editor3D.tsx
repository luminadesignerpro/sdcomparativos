import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Box,
  Move,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Grid3X3,
  Layers,
  MousePointer,
  Plus,
  Save,
  Undo,
  Redo,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FurnitureItem {
  id: string;
  name: string;
  category: string;
  icon: string;
}

const furnitureCatalog: FurnitureItem[] = [
  { id: "1", name: "Armário Superior", category: "Cozinha", icon: "🗄️" },
  { id: "2", name: "Armário Inferior", category: "Cozinha", icon: "📦" },
  { id: "3", name: "Balcão", category: "Cozinha", icon: "🪑" },
  { id: "4", name: "Guarda-Roupa", category: "Quarto", icon: "🚪" },
  { id: "5", name: "Cômoda", category: "Quarto", icon: "🗃️" },
  { id: "6", name: "Criado-Mudo", category: "Quarto", icon: "🛏️" },
  { id: "7", name: "Estante", category: "Sala", icon: "📚" },
  { id: "8", name: "Rack TV", category: "Sala", icon: "📺" },
  { id: "9", name: "Mesa Escritório", category: "Escritório", icon: "🖥️" },
  { id: "10", name: "Gaveteiro", category: "Escritório", icon: "📋" },
];

const tools = [
  { id: "select", icon: MousePointer, label: "Selecionar" },
  { id: "move", icon: Move, label: "Mover" },
  { id: "rotate", icon: RotateCcw, label: "Rotacionar" },
  { id: "add", icon: Plus, label: "Adicionar" },
];

export function Editor3D() {
  const [selectedTool, setSelectedTool] = useState("select");
  const [zoom, setZoom] = useState(100);
  const [selectedCategory, setSelectedCategory] = useState("Cozinha");
  const [roomWidth, setRoomWidth] = useState("4.00");
  const [roomLength, setRoomLength] = useState("3.00");
  const [roomHeight, setRoomHeight] = useState("2.80");

  const categories = [...new Set(furnitureCatalog.map((f) => f.category))];

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Left Panel - Catalog */}
      <div className="w-72 bg-card rounded-xl border border-border flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Catálogo de Móveis
          </h3>
        </div>

        {/* Categories */}
        <div className="p-3 border-b border-border flex flex-wrap gap-2">
          {categories.map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={selectedCategory === cat ? "default" : "outline"}
              onClick={() => setSelectedCategory(cat)}
              className="text-xs"
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* Items */}
        <ScrollArea className="flex-1 p-3">
          <div className="grid grid-cols-2 gap-2">
            {furnitureCatalog
              .filter((f) => f.category === selectedCategory)
              .map((item) => (
                <button
                  key={item.id}
                  className="p-3 bg-muted hover:bg-muted/80 rounded-lg text-center transition-all hover:scale-105 border-2 border-transparent hover:border-primary"
                >
                  <span className="text-2xl block mb-1">{item.icon}</span>
                  <span className="text-xs">{item.name}</span>
                </button>
              ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 bg-card rounded-xl border border-border flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            {tools.map((tool) => (
              <Button
                key={tool.id}
                size="sm"
                variant={selectedTool === tool.id ? "default" : "ghost"}
                onClick={() => setSelectedTool(tool.id)}
                title={tool.label}
              >
                <tool.icon className="w-4 h-4" />
              </Button>
            ))}
            <div className="w-px h-6 bg-border mx-2" />
            <Button size="sm" variant="ghost">
              <Undo className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost">
              <Redo className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setZoom((z) => Math.max(50, z - 10))}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm w-12 text-center">{zoom}%</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setZoom((z) => Math.min(200, z + 10))}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <div className="w-px h-6 bg-border mx-2" />
            <Button size="sm" variant="ghost">
              <Grid3X3 className="w-4 h-4" />
            </Button>
          </div>

          <Button size="sm">
            <Save className="w-4 h-4 mr-2" />
            Salvar Projeto
          </Button>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 relative bg-muted/30 overflow-hidden">
          {/* Grid background */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
                linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
              `,
              backgroundSize: `${zoom / 2}px ${zoom / 2}px`,
            }}
          />

          {/* Room outline */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div
              className="border-2 border-primary border-dashed relative bg-background/50"
              style={{
                width: `${parseFloat(roomWidth) * 100}px`,
                height: `${parseFloat(roomLength) * 100}px`,
                transform: `scale(${zoom / 100})`,
              }}
            >
              {/* Sample furniture */}
              <div className="absolute top-4 left-4 w-20 h-8 bg-secondary rounded shadow-md flex items-center justify-center text-xs text-white font-medium">
                Armário
              </div>
              <div className="absolute top-4 right-4 w-20 h-8 bg-secondary rounded shadow-md flex items-center justify-center text-xs text-white font-medium">
                Armário
              </div>
              <div className="absolute bottom-4 left-4 w-24 h-12 bg-secondary/80 rounded shadow-md flex items-center justify-center text-xs text-white font-medium">
                Balcão
              </div>

              {/* Dimensions */}
              <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
                {roomWidth}m
              </div>
              <div className="absolute top-1/2 -right-8 -translate-y-1/2 rotate-90 text-xs text-muted-foreground">
                {roomLength}m
              </div>
            </div>
          </div>

          {/* Empty state overlay */}
          <div className="absolute bottom-4 right-4 bg-card/80 backdrop-blur-sm rounded-lg p-4 border border-border max-w-xs">
            <p className="text-sm font-medium flex items-center gap-2">
              <Box className="w-4 h-4 text-primary" />
              Dica
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Arraste móveis do catálogo para a planta. Use as ferramentas para
              posicionar e rotacionar.
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Properties */}
      <div className="w-72 bg-card rounded-xl border border-border flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2">
            <Box className="w-4 h-4" />
            Propriedades
          </h3>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {/* Room dimensions */}
            <div>
              <h4 className="text-sm font-medium mb-3">Dimensões do Ambiente</h4>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Largura (m)</Label>
                  <Input
                    value={roomWidth}
                    onChange={(e) => setRoomWidth(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Comprimento (m)</Label>
                  <Input
                    value={roomLength}
                    onChange={(e) => setRoomLength(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Altura (m)</Label>
                  <Input
                    value={roomHeight}
                    onChange={(e) => setRoomHeight(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Project info */}
            <div>
              <h4 className="text-sm font-medium mb-3">Informações do Projeto</h4>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Nome do Projeto</Label>
                  <Input placeholder="Ex: Cozinha - Maria Silva" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Cliente</Label>
                  <Input placeholder="Nome do cliente" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Observações</Label>
                  <Textarea
                    placeholder="Anotações sobre o projeto..."
                    className="mt-1"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div>
              <h4 className="text-sm font-medium mb-3">Ações Rápidas</h4>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Box className="w-4 h-4 mr-2" />
                  Visualizar em 3D
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  📄 Gerar Orçamento
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  📤 Exportar PDF
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
