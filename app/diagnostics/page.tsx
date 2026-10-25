import { SiteDiagnostics } from "@/components/site-diagnostics";

export const metadata = {
  title: "Проверка отображения",
  robots: { index: false, follow: false },
};

export default function DiagnosticsPage() {
  const commit = process.env.RENDER_GIT_COMMIT || "";
  return (
    <div className="shell content-page">
      <div className="page-heading">
        <h1>Проверка отображения</h1>
      </div>
      <SiteDiagnostics
        release="motion-check-2026-10-25"
        commit={/^[a-f0-9]{40}$/i.test(commit) ? commit.slice(0, 8) : null}
      />
    </div>
  );
}
