
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Fix: Use gemini-2.5-flash for maps grounding as it is 2.5 series.
export const getRouteInsights = async (origin: string, destination: string, lat?: number, lng?: number) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Provide a detailed route summary for a trip from ${origin} to ${destination}. Mention estimated traffic patterns and any points of interest for professional drivers.`,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: lat && lng ? { latitude: lat, longitude: lng } : undefined
          }
        }
      },
    });

    return {
      text: response.text || "Sem detalhes da rota disponíveis.",
      grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error("Error fetching route insights:", error);
    return { text: "Error fetching route details. Please check your network.", grounding: [] };
  }
};

// Fix: Use gemini-2.5-flash for optimized route with maps grounding.
export const getOptimizedRoute = async (origin: string, destination: string, waypoints: string[] = []) => {
  try {
    const waypointsStr = waypoints.length > 0 ? ` passing through ${waypoints.join(', ')}` : '';
    const prompt = `As a logistics expert, optimize the route from ${origin} to ${destination}${waypointsStr}. 
    Analyze current traffic conditions and distance to suggest the most efficient sequence of stops or alternative paths. 
    Focus on fuel saving and time efficiency. Mention specific roads if possible.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
      },
    });

    return {
      text: response.text || "Não foi possível otimizar a rota.",
      grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error("Error optimizing route:", error);
    return { text: "Falha ao otimizar a rota. Tente novamente em instantes.", grounding: [] };
  }
};

// Fix: Use gemini-3-pro-preview for fleet stats analysis as it is a complex text task.
export const getFleetStatsAnalysis = async (fleetData: any) => {
  try {
    const prompt = `Aja como um Consultor Sênior de Logística e Gestão de Frotas. 
    Analise os seguintes dados consolidados da empresa:
    ${JSON.stringify(fleetData)}

    Gere um relatório estruturado contendo:
    1. Resumo Executivo: Uma visão geral da saúde operacional da frota.
    2. Análise de Eficiência: Como está o uso dos veículos e custos.
    3. 3 Insights Acionáveis: Recomendações práticas para reduzir custos ou melhorar a segurança.

    Seja direto, profissional e use formatação Markdown.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
    });
    
    return response.text || "Relatório indisponível.";
  } catch (error) {
    console.error("Error analyzing fleet:", error);
    return "Não foi possível gerar a análise estratégica no momento. Verifique os dados e tente novamente.";
  }
};
