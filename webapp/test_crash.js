const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  // log all console messages and page errors
  page.on('pageerror', err => {
    console.error('[PAGE ERROR]', err.toString());
  });
  page.on('console', msg => {
    if(msg.type() === 'error') console.error('[CONSOLE ERROR]', msg.text());
  });

  // Since Run_PWA.command might be running on 1576 or 5173, let's try 5173 (vite default)
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  
  const html = await page.content();
  if(!html.includes('id="root"')) {
     console.error('Wrong port or not running.');
     // Try 1576
     await page.goto('http://localhost:1576/', { waitUntil: 'domcontentloaded' });
  }

  console.log("Page loaded. Clicking language...");
  await page.waitForSelector('.grid button');
  const btns = await page.$$('.grid button');
  if (btns.length > 0) await btns[0].click();
  
  await new Promise(r => setTimeout(r, 500));
  const inputs = await page.$$('input');
  if (inputs.length > 0) {
    await inputs[0].type('1231231234');
    await page.click('button.bg-blue-600');
  }
  
  await new Promise(r => setTimeout(r, 500));
  await page.click('button.bg-blue-600'); // proceed SMS
  
  console.log("Selecting Worker role...");
  await new Promise(r => setTimeout(r, 500));
  const roleBtns = await page.$$('button.glass');
  if (roleBtns.length > 0) {
      await roleBtns[0].click(); // Worker
  }
  
  await new Promise(r => setTimeout(r, 500));
  await page.waitForSelector('button.bg-slate-800');
  await page.click('button.bg-slate-800'); // Form Done

  console.log("Worker Feed. Let's click the Like checkmark.");
  await new Promise(r => setTimeout(r, 1000));
  const checkBtns = await page.$$eval('button', els => els.filter(el => el.textContent === '✓').map(el => el.className));
  const checkBtnHandles = await page.$$('button');
  for (const handle of checkBtnHandles) {
      const text = await page.evaluate(el => el.textContent, handle);
      if (text === '✓') {
          console.log("Clicking match!");
          await handle.click();
          break;
      }
  }

  // Wait to see if crash occurs
  await new Promise(r => setTimeout(r, 3000));
  console.log("Done");
  process.exit(0);
})();
