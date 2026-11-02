# StudyStream Desktop

> **Plataforma Monolítica de Estudos, Cursos e Streaming Pessoal para Windows**

O **StudyStream Desktop** é uma aplicação desktop nativa para Windows desenvolvida com arquitetura monolítica moderna (Electron, React, TypeScript, Vite, Tailwind CSS e SQLite com WebAssembly/ACID). Ele combina a experiência visual e de streaming de plataformas como Netflix/Plex com o acompanhamento pedagógico e anotações estilo Udemy/Notion, permitindo gerenciar e reproduzir cursos locais e remotos armazenados no **Google Drive** através de integração direta com o **Rclone**.

---

## 1. Visão Geral e Recursos

- **Biblioteca Visual Unificada**: Catálogo com cards, capas dinâmicas em gradiente, busca global instantânea, filtros por categoria, status (não iniciado, em andamento, concluído), favoritos e origem.
- **Integração Real com Google Drive via Rclone**:
  - Aproveita instalação existente do Rclone e remotes já autenticados (ex: `gdrive:`).
  - Indexação remota veloz em lote via comandos estruturados `lsjson`.
  - Servidor local loopback HTTP com suporte a **HTTP Range (Status 206 Partial Content)**, permitindo busca na linha do tempo (seek) de arquivos no Google Drive sem baixar o vídeo inteiro antes de iniciar a reprodução.
- **Player de Vídeo Profissional**:
  - Reprodução fluida de arquivos locais (.mp4, .mkv, .webm, .mov, etc.) e remotos.
  - Controle de velocidade (0.75x, 1x, 1.25x, 1.5x, 2x).
  - Atalhos de teclado (Espaço para Play/Pause, Setas para avançar/retroceder e volume, F para tela cheia, N/P para próxima/anterior).
  - Retomada automática da posição onde parou.
  - Conclusão automática inteligente ao atingir 90% do vídeo.
- **Modo de Estudo & Anotações**:
  - Anotações vinculadas ao segundo exato da aula.
  - Marcadores de momentos-chave com navegação instantânea.
  - Painel lateral integrado ao reprodutor.
- **Produtividade & Estatísticas**:
  - Metas diárias e semanais de estudo em minutos.
  - Cronômetro de tempo efetivamente estudado por sessão (não conta quando pausado).
  - Sequência de dias consecutivos estudados (streaks).
  - Lista de tarefas de estudo vinculadas a cursos com prazos.
- **Modo Offline & Downloads**:
  - Fila de downloads assíncronos com taxa de transferência e porcentagem em tempo real.
  - Associação automática do arquivo baixado à aula existente para visualização sem internet.
- **Persistência Confiável com SQLite**:
  - Arquivo local de banco de dados (`studystream.db`) salvo no diretório de dados do usuário (`%APPDATA%/StudyStream`).
  - Transações ACID completas e migrações versionadas.
  - Ferramentas integradas para criação de backup (.db), restauração com validação e verificação de integridade SQLite (`PRAGMA integrity_check`).

---

## 2. Arquitetura da Aplicação

A aplicação segue rigorosamente os padrões de segurança do Electron:

