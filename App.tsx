
import React, { useState, useEffect } from 'react';
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
  const { currentUser, isLoading } = useFleet();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  const isAdmin = currentUser?.username === 'admin';

  useEffect(() => {
    const handleStartSchedule = (e: any) => {
      setSelectedScheduleId(e.detail);
      setActiveTab('operation');
    };
    window.addEventListener('start-schedule', handleStartSchedule);
    return () => window.removeEventListener('start-schedule', handleStartSchedule);
  }, []);

  if (!currentUser) return <Login />;
  if (currentUser && !currentUser.passwordChanged) return <ForceChangePassword />;

  const handleStartFromSchedule = (scheduleId: string) => {
    setSelectedScheduleId(scheduleId);
    setActiveTab('operation');
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
