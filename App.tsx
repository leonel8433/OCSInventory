
import React, { useState, useEffect, useMemo } from 'react';
import { FleetProvider, useFleet } from './context/FleetContext';
import Layout from './components/Layout';
import DashboardOverview from './components/DashboardOverview';
import FleetManager from './pages/FleetManager';
import DriverManagement from './pages/DriverManagement';
import OperationWizard from './pages/OperationWizard';
import TripMonitoring from './pages/TripMonitoring';
import SchedulingPage from './pages/SchedulingPage';
import ReportsPage from './pages/ReportsPage';
import HistoryPage from './pages/HistoryPage';
import ProfilePage from './pages/ProfilePage';
import Login from './pages/Login';
import ForceChangePassword from './pages/ForceChangePassword';

const AppContent: React.FC = () => {
  const { currentUser, isLoading, notifications, markNotificationAsRead } = useFleet();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [showFineAlert, setShowFineAlert] = useState(false);

  const isAdmin = currentUser?.username === 'admin';

  // Filtragem de multas não lidas para o motorista logado
  const unreadFineNotifications = useMemo(() => {
    if (!currentUser || isAdmin) return [];
    return notifications.filter(n => n.driverId === currentUser.id && n.type === 'new_fine' && !n.isRead);
  }, [notifications, currentUser, isAdmin]);

  useEffect(() => {
    const handleStartSchedule = (e: any) => {
      setSelectedScheduleId(e.detail);
      setActiveTab('operation');
    };
    window.addEventListener('start-schedule', handleStartSchedule);
    return () => window.removeEventListener('start-schedule', handleStartSchedule);
  }, []);

  // Dispara o alerta de multas se houver notificações não lidas ao logar
  useEffect(() => {
    if (unreadFineNotifications.length > 0 && !showFineAlert) {
      setShowFineAlert(true);
    }
  }, [unreadFineNotifications, showFineAlert]);

  if (!currentUser) return <Login />;
  if (currentUser && !currentUser.passwordChanged) return <ForceChangePassword />;

  const handleStartFromSchedule = (scheduleId: string) => {
    setSelectedScheduleId(scheduleId);
    setActiveTab('operation');
  };

  const handleAcknowledgeFines = async () => {
    for (const n of unreadFineNotifications) {
      await markNotificationAsRead(n.id);
    }
    setShowFineAlert(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardOverview onStartSchedule={handleStartFromSchedule} onNavigate={setActiveTab} />;
      case 'fleet': return isAdmin ? <FleetManager /> : <DashboardOverview onStartSchedule={handleStartFromSchedule} onNavigate={setActiveTab} />;
      case 'drivers': return isAdmin ? <DriverManagement /> : <DashboardOverview onStartSchedule={handleStartFromSchedule} onNavigate={setActiveTab} />;
      case 'operation': return <OperationWizard scheduledTripId={selectedScheduleId || undefined} onComplete={() => { setSelectedScheduleId(null); setActiveTab('dashboard'); }} />;
      case 'history': return <HistoryPage />;
      case 'monitoring': return isAdmin ? <TripMonitoring /> : <DashboardOverview onStartSchedule={handleStartFromSchedule} onNavigate={setActiveTab} />;
      case 'scheduling': return <SchedulingPage />;
      case 'reports': return <ReportsPage />;
      case 'profile': return <ProfilePage />;
      default: return <DashboardOverview onStartSchedule={handleStartFromSchedule} onNavigate={setActiveTab} />;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={(tab) => {
      setActiveTab(tab);
      if (tab !== 'operation') setSelectedScheduleId(null);
    }}>
      {/* Overlay de Sincronização */}
      {isLoading && (
        <div className="fixed top-4 right-4 z-[999] bg-white/90 backdrop-blur-md px-6 py-3 rounded-2xl shadow-2xl border border-slate-100 flex items-center gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
           <div className="w-5 h-5 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
           <span className="text-[10px] font-write text-slate-600 uppercase tracking-widest">Sincronizando...</span>
        </div>
      )}

      {/* Alerta de Novas Multas Pós-Login */}
      {showFineAlert && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 bg-red-600 text-white flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">
                <i className="fas fa-gavel"></i>
              </div>
              <div>
                <h3 className="text-xl font-write uppercase tracking-tight">Novas Infrações Registradas</h3>
                <p className="text-[10px] font-bold text-red-100 uppercase tracking-widest">Atenção Condutor: Revisão Obrigatória</p>
              </div>
            </div>
            
            <div className="p-10 space-y-6 max-h-[400px] overflow-y-auto custom-scrollbar">
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Olá {currentUser.name}, identificamos novas multas atribuídas ao seu prontuário durante sua última ausência do sistema. Por favor, revise os detalhes abaixo:
              </p>
              
              <div className="space-y-4">
                {unreadFineNotifications.map(n => (
                  <div key={n.id} className="bg-red-50 p-6 rounded-3xl border border-red-100">
                    <p className="text-[11px] text-red-800 font-bold leading-relaxed">{n.message}</p>
                    <div className="mt-4 flex justify-between items-center text-[9px] font-write text-red-400 uppercase tracking-widest">
                       <span>Data do Alerta: {new Date(n.timestamp).toLocaleDateString()}</span>
                       <i className="fas fa-circle-exclamation"></i>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
              <button 
                onClick={handleAcknowledgeFines}
                className="w-full bg-slate-900 text-white py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95"
              >
                Estou ciente das infrações
              </button>
              <p className="text-[9px] text-slate-400 text-center font-bold uppercase">Ao clicar, os alertas serão movidos para o seu histórico de notificações.</p>
            </div>
          </div>
        </div>
      )}

      {renderContent()}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <FleetProvider>
      <AppContent />
    </FleetProvider>
  );
};

export default App;
