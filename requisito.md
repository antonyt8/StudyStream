# PROJETO: STUDYSTREAM DESKTOP
## Plataforma monolítica de estudos, cursos e streaming pessoal (Edição Atualizada & Especificação Completa)

Atue como um engenheiro de software sênior, arquiteto de aplicações desktop, especialista em desenvolvimento Windows, streaming de vídeo, integração com Google Drive e Rclone, bancos de dados locais, UX/UI e engenharia de aprendizagem.

Sua missão é PROJETAR, IMPLEMENTAR, TESTAR E DOCUMENTAR uma aplicação desktop completa para Windows, destinada ao gerenciamento e à reprodução de cursos pessoais armazenados no Google Drive e no disco local, equipada com ferramentas modernas de retenção de estudo, streaming otimizado e organização de arquivos.

Não quero apenas um protótipo visual, uma landing page ou uma demonstração com dados fictícios. Quero uma aplicação funcional, com persistência real, integração efetiva com os arquivos, reprodução de vídeos e funcionalidades de estudo implementadas.

---

# 1. VISÃO GERAL DO PROJETO

Nome oficial: StudyStream Desktop.

Objetivo: desenvolver uma plataforma privada de estudos que combine características de:

- **Netflix**: catálogo visual cinematográfico, capas dinâmicas geradas por IA/vídeo, categorias, abas limpas e reprodução fluida.
- **Udemy / Coursera**: cursos, módulos recolhíveis, aulas, controle de materiais de apoio paginados e acompanhamento detalhado de progresso.
- **Plex / Stremio**: biblioteca pessoal de mídia, indexação sob demanda, suporte a streaming em nuvem sem download prévio obrigatório e fallback para reprodutor externo (VLC/MPV).
- **Notion / Obsidian**: anotações ricas com timestamps clicáveis, captura de prints da lousa/slides e exportação para Markdown (.md).
- **Anki / SuperMemo**: sistema integrado de Flashcards com Repetição Espaçada (SRS) para fixação de conceitos das aulas.
- **Aplicativos de produtividade**: timer Pomodoro no player, heatmap anual de consistência (estilo GitHub), metas diárias e histórico de aprendizagem.

O sistema transforma pastas de cursos armazenadas no Google Drive ou no computador em uma biblioteca organizada, permitindo localizar, reproduzir e estudar os conteúdos por meio de uma interface própria de alta velocidade.

A aplicação funciona prioritariamente em computadores Windows, em arquitetura local e monolítica, sem exigir servidores em nuvem pagos ou assinaturas de streaming de terceiros.

A integração com o Google Drive aproveita diretamente uma instalação existente do Rclone, sem exigir reautenticação manual nem expor tokens na interface.

O programa continua permitindo a reprodução de cursos já baixados e o acesso às informações locais mesmo quando estiver totalmente sem conexão com a internet.

## Princípios fundamentais

1. **Aplicação desktop de verdade**: Executável nativo empacotado para Windows com baixa sobrecarga de memória e CPU.
2. **Arquitetura monolítica modular**: Main process seguro, preload isolado com context isolation e interface React moderna.
3. **Interface premium e responsiva**: Design escuro curado, glassmorphism sutil, tipografia moderna e ausência de sobrecarga no DOM (paginação e abas dedicadas).
4. **Streaming de ultra-baixa latência**: Conexões paralelas com o Google Drive (`--vfs-read-chunk-streams 4`), pré-buffer inteligente da próxima aula e aceleração de hardware GPU.
5. **Acesso híbrido flexível**: Player interno moderno com todas as ferramentas de estudo e botão para abrir instantaneamente no VLC/MPV quando desejado.
6. **Central de estudo completa**: Visualizador de PDF integrado, modo dividido (Split View), anotações com prints da tela, flashcards e timer Pomodoro.
7. **Banco de dados SQLite persistente**: Migrações versionadas, integridade relacional e rotinas de backup local e em nuvem.
8. **Respeito absoluto aos arquivos originais**: Nunca renomear, mover ou apagar arquivos originais da origem sem autorização explícita.
9. **Total privacidade e segurança**: Zero telemetria obrigatória, senhas ocultas e comunicação loopback autenticada por token de sessão.

