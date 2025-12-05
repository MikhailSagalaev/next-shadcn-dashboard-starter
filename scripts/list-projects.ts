import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.project.findMany({ select: { id: true, name: true } }).then((r) => {
  console.log(r);
  prisma.$disconnect();
});
