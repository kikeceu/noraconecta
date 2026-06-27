# NORA Conecta MCP Server

MCP (Model Context Protocol) server for managing NORA Conecta admin panel directly from Claude or OpenCode.

## Setup

```bash
cd mcp
cp .env.example .env
# Edit .env with your NORA admin credentials
npm install
npm run build
```

## Usage

Configure your MCP client to run:

```bash
node /path/to/noraconecta/mcp/dist/index.js
```

Or with environment variables:

```bash
NORA_API_URL=https://api.noraconecta.com \
NORA_ADMIN_EMAIL=admin@noraconecta.com \
NORA_ADMIN_PASSWORD=yourpassword \
node dist/index.js
```

## Available Tools

- **Professionals**: list, get, approve, reject, suspend, reactivate, assign/cancel membership, badge, license status, data changes, panel session
- **Requests**: list, get
- **Metrics**: dashboard metrics, config, membership discount
- **Locations**: countries, geo tree, create/update/toggle geo nodes
- **Categories**: list, create, update, toggle
- **Plans**: list, create, update, deactivate
- **Users**: list, get, block, unblock
- **Escalations**: list, get, change status, resolve
