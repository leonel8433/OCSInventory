
import React, { useState, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { ScheduledTrip } from '../types';
import { checkSPRodizio, getRodizioDayLabel } from '../utils/trafficRules';

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

  // Lógica de validação de rodízio para o formulário
  const isSaoPaulo = useMemo(() => {
    const cityNorm = newSchedule.city.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const stateNorm = newSchedule.state.toLowerCase().trim();
    return cityNorm.includes('sao paulo') || cityNorm === 'sp' || stateNorm === 'sp';
  }, [newSchedule.city, newSchedule.state]);

  const currentSelectionRestricted = useMemo(() => {
    if (!isSaoPaulo || !newSchedule.vehicleId || !newSchedule.scheduledDate) return false;
    const vehicle = vehicles.find(v => v.id === newSchedule.vehicleId);
    if (!vehicle) return false;
    
    // Ajuste da data para evitar problemas de fuso horário
    const [year, month, day] = newSchedule.scheduledDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day, 12, 0, 0);
    
    return checkSPRodizio(vehicle.plate, dateObj);
  }, [isSaoPaulo, newSchedule.vehicleId, newSchedule.scheduledDate, vehicles]);

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

    if (currentSelectionRestricted) {
      alert("Atenção: Este veículo está em dia de rodízio em São Paulo para a data selecionada. O agendamento não pode ser concluído.");
      return;
    }

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
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl">
              <i className="fas fa-calendar-day"></i>
            </div>
            <div>
              <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest">{editingId ? 'Editar Agendamento' : 'Criar Novo Agendamento'}</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase">Planeje a rota e verifique restrições de tráfego</p>
            </div>
          </div>

          <form onSubmit={handleAddSchedule} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-write text-slate-500 uppercase mb-2 tracking-widest">Condutor Escalado</label>
                <select required value={newSchedule.driverId} onChange={(e) => setNewSchedule({ ...newSchedule, driverId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-950">
                  <option value="">Selecione o motorista...</option>
                  {drivers.filter(d => d.username !== 'admin').map(d => (<option key={d.id} value={d.id}>{d.name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-500 uppercase mb-2 tracking-widest">Veículo Escolhido</label>
                <select required value={newSchedule.vehicleId} onChange={(e) => setNewSchedule({ ...newSchedule, vehicleId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-950">
                  <option value="">Selecione o veículo...</option>
                  {vehicles.map(v => {
                    // Check restriction for the select label
                    let labelSuffix = '';
                    if (isSaoPaulo && newSchedule.scheduledDate) {
                      const [y, m, d] = newSchedule.scheduledDate.split('-').map(Number);
                      if (checkSPRodizio(v.plate, new Date(y, m-1, d, 12))) {
                        labelSuffix = ' [RODÍZIO SP]';
                      }
                    }
                    return (
                      <option key={v.id} value={v.id} className={labelSuffix ? 'text-red-500 font-bold' : ''}>
                        {v.plate} - {v.model}{labelSuffix}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-500 uppercase mb-2 tracking-widest">Data da Viagem</label>
                <input required type="date" value={newSchedule.scheduledDate} onChange={(e) => setNewSchedule({ ...newSchedule, scheduledDate: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-950" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-write text-slate-500 uppercase mb-2 tracking-widest">Cidade de Destino</label>
                <input required placeholder="Ex: São Paulo" value={newSchedule.city} onChange={(e) => setNewSchedule({ ...newSchedule, city: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-950" />
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-500 uppercase mb-2 tracking-widest">Estado (UF)</label>
                <input required maxLength={2} placeholder="SP" value={newSchedule.state} onChange={(e) => setNewSchedule({ ...newSchedule, state: e.target.value.toUpperCase() })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-950" />
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-500 uppercase mb-2 tracking-widest">CEP</label>
                <input placeholder="00000-000" value={newSchedule.zipCode} onChange={(e) => setNewSchedule({ ...newSchedule, zipCode: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-950" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-50">
              <div>
                <label className="block text-[10px] font-write text-slate-500 uppercase mb-2 tracking-widest">Ponto de Partida</label>
                <input placeholder="Rua, número, bairro..." value={newSchedule.origin} onChange={(e) => setNewSchedule({ ...newSchedule, origin: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-950" />
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-500 uppercase mb-2 tracking-widest">Ponto de Chegada</label>
                <input required placeholder="Rua, número, bairro..." value={newSchedule.destination} onChange={(e) => setNewSchedule({ ...newSchedule, destination: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-950" />
              </div>
            </div>

            {/* Alerta de Rodízio Crítico no Formulário */}
            {currentSelectionRestricted && (
              <div className="bg-red-50 border-2 border-red-200 p-6 rounded-[2rem] flex items-center gap-5 animate-in shake duration-500">
                <div className="w-14 h-14 bg-red-600 text-white rounded-2xl flex items-center justify-center text-2xl shadow-lg shrink-0">
                  <i className="fas fa-ban"></i>
                </div>
                <div>
                  <h4 className="text-sm font-write text-red-900 uppercase tracking-widest mb-1">Veículo com Restrição de Circulação</h4>
                  <p className="text-xs text-red-700 font-medium">O veículo selecionado possui rodízio em São Paulo na {getRodizioDayLabel(vehicles.find(v => v.id === newSchedule.vehicleId)?.plate || '')}. Por favor, escolha outro veículo ou altere a data.</p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-8 py-4 font-write text-slate-400 uppercase text-[10px] tracking-widest hover:text-slate-900 transition-colors">Descartar</button>
              <button 
                type="submit" 
                disabled={currentSelectionRestricted}
                className="bg-indigo-600 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-[0.2em] shadow-2xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-20 transition-all active:scale-95"
              >
                {editingId ? 'Salvar Alterações' : 'Agendar Viagem'}
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
            const [y, m, d] = trip.scheduledDate.split('-').map(Number);
            const tripDate = new Date(y, m-1, d, 12, 0, 0);
            
            const cityNorm = (trip.city || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            const stateNorm = (trip.state || '').toLowerCase().trim();
            const tripIsSP = cityNorm.includes('sao paulo') || cityNorm === 'sp' || stateNorm === 'sp';
            const restricted = vehicle && tripIsSP && checkSPRodizio(vehicle.plate, tripDate);

            return (
              <div key={trip.id} className={`bg-white p-6 rounded-[2.5rem] shadow-sm border transition-all flex flex-col md:flex-row items-center gap-6 group relative overflow-hidden ${restricted ? 'border-red-200 bg-red-50/20' : 'border-slate-100 hover:shadow-md'}`}>
                {restricted && <div className="absolute top-0 left-0 w-1.5 h-full bg-red-500"></div>}
                
                <div className={`w-full md:w-32 flex flex-col items-center justify-center p-4 rounded-3xl border shrink-0 transition-colors ${restricted ? 'bg-red-100 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                  <span className={`text-2xl font-write ${restricted ? 'text-red-700' : 'text-slate-800'}`}>{tripDate.getDate()}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tripDate.toLocaleDateString('pt-BR', { month: 'short' })}</span>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
                  <div>
                    <p className="text-[8px] font-write text-slate-400 uppercase tracking-widest mb-1">Motorista</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{driver?.name}</p>
                  </div>
                  <div>
                    <p className="text-[8px] font-write text-slate-400 uppercase tracking-widest mb-1">Veículo</p>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-lg font-mono text-[10px] ${restricted ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'}`}>{vehicle?.plate}</span>
                      {restricted && <i className="fas fa-triangle-exclamation text-red-500 animate-pulse" title="Rodízio Ativo!"></i>}
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-[8px] font-write text-slate-400 uppercase tracking-widest mb-1">Destino</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{trip.destination}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{trip.city} / {trip.state}</p>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0 w-full md:w-auto">
                  {!isAdmin && (
                    <>
                      <button
                        onClick={() => window.dispatchEvent(new CustomEvent('start-schedule', { detail: trip.id }))}
                        disabled={restricted}
                        className="flex-1 md:flex-none bg-indigo-600 text-white px-8 py-4 rounded-2xl font-write uppercase text-[10px] tracking-widest hover:bg-indigo-700 disabled:opacity-30 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                      >
                        <i className="fas fa-play"></i> Iniciar
                      </button>
                      <button
                        onClick={() => { if(window.confirm('Deseja cancelar este agendamento?')) deleteScheduledTrip(trip.id); }}
                        className="flex-1 md:flex-none bg-white text-red-500 px-8 py-4 rounded-2xl font-write uppercase text-[10px] tracking-widest hover:bg-red-50 border border-red-100 transition-all flex items-center justify-center gap-2"
                      >
                        <i className="fas fa-xmark"></i> Cancelar
                      </button>
                    </>
                  )}
                  {isAdmin && (
                    <>
                      <button onClick={() => handleEdit(trip)} className="w-12 h-12 bg-white text-slate-400 rounded-2xl flex items-center justify-center border border-slate-100 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm">
                        <i className="fas fa-edit"></i>
                      </button>
                      <button onClick={() => { if(window.confirm('Excluir este agendamento?')) deleteScheduledTrip(trip.id); }} className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center border border-red-100 hover:bg-red-500 hover:text-white transition-all shadow-sm">
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </>
                  )}
                </div>

                {restricted && (
                  <div className="absolute top-2 right-4">
                    <span className="bg-red-600 text-white text-[7px] font-write uppercase px-2 py-0.5 rounded-full tracking-[0.1em]">Atenção: Rodízio Ativo</span>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-24 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center text-3xl">
              <i className="fas fa-calendar-xmark"></i>
            </div>
            <p className="text-slate-300 font-write uppercase text-[10px] tracking-[0.3em]">Nenhum agendamento futuro encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchedulingPage;
