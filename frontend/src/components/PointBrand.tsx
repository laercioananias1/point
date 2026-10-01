import { urlArquivo } from "../api/client";
import { LogoMark, MarcaOPoint } from "./LogoMark";

/** Marca no topo das telas públicas sem login (convite, aula
 * experimental) — pedido do usuário, 2026-09-14: "dar destaque para o
 * logo de cada point". Quando já sabemos qual Point é, mostra o logo e o
 * nome DELE, com "via OPoint" discreto embaixo; a marca OPoint completa
 * só aparece enquanto ainda carrega. */
export function PointBrand({ point }: { point?: { nome: string; logo: string | null } | null }) {
  if (!point) {
    return (
      <div className="auth-brand">
        <MarcaOPoint />
      </div>
    );
  }
  return (
    <>
      <div className="auth-brand">
        {point.logo ? (
          <img src={urlArquivo(point.logo)} alt={point.nome} className="auth-brand-logo" />
        ) : (
          <LogoMark size={28} />
        )}
        <span className="auth-brand-name">{point.nome}</span>
      </div>
      <p className="auth-brand-credit">via OPoint</p>
    </>
  );
}
