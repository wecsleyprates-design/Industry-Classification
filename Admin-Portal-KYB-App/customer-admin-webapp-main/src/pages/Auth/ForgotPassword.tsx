import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import { URL } from "constants/URL";
import Button from "@/components/Button";
import { Input } from "@/components/Input";
import useCustomToast from "@/hooks/useCustomToast";
import { forgotPasswordSchema } from "@/lib/validation";
import { useForgotPasswordQuery } from "@/services/queries/auth.query";
import { type ForgotPasswordBody } from "@/types/auth";

const ForgotPassword = () => {
	const [loading, setLoading] = useState<boolean>(false);
	const { successHandler, errorHandler } = useCustomToast();
	const navigate = useNavigate();

	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<ForgotPasswordBody>({
		resolver: yupResolver(forgotPasswordSchema),
	});

	const {
		mutateAsync: forgotPasswordAsync,
		data: forgotPasswordData,
		error: forgotPasswordError,
	} = useForgotPasswordQuery();

	useEffect(() => {
		if (forgotPasswordData) {
			setLoading(false);
			successHandler({
				message: forgotPasswordData.message,
			});
			navigate(URL.LOGIN);
		}
	}, [forgotPasswordData]);

	useEffect(() => {
		if (forgotPasswordError != null) {
			setLoading(false);
			errorHandler(forgotPasswordError);
		}
	}, [forgotPasswordError]);

	const onSubmit = async (data: any) => {
		setLoading(true);
		await forgotPasswordAsync(data);
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
							Reset Password
						</p>
					</div>
				</div>

				<div className="mt-10 sm:mx-auto sm:w-full sm:max-w-[480px] px-4 py-5 sm:p-6">
					<div className="px-4 py-5 overflow-hidden rounded-lg bg-white sm:p-6 shadow sm:rounded-lg">
						<button
							onClick={() => {
								navigate(URL.LOGIN);
							}}
							type="button"
							className="z-50 relative rounded-md bg-white text-black hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
						>
							<span className="absolute -inset-2.5" />
							<span className="sr-only">Close panel</span>
							<ChevronLeftIcon className="h-6 w-6" />
						</button>
						<form
							onSubmit={handleSubmit(onSubmit)}
							className="space-y-6 px-4 py-5 sm:p-6 sm:pt-0"
						>
							<div className="mt-6 leading-9 tracking-tight text-gray-900">
								<p className="font-bold text-[25px] sm:text-[25px] text-[#333]">
									Forgot password
								</p>
								<p className="mt-1 text-[15px] font-normal text-gray-400 leading-6">
									Please enter the registered email address you’d like your
									password reset information sent to
								</p>
							</div>
							<div>
								<div className="mt-2">
									<Input
										errors={errors}
										label="Email id"
										id="email"
										name="email"
										placeholder="Email address"
										register={register}
										className="w-full border border-slate-300 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4"
									/>
								</div>
							</div>

							<div className="text-center">
								<Button
									className="w-full text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700 dark:border-gray-700"
									type="submit"
									isLoading={loading}
								>
									<span className="p-1.5 pad text-sm text-white-600 font-bold">
										SEND
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

export default ForgotPassword;
