import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { Point } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Carrossel } from "../../components/Carrossel";
import { Layout } from "../../components/Layout";
import { TrocarArea } from "../../components/TrocarArea";

/** Perfil do admin do Point (pedido do usuário, 2026-08-25: "seguindo o
 * mesmo padrão" — virou aba própria). Dados de quem administra + do Point;
 * ajustar prazos/dias/preços fica em Configurações (ícone de engrenagem no
 * cabeçalho), não aqui — Perfil é só leitura da própria conta. Banners
 * também aparecem aqui (pedido do usuário, 2026-08-30: "perfil de
 * professor e adm tb aparece os banners") — o resto dos dados do Point
 * (endereço, horários, sobre...) não repete aqui porque o admin já
 * gerencia tudo isso direto em Meu Point. */
export default function AdminPointPerfil() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [point, setPoint] = useState<Point | null>(null);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setPoint(await api.get<Point>("/points/me"));
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

      {pronto && (
        <>
          <section className="section">
            <h2>Minha conta</h2>
            <div className="item-card" style={{ alignItems: "flex-start" }}>
              <div className="item-card-info">
                <span className="item-card-title">{user?.nome}</span>
                <span className="item-card-subtitle">Admin do Point</span>
              </div>
            </div>
            <button
              type="button"
              className="secondary"
              style={{ marginTop: 12 }}
              onClick={() => navigate("/admin-point/perfil/senha")}
            >
              Trocar senha
            </button>
          </section>

          {point && (
            <section className="section">
              <h2>Meu Point</h2>
              <div className="item-card" style={{ alignItems: "flex-start" }}>
                <div className="item-card-info">
                  <span className="item-card-title">{point.nome}</span>
                  <span className="item-card-subtitle">{point.endereco}</span>
                </div>
              </div>
              {point.banners.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Carrossel fotos={point.banners} contido />
                </div>
              )}
            </section>
          )}

          <TrocarArea papelAtual="admin_point" />
        </>
      )}
    </Layout>
  );
}
