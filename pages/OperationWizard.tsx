
import React, { useState, useEffect, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { Vehicle, Checklist, Trip, VehicleStatus } from '../types';
import { checkSPRodizio, getRodizioDayLabel, isLocationSaoPaulo } from '../utils/trafficRules';
import { getOptimizedRoute } from '../services/geminiService';

interface OperationWizardProps {
  scheduledTripId?: string;
  onComplete?: () => void;
}

const OperationWizard: React.FC<OperationWizardProps> = ({ scheduledTripId, onComplete }) => {
  const { vehicles, scheduledTrips, drivers, currentUser, startTrip, deleteScheduledTrip } = useFleet();
  const [step, setStep] = useState(1);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [checklist, setChecklist] = useState<Partial<Checklist>>({
    km: 0,
    oilChecked: false,
    waterChecked: false,
    tiresChecked: false,
    comments: ''
  });

  const [route, setRoute] = useState({
    origin: '',
    destination: '',
    city: '',
    state: '',
    tripDate: new Date().toISOString().split('T')[0],
    waypoints: [] as string[]
  });

  useEffect(() => {
    if (scheduledTripId) {
      const schedule = scheduledTrips.find(s => s.id === scheduledTripId);
      if (schedule) {
        setRoute({
          origin: schedule.origin || '',
          destination: schedule.destination || '',
          city: schedule.city || '',
          state: schedule.state || '',
          tripDate: schedule.scheduledDate || new Date().toISOString().split('T')[0],
          waypoints: schedule.waypoints || []
        });
        const vehicle = vehicles.find(v => v.id === schedule.vehicleId);
        if (vehicle) setSelectedVehicle(vehicle);
        setStep(2);
      }
    }
  }, [scheduledTripId, scheduledTrips, vehicles]);

  useEffect(() => {
    if (selectedVehicle) {
      setChecklist(prev => ({ ...prev, km: selectedVehicle.currentKm }));
    }
  }, [selectedVehicle]);

  const handleOptimizeRoute = async () => {
    if (!route.origin || !route.destination) {
      alert("Por favor, informe a origem e o destino para otimização.");
      return;
    }
    
    setIsOptimizing(true);
    setAiSuggestion(null);
    
    try {
      const result = await getOptimizedRoute(route.origin, route.destination, route.waypoints);
      setAiSuggestion(result.text);
    } catch (error) {
      console.error("Erro ao otimizar rota:", error);
      setAiSuggestion("Não foi possível obter sugestões da IA no momento.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const isKmInvalid = (checklist.km ?? 0) < (selectedVehicle?.currentKm ?? 0);
  
  const isSaoPaulo = useMemo(() => {
    return isLocationSaoPaulo(route.city, route.state, route.destination);
  }, [route.city, route.state, route.destination]);

  const getSafeTripDate = () => {
    if (!route.tripDate) return new Date();
    const [year, month, day] = route.tripDate.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
  };

  const handleStartTrip = () => {
    if (!selectedVehicle || !currentUser) return;
    
    if (isSaoPaulo && checkSPRodizio(selectedVehicle.plate, getSafeTripDate())) {
      alert(`BLOQUEIO DE SEGURANÇA: Este veículo não pode circular em SP hoje devido ao rodízio (${getRodizioDayLabel(selectedVehicle.plate)}).`);
      return;
    }

    const now = new Date().toISOString();
    const newTrip: Trip = {
      id: Math.random().toString(36).substr(2, 9),
      driverId: currentUser.id,
      vehicleId: selectedVehicle.id,
      origin: route.origin,
      destination: route.destination,
      waypoints: route.waypoints,
      city: route.city,
      state: route.state,
      startTime: now,
      startKm: checklist.km || selectedVehicle.currentKm,
      observations: `${aiSuggestion ? `SUGESTÃO IA: ${aiSuggestion.slice(0, 300)}... ` : ''}${checklist.comments ? `| ANOTAÇÕES INICIAIS: ${checklist.comments}` : ''}`
    };

    const finalChecklist: Checklist = {
      ...checklist as Checklist,
      id: Math.random().toString(36).substr(2, 9),
      driverId: currentUser.id,
      vehicleId: selectedVehicle.id,
      timestamp: now,
      fuelLevel: selectedVehicle.fuelLevel
    };

    startTrip(newTrip, finalChecklist);
    if (scheduledTripId) deleteScheduledTrip(scheduledTripId);

    const originEnc = encodeURIComponent(route.origin);
    const destEnc = encodeURIComponent(`${route.destination}, ${route.city} - ${route.state}`);
    const waypointsEnc = route.waypoints.length > 0 
      ? `&waypoints=${route.waypoints.map(w => encodeURIComponent(w)).join('|')}` 
      : '';
      
    window.open(`https://www.google.com/maps/dir/?api=1&origin=${originEnc}&destination=${destEnc}${waypointsEnc}&travelmode=driving`, '_blank');

    if (onComplete) onComplete();
  };

  const handleCancelWizard = () => {
    const isScheduled = !!scheduledTripId;
    let message = 'Deseja realmente cancelar a preparação da viagem?';
    
    if (isScheduled) {
      if (window.confirm('Esta viagem foi agendada. Deseja APAGAR o agendamento da sua escala ou apenas SAIR desta tela?\n\nOK = Apagar Agendamento\nCANCELAR = Apenas Sair')) {
        deleteScheduledTrip(scheduledTripId);
        alert('Agendamento removido da sua escala.');
      }
    } else {
      if (!window.confirm(message)) return;
    }
    
    if (onComplete) onComplete();
  };

  const addWaypoint = () => {
    setRoute(prev => ({ ...prev, waypoints: [...prev.waypoints, ''] }));
  };

  const removeWaypoint = (index: number) => {
    setRoute(prev => ({ ...prev, waypoints: prev.waypoints.filter((_, i) => i !== index) }));
  };

  const updateWaypoint = (index: number, value: string) => {
    const newWaypoints = [...route.waypoints];
    newWaypoints[index] = value;
    setRoute(prev => ({ ...prev, waypoints: newWaypoints }));
  };

  const mapUrl = useMemo(() => {
    const origin = encodeURIComponent(route.origin);
    const destination = encodeURIComponent(route.destination + (route.city ? ', ' + route.city : '') + (route.state ? ' - ' + route.state : ''));
    const validWaypoints = route.waypoints.filter(w => w.trim() !== '');
    
    let daddr = destination;
    if (validWaypoints.length > 0) {
      daddr = validWaypoints.map(w => encodeURIComponent(w)).join('+to:') + '+to:' + destination;
    }
    
    return `https://www.google.com/maps?saddr=${origin}&daddr=${daddr}&output=embed`;
  }, [route.origin, route.destination, route.city, route.state, route.waypoints]);

  const showMapPreview = route.origin && route.destination;

  return (
    <div className="max-w-4xl mx-auto py-4">
      <div className="flex items-center justify-between mb-10 px-4">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className={`w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all ${
            step >= s ? 'bg-slate-900 border-slate-900 text-white shadow-xl' : 'bg-white border-slate-100 text-slate-300'
          }`}>
            <span className="font-write">{s}</span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
        {step === 1 && (
          <div className="p-10 space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">1. Definição da Rota</h3>
              <button 
                type="button" 
                onClick={handleOptimizeRoute}
                disabled={!route.origin || !route.destination || isOptimizing}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-write uppercase tracking-widest hover:bg-indigo-100 transition-all disabled:opacity-50"
              >
                <i className={`fas ${isOptimizing ? 'fa-circle-notch fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
                {isOptimizing ? 'Analisando...' : 'Consultar Rota Inteligente'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Data da Viagem</label>
                <input type="date" value={route.tripDate} onChange={(e) => setRoute({ ...route, tripDate: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-write font-bold text-slate-950" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Cidade</label>
                  <input placeholder="Ex: São Paulo" value={route.city} onChange={(e) => setRoute({ ...route, city: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-write font-bold text-slate-950" />
                </div>
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">UF</label>
                  <input placeholder="SP" maxLength={2} value={route.state} onChange={(e) => setRoute({ ...route, state: e.target.value.toUpperCase() })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-write font-bold text-slate-950" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Ponto de Partida</label>
                <input placeholder="Endereço de Origem" value={route.origin} onChange={(e) => setRoute({ ...route, origin: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-write font-bold text-slate-950" />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] font-write text-slate-400 uppercase tracking-widest font-bold">Paradas Intermediárias</label>
                  <button type="button" onClick={addWaypoint} className="text-[10px] bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold uppercase hover:bg-slate-800 transition-all">
                    <i className="fas fa-plus mr-1"></i> Add Parada
                  </button>
                </div>
                <div className="space-y-2">
                  {route.waypoints.map((wp, index) => (
                    <div key={index} className="flex gap-2 animate-in slide-in-from-left-2 duration-200">
                      <input 
                        placeholder={`Endereço da parada ${index + 1}...`} 
                        value={wp} 
                        onChange={(e) => updateWaypoint(index, e.target.value)} 
                        className="flex-1 p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none font-write font-bold text-xs text-slate-950"
                      />
                      <button type="button" onClick={() => removeWaypoint(index)} className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center border border-red-100 hover:bg-red-500 hover:text-white transition-all">
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Ponto de Chegada</label>
                <input placeholder="Endereço de Destino Final" value={route.destination} onChange={(e) => setRoute({ ...route, destination: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-write font-bold text-slate-950" />
              </div>
            </div>

            {showMapPreview && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-4 duration-500">
                <label className="block text-[10px] font-write text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <i className="fas fa-map-marked-alt text-blue-500"></i> Pré-visualização do Trajeto Planejado
                </label>
                <div className="w-full h-80 bg-slate-100 rounded-3xl overflow-hidden border border-slate-200 shadow-inner relative group">
                  <iframe
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    style={{ border: 0, filter: 'grayscale(0.1) brightness(0.95)' }}
                    src={mapUrl}
                    allowFullScreen
                  ></iframe>
                  <div className="absolute inset-0 pointer-events-none border-4 border-white/20 rounded-3xl"></div>
                </div>
              </div>
            )}

            {aiSuggestion && (
              <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 animate-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-indigo-600 text-white rounded-lg flex items-center justify-center text-[10px]">
                    <i className="fas fa-robot"></i>
                  </div>
                  <span className="text-[10px] font-write text-indigo-900 uppercase tracking-widest">Sugestão de Logística AI</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  {aiSuggestion}
                </p>
                <div className="mt-4 flex justify-end">
                   <button 
                    type="button" 
                    onClick={() => setAiSuggestion(null)}
                    className="text-[9px] font-bold text-slate-400 uppercase hover:text-slate-600"
                   >
                     Limpar Sugestão
                   </button>
                </div>
              </div>
            )}

            {isOptimizing && (
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 animate-pulse flex flex-col items-center justify-center gap-3">
                <i className="fas fa-wand-sparkles text-indigo-400 text-xl"></i>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Otimizando sua jornada...</p>
              </div>
            )}

            <div className="flex justify-between pt-4">
              <button onClick={handleCancelWizard} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Abandonar Operação</button>
              <button disabled={!route.origin || !route.destination} onClick={() => setStep(2)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl disabled:opacity-30 active:scale-95 transition-all">Próximo: Veículo</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-10 space-y-8 animate-in slide-in-from-right-8 duration-500">
            <div className="flex justify-between items-center">
               <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">2. Seleção de Veículo</h3>
               <span className="text-[10px] bg-slate-100 px-3 py-1 rounded-full font-bold text-slate-500 uppercase">Apenas Disponíveis</span>
            </div>

            {isSaoPaulo && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <i className="fas fa-traffic-light text-amber-600 mt-1"></i>
                <div>
                  <p className="text-[10px] font-bold text-amber-800 uppercase tracking-tight">Zona de Rodízio Detectada: São Paulo</p>
                  <p className="text-[9px] text-amber-700 font-medium leading-relaxed">
                    O sistema está validando automaticamente a restrição de trânsito para o dia {getSafeTripDate().toLocaleDateString('pt-BR', { weekday: 'long' })}. 
                    Veículos impedidos pelo rodízio foram bloqueados.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {vehicles.filter(v => v.status === VehicleStatus.AVAILABLE).map(v => {
                const restricted = isSaoPaulo && checkSPRodizio(v.plate, getSafeTripDate());
                
                const todayStr = new Date().toISOString().split('T')[0];
                const reservation = scheduledTrips.find(s => s.vehicleId === v.id && s.scheduledDate === todayStr);
                const isReservedForOther = reservation && reservation.driverId !== currentUser?.id;
                const reservationDriverName = isReservedForOther ? drivers.find(d => d.id === reservation.driverId)?.name : null;

                return (
                  <button 
                    key={v.id} 
                    disabled={restricted || isReservedForOther} 
                    onClick={() => setSelectedVehicle(v)} 
                    className={`p-6 rounded-3xl border-2 text-left relative overflow-hidden transition-all ${
                      restricted || isReservedForOther
                      ? 'bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed grayscale' 
                      : selectedVehicle?.id === v.id 
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100' 
                        : 'border-slate-100 hover:border-blue-200 shadow-sm'
                    }`}
                  >
                    {restricted && (
                      <div className="absolute inset-0 bg-red-600/5 flex flex-col items-center justify-center gap-1 z-10 backdrop-blur-[1px]">
                         <span className="bg-red-600 text-white px-3 py-1 rounded-lg text-[9px] font-write uppercase tracking-widest shadow-lg">IMPEDIDO: RODÍZIO</span>
                         <span className="text-[8px] font-bold text-red-700 uppercase bg-white/80 px-2 py-0.5 rounded shadow-sm">Restrito na {getRodizioDayLabel(v.plate)}</span>
                      </div>
                    )}

                    {isReservedForOther && (
                      <div className="absolute inset-0 bg-amber-600/5 flex flex-col items-center justify-center gap-1 z-10 backdrop-blur-[1px]">
                         <span className="bg-amber-600 text-white px-3 py-1 rounded-lg text-[10px] font-write uppercase tracking-widest shadow-lg">RESERVADO</span>
                         <span className="text-[8px] font-bold text-amber-700 uppercase text-center px-2 bg-white/80 rounded shadow-sm">Escala p/ {reservationDriverName}</span>
                      </div>
                    )}

                    <div className="relative">
                      <p className="text-xl font-write tracking-widest text-slate-950">{v.plate}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{v.model}</p>
                      <div className="mt-4 flex items-center gap-2">
                         <span className="text-[9px] font-bold text-slate-500 uppercase">Final {v.plate.slice(-1)}</span>
                         <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                         <span className="text-[9px] font-bold text-slate-500 uppercase">{v.brand}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {vehicles.filter(v => v.status === VehicleStatus.AVAILABLE).length === 0 && (
                <div className="md:col-span-2 py-10 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                   <p className="text-slate-400 font-bold text-xs uppercase">Nenhum veículo disponível no momento.</p>
                </div>
              )}
            </div>
            <div className="flex justify-between pt-6">
              <button onClick={() => setStep(1)} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Voltar: Rota</button>
              <div className="flex gap-4">
                <button onClick={handleCancelWizard} className="text-red-500 font-write uppercase text-[10px] tracking-widest font-bold px-4">Cancelar</button>
                <button disabled={!selectedVehicle} onClick={() => setStep(3)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl disabled:opacity-30 active:scale-95 transition-all">Próximo: Checklist</button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-10 space-y-8 animate-in slide-in-from-right-8 duration-500">
            <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">3. Checklist de Saída</h3>
            
            {isKmInvalid && (
              <div className="bg-red-50 p-5 rounded-3xl border border-red-100 flex items-center gap-4 animate-in slide-in-from-top-2 duration-300">
                <div className="w-10 h-10 bg-red-600 text-white rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-red-100">
                  <i className="fas fa-triangle-exclamation"></i>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-red-800 uppercase tracking-tight">Alerta de Inconsistência no Odômetro</p>
                  <p className="text-[9px] text-red-700 font-medium leading-relaxed">A quilometragem inserida é menor que a última registrada ({selectedVehicle?.currentKm} KM). Por favor, verifique o painel do veículo.</p>
                </div>
              </div>
            )}

            <div className={`p-8 rounded-3xl border transition-all ${isKmInvalid ? 'bg-red-50/30 border-red-200 ring-4 ring-red-50' : 'bg-slate-50 border-slate-100'}`}>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-4 text-center tracking-widest font-bold">KM Atual no Painel do {selectedVehicle?.plate}</label>
                <input 
                  type="number" 
                  value={checklist.km} 
                  onChange={(e) => setChecklist({ ...checklist, km: parseInt(e.target.value) || 0 })} 
                  className={`w-full p-5 rounded-3xl border-2 font-write text-3xl text-center outline-none focus:ring-4 transition-all ${isKmInvalid ? 'border-red-400 bg-white text-red-600 focus:ring-red-100' : 'border-slate-200 bg-white text-slate-950 focus:ring-blue-50 shadow-inner'}`} 
                />
                <div className="flex justify-center mt-3">
                   <span className={`text-[10px] font-bold uppercase tracking-widest ${isKmInvalid ? 'text-red-500' : 'text-slate-400'}`}>
                     Último registro: {selectedVehicle?.currentKm} KM
                   </span>
                </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
                {[
                  { key: 'oilChecked', label: 'Óleo' },
                  { key: 'waterChecked', label: 'Água' },
                  { key: 'tiresChecked', label: 'Pneus' }
                ].map(item => (
                  <button key={item.key} onClick={() => setChecklist({ ...checklist, [item.key]: !checklist[item.key as keyof Checklist] })} className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${checklist[item.key as keyof Checklist] ? 'bg-emerald-50 border-emerald-500 text-emerald-600 shadow-lg' : 'bg-white border-slate-100 text-slate-300 hover:border-slate-200'}`}>
                    <i className={`fas ${checklist[item.key as keyof Checklist] ? 'fa-check-circle' : 'fa-circle-notch'} text-xl`}></i>
                    <span className="text-[10px] font-write uppercase tracking-widest">{item.label}</span>
                  </button>
                ))}
            </div>

            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 animate-in fade-in duration-500">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-3 tracking-widest font-bold flex items-center gap-2">
                  <i className="fas fa-comment-dots text-blue-500"></i> Anotações do Condutor
                </label>
                <textarea 
                  placeholder="Relate aqui qualquer observação sobre o veículo antes de sair (arranhões, barulhos, estado da carga)..." 
                  value={checklist.comments} 
                  onChange={(e) => setChecklist({ ...checklist, comments: e.target.value })} 
                  className="w-full bg-white border border-slate-200 p-4 rounded-2xl font-bold text-slate-950 text-sm outline-none focus:ring-2 focus:ring-blue-500 min-h-[120px] transition-all"
                />
            </div>

            <div className="flex justify-between pt-6">
              <button onClick={() => setStep(2)} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Trocar Veículo</button>
              <div className="flex gap-4">
                <button onClick={handleCancelWizard} className="text-red-500 font-write uppercase text-[10px] tracking-widest font-bold px-4">Cancelar</button>
                <button disabled={!checklist.oilChecked || !checklist.waterChecked || !checklist.tiresChecked || isKmInvalid} onClick={() => setStep(4)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl disabled:opacity-30 active:scale-95 transition-all">Revisar e Iniciar</button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="p-10 space-y-8 animate-in zoom-in-95 duration-500 text-center">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center text-3xl mx-auto shadow-inner mb-6"><i className="fas fa-check-double"></i></div>
            <h3 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">Confirmar Início de Jornada?</h3>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">A rota será aberta automaticamente no seu GPS padrão</p>
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-left space-y-2">
               <p className="text-[10px] text-slate-400 font-bold uppercase">Resumo da Operação</p>
               <p className="text-sm font-bold text-slate-700">Veículo: {selectedVehicle?.plate} ({selectedVehicle?.model})</p>
               <p className="text-sm font-bold text-slate-700">Destino Final: {route.destination}</p>
               {checklist.comments && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Anotações do Condutor:</p>
                    <p className="text-[11px] text-slate-600 italic leading-relaxed line-clamp-2">{checklist.comments}</p>
                  </div>
               )}
               {route.waypoints.length > 0 && (
                 <div className="mt-3 pt-3 border-t border-slate-200">
                    <p className="text-[9px] font-bold text-slate-400 uppercase mb-2">Paradas Intermediárias:</p>
                    <ul className="space-y-1">
                      {route.waypoints.filter(w => w.trim() !== '').map((wp, i) => (
                        <li key={i} className="text-[11px] font-bold text-slate-500 flex items-center gap-2">
                           <i className="fas fa-map-marker-alt text-blue-500"></i> {wp}
                        </li>
                      ))}
                    </ul>
                 </div>
               )}
            </div>
            <div className="pt-8 flex flex-col gap-4">
              <button onClick={handleStartTrip} className="w-full bg-emerald-600 text-white py-6 rounded-3xl font-write uppercase text-sm tracking-[0.3em] shadow-2xl hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 transition-all">INICIAR AGORA</button>
              <div className="flex justify-between items-center px-2 mt-4">
                <button onClick={() => setStep(3)} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Revisar Checklist</button>
                <button onClick={handleCancelWizard} className="text-red-500 font-write uppercase text-[10px] tracking-widest font-bold flex items-center gap-2">
                  <i className="fas fa-trash-can"></i> Cancelar Operação
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationWizard;
