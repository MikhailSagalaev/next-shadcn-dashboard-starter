import 'dotenv/config';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { processFiscalOutboxBatch } from '@/lib/services/fiscal-outbox.service';

let stopping = false;

async function run() {
  logger.info('Fiscal worker started', { component: 'fiscal-worker' });
  while (!stopping) {
    try {
      const processed = await processFiscalOutboxBatch();
      await new Promise((resolve) =>
        setTimeout(resolve, processed ? 250 : 3000)
      );
    } catch (error) {
      logger.error('Fiscal worker batch failed', {
        component: 'fiscal-worker',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  await db.$disconnect();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    stopping = true;
  });
}

void run();
