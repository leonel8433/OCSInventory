
import React, { useState, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { ScheduledTrip } from '../types';
import { checkSPRodizio } from '../utils/trafficRules';

const SchedulingPage: React.FC = () => {
  const { drivers, vehicles, scheduledTrips, addScheduledTrip, updateScheduledTrip, deleteScheduledTrip, currentUser } = useFleet();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [newSchedule, setNewSchedule] = useState({
    driverId: '',
    vehicleId: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    origin: '',
    destination: '',
    waypoints: [] as string[],
    city: '',
    state: '',
    zipCode: '',
    notes: ''
  });

  const isAdmin = currentUser?.username === 'admin';

  const visibleSchedules = useMemo(() => {
    if (isAdmin) return scheduledTrips;
    return scheduledTrips.filter(t => t.driverId === currentUser?.id);
  }, [scheduledTrips, isAdmin, currentUser]);

  const handleEdit = (trip: ScheduledTrip) => {
    setNewSchedule({
      driverId: trip.driverId,
      vehicleId: trip.vehicleId,
      scheduledDate: trip.scheduledDate,
      origin: trip.origin || '',
      destination: trip.destination,
      waypoints: trip.waypoints || [],
      city: trip.city || '',
      state: trip.state || '',
      zipCode: trip.zipCode || '',
      notes: trip.notes || ''
    });
    setEditingId(trip.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddWaypoint = () => {
    setNewSchedule(prev => ({ ...prev, waypoints: [...prev.waypoints, ''] }));
  };

  const handleUpdateWaypoint = (index: number, value: string) => {
    const updated = [...newSchedule.waypoints];
    updated[index] = value;
    setNewSchedule(prev => ({ ...prev, waypoints: updated }));
  };

  const handleRemoveWaypoint = (index: number) => {
    setNewSchedule(prev => ({ ...prev, waypoints: prev.waypoints.filter((_, i) => i !== index) }));
  };

  const handleAddSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedule.driverId || !newSchedule.vehicleId || !newSchedule.destination) return;

    if (editingId) {
      updateScheduledTrip(editingId, {
        ...newSchedule,
        waypoints: newSchedule.waypoints.filter(w => w.trim() !== '')
      });
      setEditingId(null);
      alert('Agendamento atualizado com sucesso!');
    } else {
      const trip: ScheduledTrip = {
        id: Math.random().toString(36).substr(2, 9),
        driverId: newSchedule.driverId,
        vehicleId: newSchedule.vehicleId,
        scheduledDate: newSchedule.scheduledDate,
        origin: newSchedule.origin,
        destination: newSchedule.destination,
        waypoints: newSchedule.waypoints.filter(w => w.trim() !== ''),
        city: newSchedule.city,
        state: newSchedule.state,
        zipCode: newSchedule.zipCode,
        notes: newSchedule.notes
      };
      addScheduledTrip(trip);
      alert('Viagem agendada com sucesso!');
    }

    setNewSchedule({
      driverId: '',
      vehicleId: '',
      scheduledDate: new Date().toISOString().split('T')[0],
      origin: '',
      destination: '',
      waypoints: [],
      city: '',
      state: '',
      zipCode: '',
      notes: ''
    });
    setShowForm(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Agenda de Viagens</h2>
          {!isAdmin && <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Seus Próximos Compromissos</p>}
        </div>
        {isAdmin && (
          <button 
            onClick={() => { setShowForm(!showForm); if (showForm) setEditingId(null); }}
            className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-100 transition-all"
          >
            <i className={`fas ${showForm ? 'fa-times' : 'fa-calendar-plus'}`}></i>
            {showForm ? 'Cancelar' : 'Nova Agenda'}
          </button>
        )}
      </div>

      {isAdmin && showForm && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-6">Criar Agendamento</h3>
          <form onSubmit={handleAddSchedule} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-write text-slate-500 uppercase mb-2">Condutor</label>
                <select required value={newSchedule.driverId} onChange={(e) => setNewSchedule({ ...newSchedule, driverId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-950">
                  <option value="">Selecione...</option>
                  {drivers.map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-500 uppercase mb-2">Veículo</label>
                <select required value={newSchedule.vehicleId} onChange={(e) => setNewSchedule({ ...newSchedule, vehicleId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-950">
                  <option value="">Selecione...</option>
                  {vehicles.map(v => (<option key={v.id} value={v.id}>{v.plate} - {v.model}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-500 uppercase mb-2">Data Prevista</label>
                <input required type="date" value={newSchedule.scheduledDate} onChange={(e) => setNewSchedule({ ...newSchedule, scheduledDate: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-950" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-write text-slate-500 uppercase mb-2">Origem</label>
                <input placeholder="Ponto de partida" value={newSchedule.origin} onChange={(e) => setNewSchedule({ ...newSchedule, origin: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-950" />
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-500 uppercase mb-2">Destino Final</label>
                <input required placeholder="Local de chegada" value={newSchedule.destination} onChange={(e) => setNewSchedule({ ...newSchedule, destination: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-950" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-write text-slate-500 uppercase tracking-widest">Paradas Intermediárias</label>
                <button type="button" onClick={handleAddWaypoint} className="text-[10px] font-write text-indigo-600 uppercase tracking-widest hover:underline">+ Adicionar Ponto</button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {newSchedule.waypoints.map((wp, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input placeholder={`Parada ${idx + 1}`} value={wp} onChange={(e) => handleUpdateWaypoint(idx, e.target.value)} className="flex-1 p-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-950" />
                    <button type="button" onClick={() => handleRemoveWaypoint(idx)} className="w-10 h-10 text-red-300 hover:text-red-500 transition-colors"><i className="fas fa-trash-alt"></i></button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-6 py-3 font-write text-slate-400 uppercase text-[10px] tracking-widest">Cancelar</button>
              <button type="submit" className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-write uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">
                {editingId ? 'Salvar Alterações' : 'Confirmar Agendamento'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {visibleSchedules.length > 0 ? (
          visibleSchedules.map(trip => {
            const vehicle = vehicles.find(v => v.id === trip.vehicleId);
            const driver = drivers.find(d => d.id === trip.driverId);
            const tripDate = new Date(trip.scheduledDate + 'T00:00:00');
            const restricted = vehicle && checkSPRodizio(vehicle.plate, tripDate);

            return (
              <div key={trip.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row items-center gap-6 hover:shadow-md transition-all relative overflow-hidden group">
                <div className="w-full md:w-32 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-100 shrink-0">
                  <span className="text-2xl font-write text-slate-800">{tripDate.getDate()}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tripDate.toLocaleDateString('pt-BR', { month: 'short' })}</span>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                  <div>
                    <p className="text-[9px] font-write text-slate-400 uppercase tracking-widest mb-1">Motorista</p>
                    <p className="font-bold text-slate-800">{driver?.name}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-write text-slate-400 uppercase tracking-widest mb-1">Veículo</p>
                    <p className="font-bold text-indigo-600">{vehicle?.plate} {restricted && '⚠️'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-[9px] font-write text-slate-400 uppercase tracking-widest mb-1">Destino</p>
                    <p className="font-bold text-slate-800 truncate">{trip.destination}</p>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  {/* Botão de Iniciar para o motorista */}
                  {!isAdmin && (
                    <button
                      onClick={() => {
                        // Navegação para a aba de operação passando o ID do agendamento
                        // Isso simula o clique no dashboard
                        window.dispatchEvent(new CustomEvent('start-schedule', { detail: trip.id }));
                      }}
                      className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-write uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
                    >
                      <i className="fas fa-play"></i> Iniciar
                    </button>
                  )}
                  {isAdmin && (
                    <>
                      <button onClick={() => handleEdit(trip)} className="w-11 h-11 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:text-blue-600 hover:bg-blue-50 transition-all">
                        <i className="fas fa-edit"></i>
                      </button>
                      <button onClick={() => deleteScheduledTrip(trip.id)} className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-100 transition-all">
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
             <i className="fas fa-calendar-xmark text-4xl text-slate-100 mb-4"></i>
            <p className="text-slate-400 font-medium italic">Nenhum agendamento para o período.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchedulingPage;
