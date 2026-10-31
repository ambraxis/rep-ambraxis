# Documentação do AMBRAXIS

Versão 0.12.0 — 31/10/2026

## Preparação das integrações cloud

Estado: Estrutura preparada — sem publicação

Preparação iniciada em 31/10/2026 para GitHub, Firebase Hosting, Google Cloud Run e Supabase Postgres.

- O backend continua com SQLite e autenticação própria. Não existe conexão Postgres ativa nesta etapa.
- Workflow GitHub preparado para sintaxe, testes e build. Modelos de destinos e Hosting ficam em deploy; não foram vinculados a projetos.
- A publicação depende da migração transacional para Postgres e da configuração de segredos, origem HTTPS e identidade de implantação. Consulte INTEGRACAO_CLOUD.md.

## Visão do sistema

Estado: Escopo

AMBRAXIS — Plataforma integrada de comando — reúne rastreamento, central de monitoramento, proteção de ativos e cargas, CFTV e gestão operacional. A versão atual combina demonstração, cadastro local e backend de desenvolvimento com contas e banco SQLite. Há uma API de recepção de posições JSON; nenhum equipamento físico foi conectado ou homologado nesta entrega.

- Interface em português com navegação por módulos e apresentação para desktop e celular.
- Dados de frota, mapas, câmeras, contêineres e indicadores são exemplos fictícios.
- ERP faz parte do escopo futuro; não há sincronização implementada.

## Central operacional e frota

Estado: Demonstração

Visão geral, mapa ao vivo, veículos e frotas, rotas, geocercas e reprodução de trajetos apresentam a organização planejada da operação.

- Pesquisar os ativos e abrir suas fichas pelos módulos existentes.
- O mapa é ilustrativo: não recebe coordenadas de GPS nem confirma a localização atual.
- Rotas, geocercas, reprodução e telemetria usam dados simulados; não executam monitoramento real.

## Instalação e configuração de rastreadores

Estado: Assistente demonstrativo

O assistente existente organiza a instalação em oito etapas: modelo, identificação, pré-instalação, ligações, SIM/APN, servidor, diagnóstico e conclusão.

- Abra Instalar rastreador ou o atalho do catálogo Rastreadores.
- A biblioteca contém referências para FMC130 e FMB920 e um fluxo genérico para modelos que precisam de homologação.
- As referências técnicas herdadas não foram revalidadas nesta continuação. Consulte o manual oficial aplicável ao modelo, firmware e chicote.
- Checklist e diagnóstico são manuais e fictícios. A conclusão não comprova instalação ou conexão.
- O texto de configuração pode ser visualizado/copiado; nenhum SMS ou comando é enviado. A exportação TXT omite a senha APN.
- Campos do assistente permanecem em memória até o salvamento explícito do cadastro; o rascunho não é recuperado após recarga. Checklist e diagnóstico só são recuperados se registrados explicitamente no banco da empresa, conforme a seção de registros de instalação.

## Cadastro local de rastreadores

Estado: Implementado localmente

A configuração pode ser salva explicitamente no armazenamento deste navegador e consultada em Cadastros locais. Este é um cadastro de teste, sem ativação do equipamento.

- No assistente, preencha empresa, nome, ID de ativo existente (por exemplo VFT-001), IMEI de teste com 15 dígitos, servidor, porta e TCP ou UDP.
- Clique em Salvar rastreador neste navegador. O sistema abre Cadastros locais após confirmar a gravação.
- O sistema valida campos obrigatórios, vínculo do ativo, formato do IMEI, servidor sem espaços ou http://, porta de 1 a 65535 e transporte.
- IMEIs repetidos nos cadastros locais são rejeitados. Não há validação do dígito verificador, titularidade ou duplicidade em plataformas externas.
- Empresa, ativo, identificador e parâmetros são armazenados localmente; a senha APN é removida antes da gravação.
- A lista mascara o IMEI, mas o identificador completo permanece no armazenamento local. Use apenas dados de teste.
- Recarregue o mesmo endereço no mesmo navegador para recuperar os registros. Outro arquivo, perfil, computador ou origem pode ter armazenamento diferente. Limpar os dados do navegador pode apagar os registros.
- Falhas de leitura ou gravação são informadas. Dados corrompidos não são sobrescritos pelo cadastro.
- Não há edição, exclusão, backup ou sincronização nesta etapa. O catálogo original de dispositivos fictícios permanece separado.

