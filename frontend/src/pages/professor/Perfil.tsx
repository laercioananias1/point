import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import type { ProfessorResumo, Vinculo } from "../../api/types";
import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { Layout } from "../../components/Layout";
import { PerfilTopo } from "../../components/PerfilTopo";
import { StatusPill } from "../../components/StatusPill";
import { TemaToggle } from "../../components/TemaToggle";
import { TrocarArea } from "../../components/TrocarArea";

/** Perfil do professor (pedido do usuário, 2026-08-25: "seguindo o mesmo
 * padrão" do aluno). Dados da conta + Points com quem tem vínculo — criar
 * turma/agenda ficam nas outras abas. Banners e dados do Point ficam na
 * Início (pedido do usuário, 2026-08-30: "retira do perfil"). Layout do
 * kit (pedido do usuário, 2026-10-01): topo com foto + cards. */
export default function ProfessorPerfil() {
  const [perfil, setPerfil] = useState<ProfessorResumo | null>(null);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [perfilRes, vinculosRes] = await Promise.all([
        api.get<ProfessorResumo>("/professores/me"),
        api.get<Vinculo[]>("/professores/me/vinculos"),
      ]);
      setPerfil(perfilRes);
      setVinculos(vinculosRes);
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar seu perfil. Tente novamente.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <Layout>
      <CabecalhoPagina titulo="Perfil" contexto="Minha conta" />

      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && perfil && (
        <>
          <PerfilTopo papel="Professor" detalhes={[perfil.email, perfil.contato]} />
          <div className="perfil-grade">
            <section className="alunos-card perfil-card">
              <h2 className="chk-secao-titulo">Meus vínculos</h2>
              {vinculos.length === 0 ? (
                <p className="alunos-sub">
                  Você ainda não tem vínculo com nenhum Point — aguarde um convite por e-mail.
                </p>
              ) : (
                <ul className="perfil-lista">
                  {vinculos.map((v) => (
                    <li key={v.id}>
                      <span className="alunos-pessoa-texto">
                        <span className="alunos-nome">{v.point.nome}</span>
                        <span className="alunos-sub">{v.point.endereco}</span>
                      </span>
                      <StatusPill status={v.status} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <TemaToggle />
            <TrocarArea papelAtual="professor" />
          </div>
        </>
      )}
    </Layout>
  );
}
