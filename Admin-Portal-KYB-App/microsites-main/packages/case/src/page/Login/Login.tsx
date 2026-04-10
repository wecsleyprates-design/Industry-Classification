import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCustomToast, useSearchState } from "@/hooks";
import { setItem } from "@/lib/localStorage";
import { useLoginQuery } from "@/services/queries/auth.query";

import { LOCALSTORAGE, URL } from "@/constants";
import { Button } from "@/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/ui/form";
import { Input } from "@/ui/input";

// Define the login schema using Zod
const loginSchema = z.object({
	email: z.string().email({
		message: "Please enter a valid email address",
	}),
	password: z.string().min(6, {
		message: "Password must be at least 6 characters",
	}),
});

// Create a type for our form data based on the schema
type LoginFormData = z.infer<typeof loginSchema>;

const Login = () => {
	const form = useForm<LoginFormData>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});

	const [loading, setLoading] = useState<boolean>(false);
	const [isAdminLogin, setIsAdminLogin] = useState<boolean>(false);
	const [redirectTo] = useSearchState("redirectTo", "");
	const navigate = useNavigate();
	const { successToast, errorToast } = useCustomToast();
	const {
		data: loginData,
		error: loginError,
		mutateAsync: login,
	} = useLoginQuery();

	useEffect(() => {
		if (loginData) {
			if (
				loginData.data.is_email_verified !== undefined &&
				!loginData.data.is_email_verified
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
				setItem(
					LOCALSTORAGE.allPermissions,
					loginData.data.permissions.map(
						(permission: { code: string }) => permission.code,
					),
				);
				successToast(loginData.message);
				if (isAdminLogin) {
					navigate(redirectTo || URL.STANDALONE_CASES);
				} else {
					navigate(redirectTo || URL.CASES);
				}
			}
		}
	}, [loginData, redirectTo]);

	useEffect(() => {
		if (loginError != null) {
			setLoading(false);
			errorToast(loginError);
		}
	}, [loginError]);

	const onSubmit = async (data: LoginFormData) => {
		setLoading(true);
		const { email, password } = data;
		try {
			const loginResponse = await login({
				email,
				password,
				isAdminLogin,
			});

			if (loginResponse) {
				setItem("token", loginResponse.data.id_token);
				setItem("access_token", loginResponse.data.access_token);
				setItem("customerId", loginResponse.data.customer_details?.id);
				setItem("userId", loginResponse.data.user_details?.id);
				setItem("userDetails", loginResponse.data.user_details ?? "");
				setItem("permissions", loginResponse.data.permissions ?? "");
				setItem("subrole", loginResponse.data.subrole ?? "");
				setItem(
					LOCALSTORAGE.allPermissions,
					loginResponse.data.permissions.map(
						(p: { code: string }) => p.code,
					),
				);

				navigate(isAdminLogin ? URL.STANDALONE_CASES : URL.CASES);
			}
		} catch (err: any) {
			errorToast(err?.response?.data?.message || "Login failed");
		} finally {
			setLoading(false);
		}
	};

	return (
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
					<Form {...form}>
						<form
							onSubmit={form.handleSubmit(onSubmit)}
							className="px-4 py-5 space-y-6 sm:p-6"
						>
							<FormField
								control={form.control}
								name="email"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Email</FormLabel>
										<FormControl>
											<Input
												{...field}
												placeholder="Email address"
												className="w-full border border-slate-300 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4"
												autoComplete="username"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="password"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Password</FormLabel>
										<FormControl>
											<Input
												{...field}
												type="password"
												placeholder="Enter password"
												autoComplete="current-password"
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>

							<div className="flex items-center justify-between pt-4 mt-4 border-t">
								<label
									htmlFor="admin-login"
									className="text-sm font-medium text-gray-700 select-none"
								>
									Admin Login
								</label>

								<div
									onClick={() => {
										setIsAdminLogin(!isAdminLogin);
									}}
									className={`relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors ${
										isAdminLogin
											? "bg-blue-600"
											: "bg-gray-300"
									}`}
								>
									<span
										className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
											isAdminLogin
												? "translate-x-6"
												: "translate-x-1"
										}`}
									/>
								</div>
							</div>

							<div className="text-center">
								<Button
									type="submit"
									className="w-full"
									variant="default"
									disabled={loading}
								>
									<span className="p-1.5 text-sm font-bold text-white">
										{loading ? "Loading..." : "LOGIN"}
									</span>
								</Button>
							</div>
						</form>
					</Form>
				</div>
			</div>
		</div>
	);
};

export default Login;
