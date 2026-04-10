import React, { useMemo } from "react";
import { Navigate, Outlet } from "react-router";
import { useLocation } from "react-router-dom";
import { twMerge } from "tailwind-merge";
import SandboxBanner from "@/components/Banner/SandboxBanner";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar/Sidebar";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import useLogout from "@/hooks/useLogout";
import { getItem } from "@/lib/localStorage";
import useAuthStore from "@/store/useAuthStore";
import { type ILoginResponseUserDetails } from "@/types/auth";
import { URL } from "../constants";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import REGEX from "@/constants/Regex";

const PrivateRoute = ({ hideSidebar = false }) => {
	const { isLoading, logoutAsync } = useLogout();
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
	const loginData = useAuthStore((state) => state.loginData);
	const location = useLocation();

	const userDetails =
		loginData?.user_details ??
		getItem<ILoginResponseUserDetails>(LOCALSTORAGE.userDetails);

	const dropdownOptions = useMemo(
		() => [
			{
				name: "Sign out",
				onClick: async () => {
					await logoutAsync();
				},
			},
		],
		[logoutAsync],
	);

	const shouldShowWebhookBackground = location.pathname.includes("/webhook");

	const shouldShowGrayBackground =
		location.pathname.includes("/settings") ||
		(location.pathname.includes("/businesses") &&
			!location.pathname.includes("/businesses/new-business"));

	const customerName = getItem<string>(LOCALSTORAGE.customerName) ?? "";
	const customerType = getItem<string>(LOCALSTORAGE.customerType) ?? "";

	if (!isAuthenticated) {
		return <Navigate to={URL.LOGIN} replace />;
	}

	return (
		<React.Fragment>
			{isLoading && <FullPageLoader />}
			<Header userDetails={userDetails} DropdownOptions={dropdownOptions} />
			<div className={twMerge("pt-16", !hideSidebar && "lg:pl-72")}>
				{customerType === "SANDBOX" && (
					<SandboxBanner
						customerName={customerName}
						customerType={customerType}
					/>
				)}
			</div>
			{!hideSidebar && <Sidebar flag={shouldShowWebhookBackground} />}
			<div
				className={twMerge(
					"w-screen pr-2 lg:pl-72	min-h-full",
					shouldShowWebhookBackground ||
						shouldShowGrayBackground ||
						new RegExp(REGEX.NEW_CASES_ROUTE).test(location.pathname)
						? "bg-gray-100"
						: "bg-white",
				)}
			>
				<main className="pt-6 pb-6">
					<div className="px-4 sm:px-6 lg:px-8">
						<Outlet />
					</div>
				</main>
			</div>
		</React.Fragment>
	);
};

export default PrivateRoute;
