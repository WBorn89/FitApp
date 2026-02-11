import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, RefreshCw, Trash2, Settings } from 'lucide-react';
import { toast } from 'sonner';

export default function IntegrationDashboard() {
  const { user } = useAuth();
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);

  // Queries
  const { data: integrations, isLoading: integrationsLoading, refetch: refetchIntegrations } = 
    trpc.health.getIntegrations.useQuery();
  
  const { data: syncHistory } = 
    trpc.health.getSyncHistory.useQuery(
      { integrationId: selectedIntegration || '', limit: 5 },
      { enabled: !!selectedIntegration }
    );

  const { data: metricsSummary } = 
    trpc.health.getMetricsSummary.useQuery();

  // Mutations
  const triggerSyncMutation = trpc.health.triggerSync.useMutation({
    onSuccess: () => {
      toast.success('Sincronização iniciada com sucesso');
      refetchIntegrations();
    },
    onError: (error) => {
      toast.error(`Erro ao sincronizar: ${error.message}`);
    },
  });

  const updateFrequencyMutation = trpc.health.updateSyncFrequency.useMutation({
    onSuccess: () => {
      toast.success('Frequência de sincronização atualizada');
      refetchIntegrations();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const toggleSyncMutation = trpc.health.toggleSync.useMutation({
    onSuccess: () => {
      toast.success('Sincronização atualizada');
      refetchIntegrations();
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const deleteIntegrationMutation = trpc.health.deleteIntegration.useMutation({
    onSuccess: () => {
      toast.success('Integração removida com sucesso');
      setSelectedIntegration(null);
      refetchIntegrations();
    },
    onError: (error) => {
      toast.error(`Erro ao remover: ${error.message}`);
    },
  });

  if (!user) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard de Saúde</h1>
          <p className="text-muted-foreground">
            Gerencie suas integrações de dispositivos de saúde e visualize suas métricas
          </p>
        </div>

        {/* Metrics Summary */}
        {metricsSummary && Object.keys(metricsSummary).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {Object.entries(metricsSummary).map(([category, data]: any) => (
              <Card key={category}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">{category}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.count}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.types.length} tipo(s) de métrica
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Integrations List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Integrações Ativas</CardTitle>
                <CardDescription>
                  {integrations?.length || 0} dispositivo(s) conectado(s)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {integrationsLoading ? (
                  <div className="text-center py-8">Carregando...</div>
                ) : integrations && integrations.length > 0 ? (
                  <div className="space-y-4">
                    {integrations.map((integration) => (
                      <div
                        key={integration.id}
                        onClick={() => setSelectedIntegration(integration.id)}
                        className={`p-4 border rounded-lg cursor-pointer transition ${
                          selectedIntegration === integration.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold">{integration.provider}</h3>
                              <Badge variant={integration.isActive ? 'default' : 'secondary'}>
                                {integration.isActive ? 'Ativo' : 'Inativo'}
                              </Badge>
                              <Badge variant="outline">
                                {integration.syncFrequency}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              Conectado em {integration.connectedAt ? new Date(integration.connectedAt as any).toLocaleDateString() : 'N/A'}
                            </p>
                            {integration.lastSuccessSyncAt && (
                              <p className="text-xs text-muted-foreground">
                                Última sincronização: {new Date(integration.lastSuccessSyncAt as any).toLocaleString()}
                              </p>
                            )}
                            {integration.syncError && (
                              <div className="flex items-center gap-1 mt-2 text-red-600 text-sm">
                                <AlertCircle className="w-4 h-4" />
                                {integration.syncError}
                              </div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerSyncMutation.mutate({ integrationId: integration.id });
                            }}
                            disabled={triggerSyncMutation.isPending}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">Nenhuma integração conectada</p>
                    <Button>Conectar Dispositivo</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Details Panel */}
          <div>
            {selectedIntegration && integrations ? (
              (() => {
                const integration = integrations.find(i => i.id === selectedIntegration);
                if (!integration) return null;

                return (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Configurações</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Sync Frequency */}
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Frequência de Sincronização
                        </label>
                        <select
                          value={integration.syncFrequency || 'DAILY'}
                          onChange={(e) => {
                            updateFrequencyMutation.mutate({
                              integrationId: integration.id,
                              frequency: e.target.value as any,
                            });
                          }}
                          className="w-full px-3 py-2 border border-border rounded-md text-sm"
                        >
                          <option value="HOURLY">A cada hora</option>
                          <option value="DAILY">Diariamente</option>
                          <option value="WEEKLY">Semanalmente</option>
                          <option value="MANUAL">Manual</option>
                        </select>
                      </div>

                      {/* Sync Toggle */}
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Status de Sincronização
                        </label>
                        <Button
                          variant={integration.syncEnabled ? 'default' : 'secondary'}
                          className="w-full"
                          onClick={() => {
                            toggleSyncMutation.mutate({
                              integrationId: integration.id,
                              enabled: !integration.syncEnabled,
                            });
                          }}
                        >
                          {integration.syncEnabled ? 'Desativar' : 'Ativar'}
                        </Button>
                      </div>

                      {/* Delete */}
                      <Button
                        variant="destructive"
                        className="w-full"
                        onClick={() => {
                          if (confirm('Tem certeza que deseja remover esta integração?')) {
                            deleteIntegrationMutation.mutate({
                              integrationId: integration.id,
                            });
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remover
                      </Button>

                      {/* Sync History */}
                      {syncHistory && syncHistory.length > 0 && (
                        <div className="mt-6 pt-6 border-t">
                          <h4 className="font-semibold text-sm mb-3">Histórico de Sincronização</h4>
                          <div className="space-y-2">
                            {syncHistory.map((log) => (
                              <div key={log.id} className="text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-medium">
                                    {log.status === 'SUCCESS' ? '✓' : '✗'} {log.status}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {log.durationMs}ms
                                  </span>
                                </div>
                                <p className="text-muted-foreground">
                                  {log.startedAt ? new Date(log.startedAt as any).toLocaleString() : 'N/A'}
                                </p>                             </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })()
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground text-center">
                    Selecione uma integração para ver os detalhes
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
