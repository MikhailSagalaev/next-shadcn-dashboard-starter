import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  try {
    const plansCount = await db.subscriptionPlan.count();
    console.log('Plans count:', plansCount);

    if (plansCount > 0) {
      const plans = await db.subscriptionPlan.findMany();
      console.log('Plans:', JSON.stringify(plans, null, 2));
    } else {
      console.log('No plans found in database.');
    }

    const admin = await db.adminAccount.findFirst();
    console.log('Sample admin:', admin?.email);
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await db.$disconnect();
  }
}

main();
