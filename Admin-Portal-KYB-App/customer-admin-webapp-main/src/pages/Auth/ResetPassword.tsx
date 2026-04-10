import { useEffect, useState } from "react";
import {
	type FieldNamesMarkedBoolean,
	type SubmitHandler,
	useForm,
} from "react-hook-form";
import { useLocation, useNavigate } from "react-router";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import { URL } from "constants/URL";
import Button from "@/components/Button";
import { Input } from "@/components/Input";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import useCustomToast from "@/hooks/useCustomToast";
import { setPasswordSchema } from "@/lib/validation";
import {
	useResetPasswordQuery,
	useVerifyResetTokenQuery,
} from "@/services/queries/auth.query";
import { type ResetPasswordBody, type UpdatePassword } from "@/types/auth";

const useQuery = () => {
	return new URLSearchParams(useLocation().search);
};

type ShowPasswordType = "newPassword" | "confirmPassword";

const ResetPassword = () => {
	const queryParams = useQuery();
	const slug = queryParams.get("token");
	const [isTokenVerified, setIsTokenVerified] = useState(false);
	const [showPassword, setShowPassword] = useState<
		FieldNamesMarkedBoolean<UpdatePassword>
	>({
		newPassword: false,
		confirmPassword: false,
	});
	const navigate = useNavigate();
	const toggleShowPassword = (field: ShowPasswordType) => {
		setShowPassword({ ...showPassword, [field]: !showPassword[field] });
	};
	const { successHandler, errorHandler } = useCustomToast();

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<ResetPasswordBody>({
		resolver: yupResolver(setPasswordSchema),
	});

	const {
		data: verifyTokenData,
		error: verifyTokenError,
		isLoading: verifyTokenLoading,
	} = useVerifyResetTokenQuery(slug ?? "");

	useEffect(() => {
		if (verifyTokenData) {
			setIsTokenVerified(true);
			successHandler({ message: verifyTokenData?.message });
		}
	}, [verifyTokenData]);

	useEffect(() => {
		if (verifyTokenError) {
			errorHandler(verifyTokenError);
			navigate(URL.ROOT);
		}
	}, [verifyTokenError]);

	// reset password
	const {
		mutateAsync: resetPassword,
		error: resetPasswordError,
		data: resetPasswordData,
		isPending: resetPassWordLoading,
	} = useResetPasswordQuery();

	useEffect(() => {
		if (resetPasswordError != null) {
			errorHandler(resetPasswordError);
		}
	}, [resetPasswordError]);

	useEffect(() => {
		if (resetPasswordData) {
			successHandler({
				message: resetPasswordData.message,
			});
			navigate(URL.LOGIN);
		}
	}, [resetPasswordData]);

	const onSetPassword: SubmitHandler<ResetPasswordBody> = async (data) => {
		const token: any = slug;
		await resetPassword({
			password: data.confirmPassword,
			reset_token: token,
		});
	};

	return (
		<>
			{verifyTokenLoading ? (
				<FullPageLoader />
			) : (
				isTokenVerified && (
					<div className="flex flex-col justify-center flex-1 min-h-full py-12 bg-slate-50 sm:px-6 lg:px-8">
						<div className="sm:mx-auto sm:w-full sm:max-w-md">
							<img
								className="w-auto h-10 mx-auto"
								src="/logo.svg"
								alt="Your Company"
							/>
							<div className="mt-6 leading-9 tracking-tight text-center text-gray-900">
								<p className="font-bold text-[25px] sm:text-[25px] text-[#333]">
									Log into your account
								</p>
							</div>
						</div>

						<div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px] px-4 py-5 sm:p-6">
							<div className="px-4 py-5 overflow-hidden bg-white rounded-lg shadow sm:p-6 sm:rounded-lg">
								<form
									onSubmit={handleSubmit(onSetPassword)}
									className="px-4 py-5 space-y-6 sm:p-6"
								>
									<div className="leading-9 tracking-tight text-gray-900">
										<p className="font-bold text-[25px] sm:text-[25px] text-[#333]">
											Set new password
										</p>
										<p className="mt-1 text-[15px] font-normal text-gray-400">
											Please enter your new password
										</p>
									</div>
									<div>
										<div className="mt-2">
											<div className="mt-2">
												<Input
													errors={errors}
													label="New password"
													id="newPassword"
													name="newPassword"
													placeholder="Enter password"
													type={showPassword.newPassword ? "text" : "password"}
													register={register}
													className="w-full border border-slate-300 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4"
													autoComplete="new-password"
												>
													<div
														onClick={() => {
															toggleShowPassword("newPassword");
														}}
														className="absolute inset-y-0 right-0 flex items-center pr-3"
													>
														{showPassword.newPassword ? (
															<EyeIcon
																className="w-5 h-5 mt-2"
																aria-hidden="true"
															/>
														) : (
															<EyeSlashIcon
																className="w-5 h-5 mt-2"
																aria-hidden="true"
															/>
														)}
													</div>
												</Input>
											</div>

											<div className="mt-2">
												<Input
													errors={errors}
													label="Confirm password"
													id="confirmPassword"
													placeholder="Confirm password"
													name="confirmPassword"
													type={
														showPassword.confirmPassword ? "text" : "password"
													}
													register={register}
													className="w-full border border-slate-300 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4"
													autoComplete="new-password"
												>
													<div
														onClick={() => {
															toggleShowPassword("confirmPassword");
														}}
														className="absolute inset-y-0 right-0 flex items-center pr-3"
													>
														{showPassword.confirmPassword ? (
															<EyeIcon
																className="w-5 h-5 mt-2"
																aria-hidden="true"
															/>
														) : (
															<EyeSlashIcon
																className="w-5 h-5 mt-2"
																aria-hidden="true"
															/>
														)}
													</div>
												</Input>
											</div>
										</div>
									</div>

									<div className="text-center">
										<Button
											className="w-full text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700 dark:border-gray-700"
											type="submit"
											isLoading={resetPassWordLoading}
											disabled={resetPassWordLoading}
										>
											<span className="p-1.5 pad">SAVE</span>
										</Button>
									</div>
								</form>
							</div>
						</div>
					</div>
				)
			)}
		</>
	);
};

export default ResetPassword;