## Conta e cadastros no servidor

Estado: Implementado em desenvolvimento

O servidor Node.js mantém contas, empresas, ativos, rastreadores, sessões e auditoria em SQLite. Estes registros são independentes dos exemplos e do armazenamento local do navegador.

- Requer Node.js 22.13 ou superior com node:sqlite. Na pasta do projeto, execute npm start e abra http://127.0.0.1:3030. Abrir o HTML avulso não inicia o backend.
- Em Conta e cadastros, crie uma empresa de teste com e-mail e senha de 12 a 128 caracteres; cada nova conta cria uma empresa própria. Administradores podem cadastrar operadores na própria empresa; não há convite por e-mail ou recuperação de senha.
- Cadastre um ativo com ID sem espaços e nome. Abra o assistente e selecione o ativo no painel Cadastro no banco da empresa; preencha nome, IMEI, servidor, porta e transporte e clique em Salvar na empresa.
- A empresa é determinada pela sessão, não pelo nome digitado no assistente. O botão de salvamento exige um ativo da conta selecionado; o servidor também valida o vínculo.
- O servidor valida modelos suportados, campos obrigatórios, IMEI numérico de 15 dígitos, servidor sem espaços ou esquema de URL, porta de 1 a 65535 e TCP/UDP. Rejeita IMEI duplicado dentro da empresa. Não verifica dígito do IMEI nem comunicação real.
- Dados persistem em data/vftrack.sqlite após reiniciar o servidor. Senhas de conta usam scrypt; a senha APN não é enviada pelo cliente nem armazenada pelo servidor. Edição e inativação estão disponíveis nos cadastros da empresa. Não há exclusão, backup automático ou migração do cadastro local.
- Sessões duram oito horas, com cookie HttpOnly e SameSite=Strict. Gravações autenticadas exigem token CSRF; consultas são filtradas pela empresa da sessão. Os testes verificam isolamento entre duas empresas.
- O histórico da conta lista os 100 eventos mais recentes de criação de empresa, entrada, saída e cadastro de ativos e rastreadores. A tela de auditoria demonstrativa continua separada.
- Servidor local por padrão em 127.0.0.1:3030. PORT e HOST alteram a escuta; COOKIE_SECURE=1 exige acesso HTTPS compatível. Não há configuração de hospedagem ou TLS incluída. Use dados de teste.
- GPS, mapas e vídeo permanecem simulados; um rastreador cadastrado aparece como Não conectado. A API JSON de posições está disponível; não há gateway nativo de protocolos, envio de SMS ou comandos físicos.

## Gestão de ativos e rastreadores

Estado: Implementado no servidor — 0.4.0

Conta e cadastros permite pesquisar, editar e inativar registros da empresa. A migração aditiva para a versão 2 do banco preserva cadastros existentes.

- Ativos têm ID imutável, nome, placa brasileira opcional, tipo (veículo, contêiner ou equipamento) e situação ativo/inativo. A placa aceita os formatos ABC1234, ABC-1234 e ABC1D23; a validação verifica formato, não titularidade.
- Use Editar na lista de ativos, altere os campos e clique em Salvar alterações. Cancelar descarta a edição. Não é permitido inativar um ativo com rastreadores ativos: transfira ou inative esses rastreadores primeiro.
- A pesquisa filtra as listas por nome, ID de ativo, placa ou IMEI conforme os campos de cada lista. Envie o campo vazio para voltar a todos os registros. O IMEI da listagem permanece mascarado.
- Em rastreadores, Editar / transferir abre o assistente com os dados gravados. Altere a identificação ou configuração, selecione o ativo e a situação no painel do banco e clique em Salvar na empresa. Cancelar edição descarta as alterações.
- Abrir assistente para novo rastreador inicia outro cadastro, sem substituir o registro anteriormente editado. Alterações não são salvas automaticamente.
- Rastreadores ativos só podem ser vinculados a ativos ativos da mesma empresa. Um rastreador inativo pode permanecer associado ao ativo inativo; reativá-lo exige um ativo ativo. Duplicidade de IMEI continua impedida na empresa, inclusive entre registros inativos.
- A auditoria grava os valores anteriores e novos dos ativos e os vínculos anterior e novo e situação dos rastreadores. A interface mostra as últimas 100 ocorrências e as transferências; não há tela de consulta de todo o histórico ou diferenças dos demais parâmetros do rastreador.
- A edição exige a sessão e o token CSRF e aplica o filtro de empresa no servidor. Inativação é administrativa: não bloqueia fisicamente o veículo e não envia comandos ao rastreador.
- Persistência em SQLite; não há exclusão definitiva. Cadastros locais e frota demonstrativa permanecem separados. Diagnósticos e checklists podem ser registrados explicitamente conforme a seção de registros de instalação.

