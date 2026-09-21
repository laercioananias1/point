import { Icon, type IconName } from "./Layout";

export interface AbaPilula<T extends string> {
  valor: T;
  rotulo: string;
  icone: IconName;
  /** Contagem no selo à direita do rótulo; omitido = sem selo. */
  contagem?: number;
}

/** Abas em formato de pílula (pedido do usuário, 2026-09-20: "esses itens
 * de tela Convites pendentes, assinaturas ativas, etc deixa em botões em
 * cima conforme a tela exemplo") — troca o empilhamento de seções por um
 * botão por seção, com ícone e contagem, e mostra só a selecionada. */
export function AbasPilula<T extends string>({
  abas,
  ativa,
  onMudar,
}: {
  abas: AbaPilula<T>[];
  ativa: T;
  onMudar: (valor: T) => void;
}) {
  return (
    <div className="abas-pilula" role="tablist">
      {abas.map((aba) => (
        <button
          key={aba.valor}
          type="button"
          role="tab"
          aria-selected={aba.valor === ativa}
          className={`aba-pilula${aba.valor === ativa ? " active" : ""}`}
          onClick={() => onMudar(aba.valor)}
        >
          <Icon name={aba.icone} size={18} />
          {aba.rotulo}
          {aba.contagem !== undefined && aba.contagem > 0 && (
            <span className="aba-pilula-selo">{aba.contagem}</span>
          )}
        </button>
      ))}
    </div>
  );
}
