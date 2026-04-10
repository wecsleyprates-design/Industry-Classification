import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { URL } from "constants/URL";
import Spinner from "@/components/Spinner";
import useCustomToast from "@/hooks/useCustomToast";
import { useVerifyInviteEmailQuery } from "@/services/queries/verifyInvite.query";

const VerifyInvite = () => {
	const [loading, setLoading] = useState<boolean>(false);
	const navigate = useNavigate();
	const [params] = useSearchParams();
	const token = params.get("token");
	const userType = params.get("user_type");
	const { successHandler, errorHandler } = useCustomToast();

	const {
		mutateAsync: verifyInviteLink,
		data: verifyInviteData,
		error: verifyInviteError,
	} = useVerifyInviteEmailQuery();

	useEffect(() => {
		if (verifyInviteData) {
			setLoading(false);
			successHandler({
				message: verifyInviteData.message,
			});
			if (
				verifyInviteData.status === "success" &&
				verifyInviteData.data.redirect === "set_password"
			) {
				navigate(`${URL.SET_PASSWORD}?token=${token ?? ""}`);
			}

			if (
				verifyInviteData.status === "success" &&
				verifyInviteData.data.redirect === "login"
			) {
				navigate(URL.LOGIN);
			}
		}
	}, [verifyInviteData]);

	useEffect(() => {
		if (verifyInviteError != null) {
			setLoading(false);
			if (
				axios.isAxiosError(verifyInviteError) &&
				verifyInviteError?.response?.data?.message === "This link has expired"
			) {
				navigate(
					`${URL.VERIFICATION_FAILED}?token=${token ?? ""}&user_type=${
						userType ?? ""
					}`,
					{ replace: true },
				);
			} else {
				errorHandler(verifyInviteError);
			}
		}
	}, [verifyInviteError]);

	useEffect(() => {
		if (token) {
			(async () => {
				await verifyResetTokenHandler();
			})().catch((err) => {
				console.error(err);
			});
		}
	}, [token]);

	const verifyResetTokenHandler = async () => {
		await verifyInviteLink(token ?? "");
	};

	return (
		<>
			{loading && <Spinner />}
			<div className="flex flex-col justify-center flex-1 min-h-full py-12 bg-slate-50 sm:px-6 lg:px-8">
				<div className="sm:mx-auto sm:w-full sm:max-w-md">
					<img
						className="w-auto h-10 mx-auto"
						src="/logo.svg"
						alt="Your Company"
					/>
					<div className="mt-6 leading-9 tracking-tight text-center text-gray-900">
						<p className="font-bold text-[25px] sm:text-[25px] text-[#333]">
							Verifying Invitation Link.
						</p>
					</div>
				</div>
			</div>
		</>
	);
};

export default VerifyInvite;
