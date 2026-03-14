# claude-code-extensions

A collection of extensions for [Claude Code](https://claude.ai/claude-code).

## Extensions

### [statusline](extensions/statusline/)

A custom statusline for Claude Code showing at-a-glance session info.

```
claude-sonnet-4-6 │ main │ my-project ████░░░░░░ 38% │ $0.04 │ 12% (3h42m left)
```

**Widgets:**
- Model name — updates when you switch with `/model`
- Git branch — auto-detected from current directory
- Directory name
- Context window usage bar — scaled to Claude's 80% limit
- Session cost
- Block timer with utilization % (requires OAuth / Pro plan)

**Auto-updates** — shows `⬆ statusline-update` in yellow when a new version is available.

#### What this script does

Before running, you can review exactly what the install script does:

```bash
curl -fsSL https://raw.githubusercontent.com/Andreesch/claude-code-extensions/v1.1.0/extensions/statusline/install.sh | less
```

It will:
1. Download `statusline.js` to `~/.claude/hooks/statusline.js`
2. Add `statusLine` config to `~/.claude/settings.json`
3. Create `~/.local/bin/statusline-update` for future updates

No sudo required. No system-wide changes.

#### Install

```bash
curl -fsSL https://raw.githubusercontent.com/Andreesch/claude-code-extensions/v1.1.0/extensions/statusline/install.sh | bash
```

Requires Node.js. Restart Claude Code after installing.

#### Update

```bash
statusline-update
```

The `statusline-update` command is created automatically during install. It always fetches the latest published release. The statusline shows `⬆ statusline-update` in yellow when a new version is available.

---

## Contributing

Each extension lives in `extensions/<name>/` with its own `install.sh` and source files.
