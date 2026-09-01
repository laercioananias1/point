import type { ModeloRepasse } from "../api/types";

const ROTULO_MODELO_REPASSE: Record<ModeloRepasse, string> = {
  percentual: "Percentual",
  valor_fixo_mensal: "Valor fixo mensal",
  valor_fixo_por_aula: "Valor fixo por aula",
};

/** R$ 1.234,56 — formato brasileiro (pedido do usuário, 2026-08-21). */
export function formatarReais(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "Percentual — 70%" ou "Valor fixo mensal — R$ 1.000,00" — o valor só é
 * dinheiro quando o modelo é fixo; no percentual é uma porcentagem, não
 * reais (pedido do usuário, 2026-08-21). */
export function rotuloRepasse(modelo: ModeloRepasse, valor: number): string {
  const rotuloValor = modelo === "percentual" ? `${valor}%` : formatarReais(valor);
  return `${ROTULO_MODELO_REPASSE[modelo]} — ${rotuloValor}`;
}

/** Máscara de celular brasileiro — (11) 91234-5678 (pedido do usuário,
 * 2026-09-01: "qdo for cadastrar nr de celular, faca uma mascara para
 * colocar ddd e numero"). Formata progressivamente enquanto digita — usa
 * em `onChange={(e) => setCelular(formatarCelular(e.target.value))}`. Só
 * mexe na exibição; ignora tudo que não é dígito (cola com traço, +55,
 * espaço — tanto faz) e limita a 11 dígitos (DDD + 9 dígitos, o padrão
 * atual de celular). Separa em 4+4 até o 10º dígito (compatível com
 * número antigo de 8 dígitos ainda sendo digitado) e vira 5+4 a partir
 * do 11º, quando fica claro que é um celular de 9 dígitos. */
export function formatarCelular(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  if (digitos.length === 0) return "";
  if (digitos.length <= 2) return `(${digitos}`;

  const ddd = digitos.slice(0, 2);
  const resto = digitos.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;

  const quebra = digitos.length <= 10 ? 4 : 5;
  return `(${ddd}) ${resto.slice(0, quebra)}-${resto.slice(quebra)}`;
}
