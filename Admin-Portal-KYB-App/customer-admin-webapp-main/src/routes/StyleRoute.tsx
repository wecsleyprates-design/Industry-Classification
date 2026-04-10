import React, { useState } from "react";
import { Navigate, Outlet } from "react-router";
import WorthIcon from "assets/svg/BrandIcons/WorthIcon";
import Header from "@/components/Header";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import useLogout from "@/hooks/useLogout";
import { getItem } from "@/lib/localStorage";
import useAuthStore from "@/store/useAuthStore";
import { type ILoginResponseUserDetails } from "@/types/auth";

const StyleRoute = () => {
	const { isLoading, logoutAsync } = useLogout();
	const [userDetails] = useState<ILoginResponseUserDetails | null>(
		getItem("userDetails"),
	);

	// Replace with your auth condition
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
			{isLoading && <FullPageLoader />}
			<Header userDetails={userDetails} DropdownOptions={DropdownOptions}>
				<button type="button" className="-m-2.5 p-2.5 text-gray-700">
					<span className="sr-only">Logo</span>
					<WorthIcon />
				</button>
			</Header>
			<div className="overflow-hidden bg-white rounded-lg">
				<div className="px-4 py-5 sm:p-6">
					<main className="py-24">
						<div className="sm:px-6 lg:px-36">
							<Outlet />
						</div>
					</main>
				</div>
			</div>
		</React.Fragment>
	) : (
		<Navigate to="/" />
	);
};

export default StyleRoute;
