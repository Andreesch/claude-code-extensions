# claude-code-extensions

Repositório público de extensões para o Claude Code. Mantido em `Andreesch/claude-code-extensions` no GitHub.

## Estrutura

```
claude-code-extensions/
└── extensions/
    └── <nome-da-extensao>/
        ├── install.sh      # Script de instalação (suporta curl | bash e clone local)
        ├── statusline.js   # Código da extensão
        └── README.md       # Documentação da extensão (opcional)
```

## Extensões Atuais

### statusline

Barra de status para o Claude Code com: modelo, git branch, diretório, barra de contexto, custo, block timer e notificações de update.

**Arquivos que instala:**
- `~/.claude/hooks/statusline.js` — hook executado a cada prompt
- `~/.claude/settings.json` — adiciona config `statusLine`
- `~/.local/bin/statusline-update` — comando para atualizar

**Constantes importantes em `statusline.js`:**
- `VERSION` — versão atual (ex: `1.1.0`). Bumpar a cada release.
- `UPDATE_URL` — aponta para `main` para verificar versão remota diariamente

## Deploy / Release

### 1. Fazer alterações

Edite os arquivos em `extensions/statusline/`, teste localmente:

```bash
bash extensions/statusline/install.sh
# Testar:
echo '{"model":"claude-sonnet-4-6","workspace":{"current_dir":"/tmp"},"session_id":"test","context_window":{"remaining_percentage":80},"cost":{"total_cost_usd":0.01}}' | node ~/.claude/hooks/statusline.js
```

### 2. Publicar nova versão

```bash
# 1. Bumpar VERSION em statusline.js
# 2. Commit e push para main
git add . && git commit -m "feat: ..." && git push origin main

# 3. Criar GitHub Release (dispara notificação de update para usuários)
gh auth switch --user Andreesch
gh release create vX.Y.Z --title "vX.Y.Z — descrição" --notes "O que mudou"
gh auth switch --user schneider-pxcenter
```

Usuários com a extensão instalada verão `⬆ statusline-update` na statusline na próxima verificação diária. Ao rodar `statusline-update`, instalam a nova release automaticamente.

### 3. Sincronizar com o PX Marketplace (opcional)

```bash
cp extensions/statusline/statusline.js \
   ~/Documents/workspace/px-github/px-claude-marketplace/extensions/statusline/statusline.js
cp extensions/statusline/install.sh \
   ~/Documents/workspace/px-github/px-claude-marketplace/extensions/statusline/install.sh

cd ~/Documents/workspace/px-github/px-claude-marketplace
git add extensions/statusline/ && git commit -m "..." && \
git remote set-url origin "https://schneider-pxcenter:$(gh auth token --user schneider-pxcenter)@github.com/px-center/px-claude-marketplace.git" && \
git push origin main && \
git remote set-url origin https://github.com/px-center/px-claude-marketplace.git
```

## Adicionar nova extensão

1. `mkdir extensions/<nome>`
2. Criar `install.sh` seguindo o padrão de `extensions/statusline/install.sh`
3. Adicionar ao `README.md` raiz
4. Fazer release

## GitHub

- **Conta:** `Andreesch` (pessoal)
- **Repo:** `https://github.com/Andreesch/claude-code-extensions`
- **Releases:** `https://github.com/Andreesch/claude-code-extensions/releases`
- Para operações no GitHub: `gh auth switch --user Andreesch` antes, `gh auth switch --user schneider-pxcenter` depois
