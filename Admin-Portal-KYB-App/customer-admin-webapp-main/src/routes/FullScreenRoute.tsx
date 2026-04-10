import React, { useState } from "react";
import { Navigate, Outlet } from "react-router";
import LogoHeader from "@/components/Header/LogoHeader";
import Spinner from "@/components/Spinner";
import useLogout from "@/hooks/useLogout";
import { getItem } from "@/lib/localStorage";
import useAuthStore from "@/store/useAuthStore";
import { type ILoginResponseUserDetails } from "@/types/auth";

const FullScreenRoute = () => {
	const { isLoading, logoutAsync } = useLogout();
	const [userDetails] = useState<ILoginResponseUserDetails | null>(
		getItem("userDetails"),
	);
	const { isAuthenticated, clearIsAuthenticated } = useAuthStore(
		(state) => state,
	);

	const DropdownOptions = [
		{
			name: "Sign out",
			onClick: async () => {
				await logoutAsync();
				clearIsAuthenticated();
			},
		},
	];

	return isAuthenticated ? (
		<React.Fragment>
			{isLoading && <Spinner />}
			<LogoHeader DropdownOptions={DropdownOptions} userDetails={userDetails}>
				<Outlet />
			</LogoHeader>
		</React.Fragment>
	) : (
		<Navigate to="/" replace={true} />
	);
};

export default FullScreenRoute;