---

# 2. ARQUITETURA DA APLICAÇÃO

O sistema é uma aplicação desktop monolítica modular sem dependência de APIs remotas proprietárias.

## Stack tecnológica

### Aplicação desktop
- **Electron** (última versão LTS estável).
- **React 18+** com **TypeScript** e **Vite**.
- **Node.js** integrado exclusivamente ao Main Process do Electron.

### Interface & Design System
- **Vanilla CSS / Tailwind CSS** com tokens HSL de alto contraste e glassmorphism.
- **Lucide React** para iconografia técnica e visual.
- **Componentes reutilizáveis** e responsivos a redimensionamentos da janela.

### Persistência & Cache
- **SQLite** via driver nativo de alta velocidade (`better-sqlite3`).
- **Migrações de esquema versionadas** executadas automaticamente na inicialização.
- **Transações ACID** para operações em lote (importações de cursos e varreduras).

### Motor de Reprodução de Vídeo e Áudio
- **HTML5 Video Player Customizado** com Chromium GPU Acceleration (`enable-accelerated-video-decode`, `enable-gpu-rasterization`).
- **Loopback HTTP Server interno** com suporte a HTTP 206 Partial Content (Range requests) e token de sessão criptográfico.
- **Rclone Serve HTTP Integrado** operando em loopback local com cache VFS inteligente.
- **Web Audio API** para ganho de volume (Volume Boost até 300%) e filtro equalizador de clareza de voz.

### Integração com Sistema Operacional
- Janelas nativas de seleção de pastas e arquivos.
- Detecção e execução de executáveis locais (Rclone, VLC Media Player, MPV Player, PotPlayer).
- Empacotador `electron-builder` para geração de instalador NSIS e binário executável portátil.

---

# 3. ESTRUTURA DO PROJETO

```
studystream-desktop/
├── electron/
│   ├── main.ts                    # Inicialização do Electron, switches de GPU e ciclo de vida
│   ├── preload.ts                 # ContextBridge com tipagem estrita (WindowApi)
│   ├── ipc/                       # Controladores IPC organizados por domínio
│   │   ├── library.ipc.ts
│   │   ├── courses.ipc.ts
│   │   ├── playback.ipc.ts
│   │   ├── explorer.ipc.ts
│   │   ├── notes.ipc.ts
│   │   ├── goals.ipc.ts
│   │   ├── tasks.ipc.ts
│   │   ├── downloads.ipc.ts
│   │   ├── rclone.ipc.ts
│   │   └── settings.ipc.ts
│   ├── services/                  # Regras de negócio e comunicação com SO
│   │   ├── rclone.service.ts      # Gerenciamento de processos Rclone e streaming HTTP
│   │   ├── library.service.ts     # Varredura recursiva de diretórios locais e remotos
│   │   ├── playback.service.ts    # Servidor loopback, Range requests e launcher de player externo
│   │   ├── download.service.ts    # Fila de downloads em lote e controle de progresso
│   │   └── backup.service.ts      # Backup e restauração do SQLite local e em nuvem
│   ├── database/                  # Camada de banco de dados
│   │   ├── connection.ts          # Conexão singleton Better-SQLite3
│   │   ├── migrations/            # Scripts versionados (001_initial.ts, etc.)
│   │   └── repositories/          # Repositórios especializados (courses, lessons, notes, etc.)
│   └── security/                  # Validação de caminhos e sanitização de entradas
│       └── path-validation.ts
│
├── src/                           # Frontend React (Renderer Process)
│   ├── components/                # Componentes de interface
│   │   ├── layout/                # Sidebar, Header, Modais globais
│   │   ├── courses/               # CourseCard, CourseDetails, FolderExplorerModal
│   │   ├── player/                # CustomVideoPlayer, TimelineMarkers, SplitView
│   │   └── common/                # Badges, Tooltips, EmptyStates, Pagination
│   ├── pages/                     # Páginas da aplicação
│   │   ├── Dashboard.tsx          # Visão geral, heatmap de estudo e métricas
│   │   ├── Library.tsx            # Biblioteca, filtros e navegação por origens
│   │   ├── CourseDetails.tsx      # Detalhes do curso, abas, paginação de materiais
│   │   ├── Player.tsx             # Reprodutor imersivo com notas, prints e VLC
│   │   ├── Notes.tsx              # Caderno geral de anotações e exportação Markdown
│   │   ├── StudyHistory.tsx       # Histórico de sessões detalhado
│   │   ├── Goals.tsx              # Metas diárias, semanais e lista de tarefas
│   │   ├── Downloads.tsx          # Fila de downloads offline ativos e concluídos
│   │   └── Settings.tsx           # Diagnósticos do Rclone, temas e backup
│   ├── types/                     # Interfaces e contratos TypeScript centralizados
│   └── index.css                  # Folha de estilo global com Tailwind e tokens HSL
│
├── tests/                         # Testes automatizados (Vitest)
│   ├── security.test.ts
│   ├── library.test.ts
│   ├── database.test.ts
│   └── rclone.test.ts
├── package.json
├── electron-builder.yml
├── vite.config.ts
└── tsconfig.json
```

