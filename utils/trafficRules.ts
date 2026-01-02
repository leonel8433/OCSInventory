
/**
 * Verifica se um veículo está no rodízio de São Paulo em uma determinada data.
 * Regras SP:
 * Seg: 1 e 2 | Ter: 3 e 4 | Qua: 5 e 6 | Qui: 7 e 8 | Sex: 9 e 0
 * @param plate Placa do veículo
 * @param date Data para validação
 */
export const checkSPRodizio = (plate: string, date: Date) => {
  // getDay() retorna 0 para Domingo, 1 para Segunda, etc.
  const dayOfWeek = date.getDay(); 
  
  // Extrai apenas o último dígito numérico da placa (funciona para Mercosul e Antigas)
  const digitsOnly = plate.replace(/\D/g, '');
  const lastDigit = parseInt(digitsOnly.slice(-1));

  if (isNaN(lastDigit)) return false;

  // Mapa de restrições (Dia da Semana -> Últimos dígitos proibidos)
  const rules: Record<number, number[]> = {
    1: [1, 2], // Segunda
    2: [3, 4], // Terça
    3: [5, 6], // Quarta
    4: [7, 8], // Quinta
    5: [9, 0], // Sexta
  };

  const restrictedDigits = rules[dayOfWeek];
  return restrictedDigits ? restrictedDigits.includes(lastDigit) : false;
};

/**
 * Retorna os dígitos proibidos para um determinado dia da semana
 */
export const getRestrictedDigitsForDate = (date: Date): number[] => {
  const day = date.getDay();
  const rules: Record<number, number[]> = {
    1: [1, 2],
    2: [3, 4],
    3: [5, 6],
    4: [7, 8],
    5: [9, 0],
  };
  return rules[day] || [];
};

export const getRodizioDayLabel = (plate: string) => {
  const digitsOnly = plate.replace(/\D/g, '');
  const lastDigit = parseInt(digitsOnly.slice(-1));
  
  if (isNaN(lastDigit)) return "Placa Inválida";
  
  if (lastDigit === 1 || lastDigit === 2) return "Segunda-feira";
  if (lastDigit === 3 || lastDigit === 4) return "Terça-feira";
  if (lastDigit === 5 || lastDigit === 6) return "Quarta-feira";
  if (lastDigit === 7 || lastDigit === 8) return "Quinta-feira";
  if (lastDigit === 9 || lastDigit === 0) return "Sexta-feira";
  return "Sem restrição";
};
