import fs from 'fs';
import { Marked } from 'marked';
import he from 'he';
import { baseUrl as baseUrlExt } from 'marked-base-url';
import { createDirectives, presetDirectiveConfigs } from 'marked-directive';
import { load } from 'cheerio';
import path from 'path';
import commandLineArgs from 'command-line-args';
import puppeteer from 'puppeteer';
import fm from 'front-matter';

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

  const marked = new Marked({
    breaks: true,
    gfm: true,
  });

  const markdownHeaderProps: Record<string, string> = {};

  marked.use(
    {
      hooks: {
        preprocess(markdown) {
          const { attributes, body } = fm<Record<string, string>>(markdown);
          
          for (const key in attributes) {
            if (key in attributes) {
              markdownHeaderProps[key] = attributes[key];
            }
          }

          return body;
        },
      }
    },
    baseUrlExt(baseUrl),
    {
      renderer: {
        code: code => {
          if (code.lang === 'mermaid') {
            return `<div class="mermaid">${code.text}</div>`;
          }
  
          return `<pre><code class="language-${code.lang}">${code.text}</code></pre>`;
        }
      }
    },
    createDirectives([
      ...presetDirectiveConfigs,
      {
        level: 'block',
        marker: '::',
        renderer: (token) => {
          if (token.meta.name === 'pagebreak') {
            return '<div class="pagebreak"></div>';
          }
  
          return false;
        }
      }
    ]),
  );

  const mdownFile = fs.readFileSync(input);
  const html = await marked.parse(mdownFile.toString());

  const template = fs.readFileSync(path.resolve(__dirname, 'template.html'));

  const $ = load(template);
  $('title').text(markdownHeaderProps.title || 'Document');
  $('#container').append(html);

  const pageHtml = $.html();
  const decodedHtml = he.decode(pageHtml);

  if (outputFormat === ValidOutputs.HTML) {
    fs.writeFileSync(output, decodedHtml);
  } else if (outputFormat === ValidOutputs.PDF) {
    const tempDir = path.resolve(__dirname, 'temp');

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const temp = path.join(tempDir,  'temp.html');

    fs.writeFileSync(temp, decodedHtml);

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