---

# 4. DASHBOARD & MÉTRICAS ANALÍTICAS

A tela inicial combina catálogo visual cinematográfico e painel de controle de produtividade:

## Cabeçalho Global
- Logotipo com badge "Desktop".
- Barra de busca global rápida com atalho de teclado (`Ctrl+K`).
- Indicador visual de ofensiva de estudo diária (Streak em dias com ícone de fogo).
- Minutos estudados no dia atual em relação à meta.
- Indicador de status do Google Drive / Rclone (Conectado / Desconectado).
- Botão primário com destaque: `+ Adicionar Origem`.

## Menu Lateral (Sidebar)
Navegação fluida e categorizada:
1. **Início** (Dashboard).
2. **Minha Biblioteca** (Todos os cursos cadastrados).
3. **Continuar Assistindo** (Aulas em andamento com barra de percentual).
4. **Favoritos** (Cursos e aulas com estrela).
5. **Cursos Concluídos** (Histórico de conclusão 100%).
6. **Minhas Anotações** (Caderno unificado com visualização de prints e exportação).
7. **Flashcards & Revisão** (Sistema de repetição espaçada diária).
8. **Histórico de Estudos** (Relatório minucioso de cada sessão).
9. **Metas de Estudo** (Metas diárias, semanais e checklist de tarefas).
10. **Downloads Offline** (Gerenciador de transferências e espaço em disco).
11. **Configurações** (Rclone, cache VFS, caminhos e backups).

## Conteúdo Analítico do Dashboard
- **Card de Retomada Rápida ("Hero Continue")**: Botão gigante para continuar imediatamente a última aula assistida.
- **Heatmap de Consistência Anual (Estilo GitHub)**: Grid de 365 dias mostrando os blocos de estudo diários em tons de verde/esmeralda conforme a quantidade de minutos estudados.
- **Gráficos Semanais**: Gráfico de barras indicando horas estudadas de segunda a domingo.
- **Carrosséis de Cursos**:
  - *Continuar de onde parou*.
  - *Adicionados recentemente*.
  - *Seus favoritos*.
  - *Cursos por categoria*.

---

# 5. EXPLORADOR INTERATIVO DE PASTAS E BIBLIOTECA

A biblioteca oferece tanto indexação em massa quanto controle cirúrgico de importação de cursos individuais ou múltiplos.

## Explorador de Pastas da Nuvem e Local (Folder Explorer Modal)
- Navegação visual interativa por pastas e subpastas de remotes do Google Drive (via Rclone `lsjson`) e diretórios locais.
- **Criação de Curso por Pasta**: O usuário clica em qualquer pasta da nuvem e seleciona `Adicionar como Curso`.
- **Preservação de Nome e Estrutura**:
  - O nome exato da pasta selecionada torna-se o título do curso.
  - Subpastas existentes dentro dessa pasta são automaticamente mapeadas como **Módulos internos**, sem fragmentar o curso em dezenas de cursos separados na biblioteca.
  - Vídeos soltos na raiz da pasta tornam-se o módulo introdutório ("Módulo 1: Introdução / Geral").

