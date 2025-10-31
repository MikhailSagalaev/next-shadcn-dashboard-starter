const fs = require('fs');
const path = require('path');

async function updateWorkflow() {
  try {
    const workflowPath = path.join(__dirname, '..', 'Система лояльности (исправленная).json');
    const workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

    console.log('📝 Обновляем workflow:', workflowData.id);
    console.log('🏗️ Проект:', workflowData.projectId);

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    let workflow = await prisma.workflow.findUnique({
      where: { id: workflowData.id }
    });

    if (!workflow) {
      console.log('📝 Создаем новый workflow...');
      workflow = await prisma.workflow.create({
        data: {
          id: workflowData.id,
          projectId: workflowData.projectId,
          name: workflowData.name,
          description: workflowData.description,
          nodes: workflowData.nodes,
          variables: workflowData.variables,
          settings: workflowData.settings,
          isActive: workflowData.isActive
        }
      });
      console.log('✅ Workflow создан');
    } else {
      console.log('📝 Обновляем существующий workflow...');
      workflow = await prisma.workflow.update({
        where: { id: workflowData.id },
        data: {
          name: workflowData.name,
          description: workflowData.description,
          nodes: workflowData.nodes,
          variables: workflowData.variables,
          settings: workflowData.settings,
          isActive: workflowData.isActive,
          updatedAt: new Date()
        }
      });
      console.log('✅ Workflow обновлен');
    }

    const latestVersion = await prisma.workflowVersion.findFirst({
      where: { workflowId: workflowData.id },
      orderBy: { version: 'desc' }
    });

    const newVersionNumber = (latestVersion?.version || 0) + 1;

    await prisma.workflowVersion.updateMany({
      where: { workflowId: workflowData.id, isActive: true },
      data: { isActive: false }
    });

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

    console.log(`✅ Создана версия ${newVersionNumber}:`, version.id);

    await prisma.$disconnect();
    console.log('🎉 Workflow успешно обновлен!');

  } catch (error) {
    console.error('❌ Ошибка обновления workflow:', error);
    process.exit(1);
  }
}

updateWorkflow();