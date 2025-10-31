const fs = require('fs');
const path = require('path');
const http = require('http');

async function updateWorkflowAPI() {
  try {
    // Читаем workflow из файла
    const workflowPath = path.join(__dirname, '..', 'Система лояльности (исправленная).json');
    const workflowData = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));

    console.log('📡 Отправляем workflow на API...');

    const postData = JSON.stringify({
      name: workflowData.name,
      description: workflowData.description,
      nodes: workflowData.nodes,
      connections: workflowData.connections,
      variables: workflowData.variables,
      settings: workflowData.settings,
      isActive: workflowData.isActive
    });

    const options = {
      hostname: 'localhost',
      port: 5006,
      path: `/api/projects/${workflowData.projectId}/workflows/${workflowData.id}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Workflow успешно обновлен через API');
          console.log('📊 Ответ:', data);
        } else {
          console.error('❌ Ошибка API:', res.statusCode, data);
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ Ошибка запроса:', e.message);
    });

    req.write(postData);
    req.end();

  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

updateWorkflowAPI();
