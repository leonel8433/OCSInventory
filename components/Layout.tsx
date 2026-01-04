
import React, { useState, useRef, useEffect } from 'react';
import { useFleet } from '../context/FleetContext';
import Logo from './Logo';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, onTabChange }) => {
  const { currentUser, logout, notifications, markNotificationAsRead } = useFleet();
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const isAdmin = currentUser?.username === 'admin';

  const menuItems = [
    { id: 'dashboard', icon: 'fa-chart-pie', label: 'Dashboard', adminOnly: false },
    { id: 'fleet', icon: 'fa-truck', label: 'Frota', adminOnly: true },
    { id: 'drivers', icon: 'fa-users', label: 'Motoristas', adminOnly: true },
    { id: 'scheduling', icon: 'fa-calendar-alt', label: 'Agenda', adminOnly: false },
    { id: 'operation', icon: 'fa-key', label: 'Operação', adminOnly: false },
    { id: 'history', icon: 'fa-clock-rotate-left', label: 'Histórico', adminOnly: false },
    { id: 'monitoring', icon: 'fa-map-location-dot', label: 'Monitoramento', adminOnly: true },
    { id: 'reports', icon: 'fa-file-contract', label: 'Relatórios', adminOnly: false },
    { id: 'profile', icon: 'fa-user-circle', label: 'Perfil', adminOnly: false },
  ];

  const visibleMenuItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  const handleLogout = () => {
    logout();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-inter text-slate-900">
      {/* Sidebar Desktop */}
      <aside className="w-72 bg-white border-r border-slate-100 flex flex-col hidden md:flex shadow-sm z-20">
        <div className="p-10 flex justify-center">
          <Logo size="md" />
        </div>
        
        <nav className="flex-1 p-6 space-y-1 overflow-y-auto custom-scrollbar">
          <div className="px-4 mb-6 flex items-center gap-2">
             <span className="text-[11px] font-write text-slate-400 uppercase tracking-[0.2em]">Menu Principal</span>
             {isAdmin && <span className="text-[9px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded font-write uppercase tracking-wider">Admin</span>}
          </div>
          {visibleMenuItems.map(item => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all group ${
                activeTab === item.id 
                ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' 
                : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <i className={`fas ${item.icon} w-5 text-base transition-transform group-hover:scale-110`}></i>
              <span className="font-bold text-xs uppercase tracking-wider">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-8">
          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center font-bold overflow-hidden ring-2 ring-slate-100 ring-offset-2">
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-slate-400 font-bold text-lg">{currentUser?.name.charAt(0)}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-write text-slate-800 truncate uppercase tracking-tight">{currentUser?.name}</p>
                <p className="text-[10px] text-slate-400 truncate font-bold">@{currentUser?.username}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout} 
              className="w-full py-3 bg-white text-red-600 rounded-xl text-[10px] font-write uppercase tracking-widest border border-red-50 hover:bg-red-50 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <i className="fas fa-power-off"></i>
              Sair do Sistema
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header Superior */}
        <header className="bg-white/95 backdrop-blur-md border-b border-slate-100 p-5 flex items-center justify-between gap-4 shadow-sm z-10">
          <div className="md:hidden">
            <Logo size="sm" />
          </div>
          
          <div className="hidden md:block flex-1 px-4">
             <h1 className="text-xs font-write text-slate-400 uppercase tracking-[0.2em]">
               {menuItems.find(m => m.id === activeTab)?.label || 'Operação'}
             </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative" ref={notificationRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)} 
                className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all hover:shadow-inner"
              >
                <i className="fas fa-bell text-base"></i>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-write w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-4 w-80 bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200 z-50">
                  <div className="p-6 border-b border-slate-50 bg-slate-50/50">
                    <h3 className="font-write text-slate-800 text-[10px] uppercase tracking-[0.2em]">Notificações</h3>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                    {notifications.length > 0 ? (
                      notifications.map(n => (
                        <div key={n.id} onClick={() => markNotificationAsRead(n.id)} className={`p-6 border-b border-slate-50 hover:bg-slate-50 cursor-pointer flex gap-4 ${!n.isRead ? 'bg-blue-50/20' : ''}`}>
                          <div className={`w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 ${n.type === 'occurrence' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                            <i className="fas fa-info-circle"></i>
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] font-write text-slate-800 uppercase">{n.title}</p>
                            <p className="text-xs text-slate-500 leading-relaxed">{n.message}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-12 text-center text-slate-400 font-medium italic text-xs">Sem novas notificações.</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={handleLogout}
              className="flex items-center gap-2.5 px-6 py-2.5 rounded-2xl bg-red-50 text-red-600 border border-red-100 shadow-sm hover:bg-red-600 hover:text-white transition-all group"
            >
              <i className="fas fa-power-off text-base"></i>
              <span className="font-write text-[11px] uppercase tracking-widest">Sair</span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 md:p-12 custom-scrollbar">
          {children}
        </div>

        {/* Bottom Nav Mobile */}
        <nav className="md:hidden bg-white/95 backdrop-blur-md border-t border-slate-100 flex items-center overflow-x-auto p-3 z-20 pb-safe custom-scrollbar">
          <div className="flex items-center gap-2 min-w-full">
            {visibleMenuItems.map(item => (
              <button 
                key={item.id} 
                onClick={() => onTabChange(item.id)} 
                className={`flex flex-col items-center px-5 py-3 rounded-2xl transition-all flex-shrink-0 ${activeTab === item.id ? 'text-blue-600 bg-blue-50/50 font-write' : 'text-slate-300'}`}
              >
                <i className={`fas ${item.icon} text-xl`}></i>
                <span className="text-[9px] font-bold mt-1 uppercase tracking-wider">{item.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </main>
    </div>
  );
};

export default Layout;
