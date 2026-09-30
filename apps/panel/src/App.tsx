import { ThemeProvider } from "@/components/theme/theme-provider";
import { PanelShell } from "@/components/layout/panel-shell";
import { SidebarProvider } from "@/context/sidebar-context";
import ActivityPage from "@/pages/ActivityPage";
import KeysPage from "@/pages/KeysPage";
import OverviewPage from "@/pages/OverviewPage";
import PlaygroundPage from "@/pages/PlaygroundPage";
import ProviderPage from "@/pages/ProviderPage";
import ProvidersPage from "@/pages/ProvidersPage";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <SidebarProvider>
          <Routes>
            <Route element={<PanelShell />}>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/providers" element={<ProvidersPage />} />
              <Route path="/providers/:slug" element={<ProviderPage />} />
              <Route path="/keys" element={<KeysPage />} />
              <Route path="/playground" element={<PlaygroundPage />} />
              <Route path="/activity" element={<ActivityPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SidebarProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
