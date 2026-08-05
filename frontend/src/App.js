import "@/App.css";
import { BrowserRouter, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Layout } from "@/components/landing/Layout";
import { AuthProvider } from "@/context/AuthContext";
import { BuildingProvider } from "@/context/BuildingContext";
import { RequireAuth, Shell } from "@/components/app/Shell";
import Home from "@/pages/Home";
import PlatformPage from "@/pages/PlatformPage";
import CompliancePage from "@/pages/CompliancePage";
import MaintenancePage from "@/pages/MaintenancePage";
import FinancialsPage from "@/pages/FinancialsPage";
import OwnersPage from "@/pages/OwnersPage";
import PricingPage from "@/pages/PricingPage";
import SecurityPage from "@/pages/SecurityPage";
import LegalPage from "@/pages/LegalPage";
import SignInPage from "@/pages/auth/SignInPage";
import SignUpPage from "@/pages/auth/SignUpPage";
import OverviewPage from "@/pages/app/OverviewPage";
import ProfilePage from "@/pages/app/ProfilePage";
import AppFinancialsPage from "@/pages/app/FinancialsPage";
import RentRollPage from "@/pages/app/RentRollPage";
import TenantsUnitsPage from "@/pages/app/TenantsUnitsPage";
import WorkOrdersPage from "@/pages/app/WorkOrdersPage";
import AppCompliancePage from "@/pages/app/CompliancePage";
import VendorsPage from "@/pages/app/VendorsPage";
import DocumentsPage from "@/pages/app/DocumentsPage";
import ReportsPage from "@/pages/app/ReportsPage";
import ActivityPage from "@/pages/app/ActivityPage";
import SettingsPage from "@/pages/app/SettingsPage";

const SiteShell = () => (
  <Layout>
    <Outlet />
  </Layout>
);

/* The operating app (and auth pages) support light/dark; the marketing site is
   designed dark-only, so its routes force the dark theme. */
const THEMED_PREFIXES = ["/app", "/signin", "/signup"];
const ThemeScope = ({ children }) => {
  const { pathname } = useLocation();
  const themed = THEMED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="obelix-theme"
      forcedTheme={themed ? undefined : "dark"}
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <ThemeScope>
        <AuthProvider>
          <Routes>
            <Route element={<SiteShell />}>
              <Route path="/" element={<Home />} />
              <Route path="/platform" element={<PlatformPage />} />
              <Route path="/compliance" element={<CompliancePage />} />
              <Route path="/maintenance" element={<MaintenancePage />} />
              <Route path="/financials" element={<FinancialsPage />} />
              <Route path="/owners" element={<OwnersPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/privacy" element={<LegalPage kind="privacy" />} />
              <Route path="/terms" element={<LegalPage kind="terms" />} />
              <Route path="*" element={<Home />} />
            </Route>

            <Route path="/signin" element={<SignInPage />} />
            <Route path="/signup" element={<SignUpPage />} />

            <Route
              path="/app"
              element={
                <RequireAuth>
                  <BuildingProvider>
                    <Shell />
                  </BuildingProvider>
                </RequireAuth>
              }
            >
              <Route index element={<OverviewPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="financials" element={<AppFinancialsPage />} />
              <Route path="rent-roll" element={<RentRollPage />} />
              <Route path="tenants" element={<TenantsUnitsPage />} />
              <Route path="work-orders" element={<WorkOrdersPage />} />
              <Route path="compliance" element={<AppCompliancePage />} />
              <Route path="vendors" element={<VendorsPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </AuthProvider>
        </ThemeScope>
      </BrowserRouter>
    </div>
  );
}

export default App;
