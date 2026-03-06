const puppeteer = require('puppeteer');
const path = require('path');

async function convert(inputHtml, outputPdf) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const filePath = path.resolve(inputHtml);
  await page.goto(`file://${filePath}`, { waitUntil: 'networkidle0' });

  await page.pdf({
    path: outputPdf,
    format: 'A4',
    margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
    printBackground: true,
    displayHeaderFooter: false,
  });

  await browser.close();
  console.log(`Generated: ${outputPdf}`);
}

async function main() {
  await convert('docs/user-guide.html', 'docs/HR_SYSTEM_설치_및_사용설명서.pdf');
  await convert('docs/architecture.html', 'docs/HR_SYSTEM_시스템_아키텍처.pdf');
}

main().catch(console.error);
