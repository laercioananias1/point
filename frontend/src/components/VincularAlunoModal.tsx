import { useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import type { AlunoResumo, PlataformaCheckin } from "../api/types";
import { rotuloPagamentoMeio } from "../lib/formato";
import { Icon } from "./Layout";

export interface PessoaSemVinculo {
  plataforma: PlataformaCheckin;
  gympass_id: string;
  nome: string | null;
  email: string | null;
}

/** Vínculo manual quando o automático (Gympass ID ou e-mail) não achou o
 * aluno (pedido do usuário, 2026-09-30) — por pessoa ("o email é o mesmo
 * sempre"), não por check-in. Começa buscando pelo e-mail (ou pelo nome,
 * se não tiver e-mail). */
export function VincularAlunoModal({
  pessoa,
  onFechar,
  onSalvo,
}: {
  pessoa: PessoaSemVinculo;
  onFechar: () => void;
  onSalvo: () => void;
}) {
  const [busca, setBusca] = useState(pessoa.email ?? pessoa.nome ?? "");
  const [alunos, setAlunos] = useState<AlunoResumo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) {
      setAlunos([]);
      return;
    }
    setBuscando(true);
    const timer = setTimeout(() => {
      api
        .get<AlunoResumo[]>(`/alunos?busca=${encodeURIComponent(termo)}`)
        .then(setAlunos)
        .catch(() => setErro("Não foi possível buscar alunos."))
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  async function vincular(aluno: AlunoResumo) {
    setErro(null);
    setSalvandoId(aluno.id);
    try {
      await api.patch("/wellhub/vinculo", {
        plataforma: pessoa.plataforma,
        gympass_id: pessoa.gympass_id,
        aluno_id: aluno.id,
      });
      onSalvo();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível vincular.");
    } finally {
      setSalvandoId(null);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className="modal-card form-card" onClick={(e) => e.stopPropagation()}>
        <div className="cobranca-modal-topo">
          <h2>Vincular aluno</h2>
          <button
            type="button"
            className="secondary cobranca-btn-icone"
            onClick={onFechar}
            aria-label="Fechar"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <p className="cobranca-dica">
          {pessoa.nome ?? pessoa.gympass_id} · {rotuloPagamentoMeio(pessoa.plataforma)}. Todos os
          check-ins dessa pessoa serão vinculados
          {pessoa.plataforma === "wellhub" ? ", e os próximos já chegam vinculados" : ""}.
        </p>

        <label>
          Buscar aluno
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, e-mail ou telefone"
            autoFocus
          />
        </label>

        {erro && <p className="form-error">{erro}</p>}
        {buscando && <p className="empty-state">Buscando...</p>}
        {!buscando && busca.trim().length >= 2 && alunos.length === 0 && (
          <p className="empty-state">Nenhum aluno encontrado.</p>
        )}

        <div className="card-list">
          {alunos.map((a) => (
            <div className="item-card" key={a.id}>
              <div className="item-card-info">
                <span className="item-card-title">{a.nome}</span>
                <span className="item-card-subtitle">
                  {[a.email, a.contato].filter(Boolean).join(" · ")}
                </span>
              </div>
              <button type="button" disabled={salvandoId !== null} onClick={() => vincular(a)}>
                {salvandoId === a.id ? "Vinculando..." : "Vincular"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
