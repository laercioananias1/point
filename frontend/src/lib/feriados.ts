import { api } from "../api/client";
import type { Feriado } from "../api/types";

/** Feriados (nacional + local) de um conjunto de Points, pro ano atual e
 * o seguinte (cobre navegação do calendário perto da virada do ano) —
 * pedido do usuário, 2026-09-01: o calendário não pode mostrar aula
 * marcada num feriado, já que o backend nunca gera essa Aula
 * (gerar_aulas_do_mes). Um professor pode dar aula em mais de um Point,
 * cada um com feriados locais diferentes — por isso o resultado é por
 * point_id, não uma lista solta. */
export async function buscarFeriadosPorPoint(pointIds: number[]): Promise<Record<number, Feriado[]>> {
  const ids = Array.from(new Set(pointIds));
  const anoAtual = new Date().getFullYear();
  const resultado: Record<number, Feriado[]> = {};
  await Promise.all(
    ids.map(async (id) => {
      const [desteAno, proximoAno] = await Promise.all([
        api.get<Feriado[]>(`/feriados?point_id=${id}&ano=${anoAtual}`),
        api.get<Feriado[]>(`/feriados?point_id=${id}&ano=${anoAtual + 1}`),
      ]);
      resultado[id] = [...desteAno, ...proximoAno];
    }),
  );
  return resultado;
}
