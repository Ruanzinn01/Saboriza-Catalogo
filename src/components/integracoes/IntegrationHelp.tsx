const FAQ: { question: string; answer: React.ReactNode }[] = [
  {
    question: "Como funciona?",
    answer: (
      <ol className="list-decimal flex flex-col gap-1 pl-5">
        <li>Você cola a chave de API de um ambiente do Asaas e salva.</li>
        <li>O Saboriza testa a chave com o Asaas. Só uma chave aceita pode ser ativada.</li>
        <li>O ambiente ativo é o que o Faturar usa para criar cobranças e notas. Cobranças já criadas não mudam.</li>
      </ol>
    ),
  },
  {
    question: "O que é Sandbox e o que é Produção?",
    answer: (
      <p>
        <strong>Sandbox</strong> é o ambiente de testes do Asaas: nada é cobrado de verdade. <strong>Produção</strong> é o ambiente real: as cobranças vão
        para seus clientes. Use Sandbox para testar e Produção para operar. Cada ambiente tem sua própria chave, cadastrada separadamente aqui.
      </p>
    ),
  },
  {
    question: "Como encontro minha chave de API?",
    answer: (
      <p>
        No painel do Asaas, procure <em>Integrações</em> (ou <em>Configurações → Integrações</em>, conforme a versão do painel) e gere uma nova chave de API. Copie
        a chave no momento em que ela aparecer, porque o painel pode não mostrá-la de novo. Os nomes dos menus podem mudar.
      </p>
    ),
  },
  {
    question: "O que é webhook?",
    answer: (
      <p>
        É um aviso automático que o Asaas envia ao Saboriza quando algo acontece: pagamento recebido, cobrança vencida, nota autorizada. Sem ele, o status das
        cobranças não é atualizado sozinho. Ele é protegido por um token: se o token do webhook for trocado, os avisos antigos deixam de ser aceitos.
      </p>
    ),
  },
  {
    question: "Qual a diferença entre NF-e e NFS-e?",
    answer: (
      <p>
        <strong>NF-e</strong> é para venda de produtos e mercadorias. <strong>NFS-e</strong> é para prestação de serviços. São emitidas por caminhos diferentes e
        têm configurações próprias. Hoje o Saboriza emite NFS-e pelo Asaas; a NF-e de produto ainda não está disponível.
      </p>
    ),
  },
  {
    question: "Preciso de certificado digital?",
    answer: (
      <p>
        Esta tela não pede certificado. Se a prefeitura ou o Asaas exigir certificado para a sua emissão, isso é configurado no painel do Asaas. Não existe upload
        de certificado no Saboriza ainda.
      </p>
    ),
  },
  {
    question: "Quando minha nota é considerada autorizada?",
    answer: (
      <p>
        Quando o Asaas envia o aviso de nota autorizada pelo webhook. Até lá, a nota fica como <em>em processamento</em>. Se a prefeitura rejeitar, aparece como
        rejeitada, com o motivo.
      </p>
    ),
  },
  {
    question: "Por que minha integração está pendente?",
    answer: (
      <ul className="list-disc flex flex-col gap-1 pl-5">
        <li>
          <strong>Chave salva, falta testar:</strong> clique em Testar conexão.
        </li>
        <li>
          <strong>Conexão validada, inativo:</strong> ative o ambiente para o Saboriza usá-lo.
        </li>
        <li>
          <strong>Aguardando o primeiro evento:</strong> o webhook ainda não foi configurado no Asaas, ou nenhum pagamento aconteceu desde então.
        </li>
        <li>
          <strong>Chave recusada:</strong> gere uma nova chave no Asaas e substitua aqui.
        </li>
      </ul>
    ),
  },
];

export function IntegrationHelp() {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-bold text-forest-950">Ajuda</h2>
        <p className="text-sm text-ink-muted">Explicações rápidas. Abra cada tema quando precisar.</p>
      </div>

      <div className="flex flex-col gap-2">
        {FAQ.map((item) => (
          <details key={item.question} className="rounded-2xl border border-forest-950/10 bg-white p-4">
            <summary className="cursor-pointer font-semibold text-forest-950">{item.question}</summary>
            <div className="mt-3 text-sm text-ink-900">{item.answer}</div>
          </details>
        ))}
      </div>

      <details id="seguranca" className="rounded-2xl border border-forest-950/10 bg-white p-4">
        <summary className="cursor-pointer font-semibold text-forest-950">Como suas credenciais são protegidas</summary>
        <ul className="mt-3 list-disc flex flex-col gap-1 pl-5 text-sm text-ink-900">
          <li>Chaves de API são guardadas criptografadas no Supabase Vault e nunca voltam inteiras para o navegador.</li>
          <li>Depois de salva, a chave aparece só com os 4 últimos caracteres.</li>
          <li>Cada empresa tem as próprias credenciais. Uma empresa não enxerga nem altera as de outra.</li>
          <li>Sandbox e Produção ficam separados. Um aviso de um ambiente inativo é registrado, mas não altera cobranças nem notas.</li>
          <li>O token do webhook só aparece quando alguém com permissão pede para copiá-lo, e cada uso fica registrado na auditoria.</li>
          <li>Chaves, tokens e certificados nunca aparecem em registros de log ou em mensagens de erro.</li>
        </ul>
      </details>
    </section>
  );
}
