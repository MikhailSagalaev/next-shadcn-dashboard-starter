const { PrismaClient } = require('@prisma/client');

async function checkWorkflowContent() {
  const prisma = new PrismaClient();

  try {
    console.log('🔍 Проверяем содержимое активной версии workflow...');

    const version = await prisma.workflowVersion.findFirst({
      where: {
        workflowId: 'cmhdpf1ai0001v824cvwo816y',
        isActive: true
      }
    });

    if (!version) {
      console.log('❌ Активная версия не найдена');
      return;
    }

    console.log(`Версия: ${version.version}, ID: ${version.id}`);
    console.log(`Количество нод: ${version.nodes.length}`);

    // Парсим nodes и ищем action.menu_command
    const nodes = JSON.parse(JSON.stringify(version.nodes));
    const menuCommandNodes = nodes.filter(function(node) { return node.type === 'action.menu_command'; });

    console.log(`Найдено action.menu_command нод: ${menuCommandNodes.length}`);
    menuCommandNodes.forEach(function(node, index) {
      console.log(`  ${index + 1}. ID: ${node.id}, Label: ${node.data ? node.data.label : 'No label'}`);
      console.log(`     Command: ${node.data && node.data.config && node.data.config['action.menu_command'] ? node.data.config['action.menu_command'].command : 'No command'}`);
    });

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkWorkflowContent();
