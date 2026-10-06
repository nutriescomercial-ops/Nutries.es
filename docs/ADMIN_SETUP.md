# Administracao NutriES

O frontend esta em `/admin`. A autorizacao e aplicada no Postgres/Storage por RLS, nao pelo HTML nem pelo e-mail digitado. O primeiro proprietario e `nutriescomercial@gmail.com`. Nao ha senha padrao ou modo de administracao local.

## Ativacao

1. Criar ou selecionar um projeto Supabase sob a conta da NutriES. Nao foi criado automaticamente nem contratado um plano.
2. Executar `supabase/schema.sql` uma vez no SQL Editor. A transacao cria tabelas, permissoes e bucket, e importa os seis produtos existentes. Manter Confirm Email ativado em Auth.
3. Em Auth > URL Configuration, definir Site URL `https://nutries-es.com.br` e incluir os redirects exatos `https://nutries-es.com.br/admin` e `https://www.nutries-es.com.br/admin`. Para teste local, adicionar `http://127.0.0.1:3031/admin`.
4. Configurar o envio de e-mails em Auth > SMTP. O servico padrao do Supabase pode restringir destinatarios a membros da equipe do projeto; nao considerar o login pronto antes de testar a entrega ao primeiro proprietario.
5. Cadastrar na Vercel `SUPABASE_URL` e `SUPABASE_ANON_KEY` (chave publica publishable/anon). Nunca usar service_role ou sb_secret. `/api/config` rejeita chaves secretas e nao retorna nada quando a configuracao esta incompleta.
6. Publicar novamente. Entrar em `/admin`, pedir o link para o e-mail proprietario e confirmar o acesso na caixa de entrada.
7. Testar como anonimo: leitura apenas de produtos publicados, nenhuma escrita, nenhum acesso a proprietarios. Testar um usuario confirmado nao proprietario: insercao/update e upload devem falhar. Testar o proprietario: criar um rascunho, subir foto, editar oferta, publicar e conferir em outro navegador.

## Operacao

- Proprietarios sao adicionados na aba Proprietarios, com confirmacao explicita. Eles precisam confirmar o proprio e-mail para entrar. E-mail digitado sozinho nunca libera o painel.
- Fotos aceitas: JPG, PNG e WebP, ate 5 MB. As fotos de produtos sao publicas porque aparecem na loja; escrita e exclusao exigem proprietario.
- Ofertas: percentual ou valor em reais de desconto. O valor deve ser menor que o preco total. O preco calculado tambem e usado no carrinho de cotacao.
- Desmarcar Publicado arquiva o produto sem apagar o registro. A lista publica exclui rascunhos.
- Checkout deve ser HTTPS e publico; nao usar inicio#/ ou outras paginas internas do ERP Bling. A integracao apenas abre o link cadastrado: nao cria loja, habilita pagamentos, sincroniza estoque nem confirma pedidos no Bling.
- Para revogar acesso, remover o e-mail em `store_owners` no SQL Editor. RLS bloqueia alteracoes imediatamente, inclusive de sessoes ja abertas. Confirmar que resta pelo menos um proprietario.
- Em falha do banco, o catalogo estatico anterior e exibido com aviso de confirmar disponibilidade/precos. Nenhuma escrita e simulada no navegador.

## Desenvolvimento

`$env:PORT=3031; node server.js` em PowerShell. Sem variaveis configuradas o catalogo publico original funciona e o painel permanece bloqueado. Os testes locais nao substituem os testes de RLS e login no projeto real.

Testes: `npm install --no-save --package-lock=false jsdom@26.1.0` e `node --test tests/catalog.test.js`. JSDOM e usado somente no desenvolvimento, nao na publicacao.
