import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, urlArquivo } from "../../api/client";
import type { Point } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";

const MAX_FOTOS = 5;
const MAX_BANNERS = 5;

/** Tela "Meu Point" (pedido do usuário, 2026-08-30: "um botão de Meu
 * Point onde vai ter uma tela para fazer um cadastro de Sobre..., um
 * cadastro tb de informações importantes, e permitir inserir até 5 fotos
 * do point. Esses dados vão aparecer na página principal") — tudo isso
 * aparece na Início do aluno (ver pages/aluno/Inicio.tsx), em dois
 * pontos diferentes: Anúncios + Banners preenchem o banner do meio da
 * página (pedido do usuário, 2026-08-30: "na parte do meio vai colocar
 * anúncios" / "anúncios será imagens também, como banners"); Sobre,
 * Informações importantes e as Fotos (carrossel) aparecem juntos no fim,
 * depois de "Próximas aulas". */
export default function AdminPointMeuPoint() {
  const navigate = useNavigate();
  const [point, setPoint] = useState<Point | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      setPoint(await api.get<Point>("/points/me"));
    } catch {
      setErro("Não foi possível carregar o Point. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

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
          aria-label="Fechar"
        >
          <Icon name="x" />
        </button>
        <h1>Meu Point</h1>
      </div>

      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && point && (
        <>
          <section className="section">
            <h2>Logomarca</h2>
            <p className="empty-state" style={{ paddingTop: 0 }}>
              Aparece no canto esquerdo do cabeçalho, no lugar da marca genérica do app, pra quem
              está logado nesse Point.
            </p>
            <LogoPoint point={point} onMudou={setPoint} />
          </section>

          <section className="section">
            <PerfilForm point={point} onSalvo={setPoint} />
          </section>

          <section className="section">
            <h2>
              Banners ({point.banners.length}/{MAX_BANNERS})
            </h2>
            <p className="empty-state" style={{ paddingTop: 0 }}>
              Aparecem em carrossel na parte do meio da Início do aluno.
            </p>
            <ImagensPoint
              imagens={point.banners}
              max={MAX_BANNERS}
              endpoint="/points/me/banners"
              rotuloItem="banner"
              onMudou={setPoint}
            />
          </section>

          <section className="section">
            <h2>
              Fotos ({point.fotos.length}/{MAX_FOTOS})
            </h2>
            <p className="empty-state" style={{ paddingTop: 0 }}>
              Aparecem em carrossel no fim da Início do aluno, junto de Sobre e Informações
              importantes.
            </p>
            <ImagensPoint
              imagens={point.fotos}
              max={MAX_FOTOS}
              endpoint="/points/me/fotos"
              rotuloItem="foto"
              onMudou={setPoint}
            />
          </section>
        </>
      )}
    </Layout>
  );
}

/** Grade de upload/remoção de imagem (pedido do usuário, 2026-08-30:
 * "anúncios será imagens também, como banners") — mesma mecânica pra
 * Fotos e Banners, só muda o endpoint/limite/rótulo. */
function ImagensPoint({
  imagens,
  max,
  endpoint,
  rotuloItem,
  onMudou,
}: {
  imagens: string[];
  max: number;
  endpoint: string;
  rotuloItem: string;
  onMudou: (p: Point) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [removendo, setRemovendo] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function selecionarArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setErro(null);
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);
      const atualizado = await api.upload<Point>(endpoint, formData);
      onMudou(atualizado);
    } catch (e) {
      setErro(
        e instanceof ApiError ? e.message : `Não foi possível enviar o ${rotuloItem}. Tente de novo.`,
      );
    } finally {
      setEnviando(false);
    }
  }

  async function remover(url: string) {
    setErro(null);
    setRemovendo(url);
    try {
      const atualizado = await api.delete<Point>(`${endpoint}?url=${encodeURIComponent(url)}`);
      onMudou(atualizado);
    } catch {
      setErro(`Não foi possível remover o ${rotuloItem}. Tente de novo.`);
    } finally {
      setRemovendo(null);
    }
  }

  return (
    <div>
      {imagens.length > 0 && (
        <div className="foto-point-grade">
          {imagens.map((imagem) => (
            <div className="foto-point-item" key={imagem}>
              <img src={urlArquivo(imagem)} alt={`${rotuloItem[0].toUpperCase()}${rotuloItem.slice(1)} do Point`} />
              <button
                type="button"
                className="foto-point-remover"
                disabled={removendo === imagem}
                onClick={() => remover(imagem)}
                aria-label={`Remover ${rotuloItem}`}
              >
                <Icon name="x" />
              </button>
            </div>
          ))}
        </div>
      )}

      {erro && <p className="form-error">{erro}</p>}

      {imagens.length < max ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={selecionarArquivo}
            style={{ display: "none" }}
          />
          <button
            type="button"
            className="secondary"
            style={{ marginTop: 12 }}
            disabled={enviando}
            onClick={() => inputRef.current?.click()}
          >
            {enviando ? "Enviando..." : `Adicionar ${rotuloItem}`}
          </button>
        </>
      ) : (
        <p className="empty-state" style={{ marginTop: 12 }}>
          Máximo de {max} {rotuloItem}s atingido — remova um pra adicionar outro.
        </p>
      )}
    </div>
  );
}

