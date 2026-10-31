# AMBRAXIS — 0.12.0 — 31/10/2026

## Executar com contas e banco de dados

Requer Node.js >=22.13 com node:sqlite. Na pasta deste projeto:

```sh
npm start
```

Abra http://127.0.0.1:3030 e entre em **Conta e cadastros**.
Crie uma empresa de teste com e-mail e senha de 12 a 128 caracteres.
Cadastre um ativo, abra o assistente, preencha os dados do rastreador e selecione o ativo no painel **Cadastro no banco da empresa**. Clique em **Salvar na empresa**.
A senha APN não é enviada ou persistida. Rastreador cadastrado não significa equipamento conectado.

O banco fica em `data/vftrack.sqlite`. Contas, ativos e rastreadores persistem após reiniciar. Há edição e inativação de ativos e rastreadores. Não há backup automático, recuperação de senha, exclusão nem convite por e-mail. O servidor escuta apenas em 127.0.0.1 por padrão. HOST e PORT configuram o endereço; COOKIE_SECURE=1 é destinado a acesso HTTPS, cuja implantação não está incluída.

## Demonstração sem servidor

Abra AMBRAXIS.html. O arquivo avulso oferece demonstração e cadastro local no navegador, sem iniciar o backend. Esse armazenamento é separado do banco e depende do endereço e perfil do navegador. Os cadastros locais não são migrados automaticamente.

Mapas, GPS, vídeo, SOS, lacres e comandos físicos continuam demonstrativos. Use dados de teste. As referências de pinagem herdadas não foram revalidadas nesta entrega.

## Documentação e validação

O manual completo está em DOCUMENTACAO.md e em Configurações → Consultar documentação.
Execute `npm test` para os testes do backend e da seleção de ativos; `npm run build` regenera o manual e o HTML avulso.
Não houve inspeção visual em navegador ou teste com rastreadores físicos nesta entrega.

Os arquivos originais recebidos foram preservados. O ZIP desta entrega contém somente fontes, testes e artefatos, sem banco de dados ou credenciais.

## Gestão de ativos e rastreadores

Em Conta e cadastros, cadastre nome, placa brasileira opcional, tipo e situação do ativo. Use Editar para atualizar ou inativar. Não é permitido inativar um ativo com rastreadores ativos vinculados.

Use Editar / transferir no rastreador para carregar seus dados no assistente. Selecione outro ativo ou altere sua situação no painel do banco e salve explicitamente. As transferências aparecem no histórico da conta. Cancelar edição descarta alterações; Abrir assistente para novo rastreador inicia um novo cadastro.

A pesquisa filtra os cadastros da conta. O banco anterior é migrado automaticamente de forma aditiva, preservando os registros; faça uma cópia de segurança com o servidor parado antes de atualizar uma instalação com dados importantes.

Validação 0.9.0: testes de API e interface lógica, migração repetida, persistência e sintaxe. Não houve inspeção visual no navegador nem teste de equipamento. Comunicação GPS permanece pendente.

## Registros de instalação

Após cadastrar o rastreador, use Editar / transferir, preencha o checklist e diagnóstico do assistente e clique em Salvar novo registro de instalação no painel do banco. Informe observações de até 2000 caracteres. O salvamento do cadastro do rastreador é uma ação separada.

A conta exibe o histórico de registros. Cada envio cria uma nova versão, inclusive com pendências ou falhas. Ao editar o rastreador, o último registro do mesmo ativo e modelo é recuperado. A transferência não altera registros antigos. A migração aditiva do banco passa à versão 3.

Esses registros são declarações manuais; não certificam instalação ou conexão real. No HTML avulso, os checklists permanecem em memória.

## Equipe da empresa e permissões

Como administrador, abra Conta e cadastros → Equipe da empresa. Cadastre o e-mail e a senha inicial de um operador. Ele entra pelo mesmo formulário de login, na mesma empresa, com acesso de consulta e permissão para registrar checklists. Alterações de ativos, rastreadores e equipe são exclusivas do administrador e verificadas na API.

Inativar um operador revoga suas sessões e bloqueia novos logins. Reativar permite novo login; sessões antigas permanecem inválidas. Há troca da própria senha. Recuperação, MFA e convite por e-mail continuam pendentes. Administradores não podem ser inativados pela equipe. O banco migra de forma aditiva para versão 4.

Os módulos demonstrativos continuam ilustrativos. A equipe real é gerenciada apenas em Conta e cadastros. Validação: testes de autorização, isolamento por empresa, CSRF, revogação, migração e interface lógica; sem inspeção visual no navegador.

## Troca da própria senha

Em Conta e cadastros → Alterar minha senha, informe senha atual, nova senha de 12 a 128 caracteres e confirmação. A nova senha deve ser diferente da atual. Após Alterar senha e sair, entre novamente: todas as suas sessões são encerradas. Administradores e operadores podem usar a função; ela não altera a senha de outra conta.

A operação registra auditoria sem credenciais e limita tentativas. Não há recuperação de senha esquecida ou redefinição por administrador nesta etapa. O esquema do banco continua na versão 4. Quatro testes automatizados passam, incluindo persistência da senha após reinício e revogação de sessões; não houve inspeção visual no navegador.

