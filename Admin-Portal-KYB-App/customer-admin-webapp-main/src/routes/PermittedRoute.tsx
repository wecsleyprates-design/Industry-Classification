import { Navigate, Outlet } from "react-router";
import { defaultHomePage } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import useAuthStore from "@/store/useAuthStore";
import { URL } from "../constants";

import { LOCALSTORAGE } from "@/constants/LocalStorage";

const PermittedRoute = () => {
	const { permissions, isAuthenticated } = useAuthStore((state) => state);

	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";

	// Check permissions from store, or fallback to localStorage if store not yet synced
	const storeHasPermissions = Object.keys(permissions).length > 0;
	const localStoragePermissions = getItem(LOCALSTORAGE.permissions);
	const hasPermissions =
		storeHasPermissions ||
		(localStoragePermissions &&
			Object.keys(localStoragePermissions).length > 0);

	// If authenticated and has permissions (from either source), render the route
	if (hasPermissions) {
		return <Outlet />;
	}

	// If no customerId, redirect to customer selection
	if (!customerId) {
		return <Navigate to={URL.CUSTOMER_SELECTION} />;
	}

	// If authenticated with customerId but no permissions yet, render outlet
	// (permissions might still be loading from the store)
	if (isAuthenticated && customerId) {
		return <Outlet />;
	}

	return <Navigate to={defaultHomePage()} />;
};

export default PermittedRoute;
