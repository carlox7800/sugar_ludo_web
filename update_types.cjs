const fs = require('fs');
let code = fs.readFileSync('src/types.ts', 'utf8');

code += `\nexport type AppTheme = 'dark' | 'sugar';\n`;
fs.writeFileSync('src/types.ts', code);
