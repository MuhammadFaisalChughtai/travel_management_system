const { PrismaClient } = require('@prisma/client-auth');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function seed() {
  try {
    const email = 'admin@techbarred.com';
    const password = 'password1234';
    
    const salt = await bcrypt.genSalt(10);
    const encryptedPassword = await bcrypt.hash(password, salt);
    
    const existingAdmin = await prisma.platformAdmin.findUnique({
      where: { email }
    });

    if (existingAdmin) {
      console.log('Admin already exists, updating password...');
      await prisma.platformAdmin.update({
        where: { email },
        data: {
          encryptedPassword,
          name: 'Super Admin'
        }
      });
      console.log('Successfully updated super admin:', email);
    } else {
      console.log('Creating new super admin...');
      await prisma.platformAdmin.create({
        data: {
          email,
          encryptedPassword,
          name: 'Super Admin'
        }
      });
      console.log('Successfully seeded super admin:', email);
    }
  } catch (error) {
    console.error('Error seeding admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
