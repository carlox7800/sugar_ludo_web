const fs = require('fs');
let code = fs.readFileSync('src/components/ConsoleLogs.tsx', 'utf8');

code = code.replace(/#2d2d35/g, 'var(--border-color)');
code = code.replace(/#050506/g, 'var(--bg-root)');

fs.writeFileSync('src/components/ConsoleLogs.tsx', code);
