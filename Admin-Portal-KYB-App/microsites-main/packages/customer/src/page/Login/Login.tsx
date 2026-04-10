import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useCustomToast } from "@/hooks";
import { setItem } from "@/lib/localStorage";
import { usePostCustomerSignIn } from "@/services/queries/auth.query";

import { URL } from "@/constants";
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

export const Login = () => {
	const form = useForm<LoginFormData>({
		resolver: zodResolver(loginSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});
	const [loading, setLoading] = useState<boolean>(false);

	const navigate = useNavigate();
	const { successToast, errorToast } = useCustomToast();

	const {
		mutateAsync: loginApi,
		data: loginData,
		error: loginError,
	} = usePostCustomerSignIn();

	useEffect(() => {
		if (loginData) {
			if (
				loginData.data.user_details?.is_email_verified !== undefined &&
				!loginData.data.user_details?.is_email_verified
			) {
				setLoading(false);
				errorToast(loginData.message);
				navigate(URL.LOGIN);
			} else {
				setItem("token", loginData.data.id_token);
				setItem("access_token", loginData.data.access_token);
				setItem(
					"customerId",
					(loginData as any).data?.customer_details?.id ?? "",
				);
				setItem("userId", loginData.data.user_details?.id);
				setItem("userDetails", loginData.data.user_details ?? "");
				setItem("permissions", loginData.data.permissions ?? "");

				successToast(loginData.message);
				navigate(URL.CUSTOMERS);
			}
		}
	}, [loginData]);

	useEffect(() => {
		if (loginError != null) {
			setLoading(false);
			errorToast(loginError);
		}
	}, [loginError]);

	const onSubmit = async (data: LoginFormData) => {
		setLoading(true);
		await loginApi(data);
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

							<div className="text-center">
								<Button
									type="submit"
									className="w-full"
									variant="default"
									disabled={loading}
								>
									<span className="p-1.5 pad text-sm text-white-700 font-bold">
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
