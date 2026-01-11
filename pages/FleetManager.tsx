
import React, { useState, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { VehicleStatus, MaintenanceRecord, Vehicle, TireChange } from '../types';

const MAINTENANCE_CATEGORIES = [
  { id: 'oil', label: 'Troca de Óleo', icon: 'fa-oil-can', color: 'text-amber-500', bg: 'bg-amber-50' },
  { id: 'mechanic', label: 'Mecânica Geral', icon: 'fa-wrench', color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'electric', label: 'Elétrica', icon: 'fa-bolt', color: 'text-yellow-500', bg: 'bg-yellow-50' },
  { id: 'wash', label: 'Lavagem', icon: 'fa-soap', color: 'text-cyan-500', bg: 'bg-cyan-50' },
  { id: 'tires', label: 'Troca de Pneus', icon: 'fa-car-rear', color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { id: 'other', label: 'Outros', icon: 'fa-gears', color: 'text-slate-500', bg: 'bg-slate-50' },
];

const FUEL_TYPES: Vehicle['fuelType'][] = ['Flex', 'Gasolina', 'Diesel', 'Etanol', 'GNV', 'Elétrico'];

const FleetManager: React.FC = () => {
  const { vehicles, maintenanceRecords, tireChanges, addTireChange, deleteTireChange, addMaintenanceRecord, resolveMaintenance, addVehicle, updateVehicle, scheduledTrips } = useFleet();
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [expandedVehicleTires, setExpandedVehicleTires] = useState<string | null>(null);
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
  const [closingNotes, setClosingNotes] = useState('');

  // Estados para nova troca de pneu
  const [newTire, setNewTire] = useState({
    date: new Date().toISOString().split('T')[0],
    brand: '',
    model: '',
    km: ''
  });

  const [newRecord, setNewRecord] = useState({
    vehicleId: '',
    date: new Date().toISOString().split('T')[0],
    serviceType: '',
    cost: '',
    km: '',
    notes: '',
    categories: [] as string[]
  });

  const initialVehicleState = {
    plate: '',
    brand: '',
    model: '',
    year: new Date().getFullYear().toString(),
    currentKm: '',
    fuelLevel: '100',
    fuelType: 'Flex' as Vehicle['fuelType']
  };

  const [newVehicle, setNewVehicle] = useState(initialVehicleState);

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.plate.toLowerCase().includes(searchTerm.toLowerCase()) || v.model.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const maintenanceConflict = useMemo(() => {
    if (!newRecord.vehicleId || !newRecord.date) return null;
    return scheduledTrips.find(trip => 
      trip.vehicleId === newRecord.vehicleId && 
      trip.scheduledDate === newRecord.date
    );
  }, [newRecord.vehicleId, newRecord.date, scheduledTrips]);

  const handleTireSubmit = async (vehicleId: string) => {
    if (!newTire.brand || !newTire.model || !newTire.km) {
      alert("Preencha Marca, Modelo e KM para registrar a troca.");
      return;
    }

    const tc: TireChange = {
      id: Math.random().toString(36).substr(2, 9),
      vehicleId,
      date: newTire.date,
      brand: newTire.brand,
      model: newTire.model,
      km: parseInt(newTire.km) || 0
    };

    await addTireChange(tc);
    setNewTire({
      date: new Date().toISOString().split('T')[0],
      brand: '',
      model: '',
      km: ''
    });
    alert('Troca de pneu registrada!');
  };

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
      setCheckedItems([]); 
      setClosingNotes('');
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
    if (!newRecord.vehicleId) { setFormError("Por favor, selecione um veículo."); return; }
    if (maintenanceConflict) { setFormError("Conflito de Operação: Este veículo já possui uma viagem agendada para esta data."); return; }
    if (newRecord.categories.length === 0) { setFormError("Selecione ao menos uma categoria de serviço."); return; }

    const categoryLabels = newRecord.categories.map(catId => {
      if (catId === 'other') return newRecord.serviceType || 'Outros';
      return MAINTENANCE_CATEGORIES.find(c => c.id === catId)?.label || '';
    }).filter(label => label !== '');

    const finalServiceType = categoryLabels.join(', ');
    const costVal = newRecord.cost ? parseFloat(newRecord.cost) : 0;
    const kmVal = parseInt(newRecord.km) || 0;

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
      setNewRecord({ vehicleId: '', date: new Date().toISOString().split('T')[0], serviceType: '', cost: '', km: '', notes: '', categories: [] });
      setShowMaintenanceForm(false);
      alert('Ordem de Serviço (OS) aberta com sucesso!');
    } catch (error) {
      setFormError("Erro ao salvar registro técnico.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingMaintenance?.record) return;

    const requestedCategories = resolvingMaintenance.record.categories || [];
    const allChecked = requestedCategories.every(cat => checkedItems.includes(cat));

    if (!allChecked) {
      alert("⚠️ Pendência detectada: Todos os itens do checklist devem ser marcados como executados antes de liberar o veículo.");
      return;
    }

    if (resolveKm < resolvingMaintenance.record.km) {
      alert("⚠️ Erro de Odômetro: O KM de saída da oficina não pode ser menor que o KM de entrada.");
      return;
    }

    setIsSubmitting(true);
    try {
      await resolveMaintenance(
        resolvingMaintenance.vehicleId, 
        resolvingMaintenance.record.id, 
        resolveKm, 
        resolveDate, 
        resolveCost ? parseFloat(resolveCost) : undefined,
        closingNotes.trim()
      );
      setResolvingMaintenance(null);
      alert("✅ Veículo liberado para operação! Checklist arquivado no histórico.");
    } catch (error) {
      alert('Erro ao processar liberação do veículo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setNewVehicle({ plate: vehicle.plate, brand: vehicle.brand, model: vehicle.model, year: vehicle.year.toString(), currentKm: vehicle.currentKm.toString(), fuelLevel: vehicle.fuelLevel.toString(), fuelType: vehicle.fuelType });
    setEditingVehicleId(vehicle.id);
    setShowVehicleForm(true);
    setShowMaintenanceForm(false);
  };

  const handleSubmitVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    const normalizedPlate = newVehicle.plate.toUpperCase().replace(/\s/g, '');
    
    if (!normalizedPlate || !newVehicle.model || !newVehicle.currentKm) { 
      setFormError("Placa, Modelo e KM Atual são campos obrigatórios."); 
      return; 
    }

    // Validação de Duplicidade de Placa
    const plateExists = vehicles.some(v => 
      v.plate.toUpperCase().replace(/\s/g, '') === normalizedPlate && 
      v.id !== editingVehicleId
    );

    if (plateExists) {
      setFormError(`A placa ${normalizedPlate} já está vinculada a outro veículo da frota.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const vehicleData = { 
        plate: normalizedPlate, 
        brand: newVehicle.brand, 
        model: newVehicle.model, 
        year: parseInt(newVehicle.year) || new Date().getFullYear(), 
        currentKm: parseInt(newVehicle.currentKm) || 0, 
        fuelType: newVehicle.fuelType, 
        fuelLevel: parseInt(newVehicle.fuelLevel) || 100 
      };

      if (editingVehicleId) { 
        await updateVehicle(editingVehicleId, vehicleData); 
        alert('Dados do veículo atualizados com sucesso!'); 
      } 
      else { 
        const vehicle: Vehicle = { id: Math.random().toString(36).substr(2, 9), ...vehicleData, status: VehicleStatus.AVAILABLE }; 
        await addVehicle(vehicle); 
        alert('Veículo cadastrado e pronto para operação!'); 
      }
      setNewVehicle(initialVehicleState); 
      setShowVehicleForm(false); 
      setEditingVehicleId(null);
    } catch (error) { 
      setFormError("Erro ao salvar veículo no sistema."); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const progressPercentage = resolvingMaintenance?.record?.categories 
    ? Math.round((checkedItems.length / resolvingMaintenance.record.categories.length) * 100)
    : 0;

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Ativos & Manutenção</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Gestão de Disponibilidade e Custos Técnicos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setFormError(null); setShowMaintenanceForm(!showMaintenanceForm); setShowVehicleForm(false); }} className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all ${showMaintenanceForm ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>
            <i className="fas fa-screwdriver-wrench"></i> Nova Manutenção
          </button>
          <button onClick={() => { if(showVehicleForm) { setShowVehicleForm(false); setEditingVehicleId(null); setNewVehicle(initialVehicleState); } else { setFormError(null); setShowVehicleForm(true); setShowMaintenanceForm(false); } }} className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all ${showVehicleForm ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            <i className={`fas ${showVehicleForm ? 'fa-times' : 'fa-plus'}`}></i>
            {showVehicleForm ? 'Cancelar' : 'Cadastrar Ativo'}
          </button>
        </div>
      </div>

      {showMaintenanceForm && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600"><i className="fas fa-file-invoice"></i></div>
            <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest">Abertura de Ordem de Serviço</h3>
          </div>
          {formError && ( <div className="mb-6 p-5 bg-red-50 text-red-600 rounded-2xl text-[10px] font-bold uppercase flex items-center gap-3 border border-red-100 animate-in shake"> <i className="fas fa-exclamation-circle text-lg"></i> <div> <p>{formError}</p> </div> </div> )}
          <form onSubmit={handleSubmitMaintenance} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Veículo</label>
                <select required value={newRecord.vehicleId} onChange={(e) => setNewRecord({ ...newRecord, vehicleId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none">
                  <option value="">Selecione um veículo...</option>
                  {vehicles.filter(v => v.status === VehicleStatus.AVAILABLE).map(v => (<option key={v.id} value={v.id}>{v.plate} - {v.model}</option>))}
                </select>
              </div>
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Data</label><input required type="date" value={newRecord.date} onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" /></div>
            </div>

            <div className="space-y-4">
              <label className="block text-[10px] font-write text-slate-400 uppercase tracking-widest font-bold">Serviços Necessários:</label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {MAINTENANCE_CATEGORIES.map(cat => (
                  <button 
                    key={cat.id} 
                    type="button" 
                    onClick={() => toggleCategorySelection(cat.id)} 
                    className={`flex flex-col items-center justify-center gap-3 p-5 rounded-3xl border-2 transition-all ${newRecord.categories.includes(cat.id) ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                  >
                    <i className={`fas ${cat.icon} text-2xl ${newRecord.categories.includes(cat.id) ? 'text-white' : cat.color}`}></i>
                    <span className="text-[9px] font-write uppercase text-center">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Observações / Sintomas do Ativo</label>
              <textarea 
                required
                placeholder="Descreva o que foi relatado pelo motorista ou identificado na inspeção..."
                value={newRecord.notes}
                onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none min-h-[100px]"
              />
            </div>

            <div className="flex justify-end pt-6 border-t border-slate-50">
               <button type="submit" disabled={isSubmitting} className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-write uppercase text-xs shadow-xl active:scale-95 transition-all">{isSubmitting ? 'Processando...' : 'Abrir OS'}</button>
            </div>
          </form>
        </div>
      )}

      {showVehicleForm && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-blue-100 animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center"><i className="fas fa-truck-front"></i></div>
            <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest">{editingVehicleId ? 'Editar Ativo' : 'Novo Veículo'}</h3>
          </div>
          {formError && ( <div className="mb-6 p-5 bg-red-50 text-red-600 rounded-2xl text-[10px] font-bold uppercase flex items-center gap-3 border border-red-100 animate-in shake"> <i className="fas fa-exclamation-circle text-lg"></i> <div> <p>{formError}</p> </div> </div> )}
          <form onSubmit={handleSubmitVehicle} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Placa</label><input required placeholder="ABC-1234" value={newVehicle.plate} onChange={(e) => setNewVehicle({ ...newVehicle, plate: e.target.value.toUpperCase() })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" /></div>
            <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Marca</label><input required placeholder="Toyota" value={newVehicle.brand} onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" /></div>
            <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Modelo</label><input required placeholder="Corolla" value={newVehicle.model} onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" /></div>
            <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Ano</label><input required type="number" value={newVehicle.year} onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" /></div>
            <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">KM Inicial</label><input required type="number" value={newVehicle.currentKm} onChange={(e) => setNewVehicle({ ...newVehicle, currentKm: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" /></div>
            <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Combustível</label><select value={newVehicle.fuelType} onChange={(e) => setNewVehicle({ ...newVehicle, fuelType: e.target.value as any })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none">{FUEL_TYPES.map(type => <option key={type} value={type}>{type}</option>)}</select></div>
            <div className="md:col-span-3 flex justify-end gap-3 pt-6 border-t border-slate-50">
              <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-write uppercase text-xs shadow-xl hover:bg-blue-700 transition-all active:scale-95">{isSubmitting ? 'Salvando...' : 'Salvar Ativo'}</button>
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
             <div key={v.id} className="flex flex-col">
               <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition-all">
                  <div className="flex items-center gap-6">
                     <div className="w-20 h-20 rounded-2xl bg-white border border-slate-100 shadow-sm flex flex-col items-center justify-center font-write shrink-0">
                        <span className="text-[8px] text-slate-400 uppercase tracking-widest mb-1">Placa</span>
                        <span className="text-sm text-slate-900">{v.plate}</span>
                     </div>
                     <div>
                        <h4 className="font-write text-lg text-slate-800 uppercase tracking-tight">{v.model}</h4>
                        <div className="flex items-center gap-3 mt-1">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{v.brand} • {v.year}</p>
                          <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                          <p className="text-[10px] text-blue-600 font-bold uppercase">{v.currentKm} KM</p>
                        </div>
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
                     <div className="flex gap-2">
                       <button onClick={() => setExpandedVehicleTires(expandedVehicleTires === v.id ? null : v.id)} title="Histórico de Pneus" className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all border ${expandedVehicleTires === v.id ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                         <i className="fas fa-car-rear text-xs"></i>
                       </button>
                       <button onClick={() => handleEditVehicle(v)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all border border-slate-100">
                         <i className="fas fa-edit text-xs"></i>
                       </button>
                       {v.status === VehicleStatus.MAINTENANCE && (
                          <button onClick={() => handleOpenResolve(v.id)} className="bg-slate-900 text-white px-5 py-2.5 rounded-xl text-[10px] font-write uppercase tracking-widest shadow-lg">Liberar</button>
                       )}
                     </div>
                  </div>
               </div>

               {/* Expansão de Histórico de Pneus */}
               {expandedVehicleTires === v.id && (
                 <div className="p-8 bg-slate-50/80 border-t border-slate-100 animate-in slide-in-from-top-2 duration-300">
                    <div className="flex flex-col lg:flex-row gap-8">
                       <div className="flex-1 space-y-4">
                          <h5 className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-4">Histórico de Trocas</h5>
                          {tireChanges.filter(tc => tc.vehicleId === v.id).length > 0 ? (
                            <div className="space-y-2">
                               {tireChanges.filter(tc => tc.vehicleId === v.id).map(tc => (
                                 <div key={tc.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                                    <div className="flex items-center gap-4">
                                       <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                                          <i className="fas fa-car-rear text-xs"></i>
                                       </div>
                                       <div>
                                          <p className="text-xs font-bold text-slate-800 uppercase">{tc.brand} - {tc.model}</p>
                                          <p className="text-[9px] text-slate-400 font-bold uppercase">{new Date(tc.date + 'T12:00:00').toLocaleDateString()} • {tc.km} KM</p>
                                       </div>
                                    </div>
                                    <button onClick={() => { if(window.confirm('Excluir este registro?')) deleteTireChange(tc.id); }} className="text-[9px] font-bold text-slate-300 hover:text-red-500 uppercase tracking-widest">Excluir</button>
                                 </div>
                               ))}
                            </div>
                          ) : (
                            <div className="py-10 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
                               <p className="text-slate-300 font-bold text-[10px] uppercase">Nenhum registro de pneus</p>
                            </div>
                          )}
                       </div>

                       <div className="w-full lg:w-72 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                          <h5 className="text-[10px] font-write text-slate-400 uppercase tracking-widest mb-4">Registrar Troca</h5>
                          <div className="space-y-4">
                             <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Data</label>
                                <input type="date" value={newTire.date} onChange={(e) => setNewTire({...newTire, date: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none" />
                             </div>
                             <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Marca</label>
                                <input placeholder="Ex: Michelin" value={newTire.brand} onChange={(e) => setNewTire({...newTire, brand: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none" />
                             </div>
                             <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Modelo</label>
                                <input placeholder="Ex: Primacy 4" value={newTire.model} onChange={(e) => setNewTire({...newTire, model: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none" />
                             </div>
                             <div>
                                <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">KM Atual</label>
                                <input type="number" placeholder={v.currentKm.toString()} value={newTire.km} onChange={(e) => setNewTire({...newTire, km: e.target.value})} className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold outline-none" />
                             </div>
                             <button onClick={() => handleTireSubmit(v.id)} className="w-full py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-write uppercase tracking-widest shadow-lg active:scale-95 transition-all mt-2">Salvar Registro</button>
                          </div>
                       </div>
                    </div>
                 </div>
               )}
             </div>
           ))}
        </div>
      </div>

      {/* Modal Resolvendo Manutenção - Checklist de Validação */}
      {resolvingMaintenance?.record && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-10 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
               <div>
                  <h3 className="text-2xl font-write uppercase text-slate-800">Liberação OS</h3>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Protocolo: {resolvingMaintenance.record.id}</p>
               </div>
               <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Conclusão</span>
                  <div className="text-2xl font-write text-blue-600">{progressPercentage}%</div>
               </div>
            </div>

            <div className="p-10 space-y-8 overflow-y-auto custom-scrollbar flex-1">
              <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
                 <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest mb-2">Relato de Abertura:</p>
                 <p className="text-xs text-blue-800 italic leading-relaxed">"{resolvingMaintenance.record.notes}"</p>
              </div>

              <div className="space-y-4">
                <label className="block text-[10px] font-write text-slate-400 uppercase tracking-widest font-bold">Checklist de Conformidade:</label>
                <div className="grid grid-cols-1 gap-3">
                  {(resolvingMaintenance.record.categories || []).map(catId => (
                    <button 
                      key={catId} 
                      onClick={() => toggleChecklistItem(catId)}
                      className={`flex items-center justify-between p-5 rounded-2xl border-2 transition-all ${checkedItems.includes(catId) ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-100 text-slate-400'}`}
                    >
                      <div className="flex items-center gap-4">
                        <i className={`fas ${MAINTENANCE_CATEGORIES.find(c => c.id === catId)?.icon} text-lg`}></i>
                        <span className="text-[11px] font-write uppercase tracking-tight">{MAINTENANCE_CATEGORIES.find(c => c.id === catId)?.label || 'Serviço'}</span>
                      </div>
                      <i className={`fas ${checkedItems.includes(catId) ? 'fa-check-circle' : 'fa-circle'} text-xl`}></i>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                   <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Odômetro Saída</label>
                   <input 
                     type="number" 
                     value={resolveKm} 
                     onChange={(e) => setResolveKm(parseInt(e.target.value) || 0)}
                     className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none"
                   />
                </div>
                <div>
                   <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Custo Total (R$)</label>
                   <input 
                     type="number" 
                     value={resolveCost} 
                     onChange={(e) => setResolveCost(e.target.value)}
                     className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none"
                   />
                </div>
              </div>

              <div className="space-y-2">
                 <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Observações de Saída / Garantia</label>
                 <textarea 
                   placeholder="Informe detalhes sobre peças trocadas ou recomendações técnicas de uso..."
                   value={closingNotes}
                   onChange={(e) => setClosingNotes(e.target.value)}
                   className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none min-h-[80px]"
                 />
              </div>
            </div>

            <div className="p-8 bg-white border-t border-slate-100 flex gap-4">
              <button onClick={() => setResolvingMaintenance(null)} className="flex-1 py-4 text-slate-400 font-write uppercase text-[10px] tracking-widest">Cancelar</button>
              <button 
                onClick={handleResolveMaintenance}
                disabled={progressPercentage < 100 || isSubmitting}
                className={`flex-[2] py-4 rounded-xl font-write text-[10px] uppercase tracking-widest shadow-xl transition-all ${progressPercentage === 100 ? 'bg-blue-600 text-white active:scale-95' : 'bg-slate-100 text-slate-300'}`}
              >
                {isSubmitting ? 'Finalizando...' : 'Liberar Veículo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetManager;
