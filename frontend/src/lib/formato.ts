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
