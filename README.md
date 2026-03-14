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

**Auto-updates** — notifies you in the statusline when a new version is available (`⬆ statusline`).

#### Install

```bash
curl -fsSL https://raw.githubusercontent.com/Andreesch/claude-code-extensions/main/extensions/statusline/install.sh | bash
```

Requires Node.js. Restart Claude Code after installing.

#### Update

Re-run the install command above. The statusline will show `⬆ statusline` in yellow when a new version is available.

---

## Contributing

Each extension lives in `extensions/<name>/` with its own `install.sh` and source files.
