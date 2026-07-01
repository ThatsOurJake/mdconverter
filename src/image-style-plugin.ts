interface ImageOptions {
  width?: string;
  align?: 'left' | 'center' | 'right';
}

const ALIGN_VALUES = new Set(['left', 'center', 'right']);

function parseImageOptions(alt: string): { options: ImageOptions; cleanAlt: string } {
  const parts = alt.split('|');
  const options: ImageOptions = {};
  const remainingParts: string[] = [];

  for (const part of parts) {
    const trimmed = part.trim();

    if (/^w:\S+$/.test(trimmed)) {
      options.width = trimmed.slice(2);
    } else if (ALIGN_VALUES.has(trimmed)) {
      options.align = trimmed as 'left' | 'center' | 'right';
    } else {
      remainingParts.push(part);
    }
  }

  return { options, cleanAlt: remainingParts.join('|') };
}

export function createImageStylePlugin() {
  return {
    renderer: {
      image({ href, title, text }: { href: string; title: string | null; text: string }) {
        const { options, cleanAlt } = parseImageOptions(text);

        if (!options.width && !options.align) {
          return false;
        }

        const styles: string[] = [];

        if (options.width) {
          styles.push(`width:${options.width}`);
        }

        if (options.align === 'center') {
          styles.push('display:block', 'margin-left:auto', 'margin-right:auto');
        } else if (options.align === 'left') {
          styles.push('float:left');
        } else if (options.align === 'right') {
          styles.push('float:right');
        }

        const styleAttr = styles.length > 0 ? ` style="${styles.join(';')}"` : '';
        const titleAttr = title ? ` title="${title}"` : '';
        const altAttr = cleanAlt ? ` alt="${cleanAlt}"` : '';

        return `<img src="${href}"${altAttr}${titleAttr}${styleAttr}>`;
      },
    },
  };
}
