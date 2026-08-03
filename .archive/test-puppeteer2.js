const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const aiBtn = buttons.find(b => b.textContent && b.textContent.includes('Entrenamiento con IA'));
    if (aiBtn) { 
        console.log("Found AiBtn"); 
        aiBtn.click(); 
    } else {
        console.log("Not found AiBtn");
    }
  });
  
  await new Promise(r => setTimeout(r, 1000));
  
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const startBtn = buttons.find(b => b.textContent && b.textContent.includes('Comenzar Juego'));
    if (startBtn) { 
        console.log("Found StartBtn"); 
        startBtn.click(); 
    } else {
        console.log("Not found StartBtn");
    }
  });
  
  await new Promise(r => setTimeout(r, 1000));
  await browser.close();
})();
