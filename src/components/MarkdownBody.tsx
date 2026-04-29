import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const remarkPlugins = [remarkGfm];

export function MarkdownBody({ source }: { source: string }) {
  return (
    <div className="markdown-body text-sm text-nord-5 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        components={{
          table: ({ children }) => (
            <table className="w-full border-collapse border border-nord-3 text-sm mb-3">
              {children}
            </table>
          ),
          thead: ({ children }) => (
            <thead className="bg-nord-2">{children}</thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="even:bg-nord-1">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="border border-nord-3 px-3 py-1.5 text-left font-semibold text-nord-6">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-nord-3 px-3 py-1.5 text-nord-5">
              {children}
            </td>
          ),
          h1: ({ children }) => (
            <h1 className="text-lg font-semibold text-nord-6 mt-6 mb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xs font-semibold text-nord-4 uppercase tracking-wider mt-6 mb-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-nord-5 mt-4 mb-2">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mt-3 mb-3">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>
          ),
          code: ({ children }) => (
            <code className="bg-nord-2 px-1 py-0.5 rounded text-nord-13 text-[0.85em] font-mono">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="bg-nord-2 border border-nord-3 rounded p-3 overflow-x-auto text-xs mb-3">
              {children}
            </pre>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-nord-8 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
