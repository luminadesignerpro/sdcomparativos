import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProjectCard, Project } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Grid3X3, List } from "lucide-react";
import { Link } from "react-router-dom";
import kitchenRender from "@/assets/kitchen-render.jpg";
import bedroomRender from "@/assets/bedroom-render.jpg";
import officeRender from "@/assets/office-render.jpg";

const allProjects: Project[] = [
  {
    id: "1",
    name: "Cozinha Completa",
    client: "Maria Silva",
    status: "in_progress",
    value: 18500,
    createdAt: new Date(Date.now() - 86400000 * 2),
    thumbnail: kitchenRender,
  },
  {
    id: "2",
    name: "Quarto Casal",
    client: "João Santos",
    status: "review",
    value: 12800,
    createdAt: new Date(Date.now() - 86400000 * 5),
    thumbnail: bedroomRender,
  },
  {
    id: "3",
    name: "Home Office",
    client: "Ana Costa",
    status: "completed",
    value: 8500,
    createdAt: new Date(Date.now() - 86400000 * 10),
    thumbnail: officeRender,
  },
  {
    id: "4",
    name: "Closet Planejado",
    client: "Pedro Oliveira",
    status: "draft",
    value: 15200,
    createdAt: new Date(Date.now() - 86400000),
    thumbnail: bedroomRender,
  },
  {
    id: "5",
    name: "Área Gourmet",
    client: "Carla Mendes",
    status: "in_progress",
    value: 22000,
    createdAt: new Date(Date.now() - 86400000 * 3),
    thumbnail: kitchenRender,
  },
  {
    id: "6",
    name: "Escritório Executivo",
    client: "Roberto Lima",
    status: "completed",
    value: 9800,
    createdAt: new Date(Date.now() - 86400000 * 15),
    thumbnail: officeRender,
  },
];

export default function Projects() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filteredProjects = allProjects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.client.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Projetos</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie todos os seus projetos de móveis planejados
            </p>
          </div>
          <Link to="/editor">
            <Button variant="gradient" size="lg">
              <Plus className="w-5 h-5 mr-2" />
              Novo Projeto
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar projetos ou clientes..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="in_progress">Em Produção</SelectItem>
              <SelectItem value="review">Em Revisão</SelectItem>
              <SelectItem value="completed">Concluído</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList>
            <TabsTrigger value="all">
              Todos ({allProjects.length})
            </TabsTrigger>
            <TabsTrigger value="in_progress">
              Em Produção ({allProjects.filter((p) => p.status === "in_progress").length})
            </TabsTrigger>
            <TabsTrigger value="review">
              Em Revisão ({allProjects.filter((p) => p.status === "review").length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Concluídos ({allProjects.filter((p) => p.status === "completed").length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <div
              className={
                viewMode === "grid"
                  ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                  : "space-y-4"
              }
            >
              {filteredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum projeto encontrado</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