```
studystream/
├── electron/
│   ├── main.ts                    # Processo principal do Electron (janela, ciclo de vida)
│   ├── preload.ts                 # ContextIsolation e API restrita (window.api)
│   ├── types.ts                   # Reexportação de tipos do domínio
│   ├── database/
│   │   ├── connection.ts          # Serviço SQLite (sql.js / ACID / auto-save / backup)
│   │   ├── migrations/            # Migrações versionadas DDL
│   │   └── repositories/          # Repositórios (courses, sources, lessons, notes, etc.)
│   ├── ipc/                       # Handlers IPC separados e validados
│   │   ├── library.ipc.ts
│   │   ├── courses.ipc.ts
│   │   ├── playback.ipc.ts
│   │   ├── notes.ipc.ts
│   │   ├── goals.ipc.ts
│   │   ├── tasks.ipc.ts
│   │   ├── downloads.ipc.ts
│   │   ├── rclone.ipc.ts
│   │   └── settings.ipc.ts
│   ├── services/
│   │   ├── library.service.ts     # Varredura recursiva e ordenação natural
│   │   ├── rclone.service.ts      # Integração segura com Rclone (execução sem shell injection)
│   │   └── playback.service.ts    # Servidor loopback HTTP 206 Partial Content
│   └── security/
│       └── path-validation.ts     # Proteção contra Path Traversal e validação de raízes
│
├── src/
│   ├── App.tsx                    # Componente raiz e orquestrador de telas e modais
│   ├── main.tsx                   # Ponto de montagem React
│   ├── types/                     # Interfaces TypeScript do domínio
│   ├── styles/                    # Design System (Tailwind CSS, Glassmorphism)
│   ├── components/
│   │   ├── layout/                # Sidebar, Header
│   │   ├── courses/               # CourseCard
│   │   └── library/               # AddSourceModal, ScanProgressModal
│   └── pages/
│       ├── Dashboard.tsx          # Painel principal de boas-vindas e estatísticas
│       ├── Library.tsx            # Catálogo de cursos com busca e filtros
│       ├── CourseDetails.tsx      # Detalhes, módulos em acordeão e aulas
│       ├── Player.tsx             # Player de vídeo com anotações e marcadores
│       ├── Notes.tsx              # Central global de anotações
│       ├── StudyHistory.tsx       # Tabela de sessões de estudo
│       ├── Goals.tsx              # Metas diárias/semanais e tarefas
│       ├── Downloads.tsx          # Gerenciador de downloads offline
│       └── Settings.tsx           # Configurações, Rclone e banco de dados
│
├── tests/                         # Testes automatizados (Vitest)
│   ├── security.test.ts
│   ├── database.test.ts
│   ├── library.test.ts
│   └── rclone.test.ts
│
├── package.json
├── electron-builder.yml           # Configuração de empacotamento Windows / NSIS
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

---

## 3. Requisitos de Sistema

- **Sistema Operacional**: Windows 10 ou Windows 11 (64-bit).
- **Node.js**: Versão 18+ (recomendado Node 20+ ou 24).
- **Rclone (opcional para pastas locais, obrigatório para Google Drive)**:
  - Já detectado e configurado no sistema em `rclone` (testado com Rclone v1.74.4).
  - Remote `gdrive:` configurado com autenticação do Google Drive.

---

## 4. Instalação e Execução em Desenvolvimento

1. **Instalar dependências**:
   ```bash
   npm install
   ```

2. **Executar em modo desenvolvimento (Live Reload + HMR)**:
   ```bash
   npm run dev
   ```
   A janela desktop do StudyStream abrirá automaticamente conectada ao servidor Vite com recarregamento instantâneo.

3. **Executar os testes automatizados**:
   ```bash
   npm test
   ```

4. **Compilar a aplicação e gerar o executável/instalador**:
   ```bash
   npm run build
   ```
   O executável portátil descompactado será gerado em `release/win-unpacked/StudyStream.exe`.

---

## 5. Guia de Uso

### Como Adicionar Pastas Locais de Cursos
1. No canto superior direito, clique em **"Adicionar Origem"**.
2. Na aba **"Pasta Local (PC)"**, clique em **"Procurar"** e selecione o diretório dos seus cursos (ex: `C:\MeusCursos`).
3. O sistema indexará automaticamente as subpastas no formato:
   `Pasta Principal -> Nome do Curso -> Módulos -> Aulas em Vídeo`.
4. Os cursos aparecerão imediatamente no catálogo.

### Como Conectar com o Google Drive via Rclone
1. Certifique-se de que seu Rclone possui um remote do Google Drive (o aplicativo detecta automaticamente o remote `gdrive:` existente).
2. Clique em **"Adicionar Origem"** e selecione a aba **"Google Drive (Rclone)"**.
3. Escolha o remote detectado no menu suspenso (ex: `gdrive:`).
4. (Opcional) Digite o nome de uma subpasta específica (ex: `Cursos`).
5. Clique em **"Testar Acesso ao Remote"** para confirmar a conexão.
6. Clique em **"Adicionar e Indexar"**. O Rclone listará estruturadamente os arquivos e criará os cursos no catálogo local.

### Como Reproduzir Vídeos e Salvar o Progresso
1. Abra qualquer curso na Biblioteca e clique em **"Continuar Curso"** ou selecione a aula desejada.
2. Durante a reprodução:
   - O tempo estudado é salvo automaticamente.
   - Ao atingir 90% da aula, ela é marcada como concluída e o status do curso atualizado.
   - Pressione **Espaço** para pausar/retomar, ou **Setas** para avançar 5 segundos.
   - Digite notas na aba lateral **"Anotações"** e clique no carimbo de data/hora a qualquer momento para pular até aquele ponto no vídeo.

### Como Baixar Cursos para Modo Offline
1. Na visualização de um curso do Google Drive, clique no ícone de download ao lado de qualquer aula.
2. Acesse a aba **"Downloads Offline"** no menu lateral para visualizar o progresso em tempo real e a velocidade da transferência.
3. Após o download, a aula fica disponível no disco local e pode ser assistida sem qualquer conexão com a internet.

### Backup e Restauração do Banco SQLite
1. Acesse **Configurações** -> **Banco de Dados SQLite & Backup**.
2. Clique em **"Criar Backup do Banco (.db)"** e escolha onde salvar a cópia de segurança.
3. Para restaurar, clique em **"Restaurar Backup"**. O sistema valida a integridade do arquivo antes de aplicar qualquer alteração.

---

## 6. Resultados dos Testes Automatizados

O projeto conta com um conjunto completo de testes automatizados com 100% de aprovação:

| Arquivo de Teste | Suíte | Resultados |
|---|---|---|
| `tests/security.test.ts` | Validação de caminhos, rejeição de path traversal e caracteres proibidos | 4/4 Aprovados |
| `tests/database.test.ts` | Schema SQLite, Repositórios, Auto-conclusão 90%, Streaks, Notas, Metas e Backup | 9/9 Aprovados |
| `tests/library.test.ts` | Indexador de diretórios locais, agrupamento Módulos/Aulas e ordenação natural | 1/1 Aprovados |
| `tests/rclone.test.ts` | Detecção da versão instalada do Rclone e listagem segura de remotes (`gdrive:`) | 2/2 Aprovados |
| **Total** | **Testes de Integração e Unidade** | **16/16 Aprovados (100%)** |

---

## 7. Decisões Arquiteturais

1. **SQLite sem Dependência de Compilador Nativo C++**:
   Utilizamos `sql.js` (SQLite compilado oficialmente para WebAssembly pelo consórcio SQLite) com camada de persistência em disco transacional e buffer seguro. Essa decisão garante funcionamento imediato e confiável em qualquer instalação do Windows sem exigir Microsoft Visual Studio C++ Build Tools ou `node-gyp`.
2. **Streaming por HTTP 206 Partial Content**:
   Tanto os vídeos locais quanto os vídeos do Google Drive são servidos via loopback restrito com suporte completo ao cabeçalho `Range`. Isso viabiliza o avanço/retrocesso (seek) nativo no HTML5 `<video>` sem necessidade de carregar o arquivo integralmente em memória.
3. **Segurança IPC e ContextIsolation**:
   Nenhuma API de baixo nível do Node.js (`fs`, `child_process`, `net`) é exposta ao contexto de renderização do React. Toda a interação ocorre por canais IPC explícitos expostos através de `contextBridge` com validação de parâmetros.

---

## 8. Licença
MIT License. Desenvolvido para gerenciamento de estudos pessoais e streaming privado.
