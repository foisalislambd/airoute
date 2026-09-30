import { PanelPageHeader } from "@/components/layout/panel-page-header";
import { listActivity, type ActivityItem } from "@/lib/api";
import { useEffect, useState } from "react";

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listActivity()
      .then((result) => setItems(result.activity))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div>
      <PanelPageHeader
        title="Activity"
        description="Local request log. Prompts are not stored, only the model, status, latency, and token counts when the provider returns them."
      />
      {error && <p className="mb-4 text-sm text-error-500">{error}</p>}
      <div className="panel-card overflow-hidden">
        {items.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No requests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50/80 text-xs font-medium text-gray-500 dark:border-gray-800 dark:bg-white/5 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5 font-medium">Source</th>
                  <th className="px-4 py-2.5 font-medium">Model</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Error</th>
                  <th className="px-4 py-2.5 text-right font-medium">Latency</th>
                  <th className="px-4 py-2.5 text-right font-medium">Prompt</th>
                  <th className="px-4 py-2.5 text-right font-medium">Completion</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/5">
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">{item.createdAt.replace("T", " ").replace("Z", "")}</td>
                    <td className="whitespace-nowrap px-4 py-2.5">{item.source}</td>
                    <td className="max-w-[240px] truncate px-4 py-2.5 font-mono text-xs" title={item.modelId}>{item.modelId || "—"}</td>
                    <td className={`whitespace-nowrap px-4 py-2.5 ${item.statusCode >= 400 ? "text-error-500" : "text-success-600"}`}>
                      {item.statusCode}
                    </td>
                    <td className="max-w-[280px] truncate px-4 py-2.5 text-gray-500" title={item.errorMessage}>
                      {item.errorMessage || "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums">{item.latencyMs} ms</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{item.promptTokens || "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-500">{item.completionTokens || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