## Registros de instalação

Estado: Implementado no servidor — 0.5.0

Checklists e diagnósticos manuais podem ser registrados no banco da empresa com histórico preservado. Não há leitura de equipamento nem certificação automática de instalação.

- Salve primeiro o rastreador em Conta e cadastros. Use Editar / transferir, preencha os checklists e diagnósticos do assistente e, no painel do banco, informe as observações e clique em Salvar novo registro de instalação. O salvamento do cadastro do rastreador não salva automaticamente o checklist.
- Cada envio cria um novo registro com rastreador, ativo e modelo vigentes, autor da sessão, horário do servidor, 17 itens do checklist, seis diagnósticos e observações. Registros anteriores são preservados; não há edição ou exclusão de registros de instalação.
- Os checklists aceitam booleanos e os diagnósticos aceitam Pendente, Aprovado, Falhou ou Não aplicável. Observações são limitadas a 2000 caracteres. É permitido registrar itens pendentes ou falhos: salvar não equivale a aprovar.
- Antes de salvar o registro, persista alterações no vínculo ou modelo do rastreador; o servidor rejeita divergências desses campos. O registro não inclui toda a configuração do aparelho, nome do técnico, medições ou anexos. O autor interno é o usuário autenticado.
- Na conta, abra Registros de instalação para consultar os itens, diagnósticos e observações. Ao editar o rastreador, o assistente recupera o último registro correspondente ao ativo e modelo atuais; ao iniciar outro cadastro, os checklists e diagnósticos são limpos.
- Históricos de ativos e modelos anteriores permanecem disponíveis na conta após uma transferência. A tela lista todos os registros da empresa, sem paginação ou exportação específica nesta etapa.
- Registros persistem em SQLite, com migração aditiva para a versão 3 do banco. Leituras são filtradas por empresa; gravações exigem sessão e CSRF e geram um evento installation.recorded na auditoria.
- No HTML avulso e nos cadastros locais, os checklists continuam em memória. O botão Concluir demonstração e a exportação TXT não gravam no servidor. Não há validação física, GPS, sensores ou assinatura de aceite implementados.

## Equipe e permissões de acesso

Estado: Implementado no servidor — 0.6.0

Cada empresa pode ter seu administrador e operadores. As permissões são verificadas no servidor para consultas e gravações autenticadas, independentemente dos controles visuais.

- Entre como administrador em Conta e cadastros e use Equipe da empresa para cadastrar um operador com e-mail e senha inicial de 12 a 128 caracteres. O cadastro é feito na empresa da sessão; o cliente não escolhe outra empresa.
- O perfil administrador mantém os cadastros de ativos e rastreadores, consulta informações da empresa, registra checklists e gerencia operadores. Nesta etapa, a criação pública de empresa gera um administrador; não há criação ou alteração de outros administradores pela equipe.
- O operador consulta ativos, rastreadores, registros de instalação e auditoria da própria empresa e pode registrar novos checklists. Não pode criar, editar ou inativar ativos/rastreadores, listar a equipe ou criar e alterar usuários.
- Para registrar checklist como operador, use Consultar / checklist no rastreador. O botão Salvar na empresa fica desabilitado: apenas Salvar novo registro de instalação está autorizado. Campos demonstrativos do assistente podem ser alterados em memória; isso não altera o cadastro.
- Use Inativar ou Reativar na equipe para mudar a situação de um operador. A alteração invalida todas as suas sessões. O usuário inativo não consegue entrar e a reativação exige novo login; sessões antigas não são restauradas. Administradores não podem ser inativados por esta tela.
- Os e-mails são únicos em todo o banco, inclusive entre empresas. Senhas usam scrypt e não são devolvidas na API de usuários, nem registradas nos eventos da equipe. A resposta de e-mail duplicado é genérica.
- Criação de operador e alterações de situação geram eventos na auditoria. O banco recebe migração aditiva para versão 4, mantendo usuários existentes ativos. A lista da equipe mostra apenas e-mail, perfil e situação.
- Há troca da própria senha mediante senha atual. Não há envio de convite, recuperação de senha, expiração de senha inicial, MFA ou perfis personalizados. O administrador define a senha inicial e deve combinar seu acesso com o operador fora do sistema. Nenhuma mensagem é enviada automaticamente.
- As permissões abrangem o backend implementado; os módulos demonstrativos, inclusive as telas originais de usuários e permissões, continuam ilustrativos. Esta entrega não configura HTTPS, hospedagem ou backups de produção.

