const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function createWorkflowVersion() {
  const prisma = new PrismaClient();

  try {
    console.log('🔄 Создаем новую версию workflow...');

    // Читаем workflow из файла
    const workflowPath = path.join(__dirname, '..', 'Система лояльности (исправленная).json');
    const workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

    // Получаем последнюю версию
    const latestVersion = await prisma.workflowVersion.findFirst({
      where: { workflowId: workflowData.id },
      orderBy: { version: 'desc' }
    });

    const newVersionNumber = (latestVersion?.version || 0) + 1;

    // Деактивируем старую версию
    await prisma.workflowVersion.updateMany({
      where: { workflowId: workflowData.id, isActive: true },
      data: { isActive: false }
    });

    // Создаем новую версию
    const version = await prisma.workflowVersion.create({
      data: {
        workflowId: workflowData.id,
        version: newVersionNumber,
        nodes: workflowData.nodes,
        variables: workflowData.variables,
        settings: workflowData.settings,
        entryNodeId: workflowData.entry_node_id,
        isActive: true
      }
    });

    console.log(`✅ Создана версия ${newVersionNumber}: ${version.id}`);

    // Также обновляем основной workflow
    await prisma.workflow.update({
      where: { id: workflowData.id },
      data: {
        nodes: workflowData.nodes,
        variables: workflowData.variables,
        settings: workflowData.settings,
        updatedAt: new Date()
      }
    });

    console.log('✅ Workflow обновлен');

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createWorkflowVersion();
