const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('pageerror', err => {
    console.error('PAGE ERROR:', err.toString());
  });
  page.on('console', msg => {
    if (msg.type() === 'error') console.error('CONSOLE ERROR:', msg.text());
  });

  await page.goto('http://localhost:5173/');
  
  // click through onboarding
  await page.waitForSelector('.grid button');
  const buttons = await page.$$('.grid button');
  if (buttons.length > 0) await buttons[0].click();
  
  await new Promise(r => setTimeout(r, 1000));
  const inputs = await page.$$('input');
  if (inputs.length > 0) {
    await inputs[0].type('9001112233');
    await page.click('button.bg-blue-600');
  }
  
  await new Promise(r => setTimeout(r, 1000));
  await page.click('button.bg-blue-600'); // continue inside sms
  
  // ROLE: Employer -> to test Employer Dashboard '✓'
  await new Promise(r => setTimeout(r, 1000));
  const roleBtns = await page.$$('button.glass');
  if (roleBtns.length > 1) {
      await roleBtns[1].click(); // Employer
  } else {
      console.log("No role btns");
  }
  
  await new Promise(r => setTimeout(r, 1000));
  // Onboarding -> done
  await page.waitForSelector('button.bg-slate-800');
  await page.click('button.bg-slate-800');

  await new Promise(r => setTimeout(r, 1000));
  // Employer Dashboard - find ✓ button
  const checkBtns = await page.$$eval('button', els => els.filter(el => el.textContent === '✓').map(el => el.className));
  console.log("Check buttons: ", checkBtns.length);
  const checkBtnHandles = await page.$$('button');
  for (const handle of checkBtnHandles) {
      const text = await page.evaluate(el => el.textContent, handle);
      if (text === '✓') {
          console.log("Clicking ✓ button");
          await handle.click();
          break;
      }
  }
  
  await new Promise(r => setTimeout(r, 2000));
  process.exit(0);
})();