## Troca da própria senha

Estado: Implementado no servidor — 0.7.0

Administradores e operadores podem alterar a própria senha em Conta e cadastros, no painel Alterar minha senha.

- Informe a senha atual, uma nova senha de 12 a 128 caracteres e a confirmação. A nova senha deve ser diferente da atual. Clique em Alterar senha e sair.
- A operação exige sessão válida, token CSRF e verificação da senha atual no servidor. O usuário e a empresa são definidos pela sessão; parâmetros de outra conta não alteram o destinatário da troca.
- Após o sucesso, todas as sessões do usuário são removidas, inclusive a usada na alteração, e o formulário de entrada é exibido. Entre novamente com a nova senha. As sessões de outros usuários não são encerradas.
- A senha usa scrypt com novo salt e persiste no banco existente. Um evento user.password_changed é gravado sem as senhas ou seus hashes. Não há alteração da versão do esquema do banco nesta entrega.
- A API limita a dez tentativas de troca por usuário em quinze minutos, contadas inclusive quando a validação falha. Esse limite é mantido na memória do servidor e é reiniciado ao reiniciar o processo.
- A gravação revalida a sessão e a senha armazenada depois do cálculo assíncrono para evitar substituição por uma troca concorrente. O login também revalida se a credencial mudou durante sua verificação.
- Não há recuperação de senha esquecida, redefinição por administrador, envio de e-mail, expiração obrigatória da senha inicial ou MFA nesta etapa. O HTML avulso não oferece troca de senha sem servidor.

## Cópia de segurança e restauração

Estado: Implementado por comandos locais — 0.8.0

Ferramentas locais permitem copiar, verificar e restaurar o banco completo. Não há download do banco, acesso ao backup pela API ou agendamento automático.

- Pare o servidor antes da manutenção. Na pasta do projeto, execute npm run db:backup -- backups/vftrack-data.sqlite. O destino deve ser novo: arquivos existentes não são sobrescritos. A ferramenta aceita esquemas 4, 5 e 6. O servidor migra o banco para o esquema 6.
- Para verificar um arquivo, execute npm run db:verify -- backups/vftrack-data.sqlite. A ferramenta verifica integridade SQLite, versão do esquema, colunas obrigatórias e chaves estrangeiras. Isso não autentica a origem do arquivo nem certifica a validade operacional dos dados.
- Para restaurar, mantenha o servidor parado e execute npm run db:restore -- backups/vftrack-data.sqlite --confirm. O comando substitui data/vftrack.sqlite e cria, ao lado dele, uma cópia anterior com o sufixo before-restore e identificador único. Sem --confirm, nenhuma restauração é feita.
- O backup inclui todas as empresas, contas com hashes de senha, ativos, rastreadores, auditoria e instalações; não é exportação de uma empresa isolada. Sessões e credenciais GPS são removidas das cópias; a cópia do banco anterior também omite sessões. Após restaurar, entre novamente com as credenciais de conta contidas no backup e gere uma nova credencial de integração GPS.
- Os arquivos criados têm permissões locais 0600. O backup não é criptografado: mantenha-o em armazenamento protegido. Não há retenção automática, sincronização externa, senha de arquivo ou armazenamento em nuvem nesta etapa.
- Um bloqueio ao lado do banco impede abrir outro servidor ou executar manutenção simultânea pelos comandos do projeto. Não protege contra programas externos que ignorem o bloqueio. A saída normal por Ctrl+C ou SIGTERM encerra o banco e libera o bloqueio.
- Se houver encerramento forçado ou falha do computador, pode permanecer data/vftrack.sqlite.lock. Confirme que nenhum processo AMBRAXIS ou manutenção está usando o banco antes de remover manualmente somente esse arquivo de bloqueio. Não remova arquivos -wal ou -shm manualmente.
- A cópia usa snapshot SQLite, é validada antes da publicação e não altera as sessões do banco original. Na restauração, a troca é feita com arquivo temporário no mesmo diretório e cópia anterior preservada. Não há garantia de recuperação automática após falha de energia; confira as cópias antes de remover qualquer arquivo.
- Os comandos funcionam apenas no ambiente local com acesso ao sistema de arquivos. Não há evento de auditoria web para manutenção offline e o arquivo HTML avulso não faz backup. Testes usam bancos temporários; nenhum banco de uso real foi restaurado nesta entrega.

