import { useState } from "react";
import { Navigate, Outlet } from "react-router";
import { getItem } from "@/lib/localStorage";
import { LOCALSTORAGE, URL } from "../constants";

export const PublicRoute = () => {
	// Replace with your auth condition
	const [isLoggedIn] = useState(getItem(LOCALSTORAGE.token));

	return isLoggedIn ? <Navigate to={URL.USERS} /> : <Outlet />;
};
