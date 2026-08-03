const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  
  console.log("clicking Entrenamiento con IA...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const aiBtn = buttons.find(b => b.textContent && b.textContent.includes('Entrenamiento con IA'));
    if (aiBtn) aiBtn.click();
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  console.log("clicking Comenzar Juego...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const startBtn = buttons.find(b => b.textContent && b.textContent.includes('Comenzar Juego'));
    if (startBtn) startBtn.click();
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  console.log("Check if GameEngine is mounted...");
  const hasCanvas = await page.evaluate(() => {
    return !!document.querySelector('canvas');
  });
  console.log("Has canvas:", hasCanvas);
  
  await browser.close();
})();
