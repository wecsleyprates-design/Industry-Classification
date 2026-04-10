import { BrowserRouter, Route, Routes } from "react-router-dom";
import { URL } from "../constants";
import PrivateRoute from "./PrivateRoute";
import PublicRoute from "./PublicRoute";

import CustomerBusinessTable from "@/page/Cases/BusinessTable/CustomerBusinessTable";
import BusinessCaseDetails from "@/page/Cases/CaseDetails/BusinessCaseDetails";
import CustomerCaseDetails from "@/page/Cases/CaseDetails/CustomerCaseDetails";
import CustomerDetailsCaseDetails from "@/page/Cases/CaseDetails/CustomerDetailsCaseDetails";
import StandaloneCaseDetails from "@/page/Cases/CaseDetails/StandaloneCaseDetails";
import BusinessCaseTable from "@/page/Cases/CaseTable/BusinessCaseTable";
import CustomerCaseTable from "@/page/Cases/CaseTable/CustomerCaseTable";
import CustomerDetailsCaseTable from "@/page/Cases/CaseTable/CustomerDetailsCaseTable";
import StandaloneCaseTable from "@/page/Cases/CaseTable/StandaloneCaseTable";
import Login from "@/page/Login";

const Router = () => (
	<BrowserRouter>
		<Routes>
			<Route element={<PublicRoute />}>
				<Route path={URL.LOGIN} element={<Login />} />
			</Route>
			<Route element={<PrivateRoute />}>
				<Route path={URL.CASES} element={<CustomerCaseTable />} />
				<Route
					path={URL.BUSINESS_CASES}
					element={<BusinessCaseTable />}
				/>
				<Route
					path={URL.CUSTOMER_DETAILS}
					element={<CustomerDetailsCaseTable />}
				/>
				<Route
					path={URL.STANDALONE_CASES}
					element={<StandaloneCaseTable />}
				/>
				<Route
					path={URL.CASE_DETAILS}
					element={<CustomerCaseDetails />}
				/>
				<Route
					path={URL.CUSTOMER_APPLICANT_CASE_DETAILS}
					element={<CustomerDetailsCaseDetails />}
				/>
				<Route
					path={URL.STANDALONE_CASE_DETAILS}
					element={<StandaloneCaseDetails />}
				/>
				<Route
					path={URL.BUSINESS_APPLICANT_CASE_DETAILS}
					element={<BusinessCaseDetails />}
				/>

				<Route
					path={URL.CUSTOMER_BUSINESS_TABLE}
					element={<CustomerBusinessTable />}
				/>
			</Route>
		</Routes>
	</BrowserRouter>
);

export default Router;
