import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { Layout } from "../../components/Layout";
import { PerfilTopo } from "../../components/PerfilTopo";
import { TemaToggle } from "../../components/TemaToggle";
import { TrocarArea } from "../../components/TrocarArea";

/** Perfil do dono do app (pedido do usuário, 2026-08-26: "seguindo o mesmo
 * padrão" — virou aba própria). Layout do kit (pedido do usuário,
 * 2026-10-01). */
export default function DonoAppPerfil() {
  return (
    <Layout>
      <CabecalhoPagina titulo="Perfil" contexto="Minha conta" />
      <PerfilTopo papel="Dono do app" />
      <div className="perfil-grade">
        <TemaToggle />
        <TrocarArea papelAtual="super_admin" />
      </div>
    </Layout>
  );
}
