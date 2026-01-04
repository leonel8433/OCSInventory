
import { Driver, Vehicle, Trip, Checklist, ScheduledTrip, VehicleStatus, MaintenanceRecord, Fine, AppNotification } from '../types';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const KEYS = {
  VEHICLES: 'fleet_vehicles',
  DRIVERS: 'fleet_drivers',
  TRIPS_ACTIVE: 'fleet_active_trips',
  TRIPS_COMPLETED: 'fleet_completed_trips',
  TRIPS_SCHEDULED: 'fleet_scheduled_trips',
  CHECKLISTS: 'fleet_checklists',
  MAINTENANCE: 'fleet_maintenance',
  FINES: 'fleet_fines',
  NOTIFICATIONS: 'fleet_notifications'
};

const getFromDB = <T>(key: string, defaultValue: T): T => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultValue;
};

const saveToDB = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const apiService = {
  // --- AUTH ---
  async login(username: string, pass: string): Promise<Driver | null> {
    await delay(600);
    const drivers = getFromDB<Driver[]>(KEYS.DRIVERS, []);
    return drivers.find(d => d.username === username && d.password === pass) || null;
  },

  // --- DRIVERS ---
  async getDrivers(): Promise<Driver[]> {
    await delay(300);
    return getFromDB<Driver[]>(KEYS.DRIVERS, []);
  },

  async saveDriver(driver: Driver): Promise<void> {
    const drivers = getFromDB<Driver[]>(KEYS.DRIVERS, []);
    const index = drivers.findIndex(d => d.id === driver.id);
    if (index > -1) drivers[index] = driver;
    else drivers.push(driver);
    saveToDB(KEYS.DRIVERS, drivers);
    await delay(200);
  },

  async deleteDriver(id: string): Promise<void> {
    const drivers = getFromDB<Driver[]>(KEYS.DRIVERS, []);
    saveToDB(KEYS.DRIVERS, drivers.filter(d => d.id !== id));
    await delay(200);
  },

  // --- VEHICLES ---
  async getVehicles(): Promise<Vehicle[]> {
    await delay(300);
    return getFromDB<Vehicle[]>(KEYS.VEHICLES, []);
  },

  async updateVehicle(id: string, updates: Partial<Vehicle>): Promise<void> {
    const vehicles = getFromDB<Vehicle[]>(KEYS.VEHICLES, []);
    saveToDB(KEYS.VEHICLES, vehicles.map(v => v.id === id ? { ...v, ...updates } : v));
    await delay(200);
  },

  async saveVehicle(vehicle: Vehicle): Promise<void> {
    const vehicles = getFromDB<Vehicle[]>(KEYS.VEHICLES, []);
    saveToDB(KEYS.VEHICLES, [...vehicles, vehicle]);
    await delay(200);
  },

  // --- TRIPS ---
  async getActiveTrips(): Promise<Trip[]> {
    return getFromDB<Trip[]>(KEYS.TRIPS_ACTIVE, []);
  },

  async getScheduledTrips(): Promise<ScheduledTrip[]> {
    return getFromDB<ScheduledTrip[]>(KEYS.TRIPS_SCHEDULED, []);
  },

  async getCompletedTrips(): Promise<Trip[]> {
    return getFromDB<Trip[]>(KEYS.TRIPS_COMPLETED, []);
  },

  async startTrip(trip: Trip, checklist: Checklist): Promise<void> {
    const active = getFromDB<Trip[]>(KEYS.TRIPS_ACTIVE, []);
    const checks = getFromDB<Checklist[]>(KEYS.CHECKLISTS, []);
    
    saveToDB(KEYS.TRIPS_ACTIVE, [...active, trip]);
    saveToDB(KEYS.CHECKLISTS, [...checks, checklist]);
    
    await this.updateVehicle(trip.vehicleId, { 
      status: VehicleStatus.IN_USE, 
      currentKm: checklist.km,
      lastChecklist: checklist 
    });
    await delay(400);
  },

  async endTrip(tripId: string, endKm: number, endTime: string, expenses: any): Promise<void> {
    const active = getFromDB<Trip[]>(KEYS.TRIPS_ACTIVE, []);
    const completed = getFromDB<Trip[]>(KEYS.TRIPS_COMPLETED, []);
    
    const trip = active.find(t => t.id === tripId);
    if (trip) {
      const finished: Trip = { 
        ...trip, 
        endTime, 
        distance: endKm - trip.startKm,
        fuelExpense: expenses.fuel,
        otherExpense: expenses.other,
        expenseNotes: expenses.notes
      };
      saveToDB(KEYS.TRIPS_ACTIVE, active.filter(t => t.id !== tripId));
      saveToDB(KEYS.TRIPS_COMPLETED, [finished, ...completed]);
      await this.updateVehicle(trip.vehicleId, { status: VehicleStatus.AVAILABLE, currentKm: endKm });
    }
    await delay(500);
  },

  async saveScheduledTrip(trip: ScheduledTrip): Promise<void> {
    const schedules = getFromDB<ScheduledTrip[]>(KEYS.TRIPS_SCHEDULED, []);
    saveToDB(KEYS.TRIPS_SCHEDULED, [trip, ...schedules]);
    await delay(200);
  },

  async updateScheduledTrip(id: string, updates: Partial<ScheduledTrip>): Promise<void> {
    const schedules = getFromDB<ScheduledTrip[]>(KEYS.TRIPS_SCHEDULED, []);
    const updated = schedules.map(s => s.id === id ? { ...s, ...updates } : s);
    saveToDB(KEYS.TRIPS_SCHEDULED, updated);
    await delay(200);
  },

  async deleteScheduledTrip(id: string): Promise<void> {
    const schedules = getFromDB<ScheduledTrip[]>(KEYS.TRIPS_SCHEDULED, []);
    saveToDB(KEYS.TRIPS_SCHEDULED, schedules.filter(s => s.id !== id));
    await delay(100);
  },

  // --- MAINTENANCE, FINES & NOTIFICATIONS ---
  async getMaintenance(): Promise<MaintenanceRecord[]> {
    return getFromDB<MaintenanceRecord[]>(KEYS.MAINTENANCE, []);
  },

  async saveMaintenance(record: MaintenanceRecord): Promise<void> {
    const records = getFromDB<MaintenanceRecord[]>(KEYS.MAINTENANCE, []);
    saveToDB(KEYS.MAINTENANCE, [...records, record]);
    await this.updateVehicle(record.vehicleId, { status: VehicleStatus.MAINTENANCE });
    await delay(200);
  },

  async updateMaintenanceRecord(id: string, updates: Partial<MaintenanceRecord>): Promise<void> {
    const records = getFromDB<MaintenanceRecord[]>(KEYS.MAINTENANCE, []);
    const updated = records.map(r => r.id === id ? { ...r, ...updates } : r);
    saveToDB(KEYS.MAINTENANCE, updated);
    await delay(200);
  },

  async resolveMaintenance(vehicleId: string, recordId: string, km: number, date: string, cost?: number): Promise<void> {
    const records = getFromDB<MaintenanceRecord[]>(KEYS.MAINTENANCE, []);
    const updated = records.map(r => r.id === recordId ? { ...r, returnDate: date, cost: cost ?? r.cost } : r);
    saveToDB(KEYS.MAINTENANCE, updated);
    await this.updateVehicle(vehicleId, { status: VehicleStatus.AVAILABLE, currentKm: km });
    await delay(300);
  },

  async getFines(): Promise<Fine[]> {
    return getFromDB<Fine[]>(KEYS.FINES, []);
  },

  async saveFine(fine: Fine): Promise<void> {
    const fines = getFromDB<Fine[]>(KEYS.FINES, []);
    saveToDB(KEYS.FINES, [...fines, fine]);
    await delay(200);
  },

  async deleteFine(id: string): Promise<void> {
    const fines = getFromDB<Fine[]>(KEYS.FINES, []);
    saveToDB(KEYS.FINES, fines.filter(f => f.id !== id));
    await delay(100);
  },

  async getNotifications(): Promise<AppNotification[]> {
    return getFromDB<AppNotification[]>(KEYS.NOTIFICATIONS, []);
  },

  async saveNotification(notification: AppNotification): Promise<void> {
    const notifs = getFromDB<AppNotification[]>(KEYS.NOTIFICATIONS, []);
    saveToDB(KEYS.NOTIFICATIONS, [notification, ...notifs]);
    await delay(100);
  },

  async markNotificationRead(id: string): Promise<void> {
    const notifs = getFromDB<AppNotification[]>(KEYS.NOTIFICATIONS, []);
    saveToDB(KEYS.NOTIFICATIONS, notifs.map(n => n.id === id ? { ...n, isRead: true } : n));
  },

  async getChecklists(): Promise<Checklist[]> {
    return getFromDB<Checklist[]>(KEYS.CHECKLISTS, []);
  }
};
