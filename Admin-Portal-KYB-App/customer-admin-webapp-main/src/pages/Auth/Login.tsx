import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { datadogRum } from "@datadog/browser-rum";
import {
	EyeIcon,
	EyeSlashIcon,
	LockClosedIcon,
} from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import { isAxiosError } from "axios";
import { URL } from "constants/URL";
import { useFlags } from "launchdarkly-react-client-sdk";
import Button from "@/components/Button";
import { Input } from "@/components/Input";
import SSOModal from "@/components/Modal/SSOModal";
import useCustomToast from "@/hooks/useCustomToast";
import { scheduleProactiveRefresh } from "@/lib/api";
import { defaultHomePage, getAllPermissions } from "@/lib/helper";
import { setItem } from "@/lib/localStorage";
import { loginSchema } from "@/lib/validation";
import {
	useCustomerAccessQuery,
	useGetUserCustomers,
	useLoginQuery,
	useSamlLoginQuery,
} from "@/services/queries/auth.query";
import useAuthStore from "@/store/useAuthStore";
import { type CustomerLogin, type LoginResponse } from "@/types/auth";

import FEATURE_FLAGES from "@/constants/FeatureFlags";
import { MODULES } from "@/constants/Modules";

const Login = () => {
	const {
		register: registerLogin,
		handleSubmit: handleLoginSubmit,
		formState: { errors: loginErrors },
	} = useForm<CustomerLogin>({
		resolver: yupResolver(loginSchema),
	});
	const [loading, setLoading] = useState<boolean>(false);
	const [showPassword, setShowPassword] = useState(false);
	const [ssoError, setSsoError] = useState("");
	const [isSSOModalOpen, setIsSSOModalOpen] = useState(false);
	const toggleShowPassword = () => {
		setShowPassword(!showPassword);
	};
	const { setIsAuthenticated } = useAuthStore((state) => state);
	const flags = useFlags();
	const navigate = useNavigate();
	const { successHandler, errorHandler } = useCustomToast();
	const {
		mutateAsync: loginApi,
		data: loginData,
		error: loginError,
	} = useLoginQuery();
	const { mutateAsync: getCustomerUsers } = useGetUserCustomers();

	const { mutateAsync: getCustomerAccess } = useCustomerAccessQuery();

	const handleLogin = async (loginData: LoginResponse) => {
		if (
			loginData.data.is_email_verified !== undefined &&
			!loginData.data.is_email_verified
		) {
			setLoading(false);
			errorHandler({ message: loginData.message });
			navigate(URL.LOGIN);
		} else {
			successHandler({
				message: loginData.message,
			});
			setItem("token", loginData.data.id_token);
			scheduleProactiveRefresh();
			const response = await getCustomerUsers(
				loginData?.data?.user_details?.id,
			);

			// if user is associated with only one customer,
			// then we can directly login to that customer.
			if (response.data.length === 1) {
				const customerId = response.data[0].id;
				const accessDataResponse = await getCustomerAccess({
					customer_id: customerId,
				});

				const login = accessDataResponse.data;

				const permissions = getAllPermissions(
					login.permissions,
					Object.values(MODULES),
				);
				setIsAuthenticated({
					access_token: login.access_token,
					id_token: login.id_token,
					user_details: login.user_details,
					refresh_token: login.refresh_token,
					customer_details: {
						id: login.customer_details?.id ?? "",
						name: login.customer_details?.name ?? "",
						customer_type: login.customer_details?.customer_type ?? "",
					},
					permissions,
					subrole: login.subrole,
					all_permissions: login.permissions.map((item) => item.code as string),
				});

				setLoading(false);
				navigate(defaultHomePage());
			} else if (response.data.length > 1) {
				setIsAuthenticated({
					access_token: loginData.data.access_token,
					id_token: loginData.data.id_token,
					user_details: loginData.data.user_details,
					refresh_token: loginData.data.refresh_token,
					customer_details: {
						id: "",
						name: "",
						customer_type: "",
					},
					subrole: {
						code: "",
						id: "",
						label: "",
					},
					permissions: {},
					all_permissions: [],
				});
				setLoading(false);
				navigate(URL.CUSTOMER_SELECTION);
			}
			// Set user information in Datadog RUM session
			datadogRum.setUser({
				id: loginData.data.user_details.id,
				email: loginData.data.user_details.email,
			});
		}
	};

	useEffect(() => {
		if (loginData) {
			handleLogin(loginData).catch((error) => {
				errorHandler(error);
			});
		}
	}, [loginData]);

	useEffect(() => {
		if (loginError != null) {
			setLoading(false);
			errorHandler(loginError);
		}
	}, [loginError]);

	const onSubmit = async (data: CustomerLogin) => {
		setLoading(true);
		await loginApi(data);
	};

	const {
		mutateAsync: samlLoginApi,
		data: samlLoginData,
		error: samlLoginError,
	} = useSamlLoginQuery();

	const handleSsoLogin = async (email: string) => {
		await samlLoginApi(email);
	};

	useEffect(() => {
		if (
			samlLoginData &&
			samlLoginData.status === "success" &&
			samlLoginData.data &&
			"redirect_url" in samlLoginData.data
		) {
			successHandler({
				message: "SSO login successful. Redirecting...",
			});
			window.location.href = samlLoginData.data.redirect_url;
		}
	}, [samlLoginData]);

	useEffect(() => {
		if (samlLoginError && isAxiosError(samlLoginError)) {
			setSsoError(samlLoginError.response?.data?.message || "SSO login failed");
		}
	}, [samlLoginError]);

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
						{/* SSO Button - Above the login form */}
						{flags[FEATURE_FLAGES.FOTC_1_ENABLE_SAML_SSO] && (
							<div className="px-4 pb-5 sm:px-6">
								<Button
									type="button"
									onClick={() => {
										setIsSSOModalOpen(true);
									}}
									className="h-12 w-full text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 flex items-center justify-center gap-2"
								>
									<LockClosedIcon className="w-5 h-5" />
									<span className="font-medium text-base">
										Continue with SAML SSO
									</span>
								</Button>
							</div>
						)}

						{/* OR Divider */}
						{flags[FEATURE_FLAGES.FOTC_1_ENABLE_SAML_SSO] && (
							<div className="relative my-6">
								<div className="absolute inset-0 flex items-center">
									<div className="w-full border-t border-gray-300" />
								</div>
								<div className="relative flex justify-center text-sm">
									<span className="px-2 text-gray-500 bg-white">OR</span>
								</div>
							</div>
						)}

						<form
							onSubmit={handleLoginSubmit(onSubmit)}
							className="px-4 py-5 space-y-6 sm:p-6"
						>
							<div>
								<div className="mt-2">
									<Input
										errors={loginErrors}
										label="Email"
										id="email"
										name="email"
										placeholder="Email address"
										register={registerLogin}
										className="w-full border border-slate-300 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4"
										autoComplete="username"
									/>
								</div>
							</div>

							<div>
								<div className="mt-2">
									<Input
										errors={loginErrors}
										label="Password"
										id="password"
										name="password"
										placeholder="Enter password"
										type={showPassword ? "text" : "password"}
										register={registerLogin}
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
								<div className="flex items-center justify-between">
									<div className="flex items-center"></div>
									<div className="text-sm leading-6">
										<a
											onClick={() => {
												navigate(URL.FORGOT_PASSWORD);
											}}
											className="font-normal text-[#266EF1] cursor-pointer hover:text-indigo-500"
										>
											Forgot password?
										</a>
									</div>
								</div>
							</div>

							<div className="text-center">
								<Button
									className="h-12 w-full text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700 dark:border-gray-700"
									type="submit"
									isLoading={loading}
								>
									<span className="p-1.5 pad text-sm text-white-700 font-bold">
										Sign In
									</span>
								</Button>
							</div>
						</form>
					</div>
				</div>
			</div>

			{/* SSO Modal */}
			<SSOModal
				isOpen={isSSOModalOpen}
				onClose={() => {
					setIsSSOModalOpen(false);
				}}
				onSubmit={handleSsoLogin}
				ssoError={ssoError}
				setSsoError={setSsoError}
			/>
		</>
	);
};

export default Login;
