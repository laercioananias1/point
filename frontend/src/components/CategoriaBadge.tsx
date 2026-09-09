/** Bolinha da cor da categoria + nome (pedido do usuário, 2026-09-08:
 * identificar visualmente a turma/aula pelo nível na agenda) — cor vem do
 * cadastro do Point, por isso é inline style em vez de classe fixa (não dá
 * pra saber as cores de antemão, ao contrário de StatusPill). Recebe
 * nome/cor soltos (em vez do objeto Categoria inteiro) pra servir também
 * quem só tem esses dois campos já achatados (ex.: OcorrenciaTurma). */
export function CategoriaBadge({ nome, cor }: { nome: string; cor: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span className="categoria-dot" style={{ background: cor }} aria-hidden="true" />
      {nome}
    </span>
  );
}
