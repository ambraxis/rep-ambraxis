# AMBRAXIS — recepção JSON de posições

Versão 0.12.0 — 31/10/2026.

Esta API recebe posições de um integrador autorizado. Não interpreta protocolos nativos dos rastreadores. Um gateway precisa converter seus dados para este contrato. Nenhum equipamento físico foi homologado nesta entrega.

## Preparação

1. Entre como administrador e cadastre o ativo e o rastreador com IMEI de 15 dígitos. Ambos devem estar ativos.
2. Abra **Posições recebidas** e clique em **Gerar / substituir credencial**. Copie o segredo para o integrador. Substituir invalida imediatamente o anterior.
3. Envie os dados ao servidor. A instância local usada nesta entrega escuta em `http://127.0.0.1:3031`. Um serviço externo não alcança esse endereço local; a implantação acessível por HTTPS ainda precisa ser configurada.

## Contrato

`POST /api/gps/ingest`

Cabeçalhos: `Content-Type: application/json` e `Authorization: Bearer <credencial>`.

```json
{
  "imei": "123456789012345",
  "latitude": -3.119,
  "longitude": -60.0217,
  "recordedAt": "2026-10-31T16:00:00.000Z",
  "speed": 35.5,
  "ignition": true
}
```

O IMEI é textual. Latitude e longitude são números; velocidade é opcional em km/h (0–500); ignição é booleana opcional. `recordedAt` exige UTC ISO canônico, com milissegundos e Z. Use o horário real da medição; mais de cinco minutos no futuro é rejeitado. O horário de recebimento é atribuído pelo servidor. Campos extras não mudam empresa ou vínculo. Há uma posição por rastreador e horário, sem sobrescrita.

O token identifica a empresa e autoriza envio aos seus rastreadores ativos. Ele não autentica a identidade física do equipamento. Não o inclua na URL, em arquivos públicos ou em logs. Use HTTPS fora do computador local. Não envie dados de teste como se fossem posições reais.

Respostas: 201 criada; 400 dados inválidos; 401 credencial inválida/revogada; 404 rastreador ativo inexistente na empresa; 409 horário duplicado ou ativo inativo; 429 limite de 600 tentativas por minuto por empresa. O limite é mantido em memória e reiniciado com o processo.

## Consulta e manutenção

Consultas exigem sessão de administrador ou operador. `GET /api/positions` retorna a última posição de cada rastreador por horário GPS. `GET /api/positions?deviceId=<id>` retorna até 100 posições por horário decrescente. O ID é o identificador interno do cadastro, não o IMEI. O ativo é o vigente no recebimento e fica preservado no histórico.

Administradores consultam o estado da credencial em `GET /api/gps/token`, geram ou substituem com `POST /api/gps/token` e revogam com `POST /api/gps/token/revoke`. Gravações dessas credenciais exigem cookie e CSRF. O segredo só é retornado ao gerar. O banco guarda o hash. O envio de posições usa apenas Bearer, sem cookie ou CSRF.

A tela permite atualização manual ou automática opcional a cada 15 segundos enquanto aberta e visível, filtros e CSV das até 100 posições do histórico aberto. A atualidade considera o horário GPS (recente até cinco minutos); não certifica comunicação contínua. Oferece link externo para as coordenadas no OpenStreetMap. Não há mapa integrado, estado online confirmado, alarmes ou rota reproduzida. Dados enviados por um integrador podem ser reais ou de teste; a API não comprova sua origem física.

Backups preservam posições, mas removem tokens GPS e sessões. Após restaurar, gere uma nova credencial. Não há retenção ou expurgo automático de posições.

## Geocercas operacionais

A recepção de uma posição nova avalia as geocercas circulares ativas do ativo, na mesma transação. A primeira posição estabelece referência sem evento. Mudanças posteriores entre dentro/fora geram entrada/saída. Posições fora de ordem não alteram o estado; uma repetição de horário ainda retorna 409. Transferir ou alterar situação do rastreador ou ativo reinicia a referência.

APIs com sessão de administrador ou operador:

- `GET /api/geofences`: consulta geocercas da empresa.
- `GET /api/geofence-events`: até 100 eventos mais recentes por ordem de registro.
- `POST /api/geofence-events/ack`: corpo `{"id":"id-do-evento"}`, exige CSRF e reconhece uma única vez.

Somente administrador, com CSRF:

- `POST /api/geofences`: corpo com `name`, `asset` (ID), `latitude`, `longitude` e `radius` (metros, 50–100000).
- `POST /api/geofences/status`: corpo com `id` e `active` numérico 0 ou 1. Reinicia a referência daquela cerca.

Não há exclusão ou edição de centro/raio. Estados e eventos persistem no esquema 6 e são incluídos nos backups. Não há notificação externa, desenho no mapa, polígonos ou margem anti-oscilação. O horário de um evento é o da medição que confirmou a mudança de lado, sem estimativa do instante exato de travessia.
