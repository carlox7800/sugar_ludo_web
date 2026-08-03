const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/<GameBoard/, `<GameBoard\n              appTheme={appTheme}`);

fs.writeFileSync('src/App.tsx', code);