/** Slot único de logomarca (pedido do usuário, 2026-08-30: "coloque
 * também um ícone (logomarca do point)") — diferente de ImagensPoint
 * (lista): enviar um logo novo substitui o anterior automaticamente, sem
 * precisar remover primeiro. */
function LogoPoint({ point, onMudou }: { point: Point; onMudou: (p: Point) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function selecionarArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setErro(null);
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);
      const atualizado = await api.upload<Point>("/points/me/logo", formData);
      onMudou(atualizado);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível enviar o logo. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  async function remover() {
    setErro(null);
    setRemovendo(true);
    try {
      const atualizado = await api.delete<Point>("/points/me/logo");
      onMudou(atualizado);
    } catch {
      setErro("Não foi possível remover o logo. Tente de novo.");
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <div>
      {point.logo && (
        <div className="foto-point-item" style={{ width: 90, marginBottom: 12 }}>
          <img src={urlArquivo(point.logo)} alt="Logomarca do Point" style={{ objectFit: "contain" }} />
          <button
            type="button"
            className="foto-point-remover"
            disabled={removendo}
            onClick={remover}
            aria-label="Remover logo"
          >
            <Icon name="x" />
          </button>
        </div>
      )}

      {erro && <p className="form-error">{erro}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={selecionarArquivo}
        style={{ display: "none" }}
      />
      <button
        type="button"
        className="secondary"
        disabled={enviando}
        onClick={() => inputRef.current?.click()}
      >
        {enviando ? "Enviando..." : point.logo ? "Trocar logo" : "Adicionar logo"}
      </button>
    </div>
  );
}

function PerfilForm({ point, onSalvo }: { point: Point; onSalvo: (p: Point) => void }) {
  const [nome, setNome] = useState(point.nome);
  const [endereco, setEndereco] = useState(point.endereco);
  const [sobre, setSobre] = useState(point.sobre ?? "");
  const [informacoesImportantes, setInformacoesImportantes] = useState(
    point.informacoes_importantes ?? "",
  );
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(false);
    setEnviando(true);
    try {
      const atualizado = await api.patch<Point>("/points/me/perfil", {
        nome,
        endereco,
        sobre: sobre || null,
        informacoes_importantes: informacoesImportantes || null,
      });
      onSalvo(atualizado);
      setSucesso(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível salvar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} style={{ marginTop: 0 }}>
      <label>
        Nome do Point
        <input value={nome} onChange={(e) => setNome(e.target.value)} required />
      </label>
      <label>
        Endereço
        <input value={endereco} onChange={(e) => setEndereco(e.target.value)} required />
      </label>

      <label>
        Sobre
        <textarea
          rows={4}
          placeholder="Conte pro aluno um pouco sobre o Point — estrutura, diferenciais, história..."
          value={sobre}
          onChange={(e) => setSobre(e.target.value)}
        />
      </label>

      <label>
        Informações importantes
        <textarea
          rows={4}
          placeholder="Regras, o que levar, como chegar, estacionamento..."
          value={informacoesImportantes}
          onChange={(e) => setInformacoesImportantes(e.target.value)}
        />
      </label>
      <p className="empty-state" style={{ padding: 0, marginTop: -6 }}>
        Sobre e Informações importantes aparecem no fim da Início do aluno, depois de "Próximas
        aulas".
      </p>

      {erro && <p className="form-error">{erro}</p>}
      {sucesso && <p className="form-success">Salvo.</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
