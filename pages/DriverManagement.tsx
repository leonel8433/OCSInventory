
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useFleet } from '../context/FleetContext';
import { Fine, Driver } from '../types';

const CNH_CATEGORIES = [
  { value: 'A', label: 'A (Moto)' },
  { value: 'B', label: 'B (Carro)' },
  { value: 'AB', label: 'AB (Moto e Carro)' },
  { value: 'C', label: 'C (Caminhão)' },
  { value: 'D', label: 'D (Ônibus)' },
  { value: 'E', label: 'E (Articulado)' },
];

const DriverManagement: React.FC = () => {
  const { drivers, vehicles, fines, addFine, addDriver, updateDriver, deleteDriver, deleteFine } = useFleet();
  const [showFineAlert, setShowFineAlert] = useState(false);
  const [showFineForm, setShowFineForm] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);
  const [driverSearchTerm, setDriverSearchTerm] = useState('');

  const initialFineState = {
    driverId: '',
    vehicleId: '',
    date: new Date().toISOString().split('T')[0],
    value: '',
    points: '',
    description: ''
  };

  const initialDriverState = {
    name: '',
    license: '',
    category: 'B',
    email: '',
    phone: '',
    company: '',
    notes: '',
    username: '',
    password: '',
    avatar: '',
    initialPoints: '0'
  };

  const [newFine, setNewFine] = useState(initialFineState);
  const [newDriver, setNewDriver] = useState(initialDriverState);

  const maskPhone = (value: string) => {
    const digits = value.replace(/\D/g, '');
    let masked = digits;
    if (digits.length <= 11) {
      if (digits.length > 0) masked = `(${digits.slice(0, 2)}`;
      if (digits.length > 2) masked += `) ${digits.slice(2, 7)}`;
      if (digits.length > 7) masked += `-${digits.slice(7, 11)}`;
    } else {
      masked = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
    }
    return masked;
  };

  const filteredDrivers = useMemo(() => {
    const term = driverSearchTerm.toLowerCase();
    return drivers.filter(d => 
      d.username !== 'admin' && (
        d.name.toLowerCase().includes(term) ||
        d.username.toLowerCase().includes(term) ||
        d.license.toLowerCase().includes(term) ||
        (d.company && d.company.toLowerCase().includes(term))
      )
    );
  }, [drivers, driverSearchTerm]);

  const handleFineSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFine.driverId || !newFine.vehicleId || !newFine.value) {
      alert("Por favor, selecione o motorista, o veículo e o valor da multa.");
      return;
    }

    const fine: Fine = {
      id: Math.random().toString(36).substr(2, 9),
      driverId: newFine.driverId,
      vehicleId: newFine.vehicleId,
      date: newFine.date,
      value: parseFloat(newFine.value),
      points: parseInt(newFine.points) || 0,
      description: newFine.description
    };

    addFine(fine);
    setNewFine(initialFineState);
    setShowFineForm(false);
    alert('Multa registrada com sucesso!');
  };

  const handleDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriver.name || !newDriver.license || !newDriver.username) return;

    const normalizedName = newDriver.name.trim();
    const normalizedUsername = newDriver.username.toLowerCase().trim().replace(/\s/g, '');
    
    // Verificação de duplicidade de usuário (exceto para o próprio registro sendo editado)
    const usernameExists = drivers.some(d => d.username === normalizedUsername && d.id !== editingDriverId);
    if (usernameExists) {
      alert(`Erro: O nome de usuário "@${normalizedUsername}" já está em uso por outro condutor.`);
      return;
    }

    const driverData: Partial<Driver> = {
      name: normalizedName,
      license: newDriver.license.trim(),
      category: newDriver.category,
      email: newDriver.email?.toLowerCase().trim(),
      phone: newDriver.phone,
      company: newDriver.company.trim(),
      notes: newDriver.notes.trim(),
      username: normalizedUsername,
      avatar: newDriver.avatar,
      initialPoints: parseInt(newDriver.initialPoints) || 0
    };

    try {
      if (editingDriverId) {
        if (newDriver.password && newDriver.password.trim() !== '') {
          driverData.password = newDriver.password;
          driverData.passwordChanged = false; // Resetar para obrigar troca se a senha for alterada pelo admin
        }
        await updateDriver(editingDriverId, driverData);
        alert('Cadastro do motorista atualizado!');
      } else {
        const driver: Driver = {
          id: Math.random().toString(36).substr(2, 9),
          ...driverData as Driver,
          password: newDriver.password || '123',
          passwordChanged: false
        };
        await addDriver(driver);
        alert('Motorista cadastrado com sucesso!');
      }
      resetFormState();
      setShowDriverForm(false);
    } catch (error) {
      alert('Erro ao salvar motorista. Verifique a conexão.');
    }
  };

  const handleEditDriver = (driver: Driver) => {
    setNewDriver({
      name: driver.name,
      license: driver.license,
      category: driver.category,
      email: driver.email || '',
      phone: driver.phone || '',
      company: driver.company || '',
      notes: driver.notes || '',
      username: driver.username,
      password: '', // Senha vazia no edit significa "não alterar"
      avatar: driver.avatar || '',
      initialPoints: (driver.initialPoints || 0).toString()
    });
    setEditingDriverId(driver.id);
    setShowDriverForm(true);
    setShowFineForm(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("A imagem é muito grande. Escolha uma foto de até 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewDriver(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAvatar = () => {
    setNewDriver(prev => ({ ...prev, avatar: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetFormState = () => {
    setNewDriver(initialDriverState);
    setEditingDriverId(null);
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Recursos Humanos & Condutores</h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Gestão de Motoristas e Pontuação</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => { setShowFineForm(!showFineForm); setShowDriverForm(false); setEditingDriverId(null); }}
            className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg ${showFineForm ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
          >
            <i className={`fas ${showFineForm ? 'fa-times' : 'fa-gavel'}`}></i>
            {showFineForm ? 'Cancelar' : 'Registrar Multa'}
          </button>
          <button 
            onClick={() => { 
              if (showDriverForm) {
                setShowDriverForm(false);
                resetFormState();
              } else {
                resetFormState();
                setShowDriverForm(true);
                setShowFineForm(false);
              }
            }}
            className={`px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all ${showDriverForm ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            <i className={`fas ${showDriverForm ? 'fa-times' : (editingDriverId ? 'fa-user-pen' : 'fa-user-plus')}`}></i>
            {showDriverForm ? 'Cancelar' : (editingDriverId ? 'Editar Motorista' : 'Novo Motorista')}
          </button>
        </div>
      </div>

      {showFineForm && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
              <i className="fas fa-gavel"></i>
            </div>
            <div>
              <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest">Registrar Nova Infração</h3>
            </div>
          </div>
          
          <form onSubmit={handleFineSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Motorista Infrator</label>
                <select required value={newFine.driverId} onChange={(e) => setNewFine({ ...newFine, driverId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-900">
                  <option value="">Selecione o motorista...</option>
                  {drivers.filter(d => d.username !== 'admin').map(d => (<option key={d.id} value={d.id}>{d.name} (@{d.username})</option>))}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Veículo da Infração</label>
                <select required value={newFine.vehicleId} onChange={(e) => setNewFine({ ...newFine, vehicleId: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-900">
                  <option value="">Selecione o veículo...</option>
                  {vehicles.map(v => (<option key={v.id} value={v.id}>{v.plate} - {v.model}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Data</label>
                <input type="date" required value={newFine.date} onChange={(e) => setNewFine({ ...newFine, date: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-900" />
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Valor (R$)</label>
                <input type="number" step="0.01" required value={newFine.value} onChange={(e) => setNewFine({ ...newFine, value: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-900" />
              </div>
              <div>
                <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Pontuação</label>
                <input type="number" required value={newFine.points} onChange={(e) => setNewFine({ ...newFine, points: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-900" />
              </div>
              <div className="flex items-end">
                <button type="submit" className="w-full bg-red-600 text-white p-4 rounded-2xl font-write uppercase text-[10px] tracking-widest shadow-lg hover:bg-red-700 transition-all">Gravar Multa</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {showDriverForm && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
          <h3 className="text-sm font-write text-slate-800 uppercase tracking-widest mb-8">{editingDriverId ? 'Editar Cadastro de Condutor' : 'Cadastro de Novo Condutor'}</h3>
          <form onSubmit={handleDriverSubmit} className="space-y-8">
            <div className="flex flex-col lg:flex-row gap-10">
              <div className="flex flex-col items-center gap-4 shrink-0">
                <div onClick={() => fileInputRef.current?.click()} className="w-40 h-40 rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-all overflow-hidden relative group">
                  {newDriver.avatar ? (<img src={newDriver.avatar} alt="Preview" className="w-full h-full object-cover" />) : (<><i className="fas fa-camera text-slate-300 text-3xl"></i><span className="text-[10px] font-bold text-slate-300 mt-3 uppercase">Foto Perfil</span></>)}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><i className="fas fa-sync text-white text-xl"></i></div>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarChange} />
                {newDriver.avatar && (<button type="button" onClick={removeAvatar} className="text-[9px] font-bold text-red-500 uppercase hover:underline">Remover Foto</button>)}
              </div>
              
              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Nome Completo</label>
                  <input required value={newDriver.name} onChange={(e) => setNewDriver({ ...newDriver, name: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-950" />
                </div>
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">CNH</label>
                  <input required value={newDriver.license} onChange={(e) => setNewDriver({ ...newDriver, license: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-950" />
                </div>
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Categoria</label>
                  <select required value={newDriver.category} onChange={(e) => setNewDriver({ ...newDriver, category: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-950">
                    {CNH_CATEGORIES.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Pontos CNH (Brasil)</label>
                  <input type="number" value={newDriver.initialPoints} onChange={(e) => setNewDriver({ ...newDriver, initialPoints: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-950" />
                </div>
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Telefone</label>
                  <input value={newDriver.phone} onChange={(e) => setNewDriver({ ...newDriver, phone: maskPhone(e.target.value) })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-950" />
                </div>
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">Usuário</label>
                  <input required value={newDriver.username} onChange={(e) => setNewDriver({ ...newDriver, username: e.target.value.toLowerCase().replace(/\s/g, '') })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-950" />
                </div>
                <div>
                  <label className="block text-[10px] font-write text-slate-400 uppercase mb-2">{editingDriverId ? 'Nova Senha (opcional)' : 'Senha Inicial'}</label>
                  <input type="password" value={newDriver.password} onChange={(e) => setNewDriver({ ...newDriver, password: e.target.value })} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-950" placeholder={editingDriverId ? "Deixe em branco p/ manter" : "Mínimo 4 caracteres"} />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t border-slate-50">
              <button type="button" onClick={() => { setShowDriverForm(false); resetFormState(); }} className="px-8 py-4 text-slate-400 font-write uppercase text-[10px] tracking-widest">Cancelar</button>
              <button type="submit" className="bg-blue-600 text-white px-12 py-4 rounded-2xl font-write uppercase text-xs tracking-widest shadow-xl hover:bg-blue-700 transition-all">
                {editingDriverId ? 'Salvar Alterações' : 'Confirmar Cadastro'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
        <div className="xl:col-span-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-2">
            <h3 className="text-[10px] font-write text-slate-400 uppercase tracking-[0.2em]">Condutores Ativos ({filteredDrivers.length})</h3>
            <div className="relative w-full md:w-64">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
              <input type="text" placeholder="Filtrar motoristas..." value={driverSearchTerm} onChange={(e) => setDriverSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredDrivers.map(driver => {
              const driverFines = fines.filter(f => f.driverId === driver.id);
              const systemPoints = driverFines.reduce((sum, f) => sum + f.points, 0);
              const totalPoints = (driver.initialPoints || 0) + systemPoints;
              const isPointsCritical = totalPoints >= 40;
              
              return (
                <div key={driver.id} className={`bg-white p-6 rounded-3xl shadow-sm border flex flex-col group hover:shadow-md transition-all ${isPointsCritical ? 'border-red-200 ring-2 ring-red-50' : 'border-slate-100'}`}>
                  <div className="flex items-start gap-5 mb-6">
                    <div className="w-20 h-20 rounded-2xl bg-slate-50 border-2 border-white shadow-inner overflow-hidden flex-shrink-0">
                      {driver.avatar ? (<img src={driver.avatar} alt={driver.name} className="w-full h-full object-cover" />) : (<div className="w-full h-full flex items-center justify-center font-bold text-slate-300 text-2xl uppercase">{driver.name.charAt(0)}</div>)}
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <h4 className="font-write text-lg text-slate-800 truncate mb-1">{driver.name}</h4>
                      <div className="flex items-center gap-2">
                        <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[8px] font-write uppercase">CNH {driver.license}</span>
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[8px] font-write uppercase">CAT {driver.category}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-auto pt-6 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-write text-slate-400 uppercase tracking-widest">Pontuação</span>
                      <span className={`text-xs font-write uppercase ${isPointsCritical ? 'text-red-600' : 'text-emerald-500'}`}>{totalPoints} PTS {isPointsCritical && '(CRÍTICO)'}</span>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => handleEditDriver(driver)} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-all border border-slate-100"><i className="fas fa-pen text-xs"></i></button>
                       <button onClick={() => { if(window.confirm(`Excluir motorista ${driver.name}?`)) deleteDriver(driver.id); }} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all border border-slate-100"><i className="fas fa-trash-alt text-xs"></i></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverManagement;
