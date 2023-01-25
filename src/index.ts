import fs from 'fs';
import { marked } from 'marked';
import { load } from 'cheerio';
import path from 'path';
import commandLineArgs from 'command-line-args';
import puppeteer from 'puppeteer';

interface Options {
  input: string;
  output: string;
}

enum ValidOutputs {
  HTML,
  PDF
}

const options = commandLineArgs([
  {
    name: 'input',
    alias: 'i',
    type: String
  },
  {
    name: 'output',
    alias: 'o',
    type: String
  }
]) as Options;

(async () => {
  const { input, output } = options;
  
  if (!fs.existsSync(input)) {
    console.error('Input does not exist');
    return;
  }

  const ext = path.extname(output);
  let outputFormat: ValidOutputs = ValidOutputs.HTML;

  if (ext) {
    switch(ext.toLocaleLowerCase()) {
      case '.pdf':
        outputFormat = ValidOutputs.PDF
        break;
      default:
        break;
    }
  }

  let baseUrl = input;

  if (path.dirname(input) == '.') {
    baseUrl = path.join(process.cwd(), input);
  }

  const mdownFile = fs.readFileSync(input);
  const html = marked(mdownFile.toString(), {
    breaks: true,
    gfm: true,
    baseUrl,
  });
  const template = fs.readFileSync(path.resolve(__dirname, 'template.html'));

  const $ = load(template);
  $('#container').append(html);

  if (outputFormat === ValidOutputs.HTML) {
    fs.writeFileSync(output, $.html());
  } else if (outputFormat === ValidOutputs.PDF) {
    const tempDir = path.resolve(__dirname, 'temp');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const temp = path.join(tempDir,  'temp.html');

    fs.writeFileSync(temp, $.html());

    const browser = await puppeteer.launch({
      headless: true
    });

    const page = await browser.newPage();
    await page.goto(`file://${temp}`, {
      waitUntil: 'networkidle2'
    });
    await page.pdf({
      path: output,
      format: 'a4',
      printBackground: true,
      margin: {
        top: 24,
        bottom: 24
      }
    });
    await browser.close();

    fs.rmSync(temp);
  }

  console.log('Done!');
})();
