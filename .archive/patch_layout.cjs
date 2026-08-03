const fs = require('fs');
let code = fs.readFileSync('app/layout.tsx', 'utf-8');
code = code.replace("import './globals.css'", "import './globals.css'\nimport '../src/index.css'");
fs.writeFileSync('app/layout.tsx', code);
