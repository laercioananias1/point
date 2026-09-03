import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Feriado } from "../../api/types";
import { useConfirm } from "../../components/ConfirmModal";
import { Icon, Layout } from "../../components/Layout";

function rotuloData(iso: string): string {
  return new Date(iso + "T00:00").toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "long",
  });
}

/** Cadastro de feriados (pedido do usuário, 2026-09-01: "preciso ter um
 * cadastro de feriados, se conseguir já ter os nacionais pré-cadastrados
 * é ótimo, mas também o admin pode cadastrar seus feriados locais") —
 * nacional vem calculado do backend (services/feriados.py, sem virar
 * linha no banco); local é cadastrado aqui, por ano.
 *
 * "O sistema nesse caso não pode criar [aula] nesses dias de feriados" —
 * a aplicação de verdade fica em gerar_aulas_do_mes (nunca gera Aula num
 * feriado) e nas validações de avulsa/reagendamento; essa tela é só o
 * cadastro/visualização. */
export default function AdminPointFeriados() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const anoAtual = new Date().getFullYear();
  const [ano, setAno] = useState(anoAtual);
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!user?.point_id) return;
    setLoading(true);
    setErro(null);
    try {
      setFeriados(await api.get<Feriado[]>(`/feriados?point_id=${user.point_id}&ano=${ano}`));
    } catch {
      setErro("Não foi possível carregar os feriados. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [user?.point_id, ano]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/admin-point/mais")}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Feriados</h1>
      </div>
      <p className="empty-state" style={{ paddingTop: 0 }}>
        O sistema nunca agenda aula em dia de feriado — nacional (já calculado) ou local, o que você
        cadastrar aqui.
      </p>

      <div className="mini-calendar-nav" style={{ marginBottom: 16 }}>
        <button className="secondary" onClick={() => setAno((a) => a - 1)} aria-label="Ano anterior">
          ‹
        </button>
        <span className="mini-calendar-titulo">{ano}</span>
        <button className="secondary" onClick={() => setAno((a) => a + 1)} aria-label="Próximo ano">
          ›
        </button>
      </div>

      {!user?.point_id && <p className="empty-state">Não foi possível identificar o seu Point.</p>}
      {erro && <p className="form-error">{erro}</p>}
      {loading && !erro && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && (
        <>
          <section className="section">
            {feriados.length === 0 ? (
              <p className="empty-state">Nenhum feriado em {ano}.</p>
            ) : (
              <div className="card-list">
                {feriados.map((f) => (
                  <FeriadoRow key={`${f.data}-${f.nome}`} feriado={f} onRemovido={carregar} />
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <h2>Cadastrar feriado local</h2>
            <CadastrarFeriadoForm ano={ano} onCadastrado={carregar} />
          </section>
        </>
      )}
    </Layout>
  );
}

function FeriadoRow({ feriado, onRemovido }: { feriado: Feriado; onRemovido: () => void }) {
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { confirmar, modal } = useConfirm();

  async function remover() {
    if (feriado.id === null) return;
    if (!(await confirmar(`Remover o feriado "${feriado.nome}"?`))) return;
    setErro(null);
    setRemovendo(true);
    try {
      await api.delete(`/feriados/${feriado.id}`);
      onRemovido();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível remover. Tente de novo.");
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <div className="item-card">
      {modal}
      <div className="item-card-info">
        <span className="item-card-title" style={{ textTransform: "capitalize" }}>
          {rotuloData(feriado.data)}
        </span>
        <span className="item-card-subtitle">{feriado.nome}</span>
        {erro && <p className="form-error">{erro}</p>}
      </div>
      {feriado.nacional ? (
        <span className="status-pill status-info">Nacional</span>
      ) : (
        <button className="secondary" disabled={removendo} onClick={remover}>
          {removendo ? "Removendo..." : "Remover"}
        </button>
      )}
    </div>
  );
}

function CadastrarFeriadoForm({ ano, onCadastrado }: { ano: number; onCadastrado: () => void }) {
  const [data, setData] = useState(`${ano}-01-01`);
  const [nome, setNome] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api.post("/feriados", { data, nome });
      setNome("");
      onCadastrado();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível cadastrar. Confira os dados.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} style={{ maxWidth: "none" }}>
      <div className="form-row">
        <label>
          Data
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        </label>
        <label>
          Nome
          <input
            placeholder="Aniversário da cidade"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </label>
      </div>
      {erro && <p className="form-error">{erro}</p>}
      <button type="submit" disabled={enviando}>
        {enviando ? "Cadastrando..." : "Cadastrar feriado"}
      </button>
    </form>
  );
}
