import { urlArquivo } from "../api/client";
import { LogoMark } from "./LogoMark";

/** Marca no topo das telas públicas sem login (convite, aula
 * experimental) — pedido do usuário, 2026-09-14: "dar destaque para o
 * logo de cada point". Quando já sabemos qual Point é (convite/aula
 * experimental carregam isso), mostra o logo e o nome DELE em vez da
 * marca genérica OPoint, com "via OPoint" discreto embaixo — a marca
 * genérica só aparece enquanto ainda carrega, ou se o Point não tiver
 * logo próprio (cai no LogoMark mesmo assim, só troca o texto). */
export function PointBrand({ point }: { point?: { nome: string; logo: string | null } | null }) {
  return (
    <>
      <div className="auth-brand">
        {point?.logo ? (
          <img src={urlArquivo(point.logo)} alt={point.nome} className="auth-brand-logo" />
        ) : (
          <LogoMark size={28} />
        )}
        <span className="auth-brand-name">{point?.nome ?? "OPoint"}</span>
      </div>
      {point && <p className="auth-brand-credit">via OPoint</p>}
    </>
  );
}