## Detecção e Organização de Arquivos
- **Formatos de Vídeo Suportados**: MP4, MKV, WebM, MOV, AVI, M4V, TS.
- **Apostilas e Documentos Suportados**: PDF, TXT, Markdown, DOCX, ZIP, EPUB.
- **Capas Automáticas Inteligentes**: Ao indexar ou ao dar o primeiro play, o sistema captura um frame de alta definição do vídeo e o define como a capa oficial do curso.
- **Edição de Metadados**: Modal para alterar título de exibição, nome do instrutor, descrição, status de conclusão e listas personalizadas.

---

# 6. ARQUITETURA DA PÁGINA DO CURSO (COURSE DETAILS)

Para cursos de grande porte (como preparatórios para concursos ou formações com mais de 100 módulos e 700 aulas), a interface utiliza uma **arquitetura de abas dedicada**, eliminando a sobrecarga de renderização no DOM:

## Cabeçalho Hero do Curso
- Capa do curso com efeito de zoom suave ao passar o mouse.
- Badges de origem (`Google Drive` / `Local`), categoria e status (`Não Iniciado`, `Em Andamento`, `Concluído`).
- Título em destaque, nome do professor e descrição.
- Barra de progresso com percentual e contagem de aulas concluídas.
- Botões de ação rápida: `Começar a Assistir`, `Baixar Curso Completo`, `Exportar Anotações (.md)`, `Favoritar`, `Listas`, `Editar Metadados`, `Zerar Progresso` e `Excluir Curso`.

## Sistema de 3 Abas Navegáveis

### Aba 1: Aulas & Conteúdo
- **Recolhimento Inteligente Padrão**: Em cursos com mais de 2 módulos, todos os módulos iniciam **recolhidos por padrão**, mantendo aberto apenas o módulo que contém a próxima aula a ser assistida.
- **Botão "Expandir Todos / Recolher Todos"**: Alterna os mais de 100 módulos em um único clique.
- **Filtro de Aulas em Tempo Real**: Campo de busca instantâneo. Ao digitar um termo (ex: *"Direito"*), os módulos correspondentes abrem automaticamente exibindo as aulas filtradas.
- **Downloads por Módulo**: Botão direto no cabeçalho de cada módulo para baixar todas as suas aulas em lote.
- **Checkmarks de Conclusão**: Marcação manual ou automática com indicação de duração e arquivos PDF embutidos.

### Aba 2: Materiais de Apoio (Paginado & Enxuto)
- **Paginação de Alta Performance**: Exibição em lotes de **24 materiais por página**, permitindo navegar facilmente mesmo quando o curso possui mais de 400 arquivos de apoio.
- **Filtros por Categoria**: Chips rápidos: `Todos`, `Apostilas PDF`, `Arquivos ZIP`, `Outros`.
- **Alternador de Visualização**:
  - *Modo Lista Compacta (Padrão)*: Linhas horizontais elegantes com ícone colorido por tipo de arquivo, título com tooltip, formato e tamanho formatado.
  - *Modo Grade*: Cards visuais modernos e compactos.
- **Abertura Segura**: Botão com indicador de carregamento giratório durante a chamada do arquivo.

### Aba 3: Anotações do Curso
- Listagem de todas as anotações registradas nas aulas deste curso.
- **Pulos no Vídeo**: Marcadores de tempo clicáveis (`[05:32]`) que abrem o player no exato segundo da nota.
- **Miniaturas de Prints com Zoom**: Prints tirados da tela da aula com modal para visualização em alta resolução.
- **Fixação no Topo**: Possibilidade de fixar notas cruciais.
- **Exportação Integrada**: Botão para gerar arquivo Markdown formatado.

---

# 7. MOTOR DE REPRODUÇÃO DE VÍDEO & STREAMING

O reprodutor de vídeo do StudyStream é construído para máxima fluidez, retenção de estudo e flexibilidade:

