const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

const decimal2 = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

export function formatarMoeda(valor: number | string | null | undefined): string {
  return brl.format(Number(valor ?? 0));
}

export function formatarNumero(valor: number | string | null | undefined): string {
  return inteiro.format(Number(valor ?? 0));
}

export function formatarPercentual(valor: number | string | null | undefined): string {
  return `${decimal2.format(Number(valor ?? 0))}%`;
}

export function formatarRoas(valor: number | string | null | undefined): string {
  return `${decimal2.format(Number(valor ?? 0))}x`;
}

export function formatarDecimal(valor: number | string | null | undefined): string {
  return decimal2.format(Number(valor ?? 0));
}

export function formatarDataHora(valor: string | null | undefined): string {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatarRelativo(valor: string | null | undefined): string {
  if (!valor) return "—";
  const diffMin = Math.round((Date.now() - new Date(valor).getTime()) / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const horas = Math.round(diffMin / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  return `há ${dias} d`;
}

export const rotuloPlataforma: Record<string, string> = {
  META: "Meta Ads",
  GOOGLE_ADS: "Google Ads",
  GA4: "GA4",
};

export const rotuloStatusIntegracao: Record<string, string> = {
  DISCONNECTED: "Desconectado",
  CONNECTED: "Conectado",
  EXPIRED: "Expirado",
  ERROR: "Erro",
};

export const rotuloAcao: Record<string, string> = {
  PAUSE_CAMPAIGN: "Pausar campanha",
  RESUME_CAMPAIGN: "Reativar campanha",
  INCREASE_BUDGET: "Aumentar orçamento",
  DECREASE_BUDGET: "Reduzir orçamento",
  ROTATE_CREATIVE: "Girar criativo",
};

export const rotuloStatusDecisao: Record<string, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovada",
  REJECTED: "Rejeitada",
  EXECUTED: "Executada",
  FAILED: "Falhou",
  EXPIRED: "Expirada",
};

export const rotuloOrigem: Record<string, string> = {
  RULE_ENGINE: "Motor de regras",
  AI: "IA estrategista",
  MCP: "MCP",
  MANUAL: "Manual",
};

export const rotuloRisco: Record<string, string> = {
  LOW: "Baixo",
  MEDIUM: "Médio",
  HIGH: "Alto",
};

export const rotuloCanal: Record<string, string> = {
  API: "API oficial",
  BROWSER: "Agente de navegador",
  SIMULATED: "Simulado (demo)",
};

export const rotuloStatusSync: Record<string, string> = {
  RUNNING: "Em andamento",
  SUCCESS: "Concluída",
  PARTIAL: "Parcial",
  FAILED: "Falhou",
};

export const rotuloStatusCampanha: Record<string, string> = {
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  ARCHIVED: "Arquivada",
  DELETED: "Excluída",
};
