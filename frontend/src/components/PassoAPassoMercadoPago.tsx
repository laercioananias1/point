/** Passo a passo pra o dono do Point pegar o Access Token do Mercado Pago
 * (pedido do usuário, 2026-10-02: "seria bom ter um passo a passo...
 * normalmente não são técnicos"). Usado no cartão de Integrações e na
 * Ajuda. Os nomes dos menus seguem o painel do MP de hoje — se mudarem,
 * é aqui que atualiza. */
export function PassoAPassoMercadoPago() {
  return (
    <div className="mp-passos">
      <p className="mp-passos-intro">
        Leva uns 5 minutos e é feito uma vez só. Faça pelo <strong>computador</strong>, entrando com a conta do
        Mercado Pago que vai <strong>receber o dinheiro</strong> da arena.
      </p>
      <ol>
        <li>
          <strong>Tenha a conta Mercado Pago da arena.</strong> Se ainda não tem, crie em{" "}
          <a href="https://www.mercadopago.com.br" target="_blank" rel="noopener noreferrer">
            mercadopago.com.br
          </a>{" "}
          (pode ser com CNPJ ou CPF).
        </li>
        <li>
          <strong>Cadastre uma chave Pix nessa conta.</strong> No app do Mercado Pago: <em>Pix → Minhas chaves →
          Cadastrar chave</em> (CNPJ, CPF, e-mail ou celular). Sem chave Pix, o pagamento não funciona.
        </li>
        <li>
          <strong>Abra o painel de integrações</strong> do Mercado Pago:{" "}
          <a href="https://www.mercadopago.com.br/developers/panel/app" target="_blank" rel="noopener noreferrer">
            mercadopago.com.br/developers/panel/app
          </a>
          . Se pedir, aceite os termos.
        </li>
        <li>
          <strong>Clique em "Criar aplicação".</strong> Dê o nome <em>OPoint</em>. Quando perguntar o tipo de
          solução, escolha <em>Pagamentos online</em> e depois <em>Checkout Transparente</em> (ou "API"). Confirme.
        </li>
        <li>
          <strong>Entre na aplicação e clique em "Credenciais de produção"</strong>, no menu da esquerda. Se pedir
          para ativar, informe o ramo (ex.: Esportes) e o site <em>opoint.com.br</em>.
        </li>
        <li>
          <strong>Copie o "Access Token".</strong> É um código comprido que começa com <code>APP_USR-</code>. Não
          use os que começam com <code>TEST-</code> — esses são só de teste e não recebem dinheiro.
        </li>
        <li>
          <strong>Cole aqui no OPoint</strong>, em Integrações → Pagamento online, e clique em{" "}
          <em>Ligar pagamento online</em>. Se aparecer o e-mail da sua conta, está pronto.
        </li>
      </ol>
      <p className="mp-passos-dica">
        <strong>Dica:</strong> faça um teste com uma aula de R$ 1,00 pagando de <strong>outra</strong> conta ou banco.{" "}
        <strong>Cuidado:</strong> o token funciona como uma senha — não envie por WhatsApp ou e-mail. Se vazar, clique
        em "Renovar" no mesmo lugar do Mercado Pago e cole o novo aqui.
      </p>
    </div>
  );
}
