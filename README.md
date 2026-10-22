# Silva's Tab

A minimalist kanban board for personal projects, that **Claude can read and update for you**.

<img src="img/kanban.png" width="500">

## What you can do

### Organize projects

- Keep all projects in the left column, each with its own color and initials.
- Reorder them by dragging the grip on the right of each project.
- Archive the projects you don't work on anymore: they leave the list and come back in one click from the **Archive** button.

### Track tasks

- Three columns: **TODO**, **On doing** and **Done**. Drag & drop a card to move it.
- Write the details of a task in Markdown (lists, headings, code…), with a live preview.
- Say which tasks must be finished first with **Blocked by**: the card shows a red *Blocked by* badge until they are done.
- Give each task a priority (**Low**, **Medium**, **High** or **NOW!**), shown as an icon in the bottom-right corner of its card.

<img src="img/edit.png" width="500">

### Tag and find

- Add tags to tasks, created on the fly while typing.
- Rename, recolor or delete them from the **tags** button of the board.
- Search tasks by text and filter them by tag.

<img src="img/tags.png" width="500">

<img src="img/search.png" width="500">

### Share with other people

- Sign in as **admin** to create, edit, archive and reorder projects, and to manage accounts from the **Accounts** button.
- Create an account by typing a username: a password is generated and shown once. The user replaces it at first sign-in.
- For each account, choose per project whether it is hidden, read only or editable. New projects are hidden from everybody but the admin.
- Reset a forgotten password the same way: the user is signed out and picks a new one at next sign-in.

### Let Claude work with you

Connect Claude to the board and just ask:

- *"What's left to do on Website redesign?"*
- *"Split this feature into tasks, with their dependencies."*
- *"Take the next ticket in TODO and do it."*

Claude can list projects and tasks, filter them by column, tag or priority, create tasks (with tags and blockers), edit them and move them between columns. The board refreshes by itself, so its changes show up live.

### On your phone too

The layout adapts to small screens: swipe between columns, scroll the project list, open any task.

<img src="img/mobile.png" width="250">

## Installation

Silva's Tab runs with Docker (one app container + MongoDB). Sign in with the `admin` account and the `SILVA_PASSWORD` password, then create accounts for the other people from the app.

```bash
cp .env.example .env        # set SILVA_PASSWORD and MCP_TOKEN (openssl rand -hex 32)
docker compose up -d --build
```

Open `http://localhost:3000`. Set `BIND_ADDRESS=0.0.0.0` in `.env` to reach it from your local network.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SILVA_PASSWORD` | yes | | Password of the admin account. Changing it logs everybody out. |
| `ADMIN_USERNAME` | no | `admin` | Login of the admin account. |
| `MCP_TOKEN` | yes | | Secret used by Claude to connect. |
| `MONGO_URL` | no | `mongodb://localhost:27017` | |
| `MONGO_DB` | no | `silvas-tab` | |
| `PORT` | no | `3000` | |
| `BIND_ADDRESS` | no | `127.0.0.1` | Network interface the app listens on (Docker Compose only). |

To put it online with HTTPS (Debian + nginx), follow [DEPLOY.md](DEPLOY.md).

> MongoDB 5+ needs a CPU with AVX. On older hardware or some virtual machines, use the `mongo:4.4` image.

### Connect Claude

The board exposes an MCP server at `/mcp`, authenticated with `MCP_TOKEN`. It has the same rights as the admin on every project.

**Claude Code**

```bash
claude mcp add --transport http silvas-tab https://tab.example.com/mcp \
  --header "Authorization: Bearer <MCP_TOKEN>"
```

Add `--scope user` to use it in every project.

**Claude Desktop / Cowork, local config** (works even when the board is only reachable from your machine or network). Edit `claude_desktop_config.json` (Settings → Developer → Edit Config), Node must be installed:

```json
{
  "mcpServers": {
    "silvas-tab": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3000/mcp", "--header", "Authorization:${SILVA_AUTH}"],
      "env": { "SILVA_AUTH": "Bearer <MCP_TOKEN>" }
    }
  }
}
```

Add `--allow-http` to the args for a non-localhost `http://` URL, then restart Claude Desktop.

**claude.ai / Claude Desktop / Cowork, custom connector** (the board must be reachable from the internet over HTTPS). Customize → Connectors → `+` → Add custom connector, with the URL below and empty OAuth fields:

```
https://tab.example.com/mcp?token=<MCP_TOKEN>
```

### Development

```bash
npm install
docker run -d -p 27017:27017 --name silva-mongo mongo:8
cp .env.example .env
npm run dev                 # API on :3000, UI on http://localhost:5173
```

`npm run build && npm start` runs the production build.
