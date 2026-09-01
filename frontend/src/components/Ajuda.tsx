import type { ReactNode } from "react";
import { Icon, type IconName } from "./Layout";

/** Peças da tela de Ajuda (pedido do usuário, 2026-09-01: "documentação
 * fácil de leitura... perguntas frequentes", depois "não fica melhor se
 * for online no app? tem um botão ajuda?" — documentação passou de um
 * link solto pra uma tela de verdade dentro do app, ver pages/admin-point/
 * Ajuda.tsx e pages/professor/Ajuda.tsx).
 *
 * Cada pergunta é um <details> com a cara de .action-card fechado — só o
 * título (a pergunta em si) aparece de cara; a resposta só abre quando
 * clicada. Formato pedido pelo usuário: "tipo: Como convidar um aluno?
 * Como convidar um professor?" — nada de texto corrido pra rolar. */
export function AjudaPergunta({
  icon,
  pergunta,
  nota,
  children,
}: {
  icon: IconName;
  pergunta: string;
  nota?: string;
  children: ReactNode;
}) {
  return (
    <details className="help-item">
      <summary className="action-card">
        <span className="action-card-icon">
          <Icon name={icon} />
        </span>
        <span className="action-card-info">
          <span className="action-card-title">{pergunta}</span>
        </span>
        <span className="action-card-chevron" aria-hidden="true">
          <Icon name="chevron-right" />
        </span>
      </summary>
      <div className="help-body">
        {children}
        {nota && <div className="help-note">{nota}</div>}
      </div>
    </details>
  );
}

export function AjudaCallout({ children }: { children: ReactNode }) {
  return <div className="help-callout">{children}</div>;
}

export function AjudaGlossario({ itens }: { itens: { termo: string; def: string }[] }) {
  return (
    <div className="help-glossary">
      {itens.map((it) => (
        <div className="help-glossary-item" key={it.termo}>
          <b>{it.termo}</b>
          <span>{it.def}</span>
        </div>
      ))}
    </div>
  );
}
