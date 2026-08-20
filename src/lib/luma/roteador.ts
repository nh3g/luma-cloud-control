/**
 * Roteador local de intenção (espelha a 1.10.4).
 * Classifica a tarefa antes de acionar o companion ou qualquer IA:
 * leitura x escrita, ambiguidade e complexidade (limite de passos).
 */

export type Complexidade = "SIMPLE" | "STANDARD" | "BROAD";
export type ModoAgente = "ANALYZE" | "APPROVAL" | "PRIME";

export type Intencao = {
  escrita: boolean;
  ambiguo: boolean;
  motivo: string | null;
  complexidade: Complexidade;
  maxPassos: number;
  statusDesejado: "ATIVAR" | "PAUSAR" | null;
  plataforma: "META" | "GOOGLE_ADS" | null;
};

const termosEscrita = [
  "pausar",
  "pause",
  "despausar",
  "ativar",
  "reativar",
  "ligar",
  "desligar",
  "aumentar",
  "reduzir",
  "diminuir",
  "alterar",
  "mudar",
  "ajustar",
  "editar",
  "duplicar",
  "criar",
  "excluir",
  "apagar",
];

const termosLeitura = ["ver", "listar", "conferir", "checar", "analisar", "auditar", "comparar", "relatório", "relatorio"];

const termosAmplos = ["todas", "todos", "geral", "completa", "completo", "auditoria", "tudo", "profunda"];

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function roteardorIntencao(tarefa: string, modo: ModoAgente): Intencao {
  const texto = normalizar(tarefa.trim());
  const palavras = texto.split(/\s+/).filter(Boolean);

  if (palavras.length < 3) {
    return {
      escrita: false,
      ambiguo: true,
      motivo: "Descreva a tarefa com mais detalhes (o que fazer, em qual conta e em qual campanha).",
      complexidade: "SIMPLE",
      maxPassos: 8,
      statusDesejado: null,
      plataforma: null,
    };
  }

  const escrita = termosEscrita.some((t) => texto.includes(t));
  const leitura = termosLeitura.some((t) => texto.includes(t));

  let statusDesejado: Intencao["statusDesejado"] = null;
  if (/\bpausa|pausar|desligar\b/.test(texto)) statusDesejado = "PAUSAR";
  if (/\bativar|reativar|ligar|despausar\b/.test(texto)) statusDesejado = "ATIVAR";

  const plataforma = /\bmeta|facebook|instagram\b/.test(texto)
    ? ("META" as const)
    : /\bgoogle|adwords|pmax|performance max|shopping\b/.test(texto)
      ? ("GOOGLE_ADS" as const)
      : null;

  // Escrita com dois sentidos opostos na mesma frase é ambígua.
  if (/\bpausar\b/.test(texto) && /\bativar|reativar\b/.test(texto)) {
    return {
      escrita: true,
      ambiguo: true,
      motivo: "A tarefa pede pausar e ativar ao mesmo tempo. Diga qual estado final você quer.",
      complexidade: "SIMPLE",
      maxPassos: 8,
      statusDesejado: null,
      plataforma,
    };
  }

  if (escrita && !plataforma && !/\bcampanha|conta\b/.test(texto)) {
    return {
      escrita: true,
      ambiguo: true,
      motivo: "Diga em qual plataforma e em qual campanha ou conta a alteração deve acontecer.",
      complexidade: "SIMPLE",
      maxPassos: 8,
      statusDesejado,
      plataforma,
    };
  }

  const amplo = termosAmplos.some((t) => texto.includes(t)) || modo === "PRIME";
  const complexidade: Complexidade = amplo ? "BROAD" : escrita || leitura ? "STANDARD" : "SIMPLE";
  const maxPassos = complexidade === "BROAD" ? (modo === "PRIME" ? 80 : 60) : complexidade === "STANDARD" ? 14 : 8;

  return { escrita, ambiguo: false, motivo: null, complexidade, maxPassos, statusDesejado, plataforma };
}