## Streaming Google Drive de Ultra-Baixa Latência
- **Servidor Rclone Otimizado**:
  - `--vfs-cache-mode full`: Cache local em disco SSD garantindo busca instantânea após o download dos blocos.
  - `--vfs-read-chunk-size 8M`: Chunk inicial de apenas 8MB para início imediato do play em menos de 1 segundo.
  - `--vfs-read-chunk-size-limit 128M`: Expansão automática do tamanho dos blocos durante a reprodução contínua.
  - `--vfs-read-chunk-streams 4`: Quatro fluxos HTTPS simultâneos de download dos blocos remotos.
  - `--vfs-read-ahead 64M`: Pré-carregamento constante à frente da agulha de reprodução.
  - `--vfs-handle-caching 30m`: Mantém conexões SSL e handles de arquivo abertos por 30 minutos para trocas de aula sem atraso.
  - **Detecção Ativa de Porta por Socket TCP**: Verificação ativa a cada 35ms, eliminando esperas estáticas de inicialização.

## Pré-Buffer Inteligente da Próxima Aula (Zero Delay)
- Enquanto o aluno assiste à aula atual, ao atingir 40% da duração (ou 40 segundos), o sistema dispara uma requisição silenciosa em segundo plano dos primeiros **16 MB da próxima aula**.
- Ao clicar em *"Próxima Aula"* ou ao término do vídeo, o próximo conteúdo abre em **0 milissegundos**, tocando imediatamente a partir do cache local.

## Launcher Híbrido para Reprodutor Externo (VLC / MPV)
- Botão dedicado na barra superior do Player: **`Player Externo (VLC)`**.
- Com 1 clique, o sistema detecta e repassa a URL de streaming ou o arquivo local diretamente para:
  - **VLC Media Player** (`vlc.exe`).
  - **MPV Player** (`mpv.exe`).
  - **PotPlayer** (`PotPlayer64.exe`).
  - **Reprodutor padrão do Windows**.
- O reprodutor interno pausa automaticamente, permitindo usar equalizadores externos ou recursos avançados sem perder o controle do StudyStream.

## Controles e Experiência Audiovisual do Player
- **Velocidades de Reprodução**: 0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x, 2.5x com preservação do pitch de áudio.
- **Amplificador de Volume (Audio Boost até 300%)**: Ganho adicional de áudio via Web Audio API para aulas com gravação baixa.
- **Picture-in-Picture (PiP)** nativo e Tela Cheia sem bordas.
- **Legendas Automáticas**: Descoberta de arquivos `.srt` e `.vtt` na pasta do curso com conversão sob demanda para WebVTT.
- **Marcadores Interativos na Linha do Tempo**:
  - Pontos em **Âmbar**: Anotações do aluno com preview em tooltip ao passar o mouse.
  - Pontos em **Ciano**: Marcadores de revisão (Bookmarks).
- **Atalhos Rápidos de Teclado**:
  - `Espaço`: Play/Pause.
  - `J` / `L`: Voltar / Avançar 10 segundos.
  - `Setas`: Volume e busca fina.
  - `N`: Próxima aula.
  - `P`: Aula anterior.
  - `M`: Mudo.
  - `F`: Tela cheia.
  - `Print/Câmera`: Captura instantânea do frame do vídeo.

---

# 8. MODO DE ESTUDO & RECURSOS PEDAGÓGICOS

## Captura de Prints da Aula (Screen Snapshot)
- Botão de câmera no player ou atalho que congela e captura o frame exato do vídeo em resolução nativa (Canvas API).
- O print é anexado diretamente à anotação do aluno, criando cadernos visuais com gráficos, tabelas e lousas desenhadas pelo professor.
- Modal de ampliação com clique na imagem para estudo de diagramas complexos.

## Visualizador de PDF Integrado & Modo Dividido (Split Screen)
- Visualizador de PDF embutido na aplicação sem depender de janelas externas do navegador.
- **Modo Split Screen**:
  - Metade esquerda da tela: Vídeo da aula em execução.
  - Metade direita da tela: Apostila PDF ou caderno de anotações aberto lado a lado.
