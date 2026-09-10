import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  MoreVertical,
  MessageSquare,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { Link } from "react-router-dom";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  totalProjects: number;
  totalValue: number;
  status: "active" | "lead" | "inactive";
}

const clients: Client[] = [
  {
    id: "1",
    name: "Maria Silva",
    email: "maria@email.com",
    phone: "(11) 99999-1234",
    address: "São Paulo, SP",
    totalProjects: 3,
    totalValue: 45000,
    status: "active",
  },
  {
    id: "2",
    name: "João Santos",
    email: "joao@email.com",
    phone: "(11) 98888-5678",
    address: "Guarulhos, SP",
    totalProjects: 2,
    totalValue: 28500,
    status: "active",
  },
  {
    id: "3",
    name: "Ana Costa",
    email: "ana@email.com",
    phone: "(11) 97777-9012",
    address: "Osasco, SP",
    totalProjects: 0,
    totalValue: 0,
    status: "lead",
  },
  {
    id: "4",
    name: "Pedro Oliveira",
    email: "pedro@email.com",
    phone: "(11) 96666-3456",
    address: "Santo André, SP",
    totalProjects: 5,
    totalValue: 72000,
    status: "active",
  },
];

const statusConfig = {
  active: { label: "Ativo", className: "bg-success/20 text-success border-success/30" },
  lead: { label: "Lead", className: "bg-warning/20 text-warning border-warning/30" },
  inactive: { label: "Inativo", className: "bg-muted text-muted-foreground" },
};

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Clientes</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie sua base de clientes
            </p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="gradient" size="lg">
                <Plus className="w-5 h-5 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Cliente</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Nome completo</Label>
                  <Input placeholder="Nome do cliente" className="mt-1" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" placeholder="email@exemplo.com" className="mt-1" />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input placeholder="(11) 99999-9999" className="mt-1" />
                </div>
                <div>
                  <Label>Endereço</Label>
                  <Input placeholder="Cidade, Estado" className="mt-1" />
                </div>
                <Button variant="gradient" className="w-full">
                  Salvar Cliente
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar clientes..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Clients grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map((client) => (
            <Card key={client.id} className="p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {client.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold">{client.name}</h3>
                    <Badge
                      variant="outline"
                      className={statusConfig[client.status].className}
                    >
                      {statusConfig[client.status].label}
                    </Badge>
                  </div>
                </div>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  {client.email}
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4" />
                  {client.phone}
                </p>
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  {client.address}
                </p>
              </div>

              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total em projetos</p>
                  <p className="font-semibold">{formatCurrency(client.totalValue)}</p>
                </div>
                <div className="flex gap-2">
                  <Link to="/crm">
                    <Button size="sm" variant="outline">
                      <MessageSquare className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button size="sm" variant="default">
                    Ver Projetos
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
