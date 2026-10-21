import { load } from "cheerio";
import commandLineArgs from "command-line-args";
import fs from "fs";
import he from "he";
import { Marked } from "marked";
import { baseUrl as baseUrlExt } from "marked-base-url";
import { createDirectives, presetDirectiveConfigs } from "marked-directive";
import path from "path";
import puppeteer from "puppeteer";
import { parse as parseYaml } from "yaml";
import { createImageStylePlugin } from "./image-style-plugin";
import { createTableWidthPlugin } from "./table-width-plugin";

interface Options {
  input: string;
  output: string;
}

enum ValidOutputs {
  HTML,
  PDF,
}

function parseFrontMatter(markdown: string): {
  attributes: Record<string, string>;
  body: string;
} {
  const frontMatterMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

  if (!frontMatterMatch) {
    return {
      attributes: {},
      body: markdown,
    };
  }

  const yamlText = frontMatterMatch[1];
  const body = markdown.slice(frontMatterMatch[0].length);

  try {
    const parsed = parseYaml(yamlText);
    const attributes: Record<string, string> = {};

    if (parsed && typeof parsed === "object") {
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        attributes[key] = String(value);
      }
    }

    return {
      attributes,
      body,
    };
  } catch {
    return {
      attributes: {},
      body: markdown,
    };
  }
}

const options = commandLineArgs([
  {
    name: "input",
    alias: "i",
    type: String,
  },
  {
    name: "output",
    alias: "o",
    type: String,
  },
]) as Options;

(async () => {
  const { input, output } = options;

  if (!fs.existsSync(input)) {
    console.error("Input does not exist");
    return;
  }

  const ext = path.extname(output);
  let outputFormat: ValidOutputs = ValidOutputs.HTML;

  if (ext) {
    switch (ext.toLocaleLowerCase()) {
      case ".pdf":
        outputFormat = ValidOutputs.PDF;
        break;
      default:
        break;
    }
  }

  let baseUrl = input;

  if (path.dirname(input) === ".") {
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
          const { attributes, body } = parseFrontMatter(markdown);

          for (const key in attributes) {
            if (key in attributes) {
              markdownHeaderProps[key] = attributes[key];
            }
          }

          return body;
        },
      },
    },
    createTableWidthPlugin(),
    createImageStylePlugin(),
    baseUrlExt(baseUrl),
    {
      renderer: {
        code: (code) => {
          const language = (code.lang || "").trim().toLowerCase();
          const escapedCode = he.encode(code.text);

          if (language === "mermaid") {
            return `<div class="mermaid">${escapedCode}</div>`;
          }

          const safeLanguageClass = language.replace(/[^\w-]/g, "");
          const className = safeLanguageClass
            ? ` class="language-${safeLanguageClass}"`
            : "";

          return `<pre><code${className}>${escapedCode}</code></pre>`;
        },
      },
    },
    createDirectives([
      ...presetDirectiveConfigs,
      {
        level: "block",
        marker: "::",
        renderer: (token) => {
          if (token.meta.name === "pagebreak") {
            return '<div class="pagebreak"></div>';
          }

          return false;
        },
      },
    ]),
  );

  const mdownFile = fs.readFileSync(input);
  const html = await marked.parse(mdownFile.toString());

  const template = fs.readFileSync(path.resolve(__dirname, "template.html"));

  const $ = load(template);
  $("title").text(markdownHeaderProps.title || "Document");
  $("#container").append(html);

  const pageHtml = $.html();

  if (outputFormat === ValidOutputs.HTML) {
    fs.writeFileSync(output, pageHtml);
  } else if (outputFormat === ValidOutputs.PDF) {
    const tempDir = path.resolve(__dirname, "temp");

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    const temp = path.join(tempDir, "temp.html");

    fs.writeFileSync(temp, pageHtml);

    const browser = await puppeteer.launch({
      headless: true,
    });

    const page = await browser.newPage();
    await page.goto(`file://${temp}`, {
      waitUntil: "networkidle2",
    });
    await page.pdf({
      path: output,
      format: "a4",
      printBackground: true,
      margin: {
        top: 24,
        bottom: 24,
      },
    });
    await browser.close();

    fs.rmSync(temp);
  }

  console.log("Done!");
})();
