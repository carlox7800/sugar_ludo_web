const fs = require('fs');
let code = fs.readFileSync('src/GameEngine.tsx', 'utf-8');
if (!code.includes("'use client'")) {
    code = "'use client';\n" + code;
    fs.writeFileSync('src/GameEngine.tsx', code);
}
