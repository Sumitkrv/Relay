import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('SaaS Prompt 1 - Frontend: WorkspaceContext and WorkspaceProvider exist and export useWorkspace', () => {
  const contextPath = path.resolve(__dirname, '../src/context/WorkspaceContext.jsx');
  assert.ok(fs.existsSync(contextPath), 'WorkspaceContext.jsx must exist');
  const code = fs.readFileSync(contextPath, 'utf8');

  assert.ok(code.includes('createContext'), 'Must create WorkspaceContext');
  assert.ok(code.includes('export function WorkspaceProvider'), 'Must export WorkspaceProvider');
  assert.ok(code.includes('export const useWorkspace'), 'Must export useWorkspace hook');
  assert.ok(code.includes('selectWorkspace'), 'Must provide selectWorkspace helper');
  assert.ok(code.includes('refreshWorkspace'), 'Must provide refreshWorkspace helper');
  assert.ok(code.includes('relay_active_workspace_id'), 'Must persist active workspace in localStorage');
});

test('SaaS Prompt 1 - Frontend: main.jsx wraps WorkspaceProvider inside AuthProvider without breaking routing', () => {
  const mainPath = path.resolve(__dirname, '../src/main.jsx');
  const code = fs.readFileSync(mainPath, 'utf8');

  assert.ok(code.includes('WorkspaceProvider'), 'main.jsx must import and mount WorkspaceProvider');
  assert.ok(code.includes('<AuthProvider><WorkspaceProvider>'), 'WorkspaceProvider must be nested within AuthProvider');
});

test('SaaS Prompt 1 - Frontend: api.js request interceptor attaches x-workspace-id when selected', () => {
  const apiPath = path.resolve(__dirname, '../src/services/api.js');
  const code = fs.readFileSync(apiPath, 'utf8');

  assert.ok(code.includes('relay_active_workspace_id'), 'api.js must read relay_active_workspace_id');
  assert.ok(code.includes("config.headers['x-workspace-id'] = workspaceId"), 'api.js must attach x-workspace-id header');
});

test('SaaS Prompt 1 - Frontend: services/workspaces.js exports complete workspace client API', () => {
  const servicePath = path.resolve(__dirname, '../src/services/workspaces.js');
  assert.ok(fs.existsSync(servicePath), 'workspaces.js must exist');
  const code = fs.readFileSync(servicePath, 'utf8');

  assert.ok(code.includes('getCurrentWorkspace'), 'Must export getCurrentWorkspace');
  assert.ok(code.includes('getMyWorkspaces'), 'Must export getMyWorkspaces');
  assert.ok(code.includes('internalProvisionWorkspace'), 'Must export internalProvisionWorkspace');
});

test('SaaS Prompt 1 - Frontend: Single-Operator and M2W Realty branding preserved for legacy compatibility', () => {
  const layoutPath = path.resolve(__dirname, '../src/layout/AppLayout.jsx');
  const code = fs.readFileSync(layoutPath, 'utf8');

  assert.ok(code.includes('Single Operator'), 'Must preserve Single Operator badge fallback');
  assert.ok(code.includes('M2W Realty'), 'Must preserve M2W Realty fallback');
});
