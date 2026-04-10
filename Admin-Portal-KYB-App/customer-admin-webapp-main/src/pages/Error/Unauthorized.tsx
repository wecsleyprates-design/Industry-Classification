import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import authError from "@/assets/png/authError.png";
import WorthIcon from "@/assets/svg/BrandIcons/WorthIcon";
import Button from "@/components/Button";
import Header from "@/components/Header";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import useLogout from "@/hooks/useLogout";
import { defaultHomePage } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import useAuthStore from "@/store/useAuthStore";
import { type ILoginResponseUserDetails } from "@/types/auth";

const Unauthorized = () => {
	const navigate = useNavigate();
	const { isLoading, logoutAsync } = useLogout();
	const [userDetails] = useState<ILoginResponseUserDetails | null>(
		getItem("userDetails"),
	);
	// Replace with your auth condition
	const { clearIsAuthenticated } = useAuthStore((state) => state);

	const DropdownOptions = [
		{
			name: "Sign out",
			onClick: async () => {
				await logoutAsync();
				clearIsAuthenticated();
			},
		},
	];

	return (
		<>
			{isLoading && <FullPageLoader />}
			<Header userDetails={userDetails} DropdownOptions={DropdownOptions}>
				<button type="button" className="-m-2.5 p-2.5 text-gray-700">
					<span className="sr-only">Logo</span>
					<WorthIcon />
				</button>
			</Header>
			<div className="pt-16 overflow-hidden bg-white rounded-lg">
				<div className="flex flex-col justify-center">
					<div className="flex justify-center">
						<img src={authError} alt="" className="scale-75 md:scale-90" />
					</div>
					<p className="text-[32px] text-center mt-5 font-bold">
						Authorization failed
					</p>
					<p className="text-[18px] text-center mt-2 font-normal">
						It looks like you don't have access to this module. <br /> Please
						contact{" "}
						<span className="text-[#1A56DB]">support@joinworth.com</span> for
						assistance.
					</p>
					<div className="flex justify-center mt-5 gap-x-3">
						<Button
							className="text-center w-[100px] rounded-lg"
							color="dark"
							onClick={async () => {
								await logoutAsync();
								clearIsAuthenticated();
							}}
						>
							Logout
						</Button>
						<Button
							className="text-center w-[100px] rounded-lg"
							color="dark"
							onClick={() => {
								navigate(defaultHomePage());
							}}
						>
							Go Back
						</Button>
					</div>
				</div>
			</div>
		</>
	);
};

export default Unauthorized;
