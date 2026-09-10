import { formatDate, formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, MoreHorizontal } from "lucide-react";
import kitchenRender from "@/assets/kitchen-render.jpg";

export interface Project {
  id: string;
  name: string;
  client: string;
  status: "draft" | "in_progress" | "review" | "completed";
  value: number;
  createdAt: Date;
  thumbnail?: string;
}

interface ProjectCardProps {
  project: Project;
}

const statusConfig = {
  draft: { label: "Rascunho", variant: "secondary" as const },
  in_progress: { label: "Em Produção", variant: "default" as const },
  review: { label: "Em Revisão", variant: "outline" as const },
  completed: { label: "Concluído", variant: "default" as const },
};

export function ProjectCard({ project }: ProjectCardProps) {
  const status = statusConfig[project.status];

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-lg transition-all duration-300 group">
      {/* Thumbnail */}
      <div className="aspect-video bg-muted relative overflow-hidden">
        <img
          src={project.thumbnail || kitchenRender}
          alt={project.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        {/* Overlay actions */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
          <Button size="sm" variant="secondary" className="shadow-lg">
            <Eye className="w-4 h-4 mr-1" />
            Ver
          </Button>
          <Button size="sm" variant="secondary" className="shadow-lg">
            <Edit className="w-4 h-4 mr-1" />
            Editar
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-card-foreground">{project.name}</h3>
            <p className="text-sm text-muted-foreground">{project.client}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between mt-4">
          <Badge
            variant={status.variant}
            className={
              project.status === "completed"
                ? "bg-success text-success-foreground"
                : project.status === "in_progress"
                ? "bg-primary text-primary-foreground"
                : ""
            }
          >
            {status.label}
          </Badge>
          <span className="text-sm font-medium text-muted-foreground">
            {formatCurrency(project.value)}
          </span>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Criado em {formatDate(project.createdAt)}
        </p>
      </div>
    </div>
  );
}
