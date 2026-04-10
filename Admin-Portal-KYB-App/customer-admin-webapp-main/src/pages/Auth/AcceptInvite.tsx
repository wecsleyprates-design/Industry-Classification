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
import useCustomToast from "@/hooks/useCustomToast";
import { acceptInviteSchema } from "@/lib/validation";
import { useAcceptInviteQuery } from "@/services/queries/auth.query";
import { type AcceptPassword } from "@/types/auth";

const useQuery = () => {
	return new URLSearchParams(useLocation().search);
};

type ShowPasswordType = "password" | "confirmPassword";

const AcceptInvite = () => {
	const queryParams = useQuery();
	const slug = queryParams.get("token");
	const [loading, setLoading] = useState<boolean>(false);
	const navigate = useNavigate();
	const [showPassword, setShowPassword] = useState<
		FieldNamesMarkedBoolean<AcceptPassword>
	>({
		password: false,
		confirmPassword: false,
	});
	const [token, setToken] = useState("");
	const { errorHandler, successHandler } = useCustomToast();
	const toggleShowPassword = (field: ShowPasswordType) => {
		setShowPassword({ ...showPassword, [field]: !showPassword[field] });
	};
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<AcceptPassword>({
		resolver: yupResolver(acceptInviteSchema),
	});

	useEffect(() => {
		if (slug) {
			(async () => {
				setToken(slug);
			})().catch((err) => {
				console.error(err);
			});
		}
	}, [slug]);

	const {
		mutateAsync: acceptInvite,
		error: acceptInviteError,
		data: acceptInviteData,
	} = useAcceptInviteQuery();

	useEffect(() => {
		if (acceptInviteError != null) {
			errorHandler(acceptInviteError);
			setLoading(false);
		}
	}, [acceptInviteError]);

	useEffect(() => {
		if (acceptInviteData) {
			setLoading(false);
			successHandler({
				message: acceptInviteData.message,
			});
			navigate(URL.LOGIN);
		}
	}, [acceptInviteData]);

	const onSetPassword: SubmitHandler<AcceptPassword> = async (data) => {
		setLoading(true);
		await acceptInvite({
			data: { password: data.confirmPassword },
			token,
		});
	};

	return (
		<>
			<div className="bg-slate-50 flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
				<div className="sm:mx-auto sm:w-full sm:max-w-md">
					<img
						className="mx-auto h-10 w-auto"
						src="/logo.svg"
						alt="Your Company"
					/>
					<div className="mt-6 text-center leading-9 tracking-tight text-gray-900">
						<p className="font-bold text-[25px] sm:text-[25px] text-[#333]">
							Log into your account
						</p>
					</div>
				</div>

				<div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px] px-4 py-5 sm:p-6">
					<div className="px-4 py-5 overflow-hidden rounded-lg bg-white sm:p-6 shadow sm:rounded-lg">
						<form
							onSubmit={handleSubmit(onSetPassword)}
							className="space-y-6 px-4 py-5 sm:p-6"
						>
							<div className="mt-6 leading-9 tracking-tight text-gray-900">
								<p className="font-bold text-[25px] sm:text-[25px] text-[#333]">
									Set password
								</p>
								<p className="mt-1 text-[15px] font-normal text-gray-400">
									Please enter your password
								</p>
							</div>
							<div>
								<div className="mt-2">
									<div className="mt-2">
										<Input
											errors={errors}
											label="Password"
											id="password"
											name="password"
											placeholder="Enter password"
											type={showPassword.password ? "text" : "password"}
											register={register}
											className="w-full border border-slate-300 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4"
											autoComplete="new-password"
										>
											<div
												onClick={() => {
													toggleShowPassword("password");
												}}
												className="absolute inset-y-0 right-0 flex items-center pr-3"
											>
												{showPassword.password ? (
													<EyeIcon
														className="h-5 w-5 mt-2"
														aria-hidden="true"
													/>
												) : (
													<EyeSlashIcon
														className="h-5 w-5 mt-2"
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
											type={showPassword.confirmPassword ? "text" : "password"}
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
														className="h-5 w-5 mt-2"
														aria-hidden="true"
													/>
												) : (
													<EyeSlashIcon
														className="h-5 w-5 mt-2"
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
									isLoading={loading}
								>
									<span className="p-1.5 pad">SAVE</span>
								</Button>
							</div>
						</form>
					</div>
				</div>
			</div>
		</>
	);
};

export default AcceptInvite;
