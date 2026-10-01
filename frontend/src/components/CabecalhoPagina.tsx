import { Link } from "react-router-dom";

/** Cabeçalho de página do kit de design: contexto pequeno em cima ("Cadastros
 * · 4 quadras"), título grande e o botão principal da tela à direita. */
export function CabecalhoPagina({
  titulo,
  contexto,
  novo,
}: {
  titulo: string;
  contexto: string;
  novo?: { para: string; rotulo: string } | null;
}) {
  return (
    <div className="pagina-topo">
      <div>
        <div className="pagina-contexto">{contexto}</div>
        <h1>{titulo}</h1>
      </div>
      {novo && (
        <Link to={novo.para} className="botao-link">
          + {novo.rotulo}
        </Link>
      )}
    </div>
  );
}
