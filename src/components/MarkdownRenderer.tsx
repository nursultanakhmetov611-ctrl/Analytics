import React from 'react';

interface MarkdownRendererProps {
  content: string;
  onWagonClick?: (wagonNumber: string) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, onWagonClick }) => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Check for Markdown Table
    if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().startsWith('|') && lines[i + 1].includes('-')) {
      const headerCells = line
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim());

      const alignLine = lines[i + 1]
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim());

      const alignments = alignLine.map((a) => {
        if (a.startsWith(':') && a.endsWith(':')) return 'text-center';
        if (a.endsWith(':')) return 'text-right';
        return 'text-left';
      });

      i += 2;
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const rowCells = lines[i]
          .trim()
          .replace(/^\||\|$/g, '')
          .split('|')
          .map((c) => c.trim());
        bodyRows.push(rowCells);
        i++;
      }

      elements.push(
        <div key={`table-${i}`} className="my-4 overflow-x-auto border border-slate-200 rounded-lg bg-white">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-semibold">
                {headerCells.map((cell, idx) => (
                  <th
                    key={idx}
                    className={`py-2.5 px-3 whitespace-nowrap ${alignments[idx] || 'text-left'}`}
                  >
                    {renderInline(cell, onWagonClick)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {bodyRows.map((row, rIdx) => {
                const isTotalRow = row.some((c) =>
                  /ИТОГО|ВСЕГО|TOTAL|ХОЛДИНГ/i.test(c)
                );
                return (
                  <tr
                    key={rIdx}
                    className={`${
                      isTotalRow
                        ? 'bg-slate-50 font-semibold text-slate-900'
                        : 'hover:bg-slate-50/80 text-slate-800'
                    } transition-colors`}
                  >
                    {row.map((cell, cIdx) => {
                      const isNumericCell = /^[+-]?\d+([.,]\d+)?%?$/.test(cell.replace(/\*/g, '').replace(/\s/g, ''));
                      return (
                        <td
                          key={cIdx}
                          className={`py-2 px-3 ${alignments[cIdx] || (isNumericCell ? 'text-right' : 'text-left')} ${
                            isNumericCell ? 'font-mono tabular-nums' : ''
                          }`}
                        >
                          {renderInline(cell, onWagonClick)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Headings
    if (line.startsWith('#### ')) {
      elements.push(
        <h4 key={i} className="text-sm font-bold text-slate-900 mt-4 mb-2 tracking-tight">
          {renderInline(line.slice(5), onWagonClick)}
        </h4>
      );
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-base font-bold text-slate-900 mt-4 mb-2 tracking-tight border-b border-slate-200 pb-1.5">
          {renderInline(line.slice(4), onWagonClick)}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-lg font-bold text-slate-900 mt-5 mb-2 tracking-tight">
          {renderInline(line.slice(3), onWagonClick)}
        </h2>
      );
      i++;
      continue;
    }

    // Unordered Lists
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith('- ') || lines[i].trim().startsWith('* '))) {
        listItems.push(lines[i].trim().slice(2));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-2.5 space-y-1.5 list-disc pl-5 text-sm text-slate-700 leading-relaxed">
          {listItems.map((item, idx) => (
            <li key={idx}>{renderInline(item, onWagonClick)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered Lists
    if (/^\d+\.\s/.test(line.trim())) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        listItems.push(lines[i].trim().replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-2.5 space-y-1.5 list-decimal pl-5 text-sm text-slate-700 leading-relaxed">
          {listItems.map((item, idx) => (
            <li key={idx}>{renderInline(item, onWagonClick)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Standard paragraph
    elements.push(
      <p key={i} className="my-2 text-sm text-slate-700 leading-relaxed">
        {renderInline(line, onWagonClick)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
};

function renderInline(text: string, onWagonClick?: (wagonNumber: string) => void): React.ReactNode {
  // Parse **bold**, `code`, and *italic*
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2);
      const isNegative = /^-\d+/.test(inner.trim());
      const isPositive = /^\+\d+/.test(inner.trim());
      return (
        <strong
          key={index}
          className={`font-semibold ${
            isNegative ? 'text-red-700 font-mono tabular-nums' : isPositive ? 'text-emerald-700 font-mono tabular-nums' : 'text-slate-900'
          }`}
        >
          {inner}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      const codeVal = part.slice(1, -1);
      const isWagonNum = /^\d{5,8}(-\d+)?(\(\d+\))?$/.test(codeVal.trim());
      if (isWagonNum && onWagonClick) {
        return (
          <button
            key={index}
            type="button"
            onClick={() => onWagonClick(codeVal.trim())}
            className="font-mono tabular-nums text-xs font-medium text-blue-700 bg-blue-50/80 hover:bg-blue-100 px-1.5 py-0.5 rounded transition-colors cursor-pointer underline decoration-blue-300"
            title="Открыть карточку вагона"
          >
            {codeVal}
          </button>
        );
      }
      return (
        <code key={index} className="font-mono tabular-nums text-xs bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded">
          {codeVal}
        </code>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={index} className="italic text-slate-600">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}
