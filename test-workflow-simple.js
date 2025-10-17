/**
 * Простой тест workflow execution
 */

const { WorkflowRuntimeService } = require('./src/lib/services/workflow-runtime.service');

async function testWorkflowExecution() {
  console.log('Testing workflow execution...');

  const mockContext = {
    from: { id: 123456789, username: 'testuser' },
    chat: { id: 123456789 },
    message: { text: '/start' }
  };

  try {
    const result = await WorkflowRuntimeService.executeWorkflow('cmgntgsdv0000v8mwfwwh30az', 'start', mockContext);
    console.log('Workflow execution result:', result);
  } catch (error) {
    console.error('Error:', error);
  }
}

testWorkflowExecution();
