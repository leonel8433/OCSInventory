
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Vehicle, Driver, Trip, Checklist, VehicleStatus, MaintenanceRecord, AppNotification, Fine, Occurrence, ScheduledTrip } from '../types';
import { apiService } from '../services/api';

interface FleetContextType {
  vehicles: Vehicle[];
  drivers: Driver[];
  activeTrips: Trip[];
  completedTrips: Trip[];
  scheduledTrips: ScheduledTrip[];
  maintenanceRecords: MaintenanceRecord[];
  fines: Fine[];
  isLoading: boolean;
  currentUser: Driver | null;
  addVehicle: (v: Vehicle) => Promise<void>;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => Promise<void>;
  addDriver: (d: Driver) => Promise<void>;
  updateDriver: (id: string, updates: Partial<Driver>) => Promise<void>;
  deleteDriver: (id: string) => Promise<void>;
  startTrip: (trip: Trip, checklist: Checklist) => Promise<void>;
  updateTrip: (tripId: string, updates: Partial<Trip>) => Promise<void>;
  addScheduledTrip: (trip: ScheduledTrip) => Promise<void>;
  endTrip: (tripId: string, currentKm: number, endTime: string, expenses?: any) => Promise<void>;
  cancelTrip: (tripId: string) => Promise<void>;
  login: (username: string, pass: string) => Promise<boolean>;
  logout: () => void;
  resetDatabase: () => void;
}

const FleetContext = createContext<FleetContextType | undefined>(undefined);

export const FleetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [activeTrips, setActiveTrips] = useState<Trip[]>([]);
  const [scheduledTrips, setScheduledTrips] = useState<ScheduledTrip[]>([]);
  const [completedTrips, setCompletedTrips] = useState<Trip[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Driver | null>(null);

  // Inicialização (Simula carregamento inicial do Backend)
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        const [v, d, a, s, c] = await Promise.all([
          apiService.getVehicles(),
          apiService.getDrivers(),
          apiService.getActiveTrips(),
          apiService.getScheduledTrips(),
          apiService.getCompletedTrips()
        ]);
        
        // Se a base estiver vazia, popula com dados iniciais (Mock)
        if (d.length === 0) {
          const initialDrivers = [
            { id: 'admin', name: 'Gestor de Frota', license: '0000', category: 'AB', username: 'admin', password: 'admin', passwordChanged: true }
          ];
          for (const drv of initialDrivers) await apiService.saveDriver(drv);
          setDrivers(initialDrivers);
        } else {
          setDrivers(d);
        }

        setVehicles(v);
        setActiveTrips(a);
        setScheduledTrips(s);
        setCompletedTrips(c);
        
        const savedUser = sessionStorage.getItem('fleet_current_user');
        if (savedUser) setCurrentUser(JSON.parse(savedUser));
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const login = async (user: string, pass: string) => {
    setIsLoading(true);
    const driver = await apiService.login(user, pass);
    setIsLoading(false);
    if (driver) {
      setCurrentUser(driver);
      sessionStorage.setItem('fleet_current_user', JSON.stringify(driver));
      return true;
    }
    return false;
  };

  const logout = useCallback(() => {
    setCurrentUser(null);
    sessionStorage.removeItem('fleet_current_user');
  }, []);

  const startTrip = async (trip: Trip, checklist: Checklist) => {
    setIsLoading(true);
    await apiService.startTrip(trip, checklist);
    setActiveTrips(prev => [...prev, trip]);
    setVehicles(prev => prev.map(v => v.id === trip.vehicleId ? { ...v, status: VehicleStatus.IN_USE } : v));
    setIsLoading(false);
  };

  const endTrip = async (tripId: string, currentKm: number, endTime: string, expenses: any) => {
    setIsLoading(true);
    await apiService.endTrip(tripId, currentKm, endTime, expenses);
    const trip = activeTrips.find(t => t.id === tripId);
    if (trip) {
      setCompletedTrips(prev => [{ ...trip, endTime }, ...prev]);
      setActiveTrips(prev => prev.filter(t => t.id !== tripId));
      setVehicles(prev => prev.map(v => v.id === trip.vehicleId ? { ...v, status: VehicleStatus.AVAILABLE, currentKm } : v));
    }
    setIsLoading(false);
  };

  const addDriver = async (d: Driver) => {
    setIsLoading(true);
    await apiService.saveDriver(d);
    setDrivers(prev => [...prev, d]);
    setIsLoading(false);
  };

  const updateDriver = async (id: string, updates: Partial<Driver>) => {
    setIsLoading(true);
    const drivers = await apiService.getDrivers();
    const updated = drivers.map(d => d.id === id ? { ...d, ...updates } : d);
    localStorage.setItem('fleet_drivers', JSON.stringify(updated));
    setDrivers(updated);
    setIsLoading(false);
  };

  const deleteDriver = async (id: string) => {
    await apiService.deleteDriver(id);
    setDrivers(prev => prev.filter(d => d.id !== id));
  };

  const resetDatabase = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.reload();
  };

  // Funções simplificadas para o protótipo manter funcionamento
  const addVehicle = async (v: Vehicle) => { setVehicles(p => [...p, v]); localStorage.setItem('fleet_vehicles', JSON.stringify([...vehicles, v])); };
  const updateVehicle = async (id: string, updates: Partial<Vehicle>) => { const n = vehicles.map(v => v.id === id ? {...v, ...updates} : v); setVehicles(n); localStorage.setItem('fleet_vehicles', JSON.stringify(n)); };
  const addScheduledTrip = async (t: ScheduledTrip) => { const n = [t, ...scheduledTrips]; setScheduledTrips(n); localStorage.setItem('fleet_scheduled_trips', JSON.stringify(n)); };
  const updateTrip = async (id: string, updates: Partial<Trip>) => { const n = activeTrips.map(t => t.id === id ? {...t, ...updates} : t); setActiveTrips(n); localStorage.setItem('fleet_active_trips', JSON.stringify(n)); };
  const cancelTrip = async (id: string) => { setActiveTrips(p => p.filter(t => t.id !== id)); };

  return (
    <FleetContext.Provider value={{
      vehicles, drivers, activeTrips, completedTrips, scheduledTrips, maintenanceRecords, fines, isLoading,
      currentUser, addVehicle, updateVehicle, addDriver, updateDriver, deleteDriver, startTrip, updateTrip, addScheduledTrip, endTrip, cancelTrip,
      login, logout, resetDatabase
    }}>
      {children}
    </FleetContext.Provider>
  );
};

export const useFleet = () => {
  const context = useContext(FleetContext);
  if (!context) throw new Error('useFleet must be used within a FleetProvider');
  return context;
};
