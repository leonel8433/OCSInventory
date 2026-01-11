
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
  
  const [states, setStates] = useState<{ sigla: string, nome: string }[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [isLoadingLocs, setIsLoadingLocs] = useState(false);

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

  // Carregar Estados
  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then(res => res.json())
      .then(data => setStates(data))
      .catch(err => console.error("Erro ao carregar estados:", err));
  }, []);

  // Carregar Cidades por UF
  useEffect(() => {
    if (route.state) {
      setIsLoadingLocs(true);
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${route.state}/municipios?orderBy=nome`)
        .then(res => res.json())
        .then(data => {
          setCities(data.map((c: any) => c.nome));
          setIsLoadingLocs(false);
        })
        .catch(err => {
          console.error("Erro ao carregar cidades:", err);
          setIsLoadingLocs(false);
        });
    }
  }, [route.state]);

  // Carregar dados da viagem agendada
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
        
        // Mantemos no passo 1 para permitir que o motorista altere os dados agendados
        setStep(1);
      }
    }
  }, [scheduledTripId, scheduledTrips, vehicles]);

  useEffect(() => {
    if (selectedVehicle) {
      setChecklist(prev => ({ ...prev, km: selectedVehicle.currentKm }));
    }
  }, [selectedVehicle]);

  const handleCancelWizard = () => {
    const confirmMsg = scheduledTripId 
      ? 'Deseja encerrar a preparação? O agendamento continuará salvo na sua agenda.'
      : 'Deseja realmente cancelar a preparação desta viagem?';
      
    if (window.confirm(confirmMsg)) {
      if (onComplete) onComplete();
    }
  };

  const handleOptimizeRoute = async () => {
    if (!route.origin || !route.destination) {
      alert("Por favor, informe a origem e o destino para otimização.");
      return;
    }
    setIsOptimizing(true);
    try {
      const result = await getOptimizedRoute(route.origin, route.destination, route.waypoints);
      setAiSuggestion(result.text);
    } catch (error) {
      console.error(error);
      setAiSuggestion("Otimização indisponível.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const isKmInvalid = (checklist.km ?? 0) < (selectedVehicle?.currentKm ?? 0);
  const isSaoPaulo = useMemo(() => isLocationSaoPaulo(route.city, route.state, route.destination), [route.city, route.state, route.destination]);

  const googleMapsUrl = useMemo(() => {
    const originEnc = encodeURIComponent(route.origin);
    const destEnc = encodeURIComponent(`${route.destination}, ${route.city} - ${route.state}`);
    const waypointsEnc = route.waypoints.length > 0 ? `&waypoints=${route.waypoints.map(w => encodeURIComponent(w)).join('|')}` : '';
    return `https://www.google.com/maps/dir/?api=1&origin=${originEnc}&destination=${destEnc}${waypointsEnc}&travelmode=driving`;
  }, [route]);

  const handleStartTrip = () => {
    if (!selectedVehicle || !currentUser) return;
    
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
      observations: `${aiSuggestion ? `IA SUGGEST: ${aiSuggestion} | ` : ''}${checklist.comments ? `OBS_SAIDA: ${checklist.comments}` : ''}`
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

    window.open(googleMapsUrl, '_blank');

    if (onComplete) onComplete();
  };

  const availableVehicles = vehicles.filter(v => v.status === VehicleStatus.AVAILABLE);

  const addWaypoint = () => setRoute(prev => ({ ...prev, waypoints: [...prev.waypoints, ''] }));
  const removeWaypoint = (idx: number) => setRoute(prev => ({ ...prev, waypoints: prev.waypoints.filter((_, i) => i !== idx) }));
  const updateWaypoint = (idx: number, val: string) => {
    const updated = [...route.waypoints];
    updated[idx] = val;
    setRoute(prev => ({ ...prev, waypoints: updated }));
  };

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
              <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">1. Planejamento da Jornada</h3>
              <button 
                type="button" 
                onClick={handleOptimizeRoute}
                disabled={isOptimizing || !route.origin || !route.destination}
                className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[10px] font-write uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-100 transition-all disabled:opacity-50"
              >
                <i className={`fas ${isOptimizing ? 'fa-circle-notch fa-spin' : 'fa-wand-magic-sparkles'}`}></i>
                Otimizar Rota
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Data da Viagem</label>
                <input type="date" value={route.tripDate} onChange={(e) => setRoute({ ...route, tripDate: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold scroll-mt-32 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">UF</label>
                <select value={route.state} onChange={(e) => setRoute({ ...route, state: e.target.value, city: '' })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold scroll-mt-32 outline-none">
                  <option value="">Selecione...</option>
                  {states.map(s => <option key={s.sigla} value={s.sigla}>{s.sigla} - {s.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2 flex justify-between">Cidade {isLoadingLocs && <i className="fas fa-spinner fa-spin"></i>}</label>
                <input list="wizard-cities" placeholder="Nome da cidade" value={route.city} onChange={(e) => setRoute({ ...route, city: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold scroll-mt-32 outline-none" />
                <datalist id="wizard-cities">{cities.map((c, i) => <option key={i} value={c} />)}</datalist>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Ponto de Partida</label>
                <input placeholder="Origem da viagem..." value={route.origin} onChange={(e) => setRoute({ ...route, origin: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold scroll-mt-32 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-[10px] font-write text-slate-400 uppercase tracking-widest font-bold">Destinos Intermediários (Paradas)</label>
                  <button type="button" onClick={addWaypoint} className="text-[10px] bg-slate-900 text-white px-3 py-1.5 rounded-lg font-bold uppercase hover:bg-slate-800 transition-all">
                    <i className="fas fa-plus mr-1"></i> Add Novo Destino
                  </button>
                </div>
                {route.waypoints.map((wp, idx) => (
                  <div key={idx} className="flex gap-2 animate-in slide-in-from-left-2">
                    <input placeholder={`Parada ${idx + 1}`} value={wp} onChange={(e) => updateWaypoint(idx, e.target.value)} className="flex-1 p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm scroll-mt-32 outline-none focus:ring-2 focus:ring-indigo-500" />
                    <button onClick={() => removeWaypoint(idx)} className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center border border-red-100 hover:bg-red-500 hover:text-white transition-all"><i className="fas fa-times"></i></button>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Destino Final</label>
                <input placeholder="Destino principal..." value={route.destination} onChange={(e) => setRoute({ ...route, destination: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold scroll-mt-32 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            <div className="flex justify-between pt-6 border-t border-slate-50">
              <button onClick={handleCancelWizard} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Abandonar</button>
              <button disabled={!route.origin || !route.destination} onClick={() => setStep(2)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-30">Próximo: Veículo</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-10 space-y-8 animate-in slide-in-from-right-8 duration-500">
            <div className="flex justify-between items-center">
               <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">2. Seleção de Veículo</h3>
               <span className="text-[10px] bg-slate-100 px-3 py-1 rounded-full font-bold text-slate-400 uppercase">Apenas Disponíveis</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {availableVehicles.map(v => (
                <button 
                  key={v.id} 
                  onClick={() => setSelectedVehicle(v)} 
                  className={`p-6 rounded-3xl border-2 text-left transition-all ${selectedVehicle?.id === v.id ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-100 hover:border-blue-200 shadow-sm'}`}
                >
                  <p className="text-xl font-write tracking-widest text-slate-950">{v.plate}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{v.model}</p>
                </button>
              ))}
              {availableVehicles.length === 0 && (
                <div className="md:col-span-2 py-10 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                   <p className="text-slate-400 font-bold text-xs uppercase">Nenhum veículo disponível no momento.</p>
                </div>
              )}
            </div>

            <div className="flex justify-between pt-6">
              <button onClick={() => setStep(1)} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Voltar: Rota</button>
              <div className="flex gap-4">
                <button type="button" onClick={handleCancelWizard} className="text-red-500 font-write uppercase text-[10px] tracking-widest font-bold px-4 hover:bg-red-50 rounded-xl transition-colors">CANCELAR</button>
                <button disabled={!selectedVehicle} onClick={() => setStep(3)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl disabled:opacity-30 active:scale-95 transition-all">Próximo: Checklist</button>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="p-10 space-y-8 animate-in slide-in-from-right-8 duration-500">
            <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">3. Checklist de Saída</h3>
            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-4 text-center font-bold tracking-widest">Odômetro Atual no {selectedVehicle?.plate}</label>
                <input type="number" value={checklist.km} onChange={(e) => setChecklist({ ...checklist, km: parseInt(e.target.value) || 0 })} className="w-full p-5 rounded-3xl border-2 font-write text-3xl text-center scroll-mt-40 bg-white outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="grid grid-cols-3 gap-4">
                {['oilChecked', 'waterChecked', 'tiresChecked'].map(key => (
                  <button key={key} onClick={() => setChecklist({ ...checklist, [key]: !checklist[key as keyof Checklist] })} className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${checklist[key as keyof Checklist] ? 'bg-emerald-50 border-emerald-500 text-emerald-600' : 'bg-white border-slate-100 text-slate-300'}`}>
                    <i className="fas fa-check-circle text-xl"></i>
                    <span className="text-[10px] font-write uppercase tracking-widest">{key.replace('Checked','')}</span>
                  </button>
                ))}
            </div>

            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-3">
              <label className="flex items-center gap-2 text-[10px] font-write text-slate-400 uppercase tracking-widest font-bold">
                <i className="fas fa-clipboard-check text-indigo-500"></i> Observações de Saída
              </label>
              <textarea 
                placeholder="Relate aqui o estado do veículo, avarias pré-existentes ou observações técnicas de saída..." 
                value={checklist.comments} 
                onChange={(e) => setChecklist({ ...checklist, comments: e.target.value })} 
                className="w-full p-5 bg-white border border-slate-200 rounded-3xl font-bold text-sm outline-none scroll-mt-40 min-h-[140px] focus:ring-2 focus:ring-indigo-500" 
              />
              <p className="text-[9px] text-slate-400 font-bold uppercase">Importante: Qualquer dano não relatado pode ser atribuído ao condutor atual.</p>
            </div>

            <div className="flex justify-between pt-6">
              <button onClick={() => setStep(2)} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Voltar</button>
              <div className="flex gap-4">
                <button onClick={handleCancelWizard} className="text-red-500 font-write uppercase text-[10px] tracking-widest font-bold px-4">Cancelar</button>
                <button disabled={!checklist.oilChecked || !checklist.waterChecked || !checklist.tiresChecked || isKmInvalid} onClick={() => setStep(4)} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl active:scale-95 transition-all">Revisar e Iniciar</button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="p-10 space-y-8 animate-in zoom-in-95 duration-500 text-center">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-2">
              <i className="fas fa-flag-checkered"></i>
            </div>
            <h3 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">Revisão Final da Viagem</h3>
            
            <div className="bg-slate-50 p-8 rounded-[2rem] border border-slate-100 text-left space-y-6">
               <div className="grid grid-cols-2 gap-4">
                 <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Veículo Escalado</p>
                    <p className="text-sm font-bold text-slate-900">{selectedVehicle?.plate}</p>
                    <p className="text-[10px] text-slate-500 font-medium">{selectedVehicle?.model}</p>
                 </div>
                 <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Data de Partida</p>
                    <p className="text-sm font-bold text-slate-900">{new Date(route.tripDate + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                 </div>
               </div>

               <div className="pt-4 border-t border-slate-200">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Destino Final</p>
                  <p className="text-sm font-bold text-slate-900 leading-tight">{route.destination}</p>
                  <p className="text-[10px] text-blue-600 font-bold uppercase mt-1">{route.city} / {route.state}</p>
               </div>

               <div className="pt-4 border-t border-slate-200">
                  <a 
                    href={googleMapsUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 bg-white border border-blue-100 rounded-2xl hover:border-blue-400 transition-all group shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                        <i className="fas fa-map-marked-alt"></i>
                      </div>
                      <span className="text-[11px] font-write text-slate-800 uppercase tracking-tight">Visualizar Rota no Google Maps</span>
                    </div>
                    <i className="fas fa-arrow-right text-slate-300 group-hover:text-blue-500 transition-colors"></i>
                  </a>
                  <p className="text-[9px] text-slate-400 font-medium mt-2 px-1 italic">* Verifique as condições de trânsito antes de iniciar o trajeto.</p>
               </div>

               {checklist.comments && (
                 <div className="pt-4 border-t border-slate-200">
                    <p className="text-[9px] text-slate-400 font-bold uppercase mb-1">Observações de Saída</p>
                    <p className="text-[10px] text-slate-600 italic leading-relaxed">"{checklist.comments}"</p>
                 </div>
               )}
            </div>

            <div className="pt-8 space-y-4">
              <button 
                onClick={handleStartTrip} 
                className="w-full bg-emerald-600 text-white py-6 rounded-3xl font-write uppercase text-sm tracking-[0.3em] shadow-2xl hover:bg-emerald-700 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <i className="fas fa-play text-xs"></i> INICIAR JORNADA AGORA
              </button>
              <button onClick={() => setStep(3)} className="text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Corrigir Checklist</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperationWizard;
