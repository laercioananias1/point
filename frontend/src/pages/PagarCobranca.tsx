import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { PagamentoPublico } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Icon } from "../components/Layout";
import { PointBrand } from "../components/PointBrand";
import { TelaEntrada } from "../components/TelaEntrada";
import { formatarReais } from "../lib/formato";

// De quanto em quanto tempo a tela pergunta se o Pix já foi pago.
const INTERVALO_CONFERENCIA_MS = 5000;

function dataCurta(iso: string): string {
  return new Date(iso.length === 10 ? iso + "T00:00" : iso).toLocaleDateString("pt-BR");
}

/** Pagamento de uma cobrança com Pix (pedido do usuário, 2026-10-02:
 * "desenvolver api do mercado pago para pagto com pix") — abre sem login
 * pelo link /pagar/<token> (e-mail, WhatsApp ou tela Pagamentos do
 * aluno). Gera o Pix sozinha, mostra QR Code e copia-e-cola e fica
 * conferindo até o pagamento cair. */
export default function PagarCobranca() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const [pagamento, setPagamento] = useState<PagamentoPublico | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [erroPix, setErroPix] = useState<string | null>(null);
  const [gerando, setGerando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const textoRef = useRef<HTMLTextAreaElement>(null);

  const gerarPix = useCallback(async () => {
    setGerando(true);
    setErroPix(null);
    try {
      setPagamento(await api.post<PagamentoPublico>(`/pagar/${token}/pix`, {}));
    } catch (e) {
      setErroPix(e instanceof ApiError ? e.message : "Não foi possível gerar o Pix. Tente de novo.");
    } finally {
      setGerando(false);
    }
  }, [token]);

  // Primeira carga: mostra a cobrança e, se dá pra pagar online, já gera
  // o Pix (ou troca um que venceu).
  useEffect(() => {
    api
      .get<PagamentoPublico>(`/pagar/${token}`)
      .then((p) => {
        setPagamento(p);
        const vencido = p.pix_expira_em !== null && new Date(p.pix_expira_em).getTime() < Date.now() + 60_000;
        if (p.status === "aberta" && p.pagamento_online && (!p.pix_copia_cola || vencido)) gerarPix();
      })
      .catch((e) => setErro(e instanceof ApiError ? e.message : "Pagamento não encontrado — confira o link."));
  }, [token, gerarPix]);

  // Enquanto o Pix está na tela, confere de tempos em tempos.
  const aguardando = pagamento?.status === "aberta" && Boolean(pagamento.pix_copia_cola);
  useEffect(() => {
    if (!aguardando) return;
    const id = window.setInterval(() => {
      api
        .get<PagamentoPublico>(`/pagar/${token}`)
        .then(setPagamento)
        .catch(() => {});
    }, INTERVALO_CONFERENCIA_MS);
    return () => window.clearInterval(id);
  }, [aguardando, token]);

  async function copiar() {
    if (!pagamento?.pix_copia_cola) return;
    try {
      await navigator.clipboard.writeText(pagamento.pix_copia_cola);
    } catch {
      textoRef.current?.select();
      document.execCommand("copy");
    }
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2500);
  }

  const marca = pagamento ? <PointBrand point={{ nome: pagamento.point_nome, logo: pagamento.point_logo }} /> : undefined;

  return (
    <TelaEntrada marca={marca}>
      {erro && <p className="auth-card auth-error">{erro}</p>}
      {!erro && !pagamento && <p className="auth-card">Carregando pagamento...</p>}

      {pagamento && (
        <>
          <div className="auth-card pagar-resumo">
            <span className="alunos-sub">Olá, {pagamento.aluno_nome}!</span>
            <h1>{pagamento.descricao}</h1>
            <div className="pagar-numeros">
              <span>
                <small>Valor</small>
                <strong>{formatarReais(pagamento.valor)}</strong>
              </span>
              <span>
                <small>Vencimento</small>
                <strong>{dataCurta(pagamento.vencimento)}</strong>
              </span>
            </div>
            {pagamento.status === "aberta" && pagamento.atrasada && !pagamento.reserva && (
              <span className="status-pill status-risk pagar-pilula">Em atraso</span>
            )}
            {pagamento.status === "aberta" && pagamento.reserva && pagamento.pagar_ate && (
              <span className="pagar-reserva">
                <Icon name="clock" size={16} /> Sua vaga está reservada até{" "}
                <strong>
                  {new Date(pagamento.pagar_ate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </strong>
                . Depois disso, sem o pagamento, a reserva é cancelada.
              </span>
            )}
          </div>

          {pagamento.status === "paga" && (
            <div className="auth-card pagar-pago">
              <span className="pagar-pago-icone">
                <Icon name="check" size={30} />
              </span>
              <h2>{pagamento.reserva ? "Aula confirmada!" : "Pagamento confirmado!"}</h2>
              <p className="alunos-sub">
                {pagamento.pago_em ? `Pago em ${dataCurta(pagamento.pago_em)}` : "Pago"}
                {pagamento.pago_via === "pix" ? " via Pix." : "."} Obrigado!
              </p>
              {user && (
                <Link to={pagamento.reserva ? "/aluno/agenda" : "/aluno/pagamentos"} className="pagar-voltar">
                  {pagamento.reserva ? "Ver na minha agenda" : "Ver meus pagamentos"}
                </Link>
              )}
            </div>
          )}

          {pagamento.status === "aberta" && !pagamento.pagamento_online && (
            <p className="auth-card">
              O {pagamento.point_nome} ainda não recebe pagamento online. Fale com a recepção pra pagar.
            </p>
          )}

          {pagamento.status === "aberta" && pagamento.pagamento_online && (
            <div className="auth-card pagar-pix">
              <h2>Pague com Pix</h2>
              {gerando && !pagamento.pix_copia_cola && <p className="alunos-sub">Gerando o Pix...</p>}
              {erroPix && (
                <>
                  <p className="auth-error">{erroPix}</p>
                  <button type="submit" onClick={gerarPix} disabled={gerando}>
                    Tentar de novo
                  </button>
                </>
              )}
              {pagamento.pix_copia_cola && (
                <>
                  {pagamento.pix_qr_base64 && (
                    <img
                      className="pagar-qr"
                      src={`data:image/png;base64,${pagamento.pix_qr_base64}`}
                      alt="QR Code do Pix"
                    />
                  )}
                  <p className="alunos-sub pagar-instrucao">
                    Abra o app do seu banco, escolha <strong>Pix &gt; Ler QR Code</strong> ou{" "}
                    <strong>Pix Copia e Cola</strong> e cole o código abaixo.
                  </p>
                  <textarea ref={textoRef} className="pagar-codigo" readOnly value={pagamento.pix_copia_cola} rows={3} />
                  <button type="submit" onClick={copiar}>
                    {copiado ? "Código copiado!" : "Copiar código Pix"}
                  </button>
                  <span className="pagar-aguardando">
                    <span className="pagar-ponto" aria-hidden="true" /> Aguardando o pagamento — a confirmação
                    aparece aqui sozinha.
                  </span>
                  {pagamento.pix_expira_em && (
                    <span className="alunos-sub pagar-validade">
                      Código válido até{" "}
                      {new Date(pagamento.pix_expira_em).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {pagamento.gateway_rotulo ? ` · pagamento processado pelo ${pagamento.gateway_rotulo}` : ""}
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </TelaEntrada>
  );
}
