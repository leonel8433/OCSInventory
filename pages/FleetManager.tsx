
import React, { useState, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { VehicleStatus, MaintenanceRecord, Vehicle } from '../types';

const TIRE_POSITIONS = [
  { id: 'FL', label: 'D. Esq', x: 'left-0', y: 'top-10' },
  { id: 'FR', label: 'D. Dir', x: 'right-0', y: 'top-10' },
  { id: 'RL', label: 'T. Esq', x: 'left-0', y: 'top-44' },
  { id: 'RR', label: 'T. Dir', x: 'right-0', y: 'top-44' },
];

const MAINTENANCE_CATEGORIES = [
  { id: 'oil', label: 'Troca de Óleo', icon: 'fa-oil-can', color: 'text-amber-500' },
  { id: 'mechanic', label: 'Mecânica Geral', icon: 'fa-wrench', color: 'text-blue-500' },
  { id: 'electric', label: 'Elétrica', icon: 'fa-bolt', color: 'text-yellow-500' },
  { id: 'wash', label: 'Lavagem', icon: 'fa-soap', color: 'text-cyan-500' },
  { id: 'tires', label: 'Troca de Pneus', icon: 'fa-car-rear', color: 'text-emerald-500' },
  { id: 'other', label: 'Outros', icon: 'fa-gears', color: 'text-slate-500' },
];

const FleetManager: React.FC = () => {
  const { vehicles, maintenanceRecords, addMaintenanceRecord, resolveMaintenance, addVehicle, updateVehicle, scheduledTrips } = useFleet();
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Estados para Fechamento de Manutenção
  const [resolvingMaintenance, setResolvingMaintenance] = useState<{record: MaintenanceRecord | null, vehicleId: string} | null>(null);
  const [resolveKm, setResolveKm] = useState<number>(0);
  const [resolveCost, setResolveCost] = useState<string>('');
  const [resolveDate, setResolveDate] = useState(new Date().toISOString().slice(0, 16));
  const [checkedItems, setCheckedItems] = useState<string[]>([]);

  const [newRecord, setNewRecord] = useState({
    vehicleId: '',
    date: new Date().toISOString().split('T')[0],
    returnDate: '', 
    serviceType: '',
    cost: '',
    km: '',
    notes: '',
    categories: [] as string[],
    tireBrand: '',
    tireModel: '',
    selectedTires: [] as string[]
  });

  const [newVehicle, setNewVehicle] = useState({
    plate: '',
    brand: '',
    model: '',
    year: new Date().getFullYear().toString(),
    currentKm: '',
    fuelLevel: '100',
    fuelType: 'Flex' as Vehicle['fuelType']
  });

  const toggleCategorySelection = (catId: string) => {
    setNewRecord(prev => ({
      ...prev,
      categories: prev.categories.includes(catId)
        ? prev.categories.filter(id => id !== catId)
        : [...prev.categories, catId]
    }));
  };

  const handleOpenResolve = (vId: string) => {
    const record = maintenanceRecords.find(r => r.vehicleId === vId && !r.returnDate);
    const vehicle = vehicles.find(v => v.id === vId);
    if (record) {
      setResolvingMaintenance({ record, vehicleId: vId });
      setResolveKm(vehicle?.currentKm || 0);
      setResolveCost(record.cost > 0 ? record.cost.toString() : '');
      setCheckedItems([]); // Reseta o checklist
    }
  };

  const toggleChecklistItem = (catId: string) => {
    setCheckedItems(prev => 
      prev.includes(catId) ? prev.filter(i => i !== catId) : [...prev, catId]
    );
  };

  const handleSubmitMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    if (!newRecord.vehicleId) {
      setFormError("Por favor, selecione um veículo.");
      return;
    }

    const tripConflict = scheduledTrips.find(trip => 
      trip.vehicleId === newRecord.vehicleId && 
      trip.scheduledDate === newRecord.date
    );

    if (tripConflict) {
      const formattedDate = new Date(newRecord.date + 'T12:00:00').toLocaleDateString('pt-BR');
      setFormError(`CONFLITO OPERACIONAL: O veículo selecionado já possui uma viagem agendada para o dia ${formattedDate} (Destino: ${tripConflict.destination}). Libere a agenda antes de abrir manutenção.`);
      return;
    }

    if (newRecord.categories.length === 0) {
      setFormError("Selecione ao menos uma categoria de serviço.");
      return;
    }

    const categoryLabels = newRecord.categories.map(catId => {
      if (catId === 'other') return newRecord.serviceType || 'Outros';
      return MAINTENANCE_CATEGORIES.find(c => c.id === catId)?.label || '';
    }).filter(label => label !== '');

    const finalServiceType = categoryLabels.join(', ');
    const costVal = newRecord.cost ? parseFloat(newRecord.cost) : 0;
    const kmVal = parseInt(newRecord.km);

    if (newRecord.categories.includes('other') && !newRecord.serviceType.trim()) {
      setFormError("O tipo de serviço 'Outros' deve ser descrito.");
      return;
    }

    setIsSubmitting(true);
    try {
      const record: MaintenanceRecord = {
        id: `maint-${Math.random().toString(36).substr(2, 9)}`,
        vehicleId: newRecord.vehicleId,
        date: newRecord.date,
        serviceType: finalServiceType,
        cost: costVal,
        km: kmVal,
        notes: newRecord.notes.trim(),
        categories: newRecord.categories
      };

      await addMaintenanceRecord(record);
      
      setNewRecord({ 
        vehicleId: '', 
        date: new Date().toISOString().split('T')[0], 
        returnDate: '', 
        serviceType: '', 
        cost: '', 
        km: '', 
        notes: '', 
        categories: [], 
        tireBrand: '', 
        tireModel: '', 
        selectedTires: [] 
      });
      setShowMaintenanceForm(false);
      alert('Ordem de Manutenção aberta!');
    } catch (error) {
      setFormError("Erro ao salvar registro técnico.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingMaintenance?.record) return;

    const allChecked = (resolvingMaintenance.record.categories || []).every(cat => checkedItems.includes(cat));
    
    if (!allChecked) {
      alert("Por favor, verifique e marque todos os itens do checklist antes de liberar o veículo.");
      return;
    }

    setIsSubmitting(true);
    try {
      await resolveMaintenance(
        resolvingMaintenance.vehicleId, 
        resolvingMaintenance.record.id, 
        resolveKm, 
        resolveDate, 
        resolveCost ? parseFloat(resolveCost) : undefined
      );
      setResolvingMaintenance(null);
      alert("Veículo liberado e histórico atualizado.");
    } catch (error) {
      alert('Erro ao liberar veículo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.plate.toLowerCase().includes(searchTerm.toLowerCase()) || v.model.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Manutenção & Ativos</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Controle Técnico da Frota</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setFormError(null); setShowMaintenanceForm(!showMaintenanceForm); setShowVehicleForm(false); }} className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all ${showMaintenanceForm ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>
            <i className="fas fa-screwdriver-wrench"></i> Manutenção
          </button>
          <button onClick={() => { setFormError(null); setShowVehicleForm(!showVehicleForm); setShowMaintenanceForm(false); }} className="bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-blue-700 flex items-center gap-2 shadow-lg transition-all">
            <i className="fas fa-plus"></i> Veículo
          </button>
        </div>
      </div>

      {showMaintenanceForm && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 animate-in fade-in slide-in-from-top-4">
          <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-8">Abertura de Chamado Técnico</h3>
          {formError && (
            <div className="mb-6 p-5 bg-red-50 text-red-600 rounded-2xl text-[10px] font-bold uppercase flex items-center gap-3 border border-red-100">
              <i className="fas fa-exclamation-circle text-lg"></i>
              <span>{formError}</span>
            </div>
          )}
          <form onSubmit={handleSubmitMaintenance} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Veículo</label>
                <select required value={newRecord.vehicleId} onChange={(e) => setNewRecord({ ...newRecord, vehicleId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none">
                  <option value="">Selecione um veículo...</option>
                  {vehicles.map(v => (<option key={v.id} value={v.id}>{v.plate} - {v.model}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Data Entrada</label>
                <input required type="date" value={newRecord.date} onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-write text-slate-400 uppercase mb-4 tracking-widest font-bold">Categorias de Serviço Requerido</label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {MAINTENANCE_CATEGORIES.map(cat => (
                  <button key={cat.id} type="button" onClick={() => toggleCategorySelection(cat.id)} className={`flex flex-col items-center justify-center gap-3 p-5 rounded-3xl border-2 transition-all ${newRecord.categories.includes(cat.id) ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}>
                    <i className={`fas ${cat.icon} text-2xl ${newRecord.categories.includes(cat.id) ? 'text-white' : cat.color}`}></i>
                    <span className="text-[9px] font-write uppercase text-center">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-50">
               <button type="submit" disabled={isSubmitting} className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-write uppercase text-xs shadow-xl disabled:opacity-50">
                 {isSubmitting ? 'Processando...' : 'Abrir Ordem'}
               </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-wrap gap-4 items-center justify-between">
           <div className="relative w-full md:w-64">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
              <input type="text" placeholder="Buscar veículo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-xs font-bold outline-none" />
           </div>
           <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="p-3 bg-slate-50 border-none rounded-2xl text-[10px] font-bold uppercase outline-none">
              <option value="ALL">Todos Status</option>
              <option value={VehicleStatus.AVAILABLE}>Disponível</option>
              <option value={VehicleStatus.IN_USE}>Em Uso</option>
              <option value={VehicleStatus.MAINTENANCE}>Manutenção</option>
           </select>
        </div>
        <div className="divide-y divide-slate-50">
           {filteredVehicles.map(v => (
             <div key={v.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-all">
                <div className="flex items-center gap-6">
                   <div className="w-20 h-20 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col items-center justify-center font-write shrink-0">
                      <span className="text-[8px] text-slate-400 uppercase tracking-widest mb-1">Placa</span>
                      <span className="text-sm text-slate-900">{v.plate}</span>
                   </div>
                   <div>
                      <h4 className="font-write text-lg text-slate-800 uppercase tracking-tight">{v.model}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{v.brand} • {v.year}</p>
                   </div>
                </div>
                <div className="flex items-center gap-4">
                   <span className={`px-4 py-1.5 rounded-full text-[9px] font-write uppercase tracking-widest border ${
                     v.status === VehicleStatus.AVAILABLE ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                     v.status === VehicleStatus.IN_USE ? 'bg-blue-50 text-blue-600 border-blue-100' :
                     'bg-amber-50 text-amber-600 border-amber-100'
                   }`}>
                      {v.status === VehicleStatus.AVAILABLE ? 'Disponível' : v.status === VehicleStatus.IN_USE ? 'Em Rota' : 'Manutenção'}
                   </span>
                   {v.status === VehicleStatus.MAINTENANCE && (
                      <button onClick={() => handleOpenResolve(v.id)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[9px] font-write uppercase tracking-widest shadow-md">Liberar</button>
                   )}
                </div>
             </div>
           ))}
        </div>
      </div>

      {/* Modal de Liberação com Checklist Dinâmico */}
      {resolvingMaintenance?.record && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl p-10 space-y-8 animate-in zoom-in-95 overflow-y-auto max-h-[90vh] custom-scrollbar">
            <div className="text-center">
               <h3 className="text-2xl font-write uppercase text-slate-800 tracking-tight">Fechamento de Ordem de Serviço</h3>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Checklist de Verificação de Itens</p>
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] font-write text-slate-400 uppercase tracking-[0.2em] font-bold">Validar Execução dos Serviços:</label>
              <div className="grid grid-cols-1 gap-3">
                {(resolvingMaintenance.record.categories || []).map(catId => {
                  const catInfo = MAINTENANCE_CATEGORIES.find(c => c.id === catId);
                  const isChecked = checkedItems.includes(catId);
                  return (
                    <button 
                      key={catId} 
                      type="button"
                      onClick={() => toggleChecklistItem(catId)}
                      className={`flex items-center justify-between p-5 rounded-3xl border-2 transition-all ${isChecked ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                    >
                      <div className="flex items-center gap-4">
                        <i className={`fas ${catInfo?.icon || 'fa-tools'} text-xl`}></i>
                        <span className="text-[11px] font-write uppercase">{catInfo?.label || 'Outros'}</span>
                      </div>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isChecked ? 'bg-emerald-500 text-white' : 'bg-white border-2 border-slate-200'}`}>
                        {isChecked && <i className="fas fa-check text-xs"></i>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleResolveMaintenance} className="space-y-6 pt-6 border-t border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Quilometragem de Retorno</label>
                  <input required type="number" value={resolveKm} onChange={(e) => setResolveKm(parseInt(e.target.value) || 0)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Custo Total (R$)</label>
                  <input required type="number" step="0.01" value={resolveCost} onChange={(e) => setResolveCost(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" />
                </div>
              </div>
              
              <div className="flex gap-4">
                <button type="button" onClick={() => setResolvingMaintenance(null)} className="flex-1 py-5 text-slate-400 font-write uppercase text-[10px] tracking-widest font-bold">Cancelar</button>
                <button 
                  type="submit" 
                  disabled={isSubmitting || (resolvingMaintenance.record.categories || []).some(cat => !checkedItems.includes(cat))}
                  className="flex-[2] py-5 bg-emerald-600 text-white rounded-2xl font-write uppercase text-[11px] tracking-widest shadow-xl disabled:opacity-20 transition-all active:scale-95"
                >
                  Confirmar e Liberar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetManager;
