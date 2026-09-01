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
    <section className="section">
      <h2>Aparência</h2>
      <div className="toggle-grid">
        {OPCOES.map((op) => (
          <button
            key={op.valor}
            type="button"
            className={tema === op.valor ? "toggle-chip active" : "toggle-chip"}
            onClick={() => escolher(op.valor)}
          >
            {op.rotulo}
          </button>
        ))}
      </div>
    </section>
  );
}
