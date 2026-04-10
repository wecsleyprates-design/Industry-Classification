import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "@/components/Button";
import useCustomToast from "@/hooks/useCustomToast";
import { useRequestInviteQuery } from "@/services/queries/auth.query";

import { URL } from "@/constants/URL";

const VerifyFailed = () => {
	const [params] = useSearchParams();
	const navigate = useNavigate();
	const { successHandler, errorHandler } = useCustomToast();
	const [isRequestSent, setIsRequestSent] = useState<boolean>(
		!!window.sessionStorage.getItem("requestSent"),
	);
	const {
		mutateAsync: requestInvite,
		data: requestInviteData,
		error: requestInviteError,
	} = useRequestInviteQuery();

	const inviteToken = params.get("token") ?? "";
	const userType: "customer_admin" | "customer_user" = params.get(
		"user_type",
	) as "customer_admin" | "customer_user";

	const requestInviteHandler = async () => {
		await requestInvite({
			inviteToken,
			userType: userType === "customer_admin" ? "admin" : "users",
		});
	};

	useEffect(() => {
		if (requestInviteData) {
			setIsRequestSent(true);
			window.sessionStorage.setItem("requestSent", "true");

			successHandler({ message: requestInviteData.message ?? "" });
		}
	}, [requestInviteData]);

	useEffect(() => {
		if (requestInviteError) {
			errorHandler(requestInviteError);
			navigate(URL.LOGIN);
		}
	}, [requestInviteError]);

	return (
		<>
			<>
				<div className="bg-[#F9FAFB] flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
					<div className="sm:mx-auto sm:w-full sm:max-w-md">
						<img
							className="w-auto h-10 mx-auto"
							src="/logo.svg"
							alt="Your Company"
						/>
					</div>

					<div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px] px-4 py-5 sm:p-6">
						<div className="px-4 py-5 overflow-hidden bg-white rounded-lg shadow sm:p-6 sm:rounded-lg">
							{isRequestSent ? (
								<>
									<div className="leading-9 tracking-tight text-gray-900">
										<p className="font-bold text-[25px] sm:text-[25px] text-[#333] mb-8 mt-2">
											Request submitted
										</p>
									</div>
									<p className="justify-between my-4 text-sm">
										A new invitation link has been sent to your email address.
										please check your inbox
									</p>
								</>
							) : (
								<>
									<div className="leading-9 tracking-tight text-gray-900">
										<p className="font-bold text-[25px] sm:text-[25px] text-[#333] mb-8 mt-2">
											Invitation link expired
										</p>
									</div>
									<p className="justify-between text-sm">
										The invitation link you used has expired. Please request a
										new invitation link.
									</p>
									<p className="text-start">
										<Button
											className="my-5"
											onClick={requestInviteHandler}
											color="dark"
										>
											Request new invitation link
										</Button>
									</p>
								</>
							)}
						</div>
					</div>
				</div>
			</>
		</>
	);
};

export default VerifyFailed;
