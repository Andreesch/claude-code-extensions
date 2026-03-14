#!/usr/bin/env bash
set -euo pipefail

REPO='Andreesch/claude-code-extensions'
BASE_URL="https://raw.githubusercontent.com/$REPO/main/extensions/statusline"
RELEASES_API="https://api.github.com/repos/$REPO/releases/latest"

HOOK_DST="$HOME/.claude/hooks/statusline.js"
SETTINGS="$HOME/.claude/settings.json"
BIN_DIR="$HOME/.local/bin"
UPDATE_CMD="$BIN_DIR/statusline-update"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[+]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[x]${NC} $1" >&2; exit 1; }

# ── Pre-flight checks ────────────────────────────────────────────────────────

command -v node >/dev/null 2>&1 || error "Node.js is required but not found. Install it first."

# ── Resolve statusline.js (local clone or remote download) ───────────────────

mkdir -p "$HOME/.claude/hooks"

# Only use local file if $0 is an actual file on disk (not piped via curl | bash)
if [ -f "$0" ] && [ -f "$(dirname "$0")/statusline.js" ]; then
  cp "$(dirname "$0")/statusline.js" "$HOOK_DST"
  info "Copied statusline.js to $HOOK_DST"
else
  info "Downloading statusline.js..."
  curl -fsSL "$BASE_URL/statusline.js" -o "$HOOK_DST" || error "Failed to download statusline.js"
  info "Downloaded statusline.js to $HOOK_DST"
fi

chmod +x "$HOOK_DST"

# ── Update settings.json ─────────────────────────────────────────────────────

STATUSLINE_CMD="node \"$HOOK_DST\""

if [ ! -f "$SETTINGS" ]; then
  mkdir -p "$(dirname "$SETTINGS")"
  STATUSLINE_CMD="$STATUSLINE_CMD" node -e '
    const fs = require("fs");
    const cmd = process.env.STATUSLINE_CMD;
    const cfg = { statusLine: { type: "command", command: cmd } };
    fs.writeFileSync(process.argv[1], JSON.stringify(cfg, null, 2) + "\n");
  ' "$SETTINGS"
  info "Created $SETTINGS with statusLine config"
else
  STATUSLINE_CMD="$STATUSLINE_CMD" node -e '
    const fs = require("fs");
    const p = process.argv[1];
    const cmd = process.env.STATUSLINE_CMD;
    const cfg = JSON.parse(fs.readFileSync(p, "utf8"));
    cfg.statusLine = { type: "command", command: cmd };
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n");
  ' "$SETTINGS"
  info "Updated statusLine in $SETTINGS"
fi

# ── Clear update cache ───────────────────────────────────────────────────────

rm -f "$HOME/.cache/claude-statusline/update.json" "$HOME/.cache/claude-statusline/update.lock"

# ── Install statusline-update command ────────────────────────────────────────

mkdir -p "$BIN_DIR"
cat > "$UPDATE_CMD" <<EOF
#!/usr/bin/env bash
# Fetches the latest release from GitHub and runs its install script
LATEST=\$(curl -fsSL '$RELEASES_API' | grep -o '"tag_name":"[^"]*"' | cut -d'"' -f4)
if [ -z "\$LATEST" ]; then
  echo "Could not fetch latest release. Check your connection." >&2
  exit 1
fi
curl -fsSL "https://raw.githubusercontent.com/$REPO/\${LATEST}/extensions/statusline/install.sh" | bash
EOF
chmod +x "$UPDATE_CMD"
info "Installed update command: statusline-update"

# Warn if ~/.local/bin is not in PATH
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
  warn "~/.local/bin is not in your PATH. Add this to your shell profile:"
  warn "  export PATH=\"\$HOME/.local/bin:\$PATH\""
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
info "Installation complete!"
echo ""
echo "  Restart Claude Code to see the new statusline."
echo ""
echo "  To update later, run:  statusline-update"
echo "  (the statusline will show '⬆ statusline-update' when a new version is available)"
echo ""
