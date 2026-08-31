import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { ProfessorResumo, Vinculo } from "../../api/types";
import { Layout } from "../../components/Layout";
import { StatusPill } from "../../components/StatusPill";
import { TrocarArea } from "../../components/TrocarArea";

/** Perfil do professor (pedido do usuário, 2026-08-25: "seguindo o mesmo
 * padrão" do aluno). Dados da conta + Points com quem tem vínculo — criar
 * turma/agenda ficam nas outras abas.
 *
 * Banners e dados do Point saíram daqui (pedido do usuário, 2026-08-30:
 * "retira do perfil") — foram pra Início do professor, junto do
 * placeholder de avisos que já existia lá (pages/professor/Inicio.tsx),
 * pra não duplicar a mesma informação em duas telas. */
export default function ProfessorPerfil() {
  const navigate = useNavigate();
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
      <h1>Perfil</h1>

      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && perfil && (
        <>
          <section className="section">
            <h2>Minha conta</h2>
            <div className="item-card" style={{ alignItems: "flex-start" }}>
              <div className="item-card-info">
                <span className="item-card-title">{perfil.nome}</span>
                <span className="item-card-subtitle">{perfil.email}</span>
                <span className="item-card-subtitle">{perfil.contato}</span>
                {perfil.modalidades.length > 0 && (
                  <span className="item-card-subtitle">{perfil.modalidades.join(" · ")}</span>
                )}
              </div>
            </div>
            <button
              type="button"
              className="secondary"
              style={{ marginTop: 12 }}
              onClick={() => navigate("/professor/perfil/senha")}
            >
              Trocar senha
            </button>
          </section>

          <section className="section">
            <h2>Meus vínculos ({vinculos.length})</h2>
            {vinculos.length === 0 ? (
              <p className="empty-state">
                Você ainda não tem vínculo com nenhum Point — aguarde um convite por e-mail.
              </p>
            ) : (
              <div className="card-list">
                {vinculos.map((v) => (
                  <div className="item-card" key={v.id}>
                    <div className="item-card-info">
                      <span className="item-card-title">{v.point.nome}</span>
                      <span className="item-card-subtitle">{v.point.endereco}</span>
                    </div>
                    <StatusPill status={v.status} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <TrocarArea papelAtual="professor" />
        </>
      )}
    </Layout>
  );
}
