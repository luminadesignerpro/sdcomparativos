import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Building2,
  Bell,
  Palette,
  Shield,
  MessageSquare,
  Save,
} from "lucide-react";

export default function Settings() {
  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-display font-bold">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as configurações do sistema
          </p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="profile" className="gap-2">
              <User className="w-4 h-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="company" className="gap-2">
              <Building2 className="w-4 h-4" />
              Empresa
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="w-4 h-4" />
              Notificações
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Integrações
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="w-4 h-4" />
              Segurança
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Informações Pessoais</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome</Label>
                  <Input defaultValue="Administrador" className="mt-1" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    defaultValue="admin@sdmoveis.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input defaultValue="(11) 99999-9999" className="mt-1" />
                </div>
                <div>
                  <Label>Cargo</Label>
                  <Input defaultValue="Gerente" className="mt-1" />
                </div>
              </div>
              <Button className="mt-6" variant="gradient">
                <Save className="w-4 h-4 mr-2" />
                Salvar Alterações
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="company" className="mt-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Dados da Empresa</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome da Empresa</Label>
                  <Input defaultValue="SD Móveis Projetados" className="mt-1" />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input defaultValue="00.000.000/0001-00" className="mt-1" />
                </div>
                <div className="col-span-2">
                  <Label>Endereço</Label>
                  <Input
                    defaultValue="Rua Exemplo, 123 - São Paulo, SP"
                    className="mt-1"
                  />
                </div>
              </div>
              <Button className="mt-6" variant="gradient">
                <Save className="w-4 h-4 mr-2" />
                Salvar Alterações
              </Button>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            <Card className="p-6 space-y-6">
              <h3 className="font-semibold">Preferências de Notificação</h3>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Novos leads</p>
                  <p className="text-sm text-muted-foreground">
                    Receber notificação quando um novo lead entrar em contato
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Mensagens WhatsApp</p>
                  <p className="text-sm text-muted-foreground">
                    Notificar sobre novas mensagens no CRM
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Projetos concluídos</p>
                  <p className="text-sm text-muted-foreground">
                    Alerta quando um projeto é finalizado
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="mt-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Integrações</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
                      <MessageSquare className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <p className="font-medium">WhatsApp Business</p>
                      <p className="text-sm text-muted-foreground">
                        Conecte sua conta para o CRM
                      </p>
                    </div>
                  </div>
                  <Button variant="outline">Configurar</Button>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Palette className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Inteligência Artificial</p>
                      <p className="text-sm text-muted-foreground">
                        IA para assistência em projetos
                      </p>
                    </div>
                  </div>
                  <Button variant="secondary">Conectado</Button>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="mt-6">
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Segurança</h3>
              <div className="space-y-4">
                <div>
                  <Label>Senha Atual</Label>
                  <Input type="password" className="mt-1" />
                </div>
                <div>
                  <Label>Nova Senha</Label>
                  <Input type="password" className="mt-1" />
                </div>
                <div>
                  <Label>Confirmar Nova Senha</Label>
                  <Input type="password" className="mt-1" />
                </div>
              </div>
              <Button className="mt-6" variant="gradient">
                Alterar Senha
              </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
