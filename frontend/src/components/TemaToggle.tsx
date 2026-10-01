import { useState } from "react";
import { lerTemaSalvo, salvarTema, type Tema } from "../theme";

const OPCOES: { valor: Tema; rotulo: string }[] = [
  { valor: "sistema", rotulo: "Sistema" },
  { valor: "claro", rotulo: "Claro" },
  { valor: "escuro", rotulo: "Escuro" },
];

/** Escolha de tema (pedido do usuário, 2026-09-01: "já aproveita e faz o
 * modo dark também") — mesmo componente nas 4 telas de Perfil (admin,
 * professor, aluno, dono do app), do lado de "Trocar de área". "Sistema"
 * é o padrão: segue o SO sem gravar nada. */
export function TemaToggle() {
  const [tema, setTema] = useState<Tema>(() => lerTemaSalvo());

  function escolher(valor: Tema) {
    setTema(valor);
    salvarTema(valor);
  }

  return (
    <section className="alunos-card perfil-card">
      <h2 className="chk-secao-titulo">Aparência</h2>
      <p className="alunos-sub">"Sistema" segue o modo claro/escuro do seu celular ou computador.</p>
      <div className="agenda-passos perfil-tema" role="radiogroup" aria-label="Tema">
        {OPCOES.map((op) => (
          <button
            key={op.valor}
            type="button"
            role="radio"
            aria-checked={tema === op.valor}
            className={tema === op.valor ? "ativo" : ""}
            onClick={() => escolher(op.valor)}
          >
            {op.rotulo}
          </button>
        ))}
      </div>
    </section>
  );
}
