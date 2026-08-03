const fs = require('fs');
let code = fs.readFileSync('components/ai-training.tsx', 'utf-8');

code = code.replace(
  "  const handleStart = () => {\n    onStartGame({",
  "  const handleStart = () => {\n    console.log('Botón presionado');\n    onStartGame({"
);

if (!code.includes("console.log('Botón presionado')")) {
  console.log("Failed to patch console.log!");
  process.exit(1);
}

fs.writeFileSync('components/ai-training.tsx', code);
