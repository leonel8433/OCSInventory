
import React, { useState, useMemo, useCallback } from 'react';
import { useFleet } from '../context/FleetContext';
import { ScheduledTrip, VehicleStatus } from '../types';
import { checkSPRodizio, getRodizioDayLabel, isLocationSaoPaulo } from '../utils/trafficRules';

const SchedulingPage: React.FC = () => {
  const { drivers, vehicles, scheduledTrips, addScheduledTrip, updateScheduledTrip, deleteScheduledTrip, currentUser } = useFleet();
  const [showForm, setShowForm] = useState(false);
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newSchedule, setNewSchedule] = useState({
    driverId: '',
    vehicleId: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    origin: '',
    destination: '',
    city: '',
    state: '',
    notes: '',
    waypoints: [] as string[]
  });

  const isAdmin = currentUser?.username === 'admin';

  // Filtragem e busca para administradores
  const visibleScheduledTrips = useMemo(() => {
    let trips = [...scheduledTrips];
    
    if (!isAdmin) {
      trips = trips.filter(trip => trip.driverId === currentUser?.id);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      trips = trips.filter(trip => {
        const driverName = drivers.find(d => d.id === trip.driverId)?.name.toLowerCase() || '';
        const vehiclePlate = vehicles.find(v => v.id === trip.vehicleId)?.plate.toLowerCase() || '';
        return (
          trip.destination.toLowerCase().includes(term) ||
          (trip.city && trip.city.toLowerCase().includes(term)) ||
          driverName.includes(term) ||
          vehiclePlate.includes(term)
        );
      });
    }

    return trips.sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
  }, [scheduledTrips, isAdmin, currentUser, searchTerm, drivers, vehicles]);

  const isDestSaoPaulo = useMemo(() => {
    return isLocationSaoPaulo(newSchedule.city, newSchedule.state, newSchedule.destination);
  }, [newSchedule.city, newSchedule.state, newSchedule.destination]);

  const getValidationDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  };

  const restrictionInfo = useMemo(() => {
    if (!newSchedule.scheduledDate) return null;
    
    if (newSchedule.vehicleId) {
      const vehicle = vehicles.find(v => v.id === newSchedule.vehicleId);
      
      // Validação de Veículo em Manutenção
      if (vehicle && vehicle.status === VehicleStatus.MAINTENANCE) {
        return { 
          type: 'MAINTENANCE', 
          severity: 'critical',
          message: `VEÍCULO INDISPONÍVEL: O ativo ${vehicle.plate} está atualmente em MANUTENÇÃO técnica.` 
        };
      }

      // Validação de Conflito de Agendamento (Mesmo Veículo, Mesma Data)
      const vehicleConflict = scheduledTrips.find(trip => 
        trip.vehicleId === newSchedule.vehicleId && 
        trip.scheduledDate === newSchedule.scheduledDate &&
        trip.id !== editingTripId
      );
      if (vehicleConflict) {
        const formattedDate = new Date(newSchedule.scheduledDate + 'T12:00:00').toLocaleDateString('pt-BR');
        return {
          type: 'CONFLICT_VEHICLE',
          severity: 'critical',
          message: `CONFLITO DE ESCALA: O veículo ${vehicles.find(v => v.id === vehicleConflict.vehicleId)?.plate} já possui uma viagem confirmada para o dia ${formattedDate}.`
        };
      }

      if (isDestSaoPaulo && vehicle) {
        const dateObj = getValidationDate(newSchedule.scheduledDate);
        if (checkSPRodizio(vehicle.plate, dateObj)) {
          return { 
            type: 'RODIZIO', 
            severity: 'critical',
            message: `BLOQUEIO DE CIRCULAÇÃO: Este veículo (${vehicle.plate}) possui restrição de rodízio em São Paulo na ${getRodizioDayLabel(vehicle.plate)}.` 
          };
        }
      }
    }

    if (newSchedule.driverId) {
      const driverConflict = scheduledTrips.find(trip => 
        trip.driverId === newSchedule.driverId && 
        trip.scheduledDate === newSchedule.scheduledDate &&
        trip.id !== editingTripId
      );
      if (driverConflict) {
        const driverName = drivers.find(d => d.id === newSchedule.driverId)?.name;
        return {
          type: 'CONFLICT_DRIVER',
          severity: 'critical',
          message: `DISPONIBILIDADE DO CONDUTOR: O motorista ${driverName} já possui compromisso agendado para esta data.`
        };
      }
    }

    return null;
  }, [isDestSaoPaulo, newSchedule.vehicleId, newSchedule.driverId, newSchedule.scheduledDate, vehicles, drivers, scheduledTrips, editingTripId]);

  const isBlocked = !!restrictionInfo;

  const handleAddSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedule.driverId || !newSchedule.vehicleId || !newSchedule.destination) return;

    if (isBlocked) {
      alert(`VALIDAÇÃO DE SEGURANÇA:\n\n${restrictionInfo.message}`);
      return;
    }

    const tripData: Omit<ScheduledTrip, 'id'> = {
      driverId: newSchedule.driverId,
      vehicleId: newSchedule.vehicleId,
      scheduledDate: newSchedule.scheduledDate,
      origin: newSchedule.origin,
      destination: newSchedule.destination,
      city: newSchedule.city,
      state: newSchedule.state,
      notes: newSchedule.notes,
      waypoints: newSchedule.waypoints.filter(w => w.trim() !== '')
    };

    if (editingTripId) {
      updateScheduledTrip(editingTripId, tripData);
      alert('Agenda atualizada.');
    } else {
      const trip: ScheduledTrip = {
        id: Math.random().toString(36).substr(2, 9),
        ...tripData
      };
      addScheduledTrip(trip);
      alert('Operação escalada com sucesso.');
    }

    resetForm();
  };

  const handleEditClick = (trip: ScheduledTrip) => {
    setNewSchedule({
      driverId: trip.driverId,
      vehicleId: trip.vehicleId,
      scheduledDate: trip.scheduledDate,
      origin: trip.origin || '',
      destination: trip.destination,
      city: trip.city || '',
      state: trip.state || '',
      notes: trip.notes || '',
      waypoints: trip.waypoints || []
    });
    setEditingTripId(trip.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = useCallback(async (id: string, isDriver: boolean) => {
    const msg = isDriver 
      ? 'Deseja desistir desta viagem agendada?'
      : 'Confirma a exclusão definitiva deste agendamento da frota?';
      
    if (window.confirm(msg)) {
      await deleteScheduledTrip(id);
      alert(isDriver ? 'Você removeu a rota da sua agenda.' : 'Agendamento deletado com sucesso.');
    }
  }, [deleteScheduledTrip]);

  const addWaypoint = () => {
    setNewSchedule({ ...newSchedule, waypoints: [...newSchedule.waypoints, ''] });
  };

  const updateWaypoint = (index: number, value: string) => {
    const updated = [...newSchedule.waypoints];
    updated[index] = value;
    setNewSchedule({ ...newSchedule, waypoints: updated });
  };

  const removeWaypoint = (index: number) => {
    setNewSchedule({ ...newSchedule, waypoints: newSchedule.waypoints.filter((_, i) => i !== index) });
  };

  const resetForm = () => {
    setNewSchedule({ driverId: '', vehicleId: '', scheduledDate: new Date().toISOString().split('T')[0], origin: '', destination: '', city: '', state: '', notes: '', waypoints: [] });
    setEditingTripId(null);
    setShowForm(false);
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Agenda de Viagens</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
            {isAdmin ? 'Escalonamento Operacional' : 'Meus Próximos Trajetos'}
          </p>
        </div>
        <div className="flex gap-2">
           {isAdmin && (
             <div className="relative">
                <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
                <input 
                  type="text" 
                  placeholder="Buscar na agenda..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm w-48 md:w-64"
                />
             </div>
           )}
           <button onClick={() => { if (showForm) resetForm(); else setShowForm(true); }} className={`px-6 py-2.5 rounded-xl font-bold shadow-lg transition-all flex items-center gap-2 ${showForm ? 'bg-slate-900 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}>
            <i className={`fas ${showForm ? 'fa-times' : (editingTripId ? 'fa-pen-to-square' : 'fa-calendar-plus')}`}></i>
            {showForm ? 'Cancelar' : (editingTripId ? 'Edição Ativa' : 'Nova Escala')}
          </button>
        </div>
      </div>

      {showForm && (
        <div className={`bg-white p-8 rounded-[2.5rem] shadow-xl border animate-in fade-in duration-300 ring-2 ${isBlocked ? 'border-red-200 ring-red-50' : 'border-indigo-100 ring-indigo-50'}`}>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isBlocked ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                <i className={`fas ${isBlocked ? 'fa-ban' : (editingTripId ? 'fa-edit' : 'fa-calendar-plus')}`}></i>
              </div>
              <div>
                <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest">
                  {editingTripId ? 'Edição de Escala' : 'Novo Agendamento'}
                </h3>
              </div>
            </div>
          </div>

          {isBlocked && (
            <div className="mb-6 p-5 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-4 animate-in slide-in-from-top-2">
              <div className="w-10 h-10 bg-red-600 text-white rounded-2xl flex items-center justify-center shrink-0">
                <i className="fas fa-exclamation-triangle"></i>
              </div>
              <p className="text-xs font-bold text-red-800 uppercase tracking-tight leading-relaxed">{restrictionInfo.message}</p>
            </div>
          )}
          
          <form onSubmit={handleAddSchedule} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Motorista Atribuído</label>
                <select 
                  required 
                  value={newSchedule.driverId} 
                  onChange={(e) => setNewSchedule({ ...newSchedule, driverId: e.target.value })} 
                  className={`w-full p-4 bg-slate-50 border rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 transition-all ${isBlocked && restrictionInfo.type === 'CONFLICT_DRIVER' ? 'border-red-300 ring-red-50' : 'border-slate-200 focus:ring-indigo-500'}`}
                >
                  <option value="">Selecione...</option>
                  {drivers.filter(d => d.username !== 'admin' || isAdmin).map(d => {
                    const isDriverBusy = scheduledTrips.some(trip => 
                      trip.driverId === d.id && 
                      trip.scheduledDate === newSchedule.scheduledDate &&
                      trip.id !== editingTripId
                    );
                    return (
                      <option key={d.id} value={d.id} disabled={isDriverBusy}>
                        {d.name} {d.id === currentUser?.id ? '(Você)' : ''} {isDriverBusy ? '(OCUPADO)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Data da Operação</label>
                <input 
                  required 
                  type="date" 
                  value={newSchedule.scheduledDate} 
                  onChange={(e) => setNewSchedule({ ...newSchedule, scheduledDate: e.target.value })} 
                  className={`w-full p-4 bg-slate-50 border rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 transition-all ${isBlocked ? 'border-red-300 ring-red-50' : 'border-slate-200 focus:ring-indigo-500'}`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Veículo Escalado</label>
                <select 
                  required 
                  value={newSchedule.vehicleId} 
                  onChange={(e) => setNewSchedule({ ...newSchedule, vehicleId: e.target.value })} 
                  className={`w-full p-4 bg-slate-50 border rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 transition-all ${isBlocked && (restrictionInfo.type === 'CONFLICT_VEHICLE' || restrictionInfo.type === 'MAINTENANCE' || restrictionInfo.type === 'RODIZIO') ? 'border-red-300 ring-red-50' : 'border-slate-200 focus:ring-indigo-500'}`}
                >
                  <option value="">Selecione...</option>
                  {vehicles.map(v => {
                    const isRodizioRestricted = isDestSaoPaulo && checkSPRodizio(v.plate, getValidationDate(newSchedule.scheduledDate));
                    const inMaintenance = v.status === VehicleStatus.MAINTENANCE;
                    
                    // Validação em tempo real no dropdown
                    const isAlreadyScheduled = scheduledTrips.some(trip => 
                      trip.vehicleId === v.id && 
                      trip.scheduledDate === newSchedule.scheduledDate &&
                      trip.id !== editingTripId
                    );
                    
                    return (
                      <option 
                        key={v.id} 
                        value={v.id} 
                        disabled={inMaintenance || isAlreadyScheduled} 
                        className={inMaintenance ? 'text-red-300' : isAlreadyScheduled ? 'text-orange-300' : isRodizioRestricted ? 'text-amber-600' : ''}
                      >
                        {v.plate} - {v.model} 
                        {inMaintenance ? ' (OFICINA)' : isAlreadyScheduled ? ' (JÁ AGENDADO)' : isRodizioRestricted ? ' (RODÍZIO SP)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Cidade de Destino</label>
                <input placeholder="Ex: São Paulo" value={newSchedule.city} onChange={(e) => setNewSchedule({ ...newSchedule, city: e.target.value })} className={`w-full p-4 bg-slate-50 border rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 transition-all ${isDestSaoPaulo ? 'border-blue-200 ring-blue-50' : 'border-slate-200 focus:ring-indigo-500'}`} />
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Estado (UF)</label>
                <input placeholder="SP" maxLength={2} value={newSchedule.state} onChange={(e) => setNewSchedule({ ...newSchedule, state: e.target.value.toUpperCase() })} className={`w-full p-4 bg-slate-50 border rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 transition-all ${isDestSaoPaulo ? 'border-blue-200 ring-blue-50' : 'border-slate-200 focus:ring-indigo-500'}`} />
              </div>
            </div>

            <div className="space-y-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
              <div className="flex justify-between items-center mb-2">
                 <label className="block text-[10px] font-write text-slate-400 uppercase tracking-widest font-bold">Paradas Intermediárias</label>
                 <button type="button" onClick={addWaypoint} className="text-[10px] bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-bold uppercase hover:bg-indigo-700 transition-all">
                   <i className="fas fa-plus mr-1"></i> Add Parada
                 </button>
              </div>
              {newSchedule.waypoints.map((wp, index) => (
                <div key={index} className="flex gap-2 animate-in slide-in-from-left-2 duration-200">
                  <div className="flex-1 relative">
                    <i className="fas fa-map-pin absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                    <input 
                      placeholder={`Endereço da parada ${index + 1}...`} 
                      value={wp} 
                      onChange={(e) => updateWaypoint(index, e.target.value)} 
                      className="w-full p-4 pl-12 bg-white border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button type="button" onClick={() => removeWaypoint(index)} className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center border border-red-100 hover:bg-red-500 hover:text-white transition-all">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Local de Entrega Final</label>
              <input required placeholder="Endereço completo do destino..." value={newSchedule.destination} onChange={(e) => setNewSchedule({ ...newSchedule, destination: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <div className="flex justify-end pt-4 gap-4">
              <button type="button" onClick={resetForm} className="px-8 py-5 text-slate-400 font-write uppercase text-[10px] tracking-widest">
                Descartar
              </button>
              <button 
                type="submit" 
                disabled={isBlocked}
                className={`px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl transition-all ${isBlocked ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'}`}
              >
                {editingTripId ? 'Salvar Alterações' : 'Escalar Viagem'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {visibleScheduledTrips.length > 0 ? visibleScheduledTrips.map(trip => {
          const vehicle = vehicles.find(v => v.id === trip.vehicleId);
          const driver = drivers.find(d => d.id === trip.driverId);
          const [y, m, d] = trip.scheduledDate.split('-').map(Number);
          const tripDate = new Date(y, m-1, d, 12, 0, 0);
          const isOwnTrip = trip.driverId === currentUser?.id;
          
          const inMaintenance = vehicle?.status === VehicleStatus.MAINTENANCE;
          const hasRodizio = isLocationSaoPaulo(trip.city, trip.state, trip.destination) && vehicle && checkSPRodizio(vehicle.plate, tripDate);

          return (
            <div key={trip.id} className={`bg-white p-6 rounded-[2.5rem] shadow-sm border flex flex-col md:flex-row md:items-center gap-6 group hover:shadow-md transition-all ${inMaintenance || hasRodizio ? 'border-red-200 bg-red-50/20' : 'border-slate-100'}`}>
              <div className={`w-24 text-center p-3 rounded-2xl font-write border shrink-0 ${inMaintenance || hasRodizio ? 'bg-red-100 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                <span className={`block text-2xl ${inMaintenance || hasRodizio ? 'text-red-700' : 'text-slate-800'}`}>{tripDate.getDate()}</span>
                <span className="text-[10px] uppercase text-slate-400 font-bold">{tripDate.toLocaleDateString('pt-BR', { month: 'short' })}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-widest ${inMaintenance || hasRodizio ? 'bg-red-700 text-white' : 'bg-slate-900 text-white'}`}>{vehicle?.plate}</span>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">{vehicle?.model}</p>
                  {isAdmin && (
                    <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[8px] font-bold uppercase border border-indigo-100">
                      Condutor: {driver?.name}
                    </span>
                  )}
                  {inMaintenance && (
                    <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[8px] font-bold uppercase animate-pulse">VEÍCULO EM MANUTENÇÃO</span>
                  )}
                  {hasRodizio && !inMaintenance && (
                    <span className="bg-amber-600 text-white px-2 py-0.5 rounded text-[8px] font-bold uppercase">ALERTA RODÍZIO</span>
                  )}
                </div>
                <h4 className={`text-lg font-bold truncate ${inMaintenance || hasRodizio ? 'text-red-900' : 'text-slate-800'}`}>{trip.destination}</h4>
              </div>
              
              <div className="flex items-center justify-end gap-3 shrink-0">
                {(isAdmin || isOwnTrip) && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleEditClick(trip)} 
                      className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 hover:bg-indigo-600 hover:text-white flex items-center justify-center transition-all border border-slate-100" 
                    >
                      <i className="fas fa-edit text-sm"></i>
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(trip.id, !isAdmin)} 
                      className="w-10 h-10 rounded-xl bg-slate-50 text-slate-300 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-all border border-slate-100"
                    >
                      <i className={`fas ${isAdmin ? 'fa-trash-can' : 'fa-user-slash'} text-sm`}></i>
                    </button>
                  </div>
                )}
                
                {!isAdmin && isOwnTrip && (
                  <button 
                    disabled={inMaintenance || hasRodizio}
                    onClick={() => window.dispatchEvent(new CustomEvent('start-schedule', { detail: trip.id }))} 
                    className={`px-8 py-4 rounded-2xl font-write uppercase text-[10px] tracking-widest shadow-xl transition-all ${inMaintenance || hasRodizio ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'}`}
                  >
                    {inMaintenance ? 'Indisponível' : 'Iniciar'}
                  </button>
                )}
              </div>
            </div>
          );
        }) : (
          <div className="py-24 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
             <i className="fas fa-calendar-xmark text-4xl text-slate-100 mb-4"></i>
             <p className="text-slate-300 font-write uppercase text-[10px] tracking-[0.3em]">Nenhuma viagem escalada para este período</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchedulingPage;
