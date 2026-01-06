
/**
 * Verifica se um veículo está no rodízio de São Paulo em uma determinada data.
 * Regras SP:
 * Seg: 1 e 2 | Ter: 3 e 4 | Qua: 5 e 6 | Qui: 7 e 8 | Sex: 9 e 0
 * @param plate Placa do veículo (ex: ABC-1234 ou ABC1D23)
 * @param date Objeto Date para validação
 */
export const checkSPRodizio = (plate: string, date: Date): boolean => {
  // 0: Domingo, 1: Segunda, ..., 5: Sexta, 6: Sábado
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // Sem rodízio fins de semana

  // Captura o último caractere da placa (no padrão Mercosul e Antigo, o último caractere é o dígito relevante)
  const cleanPlate = plate.replace(/[^a-zA-Z0-9]/g, '').trim();
  const lastChar = cleanPlate.slice(-1);
  const lastDigit = parseInt(lastChar);
  
  if (isNaN(lastDigit)) return false;

  const restrictions: Record<number, number[]> = {
    1: [1, 2], // Segunda
    2: [3, 4], // Terça
    3: [5, 6], // Quarta
    4: [7, 8], // Quinta
    5: [9, 0], // Sexta
  };

  return restrictions[day]?.includes(lastDigit) || false;
};

/**
 * Identifica se uma localidade refere-se à CIDADE de São Paulo.
 * Corrigido para ignorar a validação apenas pelo estado (SP).
 */
export const isLocationSaoPaulo = (city?: string, state?: string, destination?: string): boolean => {
  const norm = (s: string) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  const c = norm(city);
  const d = norm(destination);

  // Palavras-chave que identificam especificamente a CIDADE/CAPITAL
  const cityKeywords = [
    'sao paulo', 
    'sao paulo capital', 
    'capital sao paulo', 
    'sp capital', 
    'capital sp'
  ];
  
  // 1. Se o campo Cidade foi preenchido, ele tem prioridade absoluta.
  // Verificamos se a cidade é São Paulo (ignora se for apenas "SP" para evitar validar o estado todo)
  if (c !== '') {
    return cityKeywords.includes(c);
  }

  // 2. Se a cidade estiver vazia, tentamos inferir pelo destino,
  // mas garantimos que não estamos pegando apenas o estado.
  const checkDest = cityKeywords.some(k => d.includes(k));
  
  // Evita falsos positivos como "Estado de São Paulo" ou endereços que apenas terminam em "SP"
  const isGenericState = d === 'sp' || d === 'sao paulo' && (norm(state) === 'sp');
  
  // Se o destino contém as keywords da cidade e NÃO é uma menção genérica ao estado
  return checkDest && !d.includes('interior') && !d.includes('estado de');
};

/**
 * Retorna o nome do dia da semana em que o veículo possui restrição de rodízio.
 */
export const getRodizioDayLabel = (plate: string): string => {
  const cleanPlate = plate.replace(/[^a-zA-Z0-9]/g, '').trim();
  const lastChar = cleanPlate.slice(-1);
  const lastDigit = parseInt(lastChar);
  
  if (isNaN(lastDigit)) return 'Placa Inválida';

  if (lastDigit === 1 || lastDigit === 2) return 'Segunda-feira';
  if (lastDigit === 3 || lastDigit === 4) return 'Terça-feira';
  if (lastDigit === 5 || lastDigit === 6) return 'Quarta-feira';
  if (lastDigit === 7 || lastDigit === 8) return 'Quinta-feira';
  if (lastDigit === 9 || lastDigit === 0) return 'Sexta-feira';
  
  return 'Sem restrição';
};
