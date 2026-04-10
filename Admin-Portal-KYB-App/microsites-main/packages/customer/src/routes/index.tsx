import { BrowserRouter, Route, Routes, useParams } from "react-router-dom";
import { setItem } from "@/lib/localStorage";
import { PrivateRoute } from "./PrivateRoute";
import { PublicRoute } from "./PublicRoute";

import { URL } from "@/constants";
import CustomerDetailsOverviewTab from "@/page/Customer/CustomerDetails/Tabs/CustomerDetailsOverviewTab";
import Customer from "@/page/Customer/CustomerTable/Customer";
import Settings from "@/page/Customer/Settings";
import RiskMonitoring from "@/page/Customer/Settings/RiskMonitoring/RiskMonitoring";
import WorkflowWizard from "@/page/Customer/Settings/Workflows/Wizard/WorkflowWizard";
import Workflows from "@/page/Customer/Settings/Workflows/Workflows";
import { Login } from "@/page/Login";

// Wrapper component to extract customerId from URL params
const CustomerDetailsRoute = () => {
	const { slug } = useParams<{ slug: string }>();

	// Set customerId in localStorage for direct URL access or when viewing different customers
	if (slug) {
		setItem("customerId", slug);
	}

	return <CustomerDetailsOverviewTab customerId={slug ?? ""} />;
};

const Router = () => (
	<BrowserRouter>
		<Routes>
			<Route element={<PublicRoute />}>
				<Route path={URL.LOGIN} element={<Login />} />
			</Route>
			<Route element={<PrivateRoute />}>
				<Route path={URL.CUSTOMERS} element={<Customer />} />
				<Route path={URL.EDIT_CUSTOMER} element={<Settings />} />
				<Route
					path={URL.CUSTOMERS_DETAILS}
					element={<CustomerDetailsRoute />}
				/>
				<Route path={URL.SETTINGS} element={<Settings />} />
				<Route path={URL.WORKFLOWS} element={<Workflows />} />
				<Route path={URL.SETTINGS_WORKFLOWS} element={<Workflows />} />
				<Route path={URL.RISK_MONITORING} element={<RiskMonitoring />} />
				<Route path={URL.CREATE_WORKFLOW} element={<WorkflowWizard />} />
				<Route path={URL.EDIT_WORKFLOW} element={<WorkflowWizard />} />
			</Route>
		</Routes>
	</BrowserRouter>
);

export default Router;
