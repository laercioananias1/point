import type { PagamentoResumo } from "../api/types";
import { formatarReais } from "../lib/formato";
import { StatusPill } from "./StatusPill";

/** Extrato de um pagamento — quais aulas ele cobre (pedido do usuário,
 * 2026-08-21: "consigo ter um extrato que o pagamento X refere-se às aulas
 * xyz?"). Avulsa não tem lista (a matrícula já é a reserva única) — não
 * renderiza nada nesse caso. */
export function ExtratoPagamento({ pagamento }: { pagamento: PagamentoResumo }) {
  if (pagamento.aulas_cobertas.length === 0) {
    return null;
  }

  return (
    <div className="extrato-pagamento">
      <span className="extrato-pagamento-titulo">
        {formatarReais(pagamento.valor)} cobre {pagamento.aulas_cobertas.length} aula(s):
      </span>
      <ul className="extrato-pagamento-lista">
        {pagamento.aulas_cobertas.map((a) => (
          <li key={a.data}>
            {new Date(a.data + "T00:00").toLocaleDateString("pt-BR")}
            <StatusPill status={a.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
