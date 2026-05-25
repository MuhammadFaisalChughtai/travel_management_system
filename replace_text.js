const fs = require('fs');
const glob = require('glob');

const files = glob.sync('apps/web-client/src/components/booking-modals/*.tsx');

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('It will automatically log a transaction.')) {
    const updated = content.replace(
      'Check this if you have already transferred the money for this service to the vendor. It will automatically log a transaction.',
      'Check this to manually mark as paid if you have already transferred the money to the vendor. (To log a formal transaction, use the Log Transaction button).'
    );
    fs.writeFileSync(file, updated);
    console.log(`Updated ${file}`);
  }
});