## Recepção de posições GPS

Estado: API e consulta implementadas — 0.10.0

Posições recebidas mostra dados persistidos pela API JSON de integração. Não há decodificador TCP/UDP, conexão nativa com Traccar ou equipamento físico homologado nesta entrega.

- Cadastre o ativo e o rastreador na empresa. Como administrador, abra Posições recebidas e gere uma credencial de integração. Copie-a no momento da geração: somente seu hash é gravado no banco; a credencial completa fica na memória da página até sair ou recarregar.
- O integrador envia POST /api/gps/ingest com Authorization: Bearer e JSON contendo imei, latitude, longitude e recordedAt. Consulte INTEGRACAO_GPS.md para contrato e exemplo. O token define a empresa; campos de empresa no corpo não mudam o destinatário.
- São aceitos IMEI textual com 15 dígitos, latitude numérica de -90 a 90, longitude de -180 a 180, recordedAt UTC canônico com milissegundos e Z, velocidade opcional de 0 a 500 km/h e ignição booleana opcional. Horários mais de cinco minutos no futuro são rejeitados.
- Só recebem posições rastreadores ativos associados a ativos ativos da empresa. O ativo no evento é preservado mesmo se o rastreador for transferido depois. Posições com mesmo rastreador e horário são rejeitadas com 409; não há sobrescrita.
- A tela exibe a última posição por horário GPS, não pela ordem de chegada, e até 100 posições mais recentes por rastreador. Mostra horário GPS e recebimento separadamente e oferece link para visualizar as coordenadas no OpenStreetMap externo.
- A consulta é permitida a administradores e operadores da empresa; apenas administradores geram ou revogam credenciais. Substituir ou revogar uma credencial interrompe o uso da anterior. Tokens não são gravados em auditoria ou armazenamento do navegador.
- A recepção limita cada empresa a 600 tentativas autenticadas por minuto, com contador em memória. Não há autenticação individual do equipamento ou assinatura por posição: a credencial autoriza um integrador para os rastreadores da empresa. Proteja-a e use HTTPS fora do ambiente local.
- Atualizar posições consulta o servidor manualmente; a atualização automática a cada 15 segundos pode ser ativada nesta tela. Geocercas operacionais calcula eventos circulares a partir das posições recebidas. Não há alerta de perda de comunicação, reprodução de percurso ou mapa integrado de posições nesta etapa. O mapa demonstrativo continua separado. Não se presume online com base em um único envio.
- O banco migra para esquema 5. Backups preservam posições, mas removem credenciais GPS e sessões; depois de restaurar, gere outro token. Não há retenção ou expurgo automático de posições e o histórico da API é limitado às 100 mais recentes.
- Seis testes automatizados cobrem recepção, validações, isolamento, ordenação temporal, revogação, persistência e backup sem token. Nenhum gateway externo ou rastreador físico foi usado; não houve inspeção visual no navegador.

## Acompanhamento de posições e exportação

Estado: Implementado na interface — 0.11.0

