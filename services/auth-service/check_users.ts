import { PrismaClient } from '@prisma/client-auth';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      role: true,
      tenant: true
    }
  });

  console.log("USERS AND ROLES:");
  for (const u of users) {
    console.log(`Email: ${u.email} | Name: ${u.name} | Role Name: ${u.role?.name || 'NO_ROLE'} | Tenant: ${u.tenant?.name}`);
  }

  const roles = await prisma.role.findMany();
  console.log("\nALL ROLES:");
  for (const r of roles) {
    console.log(`Role ID: ${r.id} | Role Name: ${r.name}`);
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
