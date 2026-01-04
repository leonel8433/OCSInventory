
import React, { useState, useMemo } from 'react';
import { useFleet } from '../context/FleetContext';
import { VehicleStatus, MaintenanceRecord, Vehicle } from '../types';

const FleetManager: React.FC = () => {
  const { vehicles, maintenanceRecords, checklists, addMaintenanceRecord, updateMaintenanceRecord, resolveMaintenance, addVehicle, updateVehicle, resetDatabase } = useFleet();
  const [showMaintenanceForm, setShowMaintenanceForm] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null);
  const [expandedTiresId, setExpandedTiresId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal para finalizar manutenção
  const [resolvingMaintenance, setResolvingMaintenance] = useState<{recordId: string | null, vehicleId: string} | null>(null);
  const [resolveKm, setResolveKm] = useState<number>(0);
  const [resolveCost, setResolveCost] = useState<string>('');
  const [resolveDate, setResolveDate] = useState(new Date().toISOString().slice(0, 16));

  // Estado para edição de registro histórico
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null);

  const [newRecord, setNewRecord] = useState({
    vehicleId: '',
    date: new Date().toISOString().split('T')[0],
    returnDate: '', 
    serviceType: '',
    cost: '',
    km: '',
    notes: '',
    isTireChange: false,
    tireBrand: '',
    tireModel: ''
  });

  const [newVehicle, setNewVehicle] = useState({
    plate: '',
    brand: '',
    model: '',
    year: new Date().getFullYear().toString(),
    currentKm: '',
    fuelLevel: '100',
    fuelType: 'Diesel' as Vehicle['fuelType']
  });

  const handleResetDatabase = () => {
    const confirm1 = window.confirm("ATENÇÃO: Isso apagará permanentemente todos os veículos, motoristas, viagens e histórico de manutenção. Deseja continuar?");
    if (confirm1) {
      const confirm2 = window.confirm("TEM CERTEZA? Esta ação não pode ser desfeita e o sistema voltará às configurações de fábrica.");
      if (confirm2) {
        resetDatabase();
      }
    }
  };

  const startMaintenanceForVehicle = (vehicle: Vehicle) => {
    setNewRecord({
      ...newRecord,
      vehicleId: vehicle.id,
      km: vehicle.currentKm.toString(),
      isTireChange: false,
      serviceType: ''
    });
    setFormError(null);
    setShowMaintenanceForm(true);
    setShowVehicleForm(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    const selectedVehicleId = newRecord.vehicleId;
    const finalServiceType = newRecord.isTireChange ? 'Troca de Pneus' : newRecord.serviceType.trim();
    const costVal = newRecord.cost ? parseFloat(newRecord.cost) : 0;
    const kmVal = parseInt(newRecord.km);

    if (!selectedVehicleId) {
      setFormError("Por favor, selecione um veículo para manutenção.");
      return;
    }
    if (!finalServiceType) {
      setFormError("O tipo de serviço deve ser informado.");
      return;
    }
    if (isNaN(kmVal)) {
      setFormError("A quilometragem atual deve ser um número válido.");
      return;
    }

    setIsSubmitting(true);
    try {
      let finalNotes = newRecord.notes.trim();
      if (newRecord.isTireChange) {
        const tireDetails = `Pneus: ${newRecord.tireBrand || 'N/A'} ${newRecord.tireModel || 'N/A'}`;
        finalNotes = finalNotes ? `${tireDetails} | ${finalNotes}` : tireDetails;
      }

      const record: MaintenanceRecord = {
        id: `maint-${Math.random().toString(36).substr(2, 9)}`,
        vehicleId: selectedVehicleId,
        date: newRecord.date,
        returnDate: newRecord.returnDate || undefined,
        serviceType: finalServiceType,
        cost: costVal,
        km: kmVal,
        notes: finalNotes
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
        isTireChange: false, 
        tireBrand: '', 
        tireModel: '' 
      });
      setShowMaintenanceForm(false);
      alert('Manutenção registrada com sucesso!');
    } catch (error) {
      setFormError("Ocorreu um erro ao salvar o registro técnico.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    
    if (!newVehicle.plate || !newVehicle.brand || !newVehicle.model) {
      setFormError("Preencha todos os campos obrigatórios.");
      return;
    }

    const normalizedPlate = newVehicle.plate.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
    
    const plateExists = vehicles.some(v => 
      v.plate.toUpperCase().replace(/[^A-Z0-9]/g, '').trim() === normalizedPlate && v.id !== editingVehicleId
    );

    if (plateExists) {
      setFormError(`CONFLITO DE PLACA: Já existe um veículo registrado com a identificação "${normalizedPlate}".`);
      return;
    }

    setIsSubmitting(true);
    try {
      const vehicleData = {
        plate: normalizedPlate,
        brand: newVehicle.brand,
        model: newVehicle.model,
        year: parseInt(newVehicle.year),
        currentKm: parseInt(newVehicle.currentKm) || 0,
        fuelType: newVehicle.fuelType,
        fuelLevel: parseInt(newVehicle.fuelLevel) || 100
      };

      if (editingVehicleId) {
        await updateVehicle(editingVehicleId, vehicleData);
        alert('Veículo atualizado com sucesso!');
      } else {
        const vehicle: Vehicle = {
          id: Math.random().toString(36).substr(2, 9),
          ...vehicleData,
          status: VehicleStatus.AVAILABLE
        };
        await addVehicle(vehicle);
        alert('Veículo integrado à frota com sucesso!');
      }

      setNewVehicle({ plate: '', brand: '', model: '', year: new Date().getFullYear().toString(), currentKm: '', fuelLevel: '100', fuelType: 'Diesel' });
      setShowVehicleForm(false);
      setEditingVehicleId(null);
    } catch (error) {
      setFormError("Erro ao processar os dados do veículo. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setNewVehicle({ 
      plate: vehicle.plate, 
      brand: vehicle.brand, 
      model: vehicle.model, 
      year: vehicle.year.toString(), 
      currentKm: vehicle.currentKm.toString(), 
      fuelLevel: vehicle.fuelLevel.toString(), 
      fuelType: vehicle.fuelType 
    });
    setFormError(null);
    setEditingVehicleId(vehicle.id);
    setShowVehicleForm(true);
    setShowMaintenanceForm(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResolveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingMaintenance) return;
    
    setIsSubmitting(true);
    try {
      await resolveMaintenance(
        resolvingMaintenance.vehicleId,
        resolvingMaintenance.recordId || '',
        resolveKm,
        resolveDate,
        resolveCost ? parseFloat(resolveCost) : undefined
      );
      setResolvingMaintenance(null);
      setResolveCost('');
      setResolveKm(0);
      alert('Veículo liberado com sucesso!');
    } catch (error) {
      console.error("Erro ao liberar veículo:", error);
      alert('Erro ao liberar veículo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    
    setIsSubmitting(true);
    try {
      await updateMaintenanceRecord(editingRecord.id, editingRecord);
      setEditingRecord(null);
      alert('Registro histórico atualizado com sucesso!');
    } catch (error) {
      console.error("Erro ao atualizar registro:", error);
      alert('Erro ao atualizar registro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.plate.toLowerCase().includes(searchTerm.toLowerCase()) || v.model.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getTireDetails = (notes: string) => {
    if (!notes || !notes.startsWith('Pneus:')) return { brand: 'N/A', model: 'N/A' };
    const parts = notes.split('|')[0].replace('Pneus:', '').trim().split(' ');
    return {
      brand: parts[0] || 'N/A',
      model: parts.slice(1).join(' ') || 'N/A'
    };
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gestão da Frota</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Controle de Ativos e Manutenções</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setFormError(null); setShowMaintenanceForm(!showMaintenanceForm); setShowVehicleForm(false); setEditingVehicleId(null); }} className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all ${showMaintenanceForm ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>
            <i className={`fas ${showMaintenanceForm ? 'fa-times' : 'fa-wrench'}`}></i> 
            {showMaintenanceForm ? 'Cancelar' : 'Registrar Manutenção'}
          </button>
          <button onClick={() => { setFormError(null); setShowVehicleForm(!showVehicleForm); setShowMaintenanceForm(false); setEditingVehicleId(null); }} className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all ${showVehicleForm ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
            <i className={`fas ${showVehicleForm ? 'fa-times' : (editingVehicleId ? 'fa-edit' : 'fa-plus')}`}></i> 
            {showVehicleForm ? 'Cancelar' : (editingVehicleId ? 'Editar Veículo' : 'Novo Veículo')}
          </button>
        </div>
      </div>

      {showVehicleForm && (
        <div className={`bg-white p-8 rounded-[2.5rem] shadow-xl border animate-in fade-in slide-in-from-top-4 duration-300 ${formError ? 'border-red-200 ring-4 ring-red-50' : 'border-slate-100'}`}>
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest">
              {editingVehicleId ? 'Edição de Veículo' : 'Inclusão de Ativo na Frota'}
            </h3>
            {editingVehicleId && <span className="text-[10px] bg-blue-100 text-blue-600 px-3 py-1 rounded-full font-bold uppercase">ID: {editingVehicleId}</span>}
          </div>

          {formError && (
            <div className="mb-8 p-5 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-4 animate-in slide-in-from-left-2">
              <div className="w-10 h-10 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center shrink-0">
                <i className="fas fa-triangle-exclamation"></i>
              </div>
              <p className="text-xs font-bold text-red-800 uppercase tracking-tight leading-relaxed">{formError}</p>
            </div>
          )}

          <form onSubmit={handleSubmitVehicle} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="relative">
              <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Placa Identificadora</label>
              <div className="relative">
                <i className={`fas fa-id-card absolute left-4 top-1/2 -translate-y-1/2 ${formError?.includes('PLACA') ? 'text-red-400' : 'text-slate-300'}`}></i>
                <input 
                  required 
                  placeholder="ABC-1234" 
                  value={newVehicle.plate} 
                  onChange={(e) => { 
                    setNewVehicle({ ...newVehicle, plate: e.target.value.toUpperCase() });
                    if(formError) setFormError(null);
                  }} 
                  className={`w-full p-4 pl-12 bg-slate-50 border rounded-2xl text-slate-950 font-bold focus:ring-2 outline-none transition-all ${formError?.includes('PLACA') ? 'border-red-300 bg-red-50' : 'border-slate-200 focus:ring-blue-500'}`} 
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Marca / Fabricante</label>
              <input required placeholder="Ex: Scania, Volvo..." value={newVehicle.brand} onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Modelo</label>
              <input required placeholder="Ex: R450 6x2" value={newVehicle.model} onChange={(e) => setNewVehicle({ ...newVehicle, model: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Ano de Fabricação</label>
              <input required type="number" placeholder="2024" value={newVehicle.year} onChange={(e) => setNewVehicle({ ...newVehicle, year: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Odômetro Atual (KM)</label>
              <input required type="number" placeholder="0" value={newVehicle.currentKm} onChange={(e) => setNewVehicle({ ...newVehicle, currentKm: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Matriz Energética</label>
              <select required value={newVehicle.fuelType} onChange={(e) => setNewVehicle({ ...newVehicle, fuelType: e.target.value as Vehicle['fuelType'] })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="Diesel">Diesel</option>
                <option value="Gasolina">Gasolina</option>
                <option value="Flex">Flex</option>
                <option value="Elétrico">Elétrico</option>
                <option value="GNV">GNV</option>
              </select>
            </div>
            <div className="md:col-span-2 lg:col-span-3 pt-6 flex justify-end gap-3">
              <button type="button" onClick={() => { setShowVehicleForm(false); setEditingVehicleId(null); setFormError(null); }} className="px-8 py-5 text-slate-400 font-write uppercase text-[10px] tracking-widest">Descartar</button>
              <button type="submit" disabled={isSubmitting} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl hover:bg-blue-900 transition-all active:scale-95 disabled:opacity-50">
                {isSubmitting ? 'Processando...' : (editingVehicleId ? 'Salvar Alterações' : 'Finalizar Cadastro')}
              </button>
            </div>
          </form>
        </div>
      )}

      {showMaintenanceForm && (
        <div className={`bg-white p-8 rounded-[2.5rem] shadow-xl border animate-in fade-in slide-in-from-top-4 duration-300 ${formError ? 'border-red-200' : 'border-slate-100'}`}>
          <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-8">Abertura de Ordem Técnica</h3>
          
          {formError && (
            <div className="mb-8 p-5 bg-red-50 border border-red-100 rounded-3xl flex items-center gap-4">
              <i className="fas fa-exclamation-circle text-red-500"></i>
              <p className="text-xs font-bold text-red-800 uppercase tracking-tight leading-relaxed">{formError}</p>
            </div>
          )}

          <form onSubmit={handleSubmitMaintenance} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Veículo Destinado</label><select required value={newRecord.vehicleId} onChange={(e) => setNewRecord({ ...newRecord, vehicleId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none"><option value="">Selecione...</option>{vehicles.filter(v => v.status === VehicleStatus.AVAILABLE || v.id === newRecord.vehicleId).map(v => (<option key={v.id} value={v.id}>{v.plate} - {v.model}</option>))}</select></div>
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Tipo de Serviço</label>{!newRecord.isTireChange ? (<input required={!newRecord.isTireChange} type="text" placeholder="Ex: Revisão de Motor" value={newRecord.serviceType} onChange={(e) => setNewRecord({ ...newRecord, serviceType: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" />) : (<div className="w-full p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-600 font-bold text-xs flex items-center gap-2"><i className="fas fa-circle-check"></i> Troca de Pneus</div>)}</div>
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Recurso Específico</label><button type="button" onClick={() => setNewRecord(prev => ({ ...prev, isTireChange: !prev.isTireChange, serviceType: !prev.isTireChange ? 'Troca de Pneus' : '' }))} className={`w-full p-4 border rounded-2xl font-bold text-[10px] uppercase transition-all flex items-center justify-center gap-2 ${newRecord.isTireChange ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:border-emerald-200'}`}><i className="fas fa-car-rear"></i> {newRecord.isTireChange ? 'Recurso Ativo' : 'Troca de Pneus'}</button></div>
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Data de Entrada</label><input required type="date" value={newRecord.date} onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" /></div>
            </div>
            {newRecord.isTireChange && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-emerald-50 p-6 rounded-[2rem] border border-emerald-100 animate-in slide-in-from-left-4 duration-300">
                <div><label className="block text-[10px] font-write text-emerald-800 uppercase mb-2">Marca</label><input required={newRecord.isTireChange} placeholder="Ex: Michelin" value={newRecord.tireBrand} onChange={(e) => setNewRecord({ ...newRecord, tireBrand: e.target.value })} className="w-full p-4 bg-white border border-emerald-200 rounded-2xl text-slate-950 font-bold focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
                <div><label className="block text-[10px] font-write text-emerald-800 uppercase mb-2">Modelo</label><input required={newRecord.isTireChange} placeholder="Ex: Primacy 4" value={newRecord.tireModel} onChange={(e) => setNewRecord({ ...newRecord, tireModel: e.target.value })} className="w-full p-4 bg-white border border-emerald-200 rounded-2xl text-slate-950 font-bold focus:ring-2 focus:ring-emerald-500 outline-none" /></div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Odômetro de Entrada</label><input required type="number" value={newRecord.km} onChange={(e) => setNewRecord({ ...newRecord, km: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Prev. Retorno</label><input type="date" value={newRecord.returnDate} onChange={(e) => setNewRecord({ ...newRecord, returnDate: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Orçamento Est. (R$)</label><input type="number" step="0.01" value={newRecord.cost} onChange={(e) => setNewRecord({ ...newRecord, cost: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none" /></div>
              <div className="md:col-span-3"><label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Diagnóstico Prévio / Observações</label><textarea value={newRecord.notes} onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-950 font-bold focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"></textarea></div>
              <div className="md:col-span-3 flex justify-end">
                <button type="submit" disabled={isSubmitting} className="bg-slate-900 text-white px-12 py-5 rounded-2xl font-write uppercase text-xs tracking-widest hover:bg-slate-800 transition-all shadow-xl disabled:opacity-50">
                  {isSubmitting ? 'Gravando...' : 'Confirmar Ordem de Serviço'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {resolvingMaintenance && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 bg-slate-800 text-white text-center">
              <h3 className="text-xl font-write uppercase tracking-tight">
                {resolvingMaintenance.recordId ? 'Fechamento de OS' : 'Liberação Emergencial'}
              </h3>
            </div>
            <form onSubmit={handleResolveMaintenance} className="p-10 space-y-6">
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-4 text-center tracking-widest font-bold">Odômetro de Saída</label>
                <input type="number" required value={resolveKm} onChange={(e) => setResolveKm(parseInt(e.target.value))} className="w-full p-5 bg-slate-50 border border-slate-200 rounded-3xl focus:ring-4 focus:ring-blue-100 outline-none font-write text-3xl text-slate-800 text-center shadow-inner" />
              </div>
              
              {resolvingMaintenance.recordId && (
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2 text-center tracking-widest font-bold">Custo Final da OS (R$)</label>
                  <input type="number" step="0.01" value={resolveCost} onChange={(e) => setResolveCost(e.target.value)} className="w-full p-4 bg-emerald-50 border border-emerald-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-emerald-800 text-center text-lg" />
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setResolvingMaintenance(null)} className="flex-1 py-5 text-slate-400 font-write uppercase text-[10px] tracking-widest">Voltar</button>
                <button type="submit" disabled={isSubmitting} className="flex-[2] py-5 bg-emerald-600 text-white rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl shadow-emerald-100 disabled:opacity-50 transition-all active:scale-95">
                  {isSubmitting ? 'Processando...' : 'Liberar Veículo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 bg-slate-900 text-white text-center">
              <h3 className="text-xl font-write uppercase tracking-tight">Editar Registro Histórico</h3>
            </div>
            <form onSubmit={handleUpdateRecord} className="p-10 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Serviço Realizado</label>
                  <input type="text" required value={editingRecord.serviceType} onChange={(e) => setEditingRecord({...editingRecord, serviceType: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-950 font-bold outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Entrada</label>
                  <input type="date" required value={editingRecord.date} onChange={(e) => setEditingRecord({...editingRecord, date: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-950 font-bold outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Retorno</label>
                  <input type="date" value={editingRecord.returnDate || ''} onChange={(e) => setEditingRecord({...editingRecord, returnDate: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-950 font-bold outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Valor Pago (R$)</label>
                  <input type="number" step="0.01" value={editingRecord.cost} onChange={(e) => setEditingRecord({...editingRecord, cost: parseFloat(e.target.value) || 0})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-950 font-bold outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Odômetro (KM)</label>
                  <input type="number" value={editingRecord.km} onChange={(e) => setEditingRecord({...editingRecord, km: parseInt(e.target.value) || 0})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-950 font-bold outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Notas Técnicas</label>
                <textarea value={editingRecord.notes} onChange={(e) => setEditingRecord({...editingRecord, notes: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-950 font-bold outline-none min-h-[80px]"></textarea>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setEditingRecord(null)} className="flex-1 py-5 text-slate-400 font-write uppercase text-[10px] tracking-widest">Cancelar</button>
                <button type="submit" disabled={isSubmitting} className="flex-[2] py-5 bg-blue-600 text-white rounded-2xl font-write uppercase text-xs shadow-xl shadow-blue-100 disabled:opacity-50">
                  {isSubmitting ? 'Salvando...' : 'Atualizar Histórico'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex-1 relative">
          <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"></i>
          <input type="text" placeholder="Filtrar por placa ou modelo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-950 focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-write text-slate-700 uppercase outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer transition-all">
          <option value="ALL">Status: Todos</option>
          <option value={VehicleStatus.AVAILABLE}>Status: Livres</option>
          <option value={VehicleStatus.IN_USE}>Status: Operando</option>
          <option value={VehicleStatus.MAINTENANCE}>Status: Oficina</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredVehicles.length > 0 ? filteredVehicles.map(vehicle => {
          const vehicleMaintenances = maintenanceRecords.filter(m => m.vehicleId === vehicle.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          const lastTireChange = vehicleMaintenances.find(m => m.serviceType === 'Troca de Pneus');
          const tireInfo = lastTireChange ? getTireDetails(lastTireChange.notes) : null;
          
          const activeMaintenance = vehicle.status === VehicleStatus.MAINTENANCE ? vehicleMaintenances.find(m => !m.returnDate) : null;
          const isExpanded = expandedVehicleId === vehicle.id;
          const isTiresExpanded = expandedTiresId === vehicle.id;
          
          return (
            <div key={vehicle.id} className={`bg-white rounded-[2.5rem] shadow-sm border overflow-hidden flex flex-col hover:shadow-xl transition-all duration-300 animate-in fade-in zoom-in-95 ${vehicle.status === VehicleStatus.MAINTENANCE ? 'border-red-200 bg-red-50/10' : 'border-slate-100'}`}>
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex flex-col gap-1">
                    <span className="bg-slate-900 text-white px-4 py-1.5 rounded-xl font-mono text-xs font-write shadow-md tracking-widest">{vehicle.plate}</span>
                    <p className="text-[9px] font-write text-slate-400 uppercase tracking-widest mt-1">{vehicle.brand}</p>
                  </div>
                  <span className={`text-[9px] font-write px-4 py-1.5 rounded-full uppercase tracking-widest border-2 shadow-sm ${
                    vehicle.status === VehicleStatus.AVAILABLE ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                    vehicle.status === VehicleStatus.IN_USE ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                    'bg-red-50 text-red-600 border-red-100 animate-pulse'
                  }`}>
                    {vehicle.status === VehicleStatus.AVAILABLE ? 'Disponível' : vehicle.status === VehicleStatus.IN_USE ? 'Em Rota' : 'Oficina'}
                  </span>
                </div>
                
                <h4 className="text-xl font-write text-slate-800 tracking-tight mb-6">{vehicle.model}</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[8px] font-write text-slate-400 uppercase mb-1 tracking-widest">Quilometragem</p>
                    <p className="text-sm font-write text-slate-800">{vehicle.currentKm.toLocaleString()} KM</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[8px] font-write text-slate-400 uppercase mb-1 tracking-widest">Fabricação/Comb.</p>
                    <p className="text-[10px] font-write text-slate-800">{vehicle.year} • {vehicle.fuelType}</p>
                  </div>
                </div>

                <div className="mt-8 flex gap-2 border-t border-slate-50 pt-8">
                  <button 
                    onClick={() => handleEditVehicle(vehicle)}
                    className="flex-1 bg-slate-50 text-slate-600 py-4 rounded-2xl text-[9px] font-write uppercase tracking-widest border border-slate-100 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 transition-all flex items-center justify-center gap-2"
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  
                  <button 
                    onClick={() => setExpandedTiresId(isTiresExpanded ? null : vehicle.id)}
                    className={`flex-1 py-4 rounded-2xl text-[9px] font-write uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${isTiresExpanded ? 'bg-blue-900 text-white border-blue-900 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-blue-50 hover:text-blue-600'}`}
                  >
                    <i className="fas fa-car-rear"></i> Pneus
                  </button>

                  {vehicle.status === VehicleStatus.MAINTENANCE && (
                    <button 
                      onClick={() => { 
                        setResolvingMaintenance({
                          recordId: activeMaintenance?.id || null, 
                          vehicleId: vehicle.id
                        }); 
                        setResolveKm(vehicle.currentKm); 
                      }}
                      className="flex-1 bg-red-600 text-white py-4 rounded-2xl text-[9px] font-write uppercase tracking-widest shadow-lg shadow-red-100 hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                    >
                      <i className="fas fa-check-double"></i> Liberar
                    </button>
                  )}
                  
                  <button 
                    onClick={() => setExpandedVehicleId(isExpanded ? null : vehicle.id)}
                    className={`flex-1 py-4 rounded-2xl text-[9px] font-write uppercase tracking-widest border transition-all flex items-center justify-center gap-2 ${isExpanded ? 'bg-slate-900 text-white border-slate-900 shadow-lg' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'}`}
                  >
                    <i className={`fas ${isExpanded ? 'fa-chevron-up' : 'fa-list-ul'}`}></i> Ver Tudo
                  </button>
                </div>
              </div>

              {isTiresExpanded && (
                <div className="px-8 pb-8 animate-in slide-in-from-top-4 duration-300">
                  <div className="bg-slate-800 rounded-3xl p-6 text-white shadow-inner relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-125 transition-transform">
                      <i className="fas fa-truck-monster text-7xl"></i>
                    </div>
                    {lastTireChange ? (
                      <div className="relative z-10 space-y-4">
                        <div className="flex justify-between items-center">
                          <h5 className="text-[10px] font-write text-blue-400 uppercase tracking-[0.2em]">Última Troca de Pneus</h5>
                          <span className="text-[9px] font-bold text-slate-400">{new Date(lastTireChange.date).toLocaleDateString()}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[8px] font-write text-slate-500 uppercase tracking-widest mb-1">Marca Registrada</p>
                            <p className="text-sm font-bold">{tireInfo?.brand}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-write text-slate-500 uppercase tracking-widest mb-1">Modelo Ativo</p>
                            <p className="text-sm font-bold">{tireInfo?.model}</p>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                          <span className="text-[9px] font-bold text-slate-500 uppercase">Odômetro na Troca</span>
                          <span className="text-[10px] font-write text-emerald-400">{lastTireChange.km.toLocaleString()} KM</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <i className="fas fa-triangle-exclamation text-amber-500 text-xl mb-2"></i>
                        <p className="text-[10px] font-write text-slate-400 uppercase tracking-widest">Sem registro de troca</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {isExpanded && (
                <div className="p-8 bg-slate-50 border-t border-slate-100 animate-in slide-in-from-top-4 duration-500">
                  <div className="space-y-8">
                    <div>
                      <h5 className="text-[9px] font-write text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <i className="fas fa-history text-blue-500"></i> Últimas Manutenções
                      </h5>
                      <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                        {vehicleMaintenances.length > 0 ? vehicleMaintenances.map(m => (
                          <div key={m.id} className="bg-white p-4 rounded-2xl border border-slate-100 text-[10px] font-bold text-slate-600 flex justify-between items-center shadow-sm relative group/item">
                            <div className="flex flex-col gap-1">
                              <span className="text-slate-800 text-[11px] uppercase tracking-tight">{m.serviceType}</span>
                              <div className="flex items-center gap-4 text-slate-400 font-medium">
                                <span><i className="fas fa-calendar-alt mr-1.5"></i>{new Date(m.date).toLocaleDateString()}</span>
                                {m.returnDate && (
                                  <span className="text-blue-600"><i className="fas fa-calendar-check mr-1.5"></i>{new Date(m.returnDate).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex items-center gap-4">
                              <div className="flex flex-col">
                                <span className="text-emerald-600 font-write">R$ {m.cost.toLocaleString()}</span>
                                <span className="text-slate-300 text-[9px]">{m.km.toLocaleString()} KM</span>
                              </div>
                              <button 
                                onClick={() => setEditingRecord(m)}
                                className="w-9 h-9 rounded-xl bg-slate-50 text-slate-300 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all opacity-0 group-hover/item:opacity-100"
                              >
                                <i className="fas fa-pencil-alt text-xs"></i>
                              </button>
                            </div>
                          </div>
                        )) : (
                          <div className="py-8 text-center bg-white/50 rounded-2xl border border-dashed border-slate-200">
                            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Sem histórico técnico</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {vehicle.lastChecklist && (
                      <div className="pt-6 border-t border-slate-200">
                        <h5 className="text-[9px] font-write text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <i className="fas fa-clipboard-check text-emerald-500"></i> Checklist de Saída
                        </h5>
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex justify-around">
                          <div className="flex flex-col items-center gap-2">
                             <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${vehicle.lastChecklist.oilChecked ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                               <i className="fas fa-oil-can text-sm"></i>
                             </div>
                             <span className="text-[8px] font-bold uppercase text-slate-400">Óleo</span>
                          </div>
                          <div className="flex flex-col items-center gap-2">
                             <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${vehicle.lastChecklist.waterChecked ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                               <i className="fas fa-tint text-sm"></i>
                             </div>
                             <span className="text-[8px] font-bold uppercase text-slate-400">Água</span>
                          </div>
                          <div className="flex flex-col items-center gap-2">
                             <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${vehicle.lastChecklist.tiresChecked ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                               <i className="fas fa-truck-front text-sm"></i>
                             </div>
                             <span className="text-[8px] font-bold uppercase text-slate-400">Pneus</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        }) : (
          <div className="lg:col-span-3 py-32 text-center bg-white rounded-[3rem] border-4 border-dashed border-slate-100">
             <i className="fas fa-car-side text-6xl text-slate-50 mb-6"></i>
             <p className="text-slate-300 font-write uppercase text-xs tracking-[0.4em]">Nenhum ativo localizado na frota</p>
          </div>
        )}
      </div>

      <div className="mt-20 pt-10 border-t border-slate-200">
        <div className="bg-red-50/50 rounded-[3rem] p-10 border border-red-100 relative overflow-hidden group">
          <div className="absolute -right-10 -bottom-10 opacity-5 group-hover:scale-125 transition-transform duration-700">
             <i className="fas fa-radiation-alt text-[15rem] text-red-900"></i>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 bg-red-100 text-red-600 rounded-[2rem] flex items-center justify-center text-3xl shadow-xl shadow-red-200/50">
                <i className="fas fa-biohazard"></i>
              </div>
              <div className="text-center md:text-left">
                <h3 className="text-xl font-write text-red-800 uppercase tracking-tight">Comando de Redefinição Global</h3>
                <p className="text-xs text-red-400 font-bold uppercase tracking-widest mt-1">Ação crítica: Apaga permanentemente todo o banco de dados local.</p>
              </div>
            </div>
            <button 
              onClick={handleResetDatabase}
              className="px-10 py-5 bg-red-600 text-white rounded-[2rem] font-write uppercase text-xs tracking-[0.2em] shadow-2xl shadow-red-200 hover:bg-red-700 hover:scale-105 active:scale-95 transition-all flex items-center gap-4"
            >
              <i className="fas fa-trash-can"></i>
              Resetar Sistema
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FleetManager;
