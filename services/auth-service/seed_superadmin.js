const { PrismaClient } = require('@prisma/client-auth');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seed() {
  const email = process.env.SUPERADMIN_EMAIL || process.argv[2] || 'admin@techbarred.com';
  const password = process.env.SUPERADMIN_PASSWORD || process.argv[3] || 'password1234';
  const name = process.env.SUPERADMIN_NAME || process.argv[4] || 'Super Admin';

  try {
    console.log('Seeding superadmin credentials...');
    console.log(`- Email: ${email}`);
    console.log(`- Name: ${name}`);

    const salt = await bcrypt.genSalt(10);
    const encryptedPassword = await bcrypt.hash(password, salt);

    const existingAdmin = await prisma.platformAdmin.findUnique({
      where: { email }
    });

    if (existingAdmin) {
      console.log('Superadmin with this email already exists. Updating password and name...');
      await prisma.platformAdmin.update({
        where: { email },
        data: {
          encryptedPassword,
          name
        }
      });
      console.log('Successfully updated superadmin!');
    } else {
      console.log('Creating new superadmin...');
      await prisma.platformAdmin.create({
        data: {
          email,
          encryptedPassword,
          name
        }
      });
      console.log('Successfully created superadmin!');
    }
  } catch (error) {
    console.error('Error seeding superadmin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
