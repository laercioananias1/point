import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { api, ApiError, urlArquivo } from "../../api/client";
import type { Point } from "../../api/types";
import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { LogoMark } from "../../components/LogoMark";
import { Icon, Layout } from "../../components/Layout";

const MAX_FOTOS = 5;
const MAX_BANNERS = 5;

/** Tela "Meu Point" (pedido do usuário, 2026-08-30: "um botão de Meu
 * Point onde vai ter uma tela para fazer um cadastro de Sobre..., um
 * cadastro tb de informações importantes, e permitir inserir até 5 fotos
 * do point. Esses dados vão aparecer na página principal") — Banners
 * viram o card "Avisos do Point" no Início de alunos e professores; Sobre,
 * Informações importantes e Fotos formam o card do Point no fim do Início
 * (components/PointNoInicio.tsx).
 *
 * Layout do kit (pedido do usuário, 2026-10-01: "restiliza meu point"):
 * dados num card, logomarca com prévia do cabeçalho ao lado, banners e
 * fotos em cards com grade. A "cor de destaque do portal" saiu da tela —
 * desde o kit o app usa o limão fixo pra todo Point (o valor salvo segue
 * sendo reenviado intacto). */
export default function AdminPointMeuPoint() {
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
      <CabecalhoPagina titulo="Meu Point" contexto="Configurações" />

      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && point && (
        <div className="meupoint">
          <div className="meupoint-linha">
            <PerfilForm point={point} onSalvo={setPoint} />
            <LogoPoint point={point} onMudou={setPoint} />
          </div>

          <ImagensPoint
            titulo="Banners"
            descricao="Avisos e anúncios — aparecem no card “Avisos do Point” no Início de alunos e professores, trocando sozinhos."
            imagens={point.banners}
            max={MAX_BANNERS}
            endpoint="/points/me/banners"
            rotuloItem="banner"
            contido
            onMudou={setPoint}
          />

          <ImagensPoint
            titulo="Fotos do Point"
            descricao="Aparecem na galeria do card do Point, no fim do Início, junto de Sobre e Informações importantes."
            imagens={point.fotos}
            max={MAX_FOTOS}
            endpoint="/points/me/fotos"
            rotuloItem="foto"
            onMudou={setPoint}
          />
        </div>
      )}
    </Layout>
  );
}

/** Grade de upload/remoção de imagem (pedido do usuário, 2026-08-30:
 * "anúncios será imagens também, como banners") — mesma mecânica pra
 * Fotos e Banners, só muda o endpoint/limite/rótulo. O "+ Adicionar" é o
 * último quadrado da própria grade. */
function ImagensPoint({
  titulo,
  descricao,
  imagens,
  max,
  endpoint,
  rotuloItem,
  contido = false,
  onMudou,
}: {
  titulo: string;
  descricao: string;
  imagens: string[];
  max: number;
  endpoint: string;
  rotuloItem: string;
  // Banner é pôster: mostra inteiro (contain), não corta.
  contido?: boolean;
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

  const rotuloMaiusculo = `${rotuloItem[0].toUpperCase()}${rotuloItem.slice(1)}`;

  return (
    <section className="alunos-card meupoint-card">
      <div className="inicio-exp-topo">
        <h2 className="chk-secao-titulo">{titulo}</h2>
        <span className={imagens.length >= max ? "status-pill status-warn" : "status-pill status-neutral"}>
          {imagens.length}/{max}
        </span>
      </div>
      <p className="alunos-sub">{descricao}</p>

      <div className="meupoint-grade">
        {imagens.map((imagem) => (
          <div className={contido ? "meupoint-imagem contido" : "meupoint-imagem"} key={imagem}>
            <img src={urlArquivo(imagem)} alt={`${rotuloMaiusculo} do Point`} />
            <button
              type="button"
              className="meupoint-remover"
              disabled={removendo === imagem}
              onClick={() => remover(imagem)}
              aria-label={`Remover ${rotuloItem}`}
              title={`Remover ${rotuloItem}`}
            >
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))}
        {imagens.length < max && (
          <button
            type="button"
            className="meupoint-adicionar"
            disabled={enviando}
            onClick={() => inputRef.current?.click()}
          >
            <Icon name="plus" size={22} />
            <span>{enviando ? "Enviando..." : `Adicionar ${rotuloItem}`}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={selecionarArquivo}
        hidden
      />
      {imagens.length >= max && (
        <p className="alunos-sub">
          Máximo de {max} {rotuloItem}s atingido — remova um pra adicionar outro.
        </p>
      )}
      {erro && <p className="form-error">{erro}</p>}
    </section>
  );
}

/** Slot único de logomarca (pedido do usuário, 2026-08-30: "coloque
 * também um ícone (logomarca do point)") — enviar um logo novo substitui
 * o anterior automaticamente. Mostra uma prévia do cabeçalho com ele. */
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
    <section className="alunos-card meupoint-card meupoint-logo">
      <h2 className="chk-secao-titulo">Logomarca</h2>
      <p className="alunos-sub">
        Aparece no canto do cabeçalho, no lugar da marca do app, pra todo mundo logado nesse Point.
      </p>

      <div className="meupoint-logo-previa" aria-label="Prévia do cabeçalho">
        <span className="meupoint-logo-caixa">
          {point.logo ? <img src={urlArquivo(point.logo)} alt="Logomarca do Point" /> : <LogoMark />}
        </span>
        <span className="meupoint-logo-nome">{point.nome}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={selecionarArquivo}
        hidden
      />
      <div className="meupoint-logo-acoes">
        <button type="button" className="secondary" disabled={enviando} onClick={() => inputRef.current?.click()}>
          {enviando ? "Enviando..." : point.logo ? "Trocar logo" : "Adicionar logo"}
        </button>
        {point.logo && (
          <button type="button" className="alunos-acao" disabled={removendo} onClick={remover}>
            {removendo ? "Removendo..." : "Remover logo"}
          </button>
        )}
      </div>
      <span className="alunos-sub">PNG, JPG ou WebP. Quadrada fica melhor.</span>
      {erro && <p className="form-error">{erro}</p>}
    </section>
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
        // Sem campo na tela desde o kit (limão fixo) — reenvia o que já
        // estava salvo pra não apagar.
        cor_destaque: point.cor_destaque,
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
    <form className="alunos-card meupoint-card meupoint-form" onSubmit={handleSubmit}>
      <h2 className="chk-secao-titulo">Dados do Point</h2>
      <div className="form-grade">
        <label>
          Nome do Point
          <input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </label>
        <label>
          Endereço
          <input value={endereco} onChange={(e) => setEndereco(e.target.value)} required />
        </label>
      </div>

      <label>
        Sobre
        <textarea
          rows={5}
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
      <p className="alunos-sub">Sobre e Informações importantes aparecem no card do Point, no fim do Início.</p>

      {erro && <p className="form-error">{erro}</p>}

      <div className="meupoint-salvar">
        {sucesso && (
          <span className="meupoint-salvo">
            <Icon name="check" size={14} /> Salvo
          </span>
        )}
        <button type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
