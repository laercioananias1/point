import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Feriado } from "../../api/types";
import { useConfirm } from "../../components/ConfirmModal";
import { CabecalhoPagina } from "../../components/CabecalhoPagina";
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
      <CabecalhoPagina
        titulo="Feriados"
        contexto={loading ? "Cadastros" : `Cadastros · ${feriados.length} em ${ano}`}
      />
      <p className="pagina-intro">
        O sistema nunca agenda aula em dia de feriado — nacional (já calculado) ou local, o que você
        cadastrar aqui.
      </p>

      {!user?.point_id && <p className="empty-state">Não foi possível identificar o seu Point.</p>}
      {erro && <p className="form-error">{erro}</p>}

      <div className="lista-com-form">
        <section className="cartao-lista">
          <div className="caixa-mes-nav">
            <button
              type="button"
              className="secondary cobranca-btn-icone"
              onClick={() => setAno((a) => a - 1)}
              aria-label="Ano anterior"
            >
              <Icon name="chevron-left" size={16} />
            </button>
            <span className="caixa-mes-rotulo">{ano}</span>
            <button
              type="button"
              className="secondary cobranca-btn-icone"
              onClick={() => setAno((a) => a + 1)}
              aria-label="Próximo ano"
            >
              <Icon name="chevron-right" size={16} />
            </button>
          </div>

          {loading && !erro && <p className="empty-state">Carregando...</p>}
          {!loading && !erro && feriados.length === 0 && (
            <p className="empty-state">Nenhum feriado em {ano}.</p>
          )}
          {!loading &&
            !erro &&
            feriados.map((f) => (
              <FeriadoRow key={`${f.data}-${f.nome}`} feriado={f} onRemovido={carregar} />
            ))}
        </section>

        <aside className="painel-form">
          <h2>Cadastrar feriado local</h2>
          <CadastrarFeriadoForm ano={ano} onCadastrado={carregar} />
        </aside>
      </div>
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
    <div className="feriado-linha">
      {modal}
      <span className="feriado-data">{rotuloData(feriado.data)}</span>
      <div className="alunos-pessoa-texto">
        <span className="alunos-nome">{feriado.nome}</span>
        {erro && <p className="form-error">{erro}</p>}
      </div>
      {feriado.nacional ? (
        <span className="status-pill status-info">Nacional</span>
      ) : (
        <button type="button" className="alunos-acao" disabled={removendo} onClick={remover}>
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
    <form className="painel-form-campos" onSubmit={handleSubmit}>
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
      {erro && <p className="form-error">{erro}</p>}
      <button type="submit" disabled={enviando}>
        {enviando ? "Cadastrando..." : "Cadastrar feriado"}
      </button>
    </form>
  );
}
