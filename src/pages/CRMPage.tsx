import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { WhatsAppCRM } from "@/components/crm/WhatsAppCRM";
import { ChatFlowPanel } from "@/components/crm/ChatFlowPanel";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, Users, TrendingUp, Clock, GitBranch } from "lucide-react";

const stats = [
  { icon: MessageSquare, label: "Conversas Ativas", value: "23" },
  { icon: Users, label: "Leads Este Mês", value: "45" },
  { icon: TrendingUp, label: "Taxa de Resposta", value: "92%" },
  { icon: Clock, label: "Tempo Médio", value: "8min" },
];

export default function CRMPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold">CRM WhatsApp</h1>
          <p className="text-muted-foreground">
            Gerencie seus atendimentos com assistência de IA
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Tabs: CRM + Flow */}
        <Tabs defaultValue="crm" className="w-full">
          <TabsList>
            <TabsTrigger value="crm" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Conversas
            </TabsTrigger>
            <TabsTrigger value="flow" className="gap-2">
              <GitBranch className="w-4 h-4" />
              Fluxo de Atendimento
            </TabsTrigger>
          </TabsList>
          <TabsContent value="crm">
            <WhatsAppCRM />
          </TabsContent>
          <TabsContent value="flow">
            <ChatFlowPanel />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
