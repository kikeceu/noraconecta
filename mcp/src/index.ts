import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerProfessionalTools } from './tools/professionals.js';
import { registerRequestTools } from './tools/requests.js';
import { registerMetricTools } from './tools/metrics.js';
import { registerLocationTools } from './tools/locations.js';
import { registerCategoryTools } from './tools/categories.js';
import { registerPlanTools } from './tools/plans.js';
import { registerUserTools } from './tools/users.js';
import { registerEscalationTools } from './tools/escalations.js';

const server = new McpServer({
  name: 'nora-conecta',
  version: '1.0.0',
});

registerProfessionalTools(server);
registerRequestTools(server);
registerMetricTools(server);
registerLocationTools(server);
registerCategoryTools(server);
registerPlanTools(server);
registerUserTools(server);
registerEscalationTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);

console.error('[NORA MCP] Server started');