## Backup e restauração local

Pare o servidor com Ctrl+C. Na pasta do projeto:

```sh
npm run db:backup -- backups/vftrack-2026-10-31.sqlite
npm run db:verify -- backups/vftrack-2026-10-31.sqlite
```

O destino deve ser novo. O backup abrange todas as empresas e os hashes das senhas, sem criptografia e sem sessões. Os arquivos são criados com permissão 0600. Não há agendamento, retenção ou envio para nuvem. Guarde as cópias em local protegido. O banco precisa estar no esquema 4 (versão 0.6.0 ou posterior).

Para restaurar, com o servidor parado:

```sh
npm run db:restore -- backups/vftrack-2026-10-31.sqlite --confirm
npm start
```

A restauração valida o backup, preserva o banco anterior em `data/vftrack.sqlite.before-restore-<id>.sqlite` e substitui o banco principal. Faça login com as credenciais presentes no backup. As sessões não são restauradas. A cópia anterior também omite sessões. A manutenção local não gera auditoria web.

O servidor e os comandos usam `data/vftrack.sqlite.lock` para impedir uso simultâneo. Após encerramento forçado, confirme que não há servidor nem manutenção em execução antes de remover manualmente apenas esse arquivo de bloqueio. Nunca remova manualmente arquivos WAL/SHM. Ctrl+C e SIGTERM liberam o bloqueio normalmente.

Verificação 0.9.0: cinco testes passaram, incluindo restauração de banco temporário, preservação da cópia anterior, rejeição de arquivo inválido, bloqueio do banco em uso e remoção de sessões. Nenhum banco de uso real foi alterado ou restaurado.

## Identidade da plataforma

AMBRAXIS — Plataforma integrada de comando. O nome anterior era VF TRACK. O banco data/vftrack.sqlite, as chaves de armazenamento e cookies existentes são mantidos para compatibilidade. AMBRAXIS.html é o arquivo avulso principal; VF_TRACK_CONTINUACAO.html também é regenerado como alternativa de compatibilidade. Abrir o novo arquivo avulso pode mudar a origem do armazenamento local no navegador; não há migração automática entre arquivos.

## Posições recebidas — 0.10.0

Abra Posições recebidas após entrar na conta. Um administrador pode gerar a credencial para um integrador enviar posições à API JSON. Consulte INTEGRACAO_GPS.md. A tela exibe última posição e histórico por rastreador; o mapa demonstrativo permanece separado. Não há equipamento físico conectado nem protocolo nativo TCP/UDP implementado nesta entrega.

A migração do servidor atualiza o banco para esquema 5. A ferramenta de backup aceita esquemas 4 e 5. Posições são preservadas nas cópias; sessões e tokens GPS são removidos dos backups e cópias anteriores da restauração. Gere outra credencial GPS depois de restaurar. Não há retenção automática de posições.

Esta entrega foi desenvolvida em /Users/jarsson/Documents/AMBRAXIS. Validação: seis testes automatizados e sintaxe; sem inspeção visual ou teste de rastreador físico.

## Acompanhamento de posições — 0.11.0

Em Posições recebidas, selecione rastreador/ativo e atualidade, depois Aplicar filtros. Recente significa medição de até cinco minutos; dados antigos ou futuros são identificados separadamente. Rastreador sem dados aparece como Sem posição. Não há confirmação automática de conexão física.

A atualização automática é opcional e consulta a cada 15 segundos apenas com usuário conectado, tela aberta e aba visível. O horário de última consulta informa a atualidade dos dados exibidos. Falhas preservam a consulta anterior e são informadas na tela.

Abra Histórico → Exportar histórico CSV para baixar até 100 registros carregados. O arquivo não contém todo o percurso armazenado. Os filtros e preferências não persistem após recarregar. Nenhuma posição fictícia foi inserida. O esquema do banco continua na versão 5.

Validação: sete testes automatizados e sintaxe. Sem inspeção visual no navegador ou teste com GPS físico nesta entrega.

## Geocercas operacionais — 0.12.0

Como administrador, abra Geocercas operacionais. Cadastre nome, ativo ativo da empresa, centro em coordenadas decimais e raio em metros (50–100000). A primeira posição estabelece a referência; mudanças seguintes entre dentro/fora geram eventos. Uma posição fora de ordem é armazenada, mas não altera o estado.

Administradores e operadores podem reconhecer eventos. A consulta é manual, limitada aos 100 eventos mais recentes. Não há SMS, e-mail, bloqueio, equipe acionada ou mapa de desenho de cercas. As telas demonstrativas permanecem separadas. Inativar/reativar a cerca ou mudar vínculo/situação do ativo/rastreador reinicia a referência; não gera evento de transição nessa primeira posição seguinte.

Para alterar centro ou raio, inative a cerca e crie outra. A aproximação circular não inclui margem anti-oscilação ou precisão GPS. Não infere o ponto exato da travessia entre medições. A migração passa o banco para esquema 6 e as ferramentas de backup aceitam esquemas 4, 5 e 6, preservando estados e eventos. Sessões e tokens GPS continuam excluídos das cópias.

Validação: oito testes automatizados e sintaxe. Sem inspeção visual ou homologação física de GPS nesta entrega.
