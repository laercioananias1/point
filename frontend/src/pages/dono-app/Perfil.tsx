import { useAuth } from "../../auth/AuthContext";
import { Layout } from "../../components/Layout";
import { TrocarArea } from "../../components/TrocarArea";

/** Perfil do dono do app (pedido do usuário, 2026-08-26: "seguindo o mesmo
 * padrão" — virou aba própria). */
export default function DonoAppPerfil() {
  const { user } = useAuth();

  return (
    <Layout>
      <h1>Perfil</h1>

      <section className="section">
        <h2>Minha conta</h2>
        <div className="item-card" style={{ alignItems: "flex-start" }}>
          <div className="item-card-info">
            <span className="item-card-title">{user?.nome}</span>
            <span className="item-card-subtitle">Dono do app</span>
          </div>
        </div>
      </section>

      <TrocarArea papelAtual="super_admin" />
    </Layout>
  );
}