Posições recebidas permite filtrar rastreadores, acompanhar a idade da medição e exportar os registros do histórico aberto. Não há nova conexão de equipamento ou alteração de esquema do banco.

- Use Rastreador / ativo atual e Atualidade da posição, depois Aplicar filtros. O seletor identifica o ativo vinculado atualmente ao rastreador; a coluna Ativo no evento mantém o vínculo histórico do momento em que a posição chegou.
- Recente indica medição de até cinco minutos; Atrasada indica mais de cinco minutos. Horário futuro é exibido separadamente para datas posteriores ao relógio do navegador. Sem posição identifica rastreadores cadastrados que ainda não têm nenhum envio. Esses rótulos não certificam estado online ou veículo parado.
- A idade usa o horário GPS, não o horário de chegada do pacote. Um pacote antigo recebido agora permanece atrasado. A classificação depende do relógio do navegador; não há parametrização do limite de cinco minutos nesta etapa.
- Ative Atualizar a cada 15 segundos nesta tela para consultar automaticamente últimas posições e o histórico aberto. A consulta é suspensa em outra tela, com aba oculta, operação de cadastro em andamento ou usuário desconectado. Não há atualização em segundo plano ou notificações.
- O horário de última consulta só avança quando as consultas são concluídas. Falhas são informadas, mantendo os últimos dados disponíveis e seu horário de atualização. Uma resposta da consulta GPS não é aplicada depois de encerrar a sessão ou trocar seu token CSRF.
- Abra Histórico e use Exportar histórico CSV. O arquivo contém no máximo as 100 posições mais recentes carregadas para aquele rastreador, em ordem decrescente de horário GPS; não é uma exportação completa do banco nem de todos os trajetos.
- O CSV usa UTF-8 com BOM e separador ponto e vírgula, com horários UTC, coordenadas, velocidade e ignição. Textos que poderiam iniciar fórmulas recebem prefixo de apóstrofo. A exportação usa dados já consultados pela sessão da empresa e não inclui IMEI ou credenciais GPS.
- Filtros, opção automática e histórico aberto ficam em memória até sair ou recarregar; o CSV é um arquivo baixado pelo navegador. As posições continuam persistidas em SQLite. Nenhuma posição fictícia é inserida para demonstrar esta tela.
- Sete testes automatizados verificam cadastros, recepção, backup, filtros básicos, classificação temporal, proteção de CSV, consulta sem sobreposição e rejeição de resposta após logout. Não houve inspeção visual no navegador ou teste físico de GPS.

## Geocercas operacionais e eventos

Estado: Implementado no servidor — 0.12.0

Geocercas circulares geram eventos persistentes de entrada e saída com base nas posições da API. A implementação é separada das telas demonstrativas de geocercas e central de alertas.

- Como administrador, abra Geocercas operacionais, informe nome, ativo ativo da empresa, latitude/longitude decimais do centro e raio de 50 a 100000 metros. Clique em Cadastrar geocerca. Não há desenho no mapa ou edição do centro/raio: inative a cerca antiga e crie outra.
- A distância é calculada por aproximação esférica de Haversine com raio terrestre de 6371000 metros; pontos na borda são considerados dentro. Não há polígonos, margem anti-oscilação, validação de precisão GPS ou filtro de localização falsa.
- A primeira posição elegível estabelece a referência dentro/fora e não cria evento. Uma nova posição que mude de lado gera Entrada ou Saída. Estado e evento são gravados na mesma transação da posição. Não há inferência do ponto ou horário exato da travessia entre medições.
- Posições fora de ordem continuam no histórico, mas não retrocedem o estado nem geram transições atrasadas: só são avaliadas as que não têm posição posterior já registrada para o mesmo rastreador. Não há reprocessamento de trajetos anteriores.
- A avaliação é por geocerca e rastreador associado ao ativo. Dois rastreadores no mesmo ativo podem gerar eventos separados. Alterar a situação da cerca, alterar a situação do ativo ou do rastreador ou transferir o rastreador limpa a referência correspondente; a próxima posição elegível estabelece nova referência sem evento.
- Administradores e operadores consultam os 100 eventos mais recentes e podem Reconhecer. O reconhecimento persiste autor interno e horário, é idempotente e gera auditoria somente no primeiro atendimento. Não há encerramento, atribuição de responsável, comentários ou reabertura nesta etapa.
- Use Atualizar geocercas e eventos para consultar os dados atuais; não há atualização automática nesta tela. A tabela mostra horário GPS e horário de registro do evento, nome da cerca, ativo e rastreador.
- As APIs exigem sessão e isolamento por empresa; gravações exigem CSRF. Somente administradores criam ou ativam/inativam geocercas. Criação e mudanças de situação também são auditadas. O cadastro não aceita ativo de outra empresa.
- O banco migra de forma aditiva para esquema 6. Backups e restauração preservam geocercas, estados e eventos; as ferramentas aceitam esquemas 4, 5 e 6 e continuam removendo sessões e credenciais GPS das cópias. Não há retenção automática ou exclusão definitiva de geocercas.
- Não há SMS, e-mail, envio a equipe, bloqueio físico ou alerta de falta de sinal. A existência de um evento não certifica comunicação com equipamento real: as posições podem ser enviadas por um integrador de teste. Nenhum rastreador físico foi homologado nesta entrega.
- Oito testes automatizados passaram, cobrindo distância, transições, baseline, persistência após reinício, atraso, inativação/reativação, transferência, CSRF, isolamento e reconhecimento idempotente, além das regressões existentes. Sem inspeção visual no navegador.

