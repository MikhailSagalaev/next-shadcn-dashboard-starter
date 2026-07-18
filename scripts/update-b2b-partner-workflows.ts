/**
 * @file: update-b2b-partner-workflows.ts
 * @description: Идемпотентно обновляет B2B workflow проекта из актуального JSON-шаблона
 * @project: SaaS Bonus System
 * @dependencies: @prisma/client, Node.js fs/path
 * @created: 2026-07-18
 * @author: AI Assistant + User
 */

/* eslint-disable no-console */

import { Prisma, PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}

interface WorkflowTemplate {
  name: string;
  description: string;
  nodes: Prisma.InputJsonArray;
  connections: Prisma.InputJsonArray;
  variables: Prisma.InputJsonArray;
  settings: Prisma.InputJsonObject;
}

interface ScriptOptions {
  projectId: string;
  dryRun: boolean;
}

const prisma = new PrismaClient();
const TEMPLATE_PATH = path.join(
  process.cwd(),
  'src/lib/workflow-templates/b2b-partner-cabinet.json'
);

function parseOptions(argv: string[]): ScriptOptions {
  let projectId = '';
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run') {
      dryRun = true;
      continue;
    }
    if (argument.startsWith('--projectId=')) {
      projectId = argument.slice('--projectId='.length).trim();
      continue;
    }
    if (argument === '--projectId') {
      projectId = (argv[index + 1] ?? '').trim();
      index += 1;
      continue;
    }
    throw new Error(`Неизвестный аргумент: ${argument}`);
  }

  if (!projectId) {
    throw new Error(
      'Обязательный параметр: --projectId=<id> (дополнительно: --dry-run)'
    );
  }

  return { projectId, dryRun };
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true;
  }
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value !== 'object') return false;
  return Object.values(value).every(isJsonValue);
}

function isJsonObject(value: unknown): value is JsonObject {
  return !!value && !Array.isArray(value) && isJsonValue(value);
}

function isJsonObjectArray(value: unknown): value is JsonObject[] {
  return Array.isArray(value) && value.every(isJsonObject);
}
async function loadTemplate(): Promise<WorkflowTemplate> {
  const content = await readFile(TEMPLATE_PATH, 'utf8');
  const parsed: unknown = JSON.parse(content);

  if (!isJsonObject(parsed)) {
    throw new Error('B2B workflow template должен быть JSON-объектом');
  }
  if (typeof parsed.name !== 'string' || !parsed.name.trim()) {
    throw new Error('B2B workflow template не содержит name');
  }
  if (typeof parsed.description !== 'string') {
    throw new Error('B2B workflow template не содержит description');
  }
  if (!isJsonObjectArray(parsed.nodes)) {
    throw new Error('B2B workflow template содержит некорректные nodes');
  }
  if (!parsed.nodes.some((node) => node.id === 'start-trigger')) {
    throw new Error(
      'B2B workflow template не содержит entry node start-trigger'
    );
  }
  if (
    !isJsonObjectArray(parsed.connections) ||
    !isJsonObjectArray(parsed.variables) ||
    !isJsonObject(parsed.settings)
  ) {
    throw new Error(
      'B2B workflow template содержит некорректные connections/variables/settings'
    );
  }

  return {
    name: parsed.name,
    description: parsed.description,
    nodes: parsed.nodes as Prisma.InputJsonArray,
    connections: parsed.connections as Prisma.InputJsonArray,
    variables: parsed.variables as Prisma.InputJsonArray,
    settings: parsed.settings as Prisma.InputJsonObject
  };
}

function normalizeJson(value: unknown): JsonValue {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, normalizeJson(child)])
    );
  }
  throw new Error(`Неподдерживаемое JSON-значение: ${String(value)}`);
}

function jsonEquals(left: unknown, right: unknown): boolean {
  return (
    JSON.stringify(normalizeJson(left)) === JSON.stringify(normalizeJson(right))
  );
}
function collectNodeTypes(nodes: unknown): Set<string> {
  const nodeValues = Array.isArray(nodes)
    ? nodes
    : isJsonObject(nodes)
      ? Object.values(nodes)
      : [];
  const types = new Set<string>();

  for (const node of nodeValues) {
    if (isJsonObject(node) && typeof node.type === 'string') {
      types.add(node.type);
    }
  }
  return types;
}

