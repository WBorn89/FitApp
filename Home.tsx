import { useAuth } from '@/_core/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, BarChart3, Lock, Zap } from 'lucide-react';
import { getLoginUrl } from '@/const';
import { useLocation } from 'wouter';

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  if (isAuthenticated && user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        {/* Header */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-6xl mx-auto px-4 py-6 flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Fitness Health Tracker</h1>
              <p className="text-slate-600 dark:text-slate-400">Bem-vindo, {user.name || user.email}</p>
            </div>
            <Button onClick={() => navigate('/dashboard')}>Ir para Dashboard</Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Integracoes Ativas
                </CardTitle>
                <CardDescription>Seus dispositivos conectados</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">0</p>
                <p className="text-sm text-muted-foreground mt-2">Nenhum dispositivo conectado ainda</p>
                <Button className="mt-4 w-full" onClick={() => navigate('/dashboard')}>
                  Conectar Dispositivo
                </Button>
              </CardContent>
            </Card>

            {/* Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  Recursos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Criptografia AES-256-GCM</p>
                    <p className="text-sm text-muted-foreground">Seus dados estao protegidos</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <BarChart3 className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Sincronizacao Automatica</p>
                    <p className="text-sm text-muted-foreground">Dados atualizados em tempo real</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Supported Providers */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Provedores Suportados</CardTitle>
              <CardDescription>Conecte seus dispositivos de saude favoritos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {['Garmin', 'Samsung Health', 'Apple Health', 'Google Fit'].map((provider) => (
                  <div key={provider} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg text-center">
                    <p className="font-medium text-sm">{provider}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Fitness Health Tracker</CardTitle>
            <CardDescription>Sincronize seus dados de saude com seguranca</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Conecte seus dispositivos de saude (Garmin, Samsung, Apple Health, Google Fit) e monitore suas metricas em um unico lugar.
            </p>
            <Button className="w-full" onClick={() => (window.location.href = getLoginUrl())}>
              Fazer Login
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
