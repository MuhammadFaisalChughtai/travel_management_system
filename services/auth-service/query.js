const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.agent.findMany().then(agents => {
  console.log('Agents:', agents);
  return p.agentWallet.findMany();
}).then(wallets => {
  console.log('Wallets:', wallets);
}).finally(() => p.$disconnect());
