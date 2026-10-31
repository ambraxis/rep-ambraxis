# Integração do AMBRAXIS com serviços cloud

Preparação iniciada em 31/10/2026. Nenhum serviço remoto foi criado ou publicado nesta etapa. O backend continua usando SQLite e autenticação própria. DATABASE_URL ainda não é consumida pelo sistema.

## Responsabilidades propostas

GitHub armazenará o código em repositório privado e executará os oito testes e a geração dos artefatos. Firebase Hosting fornecerá o endereço HTTPS, encaminhando as requisições ao backend no Cloud Run. Google Cloud executará esse backend e guardará os segredos no Secret Manager. Supabase fornecerá Postgres persistente. A autenticação própria será preservada na primeira migração; Supabase Auth exige uma decisão e migração separadas.

## Estado atual e pré requisito de publicação

O sistema usa node:sqlite com consultas e transações síncronas. Não basta definir uma URL do Supabase: é necessário adaptar as operações de banco para Postgres, incluindo migrações, transações, isolamento por empresa e avaliação atômica das geocercas. Não publicar o servidor atual no Cloud Run com o arquivo SQLite local, pois o armazenamento da instância é efêmero.

A versão declarada é 0.12.0. A suíte de geocercas deve ser repetida antes da migração, incluindo a avaliação na mesma transação de cada posição.

## Arquivos preparados

.github/workflows/ci.yml executa sintaxe, testes e build sem credenciais de produção. deploy/targets.example.json registra os destinos a preencher. deploy/firebase.template.json é um modelo de Hosting com encaminhamento ao Cloud Run; não é uma configuração ativa. deploy/hosting deve permanecer sem os arquivos internos do servidor ou banco. .env.example contém somente exemplos e não deve receber senhas reais.

## Próximas etapas

1. Selecionar IDs exclusivos do AMBRAXIS no Google Cloud/Firebase, Supabase e GitHub. Firebase e Google Cloud devem usar o mesmo projeto.
2. Inicializar um repositório Git próprio nesta pasta: o Git atualmente encontrado pertence ao diretório pessoal, não ao AMBRAXIS. Revisar arquivos antes do primeiro commit.
3. Migrar persistência para Postgres com testes de isolamento, sessões, GPS e geocercas; restringir tabelas internas ao backend e configurar TLS com validação de certificado.
4. Configurar segredos e identidade de implantação via Workload Identity Federation, sem chaves de conta de serviço no repositório.
5. Criar configuração definitiva do Hosting e container Cloud Run com escuta em 0.0.0.0 e PORT, cookies HTTPS e validação da origem pública.
6. Executar migrações em ambiente de homologação, validar API e interface e só então publicar.

## Referências

https://firebase.google.com/docs/hosting/cloud-run
https://cloud.google.com/run/docs/container-contract
https://supabase.com/docs/guides/database/connecting-to-postgres

## Destinos informados pelo proprietário

GitHub: ambraxis/rep-ambraxis. O repositório está público e vazio; a conta ambraxis foi autenticada no CLI e possui administração e push.

Google Cloud: ambraxis-cloud, número 169238967755. A conta Google ativa não tem acesso a esse projeto.

Firebase: identificador informado firebase-ambraxis, ainda sem confirmação de ser ID de projeto, nome de exibição ou site Hosting. O encaminhamento Hosting para Cloud Run precisa usar o mesmo projeto Google Cloud. Confirmar o vínculo antes de gerar firebase.json definitivo.

Supabase: ambraxis’s Project, referência njvjuwzdrqkqtiafaafy, URL https://njvjuwzdrqkqtiafaafy.supabase.co. A referência não aparece na listagem das credenciais locais atuais.

Os destinos foram registrados em deploy/targets.json sem segredos. A região us-central1 continua sendo proposta, não recurso provisionado. Autenticar as contas com acesso aos projetos antes de vincular ou implantar. Não incluir tokens ou senhas em mensagens, arquivos versionados ou no frontend.
