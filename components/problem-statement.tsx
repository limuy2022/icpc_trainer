import { splitStatement, type StatementMetadata } from "@/lib/statement-header";
import type { ReactNode } from "react";

export default function ProblemStatement({ text, metadata, render }: {
  text: string;
  metadata?: StatementMetadata;
  render: (body: string) => ReactNode;
}) {
  const result = splitStatement(text, metadata);
  const header = result.metadata;
  return <>
    {header && (header.title || header.details.length > 0) && <header className="problem-metadata">
      {header.title && <h3>{header.title}</h3>}
      <dl>{header.details.map(item => <div key={item.label}>
        <dt>{item.label}</dt><dd>{item.value}</dd>
      </div>)}</dl>
    </header>}
    {render(result.text)}
  </>;
}
