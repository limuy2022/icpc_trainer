import {t as ui,useLocale} from "@/lib/locale";
import { splitStatement, type StatementMetadata } from "@/lib/statement-header";
import {memo,useMemo,type ReactNode} from "react";

export default memo(function ProblemStatement({ text, metadata, render }: {
  text: string;
  metadata?: StatementMetadata;
  render: (body: string) => ReactNode;
}) {
  useLocale();
  const result = useMemo(()=>splitStatement(text, metadata),[text,metadata]);
  const header = result.metadata;
  return <>
    {header && (header.title || header.details.length > 0) && <header className="problem-metadata">
      {header.title && <h3>{header.title}</h3>}
      <dl>{header.details.map(item => <div key={ui(item.label)}>
        <dt>{ui(item.label)}</dt><dd>{item.value}</dd>
      </div>)}</dl>
    </header>}
    {render(result.text)}
  </>;
});