function isB2BWorkflow(
  workflowName: string,
  nodes: unknown,
  templateName: string
): boolean {
  if (
    workflowName.trim().toLocaleLowerCase('ru-RU') ===
    templateName.toLocaleLowerCase('ru-RU')
  ) {
    return true;
  }

  const nodeTypes = collectNodeTypes(nodes);
  return (
    nodeTypes.has('action.partner_link') && nodeTypes.has('action.partner_team')
  );
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const template = await loadTemplate();
  const project = await prisma.project.findUnique({
    where: { id: options.projectId },
    select: { id: true, name: true }
  });

  if (!project) {
    throw new Error(`Проект ${options.projectId} не найден`);
  }

  const projectWorkflows = await prisma.workflow.findMany({
    where: { projectId: options.projectId },
    include: {
      versions: { select: { id: true, version: true, isActive: true } }
    },
    orderBy: { createdAt: 'asc' }
  });
  const workflows = projectWorkflows.filter((workflow) =>
    isB2BWorkflow(workflow.name, workflow.nodes, template.name)
  );

  console.log(
    `${options.dryRun ? '🔎 DRY-RUN' : '🔄 ОБНОВЛЕНИЕ'}: ${project.name} (${project.id})`
  );
  console.log(`Найдено B2B workflow: ${workflows.length}`);

  let updatedCount = 0;
  let versionCount = 0;

  for (const workflow of workflows) {
    const changedFields = [
      ['nodes', workflow.nodes, template.nodes],
      ['connections', workflow.connections, template.connections],
      ['variables', workflow.variables, template.variables],
      ['settings', workflow.settings, template.settings]
    ]
      .filter(([, current, expected]) => !jsonEquals(current, expected))
      .map(([field]) => String(field));
    const descriptionChanged = workflow.description !== template.description;

    if (changedFields.length === 0 && !descriptionChanged) {
      console.log(`✅ ${workflow.name} (${workflow.id}): без изменений`);
      continue;
    }

    const wasActive =
      workflow.isActive ||
      workflow.versions.some((version) => version.isActive);
    const maxVersion = workflow.versions.reduce(
      (maximum, version) => Math.max(maximum, version.version),
      0
    );

    console.log(
      `📝 ${workflow.name} (${workflow.id}): ${[
        ...changedFields,
        ...(descriptionChanged ? ['description'] : [])
      ].join(', ')}`
    );

    if (options.dryRun) {
      if (changedFields.length > 0) {
        console.log(
          `   Создана была бы версия ${maxVersion + 1}, active=${wasActive}`
        );
      }
      continue;
    }
    await prisma.$transaction(async (transaction) => {
      await transaction.workflow.update({
        where: { id: workflow.id },
        data: {
          description: template.description,
          nodes: template.nodes,
          connections: template.connections,
          variables: template.variables,
          settings: template.settings
        }
      });

      if (changedFields.length === 0) return;

      const latestVersion = await transaction.workflowVersion.aggregate({
        where: { workflowId: workflow.id },
        _max: { version: true }
      });
      const nextVersion = (latestVersion._max.version ?? 0) + 1;

      await transaction.workflowVersion.updateMany({
        where: { workflowId: workflow.id },
        data: { isActive: false }
      });
      await transaction.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          version: nextVersion,
          nodes: template.nodes,
          entryNodeId: 'start-trigger',
          variables: template.variables,
          settings: template.settings,
          isActive: wasActive
        }
      });
    });

    updatedCount += 1;
    if (changedFields.length > 0) versionCount += 1;
    console.log('   ✅ Workflow обновлён');
  }

  console.log(
    options.dryRun
      ? '🔎 Dry-run завершён: изменения в БД не вносились.'
      : `✅ Готово: workflow обновлено ${updatedCount}, новых версий ${versionCount}.`
  );
}

main()
  .catch((error: unknown) => {
    console.error('❌ Ошибка обновления B2B workflow:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
