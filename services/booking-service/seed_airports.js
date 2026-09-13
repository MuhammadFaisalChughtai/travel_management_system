const { PrismaClient } = require('./node_modules/@prisma/client-booking');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('Seeding airport table...');
    const filePath = path.join(__dirname, '../../airport.text');
    if (!fs.existsSync(filePath)) {
      throw new Error(`airport.text not found at ${filePath}`);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const airportData = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const firstSpaceIndex = line.indexOf(' ');
      if (firstSpaceIndex === -1) continue;

      const iata = line.substring(0, firstSpaceIndex).trim().toUpperCase();
      const nameRaw = line.substring(firstSpaceIndex + 1).trim();

      // Format/capitalize names nicely
      const name = nameRaw
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      if (iata.length === 3) {
        airportData.push({ iata, name });
      }
    }

    console.log(`Parsed ${airportData.length} airports. Clearing existing and inserting...`);

    await prisma.airport.deleteMany({});
    
    // Chunk size for bulk insert to avoid parameter limits in PostgreSQL
    const chunkSize = 200;
    for (let i = 0; i < airportData.length; i += chunkSize) {
      const chunk = airportData.slice(i, i + chunkSize);
      await prisma.airport.createMany({
        data: chunk,
        skipDuplicates: true,
      });
    }

    console.log('Airport table seeded successfully!');
  } catch (error) {
    console.error('Error seeding airports:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();