- Marcador de página automática por aula.

## Sistema de Flashcards & Repetição Espaçada (SRS - Anki Integrado)
- Criação de cartões de estudo (Frente/Verso e prints de aula) diretamente a partir das anotações.
- **Algoritmo de Repetição Espaçada**:
  - Avaliação de retenção: `Novamente` (1 dia), `Difícil` (3 dias), `Bom` (7 dias), `Fácil` (14+ dias).
  - Central de revisão diária no menu lateral indicando quantos cards precisam ser revisados no dia.

## Timer Pomodoro & Modo Foco no Player
- Temporizador discreto na barra de reprodução com ciclos configuráveis (ex: 25 min de foco / 5 min de descanso).
- Alerta sonoro suave e pausa opcional do vídeo ao encerrar o ciclo para descanso visual.

## Exportação Completa de Cadernos em Markdown (.md)
- Exportação de todas as anotações do curso ou da biblioteca para arquivos `.md` estruturados com timestamps formatados (`[12:45]`), títulos das aulas e imagens de prints embutidas.
- Compatibilidade nativa com ferramentas como **Notion**, **Obsidian**, **Logseq** e **Typora**.

---

# 9. GESTÃO DE DOWNLOADS & MODO OFFLINE

- **Fila de Downloads Não-Bloqueante**: Downloads em segundo plano utilizando Rclone com feedback em tempo real de porcentagem, velocidade (MB/s) e tempo restante.
- **Download em Lote de Cursos e Módulos**: Botões `Baixar Curso` e `Baixar Módulo` que enfileiram automaticamente apenas as aulas que ainda não estão salvas localmente.
- **Associação Automática**: Uma aula baixada é vinculada instantaneamente ao registro do curso no SQLite. Ao desconectar a internet, a aula é reproduzida via arquivo local com 100% de rapidez.
- **Modo Offline Total**: Todas as anotações, histórico de estudo, metas e cursos baixados funcionam sem qualquer necessidade de conexão com a rede.

---

# 10. BANCO DE DADOS LOCAL SQLITE

Estrutura relacional normalizada com Better-SQLite3:

