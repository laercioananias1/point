import { useState, type ReactNode } from "react";
import { urlArquivo } from "../api/client";
import type { PointResumo } from "../api/types";
import { faixaHorario, rotuloDias } from "../lib/dias";
import { Carrossel } from "./Carrossel";
import { Icon } from "./Layout";

// Tempo de cada aviso na tela antes de passar pro próximo.
const TEMPO_POR_AVISO_MS = 6000;

type PointDoInicio = Pick<
  PointResumo,
  | "nome"
  | "endereco"
  | "fotos"
  | "banners"
  | "sobre"
  | "informacoes_importantes"
  | "dias_semana_funcionamento"
  | "horarios_semana_funcionamento"
  | "dias_fds_funcionamento"
  | "horarios_fds_funcionamento"
>;

/** Avisos/anúncios do Point (banners) num card próprio (pedido do usuário,
 * 2026-10-01: "essas imagens de avisos, anúncios q vao rodar no meio" não
 * estavam legais soltas na página) — altura limitada, imagem inteira sem
 * corte e troca automática. Sem banner: mostra `vazio` (o admin vê onde
 * cadastrar) ou nada. */
export function AvisosDoPoint({ banners, vazio }: { banners: string[]; vazio?: ReactNode }) {
  if (banners.length === 0 && !vazio) return null;
  return (
    <section className="alunos-card avisos-point">
      <div className="inicio-exp-topo">
        <h2 className="chk-secao-titulo">Avisos do Point</h2>
        {banners.length > 1 && <span className="alunos-sub">{banners.length} avisos</span>}
      </div>
      {banners.length > 0 ? (
        <Carrossel fotos={banners} contido automatico={TEMPO_POR_AVISO_MS} />
      ) : (
        <p className="alunos-sub avisos-point-vazio">{vazio}</p>
      )}
    </section>
  );
}

/** Dados do Point no fim do Início (pedido do usuário, 2026-08-30) num
 * card de duas colunas: endereço, horários, Sobre e Informações
 * importantes de um lado, galeria de fotos (foto grande + miniaturas) do
 * outro — antes a foto ocupava a largura toda (pedido do usuário,
 * 2026-10-01: "os dados da arena (fotos, sobre)" não estavam legais). */
export function CartaoDoPoint({ point, titulo }: { point: PointDoInicio; titulo?: string }) {
  return (
    <section className="alunos-card cartao-point">
      <div className="cartao-point-texto">
        <h2 className="chk-secao-titulo">{titulo ?? point.nome}</h2>
        <p className="aluno-point-linha">
          <Icon name="pin" size={16} /> {point.endereco}
        </p>
        <p className="aluno-point-linha">
          <Icon name="clock" size={16} />
          <span>
            {rotuloDias(point.dias_semana_funcionamento)}: {faixaHorario(point.horarios_semana_funcionamento)}
            {point.dias_fds_funcionamento.length > 0 && (
              <>
                {" "}
                · {rotuloDias(point.dias_fds_funcionamento)}: {faixaHorario(point.horarios_fds_funcionamento)}
              </>
            )}
          </span>
        </p>
        {point.sobre && (
          <div>
            <h3 className="aluno-point-titulo">Sobre</h3>
            <p className="inicio-texto-point">{point.sobre}</p>
          </div>
        )}
        {point.informacoes_importantes && (
          <div className="cartao-point-importante">
            <h3 className="aluno-point-titulo">
              <Icon name="flag" size={14} /> Informações importantes
            </h3>
            <p className="inicio-texto-point">{point.informacoes_importantes}</p>
          </div>
        )}
      </div>
      {point.fotos.length > 0 && <GaleriaDeFotos fotos={point.fotos} nome={point.nome} />}
    </section>
  );
}

function GaleriaDeFotos({ fotos, nome }: { fotos: string[]; nome: string }) {
  const [atual, setAtual] = useState(0);
  const foto = fotos[Math.min(atual, fotos.length - 1)];
  return (
    <div className="galeria-point">
      <img className="galeria-point-principal" src={urlArquivo(foto)} alt={`Foto ${atual + 1} de ${nome}`} />
      {fotos.length > 1 && (
        <div className="galeria-point-miniaturas">
          {fotos.map((f, i) => (
            <button
              key={f}
              type="button"
              className={i === atual ? "galeria-point-miniatura ativa" : "galeria-point-miniatura"}
              onClick={() => setAtual(i)}
              aria-label={`Ver foto ${i + 1}`}
              aria-pressed={i === atual}
            >
              <img src={urlArquivo(f)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
