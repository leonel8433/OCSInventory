
import { Driver, Vehicle, Trip, Checklist, ScheduledTrip, VehicleStatus, MaintenanceRecord, Fine, Occurrence } from '../types';

/**
 * Este serviço simula um Backend RESTful.
 * No futuro, basta substituir as operações do localStorage por fetch('/api/...')
 */

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
  OCCURRENCES: 'fleet_occurrences',
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
    await delay(400);
    return getFromDB<Driver[]>(KEYS.DRIVERS, []);
  },

  async saveDriver(driver: Driver): Promise<void> {
    const drivers = getFromDB<Driver[]>(KEYS.DRIVERS, []);
    const index = drivers.findIndex(d => d.id === driver.id);
    if (index > -1) drivers[index] = driver;
    else drivers.push(driver);
    saveToDB(KEYS.DRIVERS, drivers);
    await delay(300);
  },

  async deleteDriver(id: string): Promise<void> {
    const drivers = getFromDB<Driver[]>(KEYS.DRIVERS, []);
    saveToDB(KEYS.DRIVERS, drivers.filter(d => d.id !== id));
    await delay(300);
  },

  // --- VEHICLES ---
  async getVehicles(): Promise<Vehicle[]> {
    await delay(400);
    return getFromDB<Vehicle[]>(KEYS.VEHICLES, []);
  },

  async updateVehicle(id: string, updates: Partial<Vehicle>): Promise<void> {
    const vehicles = getFromDB<Vehicle[]>(KEYS.VEHICLES, []);
    saveToDB(KEYS.VEHICLES, vehicles.map(v => v.id === id ? { ...v, ...updates } : v));
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
    // Transaction logic
    const active = getFromDB<Trip[]>(KEYS.TRIPS_ACTIVE, []);
    const checks = getFromDB<Checklist[]>(KEYS.CHECKLISTS, []);
    
    saveToDB(KEYS.TRIPS_ACTIVE, [...active, trip]);
    saveToDB(KEYS.CHECKLISTS, [...checks, checklist]);
    
    // Update vehicle status
    await this.updateVehicle(trip.vehicleId, { 
      status: VehicleStatus.IN_USE, 
      currentKm: checklist.km,
      lastChecklist: checklist 
    });
    await delay(500);
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
    await delay(600);
  }
};
