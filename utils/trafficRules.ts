
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
 * Identifica se uma localidade refere-se à CIDADE de São Paulo de forma robusta.
 */
export const isLocationSaoPaulo = (city?: string, state?: string, destination?: string): boolean => {
  const norm = (s: string) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  const c = norm(city);
  const s = norm(state);
  const d = norm(destination);

  // Se o estado for explicitamente diferente de SP, não é a capital paulista
  if (s !== '' && s !== 'sp' && s !== 'sao paulo') return false;

  // 1. Verificação direta pelo campo cidade
  // O IBGE retorna "São Paulo"
  if (c === 'sao paulo') return true;
  
  // 2. Verificação por palavras-chave comuns da capital
  const capitalKeywords = ['sao paulo capital', 'capital sao paulo', 'sp capital', 'capital sp', 'sao paulo - sp', 'sao paulo/sp'];
  if (capitalKeywords.includes(c)) return true;

  // 3. Verificação no campo de destino (endereço completo)
  // Procuramos por "São Paulo" no destino, garantindo que o estado seja SP ou não informado
  const hasSaoPauloInDest = d.includes('sao paulo') || d.includes('capital sp') || d.includes('sp capital');
  
  if (hasSaoPauloInDest) {
    // Evita falsos positivos como "Interior de São Paulo" ou "São José do Rio Preto"
    // Se no destino aparecer "sao paulo" mas houver outra cidade paulista específica, pode ser falso.
    // Mas para fins de segurança operacional, se contém "sao paulo" e não cita "interior", tratamos como capital.
    if (d.includes('interior')) return false;
    
    // Se o estado é SP e o destino cita São Paulo, as chances são altas de passar pelo centro expandido
    return true;
  }

  return false;
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
