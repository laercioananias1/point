import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { CobrancaDoAluno } from "../../api/types";
import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { Layout } from "../../components/Layout";
import { formatarReais } from "../../lib/formato";

function dataCurta(iso: string): string {
  return new Date(iso + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Pagamentos do aluno (pedido do usuário, 2026-10-02: "tela de cobranças
 * do aluno no app" pra pagar com Pix) — em aberto no topo, com "Pagar com
 * Pix" quando o Point recebe online; depois as últimas pagas. */
export default function AlunoPagamentos() {
  const navigate = useNavigate();
  const [cobrancas, setCobrancas] = useState<CobrancaDoAluno[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<CobrancaDoAluno[]>("/alunos/me/cobrancas")
      .then(setCobrancas)
      .catch(() => setErro("Não foi possível carregar seus pagamentos. Tente novamente."));
  }, []);

  const abertas = (cobrancas ?? []).filter((c) => c.status === "aberta");
  const pagas = (cobrancas ?? []).filter((c) => c.status === "paga");
  const totalAberto = abertas.reduce((s, c) => s + c.valor, 0);

  return (
    <Layout>
      <CabecalhoPagina titulo="Pagamentos" contexto="Minha conta" />
      {erro && <p className="form-error">{erro}</p>}
      {!cobrancas && !erro && <p className="empty-state">Carregando...</p>}

      {cobrancas && (
        <div className="pag-corpo">
          <section className="alunos-card">
            <div className="pag-topo">
              <h2 className="chk-secao-titulo">Em aberto</h2>
              {abertas.length > 0 && <strong className="pag-total">{formatarReais(totalAberto)}</strong>}
            </div>
            {abertas.length === 0 ? (
              <p className="alunos-sub">Nada em aberto. Tudo em dia!</p>
            ) : (
              <div className="pag-lista">
                {abertas.map((c) => (
                  <div key={c.id} className="pag-item">
                    <div className="alunos-pessoa-texto">
                      <span className="alunos-nome">{c.descricao}</span>
                      <span className="alunos-sub">
                        {c.point_nome} · vence {dataCurta(c.vencimento)}
                      </span>
                    </div>
                    <span className="pag-valor">{formatarReais(c.valor)}</span>
                    <span className="pag-acoes">
                      {c.atrasada && <span className="status-pill status-risk">Em atraso</span>}
                      {c.pagamento_online ? (
                        <button
                          type="button"
                          className="cobr-btn cobr-btn-pagar"
                          onClick={() => navigate(`/pagar/${c.pagamento_token}`)}
                        >
                          Pagar com Pix
                        </button>
                      ) : (
                        <span className="alunos-sub">Pague na recepção</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {pagas.length > 0 && (
            <section className="alunos-card">
              <h2 className="chk-secao-titulo">Pagos</h2>
              <div className="pag-lista">
                {pagas.map((c) => (
                  <div key={c.id} className="pag-item">
                    <div className="alunos-pessoa-texto">
                      <span className="alunos-nome">{c.descricao}</span>
                      <span className="alunos-sub">
                        {c.point_nome}
                        {c.pago_em && ` · pago em ${dataCurta(c.pago_em)}`}
                      </span>
                    </div>
                    <span className="pag-valor">{formatarReais(c.valor)}</span>
                    <span className="pag-acoes">
                      <span className="status-pill status-good">{c.pago_via === "pix" ? "Pago via Pix" : "Pago"}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Layout>
  );
}