## Antifurto, SOS e central de alertas

Estado: Simulação

O módulo permite experimentar proteção armada/desarmada, violação e acionamento manual de SOS por ativo, com ocorrências e linha do tempo da sessão.

- Selecione o ativo em Antifurto e SOS e use as ações disponíveis para explorar o atendimento.
- Reconhecimento e encerramento ilustram o fluxo operacional. Eventos gerados podem aparecer na central de alertas.
- Não existe bloqueio físico, acionamento de equipe, aviso externo ou integração com botão de pânico real.
- Ocorrências simuladas não possuem persistência ou auditoria de produção.

## Contêineres, lacres e autorizações

Estado: Demonstração

As telas mostram estado de portas, integridade de lacres, bateria, risco e exemplos de abertura fora de zona autorizada.

- Explore Contêineres, Lacres e sensores, Autorizações de abertura e Central de alertas.
- Os estados são fictícios; não há ingestão de sensores, controle remoto de lacres ou emissão de autorização operacional.
- O desenvolvimento real precisa associar sensor, ativo, empresa e horário do evento.

## CFTV e vídeo

Estado: Demonstração

Videowall e Câmeras e NVRs mostram a experiência planejada para câmeras fixas e embarcadas.

- As imagens são ilustrações, sem transmissão, gravação ou reprodução de vídeo real.
- A associação futura entre vídeo e GPS depende de identificação do ativo e sincronização de horários.
- Integrações com gateways de mídia, RTSP/ONVIF e MDVR ainda não foram implementadas.

## Gestão, inteligência e configurações

Estado: Demonstração

Clientes, planos, usuários, relatórios, telemetria, inteligência territorial, auditoria e integrações representam o escopo visual da plataforma.

- O copiloto usa respostas locais predefinidas; não está conectado a um modelo de IA.
- Formulários genéricos apenas simulam confirmação; não criam registros persistentes. As exceções são os cadastros explícitos locais e os de Conta e cadastros descritos neste documento.
- Preferências de Configurações são visuais ou mantidas na sessão; Simular salvamento não grava em servidor.
- As opções de MFA, autorização dupla e permissões não aplicam controles de acesso reais.
- A documentação nesta página acompanha os arquivos da versão; não pode ser editada pela interface.

## Evolução para operação real

Estado: Pendente

A próxima fase exige uma base de serviços que substitua os dados demonstrativos por informações autenticadas e rastreáveis.

- Evoluir o backend de desenvolvimento para implantação: HTTPS, recuperação de conta, ampliação dos perfis, backup e operação supervisionada.
- Cadastro centralizado, gestão de segredos e integração com gateway GPS.
- Recepção de telemetria, alarmes de contêiner e eventos reais de antifurto.
- Gateway de mídia, vínculos de câmeras, gravação e permissões de vídeo.
- Definição e implementação do contrato de integração com ERP.
- Testes de equipamentos, homologação dos modelos e validação operacional.

