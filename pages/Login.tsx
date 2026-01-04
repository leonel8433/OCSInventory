
import React, { useState } from 'react';
import { useFleet } from '../context/FleetContext';
import Logo from '../components/Logo';

const Login: React.FC = () => {
  const { login, drivers } = useFleet();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Verifica se o usuário existe na base local
      const userExists = drivers.some(d => d.username.toLowerCase() === username.toLowerCase());
      
      if (!userExists) {
        setError('Este usuário não está cadastrado no sistema.');
        setIsSubmitting(false);
        return;
      }

      // Tenta realizar o login
      const success = await login(username, password);
      
      if (!success) {
        setError('Senha incorreta. Por favor, tente novamente.');
      }
    } catch (err) {
      setError('Ocorreu um erro ao tentar entrar. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative patterns */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl -mr-48 -mt-48"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-900/5 rounded-full blur-3xl -ml-48 -mb-48"></div>

      <div className="max-w-md w-full relative">
        <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <Logo size="lg" className="mb-6 drop-shadow-md" />
          <div className="h-1 w-12 bg-blue-600 mx-auto rounded-full mb-4"></div>
          <p className="text-slate-500 font-medium">Gestão Inteligente de Logística e Frota</p>
        </div>

        <div className="bg-white rounded-3xl p-8 shadow-2xl shadow-slate-200/50 border border-slate-100 animate-in zoom-in-95 duration-500">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Usuário de Acesso</label>
              <div className="relative">
                <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                <input
                  type="text"
                  placeholder="Nome de usuário"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-100 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-slate-950 transition-all"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2 ml-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Senha</label>
                <button 
                  type="button"
                  onClick={() => setShowRecoveryModal(true)}
                  className="text-xs font-bold text-blue-600 hover:underline bg-transparent border-none outline-none cursor-pointer"
                >
                  Recuperar acesso
                </button>
              </div>
              <div className="relative">
                <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-100 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-bold text-slate-950 transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-bold flex items-center gap-3 animate-shake">
                <i className="fas fa-circle-exclamation text-lg"></i>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full bg-slate-900 text-white py-5 rounded-2xl font-bold text-lg hover:bg-blue-900 shadow-xl shadow-slate-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Verificando...
                </>
              ) : (
                'Iniciar Sessão'
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-slate-50">
            <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
              Propriedade de Help System<br/>
              Acesso Monitorado para Fins Profissionais
            </p>
          </div>
        </div>
      </div>

      {/* Recovery Instructions Modal */}
      {showRecoveryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center text-3xl mx-auto shadow-inner">
                <i className="fas fa-headset"></i>
              </div>
              
              <div>
                <h3 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Esqueceu sua senha?</h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  Para garantir a segurança da frota, as credenciais de acesso são geridas centralmente.
                </p>
              </div>

              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 text-left">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">O que fazer agora:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-3 text-xs font-bold text-slate-700">
                    <i className="fas fa-check-circle text-blue-500 mt-0.5"></i>
                    Contate o seu Gestor Direto
                  </li>
                  <li className="flex items-start gap-3 text-xs font-bold text-slate-700">
                    <i className="fas fa-check-circle text-blue-500 mt-0.5"></i>
                    Abra um chamado com o TI
                  </li>
                  <li className="flex items-start gap-3 text-xs font-bold text-slate-700">
                    <i className="fas fa-check-circle text-blue-500 mt-0.5"></i>
                    Solicite o reset da sua senha
                  </li>
                </ul>
              </div>

              <button 
                onClick={() => setShowRecoveryModal(false)}
                className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-xl hover:bg-slate-800 transition-all active:scale-95"
              >
                Entendi, voltar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
