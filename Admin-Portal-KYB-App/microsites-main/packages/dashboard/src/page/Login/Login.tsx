import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import { URL } from "constants/URL";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { useCustomToast } from "@/hooks/useCustomToast";
import { setItem } from "@/lib/localStorage";
import { loginSchema } from "@/lib/validation";
import { useLoginQuery } from "@/services/queries/auth.query";

const Login = () => {
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<any>({ resolver: yupResolver(loginSchema) });
	const [loading, setLoading] = useState<boolean>(false);
	const [showPassword, setShowPassword] = useState(false);
	const toggleShowPassword = () => {
		setShowPassword(!showPassword);
	};

	const navigate = useNavigate();
	const { successToast, errorToast } = useCustomToast();
	const {
		mutateAsync: loginApi,
		data: loginData,
		error: loginError,
	} = useLoginQuery();

	useEffect(() => {
		if (loginData) {
			if (
				loginData.data.user_details?.is_email_verified !== undefined &&
				!loginData.data.user_details.is_email_verified
			) {
				setLoading(false);
				errorToast(loginData.message);
				navigate(URL.LOGIN);
			} else {
				setItem("token", loginData.data.id_token);
				setItem("access_token", loginData.data.access_token);
				setItem("customerId", loginData.data.customer_details?.id);
				setItem("userId", loginData.data.user_details?.id);
				setItem("userDetails", loginData.data.user_details ?? "");
				setItem("permissions", loginData.data.permissions ?? "");
				setItem("subrole", loginData.data.subrole ?? "");

				successToast(loginData.message);
				navigate(`${URL.HOME}`);
			}
		}
	}, [loginData]);

	useEffect(() => {
		if (loginError != null) {
			setLoading(false);
			errorToast(loginError);
		}
	}, [loginError]);

	const onSubmit = async (data: any) => {
		setLoading(true);
		await loginApi(data);
	};

	return (
		<>
			<div className="bg-[#F9FAFB] flex min-h-full flex-1 flex-col justify-center py-12 sm:px-6 lg:px-8">
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
							onSubmit={handleSubmit(onSubmit)}
							className="px-4 py-5 space-y-6 sm:p-6"
						>
							<div>
								<div className="mt-2">
									<Input
										errors={errors}
										label="Email"
										id="email"
										name="email"
										placeholder="Email address"
										register={register}
										className="w-full border border-slate-300 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4"
										autoComplete="username"
									/>
								</div>
							</div>

							<div>
								<div className="mt-2">
									<Input
										errors={errors}
										label="Password"
										id="password"
										name="password"
										placeholder="Enter password"
										type={showPassword ? "text" : "password"}
										register={register}
										className="w-full border border-slate-300 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4"
										autoComplete="current-password"
									>
										<div
											onClick={toggleShowPassword}
											className="absolute inset-y-0 right-0 flex items-center pr-3"
										>
											{showPassword ? (
												<EyeIcon className="w-5 h-5 mt-2" aria-hidden="true" />
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

							<div className="text-center">
								<Button
									className="h-12 w-full text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700 dark:border-gray-700"
									type="submit"
									isLoading={loading}
								>
									<span className="p-1.5 pad text-sm text-white-700 font-bold">
										LOGIN
									</span>
								</Button>
							</div>
						</form>
					</div>
				</div>
			</div>
		</>
	);
};

export default Login;