## Histórico de implementação e validação

Estado: Atualizado em 31/10/2026

Registro das entregas recuperadas e das alterações desta continuação.

- Base recebida: demonstração navegável e pacote de instalação, com assistente, biblioteca, antifurto e SOS já presentes.
- Etapa 0.1: cadastro local de rastreadores, validação de campos e duplicidade, senha APN excluída e tratamento de falhas de armazenamento.
- Etapa 0.12.0: geocercas circulares por ativo, avaliação transacional, eventos persistentes de entrada/saída, reconhecimento e auditoria; baseline e rejeição de transições com posições fora de ordem. Migração para esquema 6, backups compatíveis e oito testes automatizados. Sem validação visual ou equipamento físico.
- Etapa 0.11.0: filtros, identificação de rastreadores sem posição, atualidade pelo horário GPS, atualização opcional de 15 segundos e exportação CSV do histórico limitado a 100 posições. Sete testes automatizados, sintaxe e artefatos verificados; sem inspeção visual ou conexão de equipamento.
- Etapa 0.10.0: API JSON autenticada para posições, tokens por empresa, última posição e histórico, links externos de mapa, validações e migração aditiva para esquema 5. Backup compatível com esquemas 4/5 e exclusão dos tokens das cópias. Testes e sintaxe validados; sem integração física homologada.
- Etapa 0.9.0: plataforma renomeada para AMBRAXIS, com assinatura Plataforma integrada de comando. Identidade atualizada na navegação, título, textos, manual e HTML avulso AMBRAXIS.html. Nome técnico do banco, chave de armazenamento e cookies preservados para compatibilidade. Sem novas integrações operacionais nesta entrega.
- Etapa 0.8.0: backup, verificação e restauração local do banco; cópia anterior preservada, sessões excluídas das cópias, permissões 0600, bloqueio de manutenção concorrente e encerramento normal liberando o banco. Cinco testes automatizados, sintaxe, geração do manual/HTML e integridade do ZIP; sem inspeção visual ou restauração de banco real.
- Etapa 0.7.0: troca da própria senha para administrador e operador, confirmação da senha atual, revogação de todas as sessões, auditoria sem credenciais e limitação de tentativas. Testes de validação, CSRF, isolamento, sessão revogada, persistência e senha antiga rejeitada. Sintaxe e geração do manual/HTML verificadas; sem inspeção visual no navegador.
- Etapa 0.6.0: equipe por empresa, criação de operadores, permissões no servidor, ativação/inativação com revogação de sessões, auditoria e migração aditiva. Testes de isolamento, proteção de administradores, CSRF, bloqueio de gravações, registros autorizados e rejeição de sessões antigas após reativação. Sem inspeção visual em navegador.
- Etapa 0.5.0: registros persistentes e históricos de checklist e diagnóstico, consulta e recuperação do último registro por rastreador/ativo/modelo, auditoria e migração aditiva. Testes de validação, isolamento, CSRF, histórico e persistência após reinício. Sem inspeção visual no navegador ou validação de equipamento.
- Etapa 0.4.0: gestão de ativos com placa/tipo/situação, edição e inativação de cadastros, pesquisa e transferência de rastreadores com histórico de vínculos. Migração aditiva do banco existente. Testes de API, isolamento, validações, persistência, migração repetida e renderização lógica da interface; sem inspeção visual em navegador ou teste físico.
- Etapa 0.3: backend de desenvolvimento com contas, ativos, rastreadores, isolamento por empresa e auditoria SQLite.
- Etapa 0.3.1: seleção de ativo da empresa no assistente, correção dos avisos de persistência e documentação do backend. Testes de API e de seleção do ativo, sintaxe e geração dos artefatos; sem inspeção visual em navegador ou teste com equipamento.
- Etapa 0.2: documentação integrada em Configurações, arquivo Markdown correspondente e orientação de manutenção do projeto.
- Validação da etapa 0.1: sintaxe dos scripts e testes automatizados de cadastro, recarga, duplicidade, senha omitida e falhas de armazenamento.
- Validação da etapa 0.2: sintaxe, geração da documentação, presença em Configurações e preservação dos arquivos no pacote. Não houve inspeção visual automatizada.
