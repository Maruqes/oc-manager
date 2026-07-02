import { Card } from "../../../components/ui/Card";

export function RawJsonViewer({ value }: { value: unknown }) {
  return (
    <Card>
      <div className="section-heading"><span>Raw config</span></div>
      <pre className="raw-viewer">{JSON.stringify(value, null, 2)}</pre>
    </Card>
  );
}
