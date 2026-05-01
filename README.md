# Almox Project

Almox Project e um sistema web local para controle de saidas de itens de almoxarifado por frota. O projeto funciona como uma aplicacao estatica em HTML, CSS e JavaScript, com persistencia no navegador por IndexedDB e suporte a instalacao como PWA.

## Visao geral

O sistema foi desenhado para registrar movimentacoes de saida, manter um catalogo de pecas e facilitar a consulta por frota, codigo, descricao, data ou numero de ordem de servico.

Nao ha backend externo, login, servidor de banco de dados ou sincronizacao em nuvem. Os dados ficam no navegador do usuario, dentro do banco local `AlmoxarifadoDB`.

## Funcionalidades principais

- Registro de saidas com frota, codigo da peca, quantidade, descricao e numero de OS opcional.
- Catalogo de itens com cadastro, edicao, exclusao e busca por codigo ou descricao.
- Preenchimento automatico da descricao quando o codigo existe no catalogo.
- Aviso quando o codigo informado ainda nao existe no catalogo, com opcao de cadastrar ou seguir apenas naquela movimentacao.
- Lista de saidas agrupada por frota, com visualizacao detalhada dos registros.
- Busca geral nas saidas por frota, codigo, descricao, OS ou data.
- Indicadores de registros, quantidade total e frotas ativas.
- Edicao e exclusao de registros de saida.
- Exportacao CSV das saidas filtradas.
- Exportacao e importacao completa dos dados em JSON.
- Backup automatico local e restauracao de backup.
- Impressao da tela/relatorio de saidas.
- Tema padrao e tema claro, persistidos no navegador.
- Instalacao como PWA quando o navegador permitir.
- Funcionamento offline apos o primeiro carregamento com service worker.

## Telas do sistema

### Tela principal

Arquivo: `index.html`

A tela principal concentra o fluxo operacional de saidas. Ela contem:

- cabecalho com menu retratil;
- formulario de registro de saida;
- area de indicadores;
- busca de saidas;
- cards agrupados por frota;
- relatorio preparado para impressao;
- modal de cadastro rapido de itens;
- modal de confirmacao para acoes criticas;
- modal de configuracoes.

No menu retratil, a opcao `ESTOQUE` abre a tela de itens. A opcao `CONFIGURACOES` abre a central de configuracoes. As demais opcoes ainda estao preparadas como atalhos futuros.

### Tela de itens

Arquivo: `itens.html`

A tela de itens e dedicada ao catalogo de pecas. Ela contem:

- formulario para cadastrar ou atualizar item;
- busca no catalogo;
- lista de itens cadastrados;
- acoes de editar e excluir;
- importacao de dados;
- modal de configuracoes;
- fluxo de retorno para a tela principal.

Quando a tela e aberta a partir de um codigo nao cadastrado na tela principal, o sistema leva junto o contexto do codigo e pode retornar para a saida original depois do cadastro.

## Persistencia de dados

Os dados sao armazenados no IndexedDB do navegador.

Banco:

```text
AlmoxarifadoDB
```

Stores:

```text
saidas
itens_cadastro
```

Tambem sao usados:

- `localStorage` para tema e estado de instalacao do app;
- `sessionStorage` para rascunho temporario de saida e contexto de navegacao entre telas;
- Cache Storage pelo service worker para recursos offline.

Importante: limpar os dados do site no navegador pode apagar os registros locais. Antes de trocar de maquina, limpar o navegador ou reinstalar o app, exporte um backup em JSON.

## PWA e modo offline

O projeto possui:

- `manifest.webmanifest` com nome, icone, escopo e modo `standalone`;
- `service-worker.js` para cache dos arquivos principais;
- botoes de instalar e desinstalar no modal de configuracoes.

O botao `Instalar aplicativo` aparece quando o navegador disponibiliza o evento de instalacao. O botao `Desinstalar aplicativo` aparece quando o sistema detecta que o app esta instalado ou em modo standalone.

Por limitacao dos navegadores, a desinstalacao de uma PWA nao pode ser executada diretamente por JavaScript. Por isso, o botao de desinstalar orienta o usuario a remover o app pelo menu do navegador ou do proprio aplicativo instalado.

## Estrutura dos arquivos

```text
index.html              Tela principal de saidas
itens.html              Tela dedicada ao catalogo
style.CSS               Estilos principais
theme.CSS               Ajustes do tema claro
theme.js                Controle e persistencia do tema
app.js                  Logica compartilhada: configuracoes, PWA, toasts e service worker
index.js                Logica da tela principal, saidas, catalogo rapido e exportacoes
items.js                Logica da tela de itens, catalogo, importacao e backup
manifest.webmanifest    Configuracao da PWA
service-worker.js       Cache offline da aplicacao
icons/                  Icones do aplicativo
```

## Como executar

O projeto nao exige instalacao de dependencias.

Opcao simples:

```text
Abra o arquivo index.html no navegador.
```

Opcao recomendada para testar PWA e service worker:

```bash
python -m http.server 8000
```

Depois acesse:

```text
http://localhost:8000
```

Em alguns sistemas o comando pode ser:

```bash
python3 -m http.server 8000
```

## Exportacao e importacao

O sistema oferece dois formatos principais:

- CSV: exporta as saidas filtradas para planilha.
- JSON: exporta ou importa todos os dados do sistema, incluindo saidas e catalogo.

Use o JSON como backup principal, pois ele preserva toda a base local do sistema.

## Observacoes tecnicas

- O sistema usa JavaScript puro, sem framework.
- O banco local foi mantido como `AlmoxarifadoDB` para preservar compatibilidade com dados ja salvos.
- A tela principal e a tela de itens compartilham o mesmo banco local.
- O service worker usa uma estrategia de rede primeiro e cache como fallback.
- O tema selecionado e salvo em `localStorage` com a chave `almox_theme`.
- O app deve ser acessado por `localhost` ou contexto seguro para que a instalacao PWA funcione corretamente.

## Desenvolvido por

Alan Freitas (Delux Lasteg)
