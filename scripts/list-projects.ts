import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    select: { id: true, name: true }
  });
  console.log('Проекты:');
  projects.forEach((p) => console.log(`  ${p.id} - ${p.name}`));
  await prisma.$disconnect();
}

main();
