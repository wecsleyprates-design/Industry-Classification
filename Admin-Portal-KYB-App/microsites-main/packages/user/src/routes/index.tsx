import { BrowserRouter, Route, Routes } from "react-router-dom";
import { isAdminSubdomain } from "@/lib/helper";
import useAuthStore from "@/store/useAuthStore";
import { URL } from "../constants";
import { PrivateRoute } from "./PrivateRoute";
import { PublicRoute } from "./PublicRoute";

import {
	ACCESS,
	type AccessType,
	type CodeModule,
	MODULES,
} from "@/constants/Modules";
import { Login } from "@/page/Login";
import CreateRole from "@/page/Users/Roles/CreateRole";
import EditRole from "@/page/Users/Roles/EditRole";
import CustomerCreateUser from "@/page/Users/UserDetail/CustomerCreateUser";
import CustomerUserDetail from "@/page/Users/UserDetail/CustomerUserDetail";
import CustomerUserTable from "@/page/Users/UserTable/CustomerUserTable";
import TeamsTab from "@/page/Users/UserTable/TeamsTab";

const Router = () => {
	const permissions = useAuthStore((state) => state.permissions);

	const checkForAccess = (module: CodeModule, type?: AccessType): boolean => {
		const canRead = !!permissions[module]?.read;
		const canWrite = !!permissions[module]?.write;
		const canCreate = !!permissions[module]?.create;

		if (type === "read") return canRead;
		else if (type === "write") return canWrite;
		else if (type === "create") return canCreate;

		return canCreate || canRead || canWrite;
	};

	return (
		<BrowserRouter>
			<Routes>
				<Route element={<PublicRoute />}>
					<Route path={URL.LOGIN} element={<Login />} />
				</Route>
				<Route element={<PrivateRoute />}>
					{checkForAccess(MODULES.CUSTOMER_USER, ACCESS.READ) && (
						<Route path={URL.USERS} element={<TeamsTab />} />
					)}
					{checkForAccess(MODULES.ROLES, ACCESS.READ) && (
						<Route path={URL.ROLES} element={<TeamsTab />} />
					)}
					<Route path={URL.USERS_NEW} element={<CustomerUserTable />} />
					<Route path={URL.USER_DETAILS} element={<CustomerUserDetail />} />
					<Route path={URL.CREATE_USER} element={<CustomerCreateUser />} />
					{checkForAccess(MODULES.ROLES, ACCESS.CREATE) && (
						<Route path={URL.ROLES_CREATE} element={<CreateRole />} />
					)}
					{checkForAccess(MODULES.ROLES, ACCESS.WRITE) && (
						<Route path={URL.ROLES_EDIT} element={<EditRole />} />
					)}
				</Route>
			</Routes>
		</BrowserRouter>
	);
};

export default Router;
