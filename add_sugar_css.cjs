const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

code = code.replace(/\.theme-sugar \{/, `.theme-sugar {
    --radius-base: 1.5rem; /* Rounder corners */`);

fs.writeFileSync('src/index.css', code);
