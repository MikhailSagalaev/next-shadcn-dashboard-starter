const fs = require('fs');

const path =
  'c:/projects/next-shadcn-dashboard-starter/src/lib/insales/insales-service.ts';
let content = fs.readFileSync(path, 'utf8');

// Fix isActive -> isUsed
content = content.replace(/isActive: true/g, 'isUsed: false');
content = content.replace(/isActive: false/g, 'isUsed: true');

// Fix toNumber
content = content.replace(
  /user\.totalPurchases\.toNumber\(\)/g,
  'Number(user.totalPurchases)'
);
content = content.replace(
  /level\.minAmount\.toNumber\(\)/g,
  'Number(level.minAmount)'
);
content = content.replace(
  /level\.maxAmount\?\.toNumber\(\)/g,
  'level.maxAmount ? Number(level.maxAmount) : undefined'
);
content = content.replace(
  /project\.referralProgram\.welcomeBonus\.toNumber\(\)/g,
  'Number(project.referralProgram.welcomeBonus)'
);
content = content.replace(
  /project\.welcomeBonus\.toNumber\(\)/g,
  'Number(project.welcomeBonus)'
);
content = content.replace(
  /bonus\.amount\.toNumber\(\)/g,
  'Number(bonus.amount)'
);
content = content.replace(
  /spendTx\.amount\.toNumber\(\)/g,
  'Number(spendTx.amount)'
);
content = content.replace(
  /earnTx\.amount\.toNumber\(\)/g,
  'Number(earnTx.amount)'
);

fs.writeFileSync(path, content);
console.log('Fixed insales-service.ts');
