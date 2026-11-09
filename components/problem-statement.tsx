import { parseStatementHeader } from "@/lib/statement-header";
import type { ReactNode } from "react";

export default function ProblemStatement({ text, render }: {
  text: string;
  render: (body: string) => ReactNode;
}) {
  const header = parseStatementHeader(text);
  return <>
    {header.details.length > 0 && <header className="problem-metadata">
      {header.title && <h3>{header.title}</h3>}
      <dl>{header.details.map(item => <div key={item.label}>
        <dt>{item.label}</dt><dd>{item.value}</dd>
      </div>)}</dl>
    </header>}
    {render(header.body)}
  </>;
}