```sql
-- Origens locais e nuvem
CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'local' | 'gdrive'
  root_path TEXT NOT NULL,
  remote_name TEXT,
  enabled INTEGER DEFAULT 1,
  scan_mode TEXT DEFAULT 'single_course',
  last_scan_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Cursos
CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  instructor TEXT,
  category_id TEXT,
  cover_path TEXT,
  total_duration_seconds INTEGER DEFAULT 0,
  status TEXT DEFAULT 'not_started',
  is_favorite INTEGER DEFAULT 0,
  root_folder TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Módulos
CREATE TABLE modules (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  relative_path TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Aulas
CREATE TABLE lessons (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  original_path TEXT NOT NULL,
  local_path TEXT,
  remote_path TEXT,
  duration_seconds INTEGER DEFAULT 0,
  position INTEGER NOT NULL,
  media_type TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  is_available INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Materiais complementares
CREATE TABLE course_materials (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  module_id TEXT,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'pdf' | 'txt' | 'markdown' | 'docx' | 'zip' | 'other'
  file_size INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Progresso de estudo
CREATE TABLE lesson_progress (
  id TEXT PRIMARY KEY,
  lesson_id TEXT UNIQUE NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  position_seconds REAL DEFAULT 0,
  duration_seconds REAL DEFAULT 0,
  progress_percent REAL DEFAULT 0,
  completed INTEGER DEFAULT 0,
  last_watched_at TEXT,
  updated_at TEXT NOT NULL
);

-- Sessões de estudo contínuas
CREATE TABLE study_sessions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  elapsed_seconds INTEGER NOT NULL,
  session_status TEXT DEFAULT 'completed'
);

-- Anotações com screenshots
CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  timestamp_seconds REAL,
  snapshot_data TEXT, -- Base64 do frame capturado
  is_pinned INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Flashcards com Repetição Espaçada
CREATE TABLE flashcards (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id TEXT REFERENCES lessons(id) ON DELETE SET NULL,
  front_text TEXT NOT NULL,
  back_text TEXT NOT NULL,
  image_data TEXT,
  interval_days INTEGER DEFAULT 1,
  ease_factor REAL DEFAULT 2.5,
  repetitions INTEGER DEFAULT 0,
  next_review_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Fila de downloads
CREATE TABLE downloads (
  id TEXT PRIMARY KEY,
  lesson_id TEXT UNIQUE NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  remote_path TEXT NOT NULL,
  destination_path TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  total_bytes INTEGER DEFAULT 0,
  downloaded_bytes INTEGER DEFAULT 0,
  speed INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Configurações de sistema
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

# 11. SEGURANÇA, PRIVACIDADE E BACKUP EM NUVEM

1. **Proteção Contra Path Traversal**: Validação estrita de todos os caminhos locais e remotos através da classe `PathSecurity`.
2. **Loopback Server com Token Criptográfico**: URLs de mídia exigem parâmetro `?token=` único gerado por sessão de inicialização.
3. **Mascaração de Credenciais**: Rclone stderr passa por filtro regex para garantir que tokens Bearer ou senhas nunca sejam expostos em logs.
4. **Backup em Nuvem Automático (Auto-Cloud Backup)**:
   - Rotina periódica que gera snapshot atômico do SQLite e salva em pasta oculta do remote configurado (`gdrive:/.studystream_backup/studystream.db`).
   - Permite restaurar todo o progresso e cadernos com 1 clique em qualquer máquina.

---

# 12. PLANO DE TESTES E CONTROLE DE QUALIDADE

Suíte de testes automatizados com **Vitest**:
- `tests/security.test.ts`: Rejeição de caminhos maliciosos (`../`, pipes, caracteres nulos) e validação de tokens.
- `tests/library.test.ts`: Agrupamento hierárquico de pastas, ordenação natural de aulas e suporte a partes (`Parte 1`, `Parte 2`).
- `tests/database.test.ts`: Migrações versionadas, constraints de chave estrangeira em cascata e transações.
- `tests/rclone.test.ts`: Detecção da versão instalada do Rclone, listagem estruturada JSON e integridade de conexões.

---

# 13. ROADMAP DE IMPLEMENTAÇÃO E EXPANSÃO FUTURA

### Fases 1 a 7 (Concluídas)
- Fundação do sistema, layout moderno com glassmorphism, banco SQLite com migrações.
- Indexação de pastas locais e integração total com o Google Drive via Rclone.
- Player HTML5 com aceleramento GPU, reprodução em nuvem sem download prévio.
- Caderno de estudos com screenshots das aulas, marcadores na timeline e exportação Markdown.
- Fila de downloads offline em lote de cursos e módulos.
- Explorador interativo de pastas do Google Drive e preservação de títulos de cursos.
- Reestruturação de cursos extensos em abas com paginação e recolhimento de módulos.
- Otimização de streaming com chunks de 8MB, conexões paralelas e pré-buffer da próxima aula.
- Launcher híbrido para reprodutor externo (VLC / MPV).

### Fase 8: Estudo Imersivo & Visualizador de PDF (Próxima Etapa)
- Visualizador interno de apostilas PDF.
- Modo Split Screen (Vídeo + Apostila lado a lado na mesma janela).
- Salvar automaticamente a última página lida da apostila de cada aula.

### Fase 9: Áudio & Volume Boost
- Web Audio API com ganho ajustável até 300% para aulas antigas com som baixo.
- Filtro equalizador para realce de frequências de voz humana.

### Fase 10: Retenção Máxima (SRS & Anki Integrado)
- Central de Flashcards com repetição espaçada.
- Criação rápida de cards a partir de qualquer anotação ou print com 1 clique.

### Fase 11: Produtividade & Métricas Avançadas
- Heatmap de consistência anual (estilo GitHub) no Dashboard.
- Temporizador Pomodoro integrado na barra do player com pausas automáticas.
- Backup automático em nuvem do banco `studystream.db` no Google Drive.