import { Navigate, Outlet, useLocation } from "react-router";
import { defaultHomePage } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import useAuthStore from "@/store/useAuthStore";
import { URL } from "../constants/URL";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

const useQuery = () => {
	return new URLSearchParams(useLocation().search);
};
const PublicRoute = () => {
	const queryParams = useQuery();
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const redirectURL = queryParams.get("redirectTo");
	// Replace with your auth condition
	const { isAuthenticated } = useAuthStore((state) => state);

	return isAuthenticated && !customerId ? (
		<Navigate
			to={`${URL.CUSTOMER_SELECTION}${
				redirectURL ? `?redirectTo=${redirectURL}` : ""
			}`}
		/>
	) : customerId ? (
		<Navigate to={defaultHomePage()} />
	) : (
		<Outlet />
	);
};

export default PublicRoute;
