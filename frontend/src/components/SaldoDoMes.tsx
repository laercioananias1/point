import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { WellhubCheckin, WellhubReconciliacao, WellhubReconciliacaoLinha } from "../api/types";
import { rotuloPagamentoMeio } from "../lib/formato";
import { Icon, type IconName } from "./Layout";
import { VincularAlunoModal, type PessoaSemVinculo } from "./VincularAlunoModal";

function plural(n: number, singular: string, varios: string): string {
  return `${n} ${n === 1 ? singular : varios}`;
}

/** Saldo de check-ins do mês (pedido do usuário, 2026-09-30: "um aluno
 * precisa ter no final do mês um saldo zerado. Se não tiver isso tem que
 * ter um alerta") — por aluno, quantidade de check-ins x quantidade de
 * aulas. Só quantidade: a data do check-in não precisa bater com a da
 * aula. Negativo = precisa fazer mais check-in; positivo = check-in
 * sobrando. Fica dentro da tela Checkins (pedido do usuário: "não precisa
 * dessa segunda tela"). */
export function SaldoDoMes({
  mes,
  versao,
  totalCheckinsPeriodo,
  onVinculado,
}: {
  mes: Date;
  versao: number;
  // Total do período do filtro da tela (hoje/semana/mês), não do mês.
  totalCheckinsPeriodo: number;
  onVinculado: () => void;
}) {
  const [linhas, setLinhas] = useState<WellhubReconciliacaoLinha[]>([]);
  const [checkins, setCheckins] = useState<WellhubCheckin[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [vinculando, setVinculando] = useState<PessoaSemVinculo | null>(null);

  const mesParam = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, "0")}`;

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [acerto, lista] = await Promise.all([
        api.get<WellhubReconciliacao>(`/wellhub/reconciliacao?mes=${mesParam}`),
        api.get<WellhubCheckin[]>(`/wellhub/checkins?mes=${mesParam}`),
      ]);
      setLinhas(acerto.linhas);
      setCheckins(lista);
    } catch {
      setErro("Não foi possível carregar o saldo do mês.");
    }
  }, [mesParam]);

  useEffect(() => {
    carregar();
  }, [carregar, versao]);

  const hoje = new Date();
  const mesEmAndamento = mes.getFullYear() === hoje.getFullYear() && mes.getMonth() === hoje.getMonth();

  const vinculadas = linhas.filter((l) => l.aluno_id !== null);
  const semVinculo = linhas.filter((l) => l.aluno_id === null);
  const devendo = vinculadas.filter((l) => l.saldo < 0);
  const checkinsFaltando = devendo.reduce((soma, l) => soma - l.saldo, 0);
  const checkinsSobrando = vinculadas.reduce((soma, l) => soma + Math.max(0, l.saldo), 0);
  const escala = Math.max(1, ...vinculadas.map((l) => Math.max(l.checkins_no_mes, l.aulas_no_mes)));

  function abrirVinculo(linha: WellhubReconciliacaoLinha) {
    if (linha.gympass_id === null) return;
    const ultimo = checkins.find((c) => c.plataforma === linha.plataforma && c.gympass_id === linha.gympass_id);
    setVinculando({
      plataforma: linha.plataforma,
      gympass_id: linha.gympass_id,
      nome: ultimo?.aluno_nome ?? null,
      email: ultimo?.email_wellhub ?? null,
    });
  }

  if (erro) return <p className="form-error">{erro}</p>;

  return (
    <section className="section">
      {devendo.length > 0 && (
        <div className="saldo-alerta" role="alert">
          <Icon name="flag" size={18} />
          <span>
            <strong>{plural(devendo.length, "aluno", "alunos")}</strong>{" "}
            {mesEmAndamento
              ? `com menos check-ins que aulas até agora — faltam ${plural(checkinsFaltando, "check-in", "check-ins")} pra zerar até o fim do mês.`
              : `fechou o mês com check-ins a menos que aulas — ${plural(checkinsFaltando, "check-in", "check-ins")} faltando.`}
          </span>
        </div>
      )}

      <div className="stats-grid saldo-stats">
        <div className="stat-tile">
          <div className="stat-label">Alunos no mês</div>
          <div className="stat-value">{vinculadas.length}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Checkins</div>
          <div className="stat-value">{totalCheckinsPeriodo}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Check-ins faltando</div>
          <div className="stat-value">{checkinsFaltando}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-label">Check-ins sobrando</div>
          <div className="stat-value">{checkinsSobrando}</div>
        </div>
      </div>

      {vinculadas.length > 0 && (
        <>
          <div className="saldo-legenda" aria-hidden="true">
            <span><i className="saldo-legenda-cor saldo-cor-checkin" /> Check-ins</span>
            <span><i className="saldo-legenda-cor saldo-cor-aula" /> Aulas</span>
          </div>
          <div className="saldo-grafico">
            {vinculadas.map((l) => (
              <LinhaSaldo key={`${l.plataforma}-${l.aluno_id}`} linha={l} escala={escala} mesEmAndamento={mesEmAndamento} />
            ))}
          </div>
        </>
      )}

      {semVinculo.length > 0 && (
        <div className="saldo-sem-vinculo">
          <h3>Sem aluno vinculado ({semVinculo.length})</h3>
          <p className="cobranca-dica">
            Check-ins que não foram ligados a nenhum aluno — sem o vínculo, não dá pra comparar com as aulas.
          </p>
          <div className="card-list">
            {semVinculo.map((l) => {
              const ultimo = checkins.find((c) => c.plataforma === l.plataforma && c.gympass_id === l.gympass_id);
              return (
                <div className="item-card" key={`${l.plataforma}-${l.gympass_id}`}>
                  <div className="item-card-info">
                    <span className="item-card-title">{ultimo?.aluno_nome ?? l.gympass_id}</span>
                    <span className="item-card-subtitle">
                      {rotuloPagamentoMeio(l.plataforma)} · {l.gympass_id} · {plural(l.checkins_no_mes, "check-in", "check-ins")}
                    </span>
                  </div>
                  <button type="button" className="secondary" onClick={() => abrirVinculo(l)}>
                    Vincular aluno
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {vinculando && (
        <VincularAlunoModal
          pessoa={vinculando}
          onFechar={() => setVinculando(null)}
          onSalvo={() => {
            setVinculando(null);
            carregar();
            onVinculado();
          }}
        />
      )}
    </section>
  );
}

function LinhaSaldo({
  linha,
  escala,
  mesEmAndamento,
}: {
  linha: WellhubReconciliacaoLinha;
  escala: number;
  mesEmAndamento: boolean;
}) {
  const { checkins_no_mes: checkins, aulas_no_mes: aulas, saldo } = linha;
  const status: { classe: string; icone: IconName | null; texto: string } =
    saldo < 0
      ? { classe: "status-risk", icone: "x-circle", texto: `Faltam ${-saldo}` }
      : saldo === 0
        ? { classe: "status-good", icone: "check-circle", texto: "Zerado" }
        : { classe: "status-neutral", icone: null, texto: `+${saldo} sobrando` };
  const resumo =
    saldo < 0
      ? `faltam ${plural(-saldo, "check-in", "check-ins")}${mesEmAndamento ? " até o fim do mês" : ""}`
      : saldo === 0
        ? "saldo zerado"
        : `${plural(saldo, "check-in", "check-ins")} sobrando`;

  return (
    <div
      className="saldo-linha"
      title={`${linha.aluno_nome}: ${plural(checkins, "check-in", "check-ins")}, ${plural(aulas, "aula", "aulas")} — ${resumo}`}
    >
      <div className="saldo-nome">
        <span className="item-card-title">{linha.aluno_nome}</span>
        <span className="item-card-subtitle">{rotuloPagamentoMeio(linha.plataforma)}</span>
      </div>
      <div className="saldo-barras">
        <Barra valor={checkins} escala={escala} classe="saldo-cor-checkin" rotulo="check-ins" />
        <Barra valor={aulas} escala={escala} classe="saldo-cor-aula" rotulo="aulas" />
      </div>
      <span className={`status-pill ${status.classe} saldo-status`}>
        {status.icone && <Icon name={status.icone} size={13} />}
        {status.texto}
      </span>
    </div>
  );
}

function Barra({ valor, escala, classe, rotulo }: { valor: number; escala: number; classe: string; rotulo: string }) {
  return (
    <div className="saldo-barra-trilho">
      {/* 84px reservados pro número + rótulo logo depois da barra. */}
      <div className={`saldo-barra ${classe}`} style={{ width: `calc((100% - 84px) * ${valor / escala})` }} />
      <span className="saldo-barra-valor">
        {valor} <span className="saldo-barra-rotulo">{rotulo}</span>
      </span>
    </div>
  );
}
