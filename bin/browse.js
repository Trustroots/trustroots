const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();

  const page = await browser.newPage();
  await page.goto('http://localhost:3000/volunteering');
  await page.click('#tr-header button#dropdown-basic-en');
  await page.click('.language-switch .dropdown-menu li:nth-child(3) a');

  console.log(await page.content());

  await browser.close();
})();
