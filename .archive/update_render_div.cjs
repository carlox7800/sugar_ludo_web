const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /<div className="min-h-screen bg-root text-t-primary flex flex-col relative pb-8 font-sans">/,
  '<div className={`min-h-screen bg-root text-t-primary flex flex-col relative pb-8 font-sans ${appTheme === \'sugar\' ? \'theme-sugar\' : \'\'}`}>'
);

fs.writeFileSync('src/App.tsx', code);
