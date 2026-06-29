interface TableWidthState {
  widthsByTable: number[][];
}

const TABLE_SEPARATOR_CELL = /^:?-{3,}:?$/;
const CODE_FENCE = /^(\s{0,3})(`{3,}|~{3,})/;

function splitTableRow(row: string): string[] {
  let normalized = row.trim();

  if (normalized.startsWith('|')) {
    normalized = normalized.slice(1);
  }

  if (normalized.endsWith('|')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized.split('|').map((cell) => cell.trim());
}

function toDashCount(cell: string): number {
  const dashMatches = cell.match(/-/g);
  return dashMatches ? Math.max(dashMatches.length, 1) : 1;
}

function readTableWidths(markdown: string): number[][] {
  const lines = markdown.split(/\r?\n/);
  const widthsByTable: number[][] = [];

  let inCodeFence = false;
  let fenceToken = '';

  for (let i = 0; i < lines.length - 1; i += 1) {
    const line = lines[i].trim();
    const next = lines[i + 1].trim();

    const fenceMatch = lines[i].match(CODE_FENCE);

    if (fenceMatch?.[2]) {
      const detectedFence = fenceMatch[2];

      if (!inCodeFence) {
        inCodeFence = true;
        fenceToken = detectedFence[0];
        continue;
      }

      if (detectedFence[0] === fenceToken) {
        inCodeFence = false;
        fenceToken = '';
      }

      continue;
    }

    if (inCodeFence || !line.includes('|') || !next.includes('-')) {
      continue;
    }

    const headerCells = splitTableRow(line);
    const separatorCells = splitTableRow(next);

    if (
      separatorCells.length === 0
      || separatorCells.length !== headerCells.length
      || !separatorCells.every((cell) => TABLE_SEPARATOR_CELL.test(cell))
    ) {
      continue;
    }

    widthsByTable.push(separatorCells.map(toDashCount));
  }

  return widthsByTable;
}

function buildColGroup(widths: number[]): string {
  const total = widths.reduce((sum, width) => sum + width, 0);

  if (!total) {
    return '';
  }

  const cols = widths
    .map((width) => `<col style="width:${((width / total) * 100).toFixed(4)}%">`)
    .join('');

  return `<colgroup>${cols}</colgroup>`;
}

export function createTableWidthPlugin() {
  const state: TableWidthState = {
    widthsByTable: [],
  };

  return {
    hooks: {
      preprocess(markdown: string) {
        state.widthsByTable = readTableWidths(markdown);
        return markdown;
      },
      postprocess(html: string) {
        let tableIndex = 0;

        return html.replace(/<table>([\s\S]*?)<\/table>/g, (tableHtml) => {
          const widths = state.widthsByTable[tableIndex];
          tableIndex += 1;

          if (!widths || widths.length === 0) {
            return tableHtml;
          }

          const colGroup = buildColGroup(widths);

          if (!colGroup) {
            return tableHtml;
          }

          return tableHtml.replace('<table>', `<table>${colGroup}`);
        });
      },
    },
  };
}
