import React, { useEffect, useState } from "react";
import { type FieldNamesMarkedBoolean, useForm } from "react-hook-form";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import Button from "@/components/Button";
import { Input } from "@/components/Input";
import useCustomToast from "@/hooks/useCustomToast";
import { updatePasswordSchema } from "@/lib/validation";
import { useUpdatePasswordQuery } from "@/services/queries/auth.query";
import { type UpdatePassword } from "@/types/auth";

import ERROR_MSG from "@/constants/ErrorMessages";

type ShowPasswordType = "newPassword" | "confirmPassword" | "currentPassword";
interface Props {
	successHandler?: () => void;
}
const UpdatePasswordForm: React.FC<Props> = ({ successHandler = () => {} }) => {
	const { errorHandler, successHandler: apiSuccessHandler } = useCustomToast();
	const [showPassword, setShowPassword] = useState<
		FieldNamesMarkedBoolean<UpdatePassword>
	>({
		currentPassword: false,
		newPassword: false,
		confirmPassword: false,
	});

	const {
		register,
		handleSubmit,
		watch,
		clearErrors,
		setError,
		formState: { errors },
	} = useForm<UpdatePassword>({ resolver: yupResolver(updatePasswordSchema) });

	const {
		mutateAsync: updatePasswordAsync,
		data: updatePasswordData,
		error: updatePasswordError,
		isPending: isLoading,
	} = useUpdatePasswordQuery();

	const toggleShowPassword = (field: ShowPasswordType) => {
		setShowPassword({ ...showPassword, [field]: !showPassword[field] });
	};

	const onSubmit = async (data: UpdatePassword) => {
		await updatePasswordAsync({
			new_password: data.confirmPassword,
			old_password: data.currentPassword,
		});
	};

	useEffect(() => {
		if (updatePasswordData?.status === "success") {
			apiSuccessHandler({
				message: updatePasswordData?.message,
			});
			successHandler();
		}
	}, [updatePasswordData]);

	useEffect(() => {
		if (updatePasswordError) {
			errorHandler(updatePasswordError);
		}
	}, [updatePasswordError]);

	useEffect(() => {
		const confirmPassword = watch("confirmPassword");
		const newPassword = watch("newPassword");
		const oldPassword = watch("currentPassword");

		if (confirmPassword !== "" && newPassword !== confirmPassword) {
			setError("confirmPassword", {
				type: "custom",
				message: ERROR_MSG.PASSWORD_NOT_MATCHED,
			});
		} else {
			clearErrors("confirmPassword");
		}

		if (newPassword !== "" && newPassword === oldPassword) {
			setError("newPassword", {
				type: "custom",
				message: ERROR_MSG.PASSWORD_NOT_MATCHED,
			});
		} else {
			clearErrors("newPassword");
		}
	}, [
		watch("newPassword"),
		watch("confirmPassword"),
		watch("currentPassword"),
	]);

	return (
		<div className="px-4 pt-2 pb-4 overflow-hidden bg-white rounded-lg min-w-fit sm:p-6 sm:rounded-lg">
			<form
				onSubmit={handleSubmit(onSubmit)}
				className="px-4 py-5 space-y-6 sm:space-y-3 sm:p-6"
			>
				<div className="leading-9 tracking-tight text-gray-900">
					<p className="font-bold text-[25px] sm:text-[25px] text-[#333]">
						Update password
					</p>
					<p className="mt-1 text-[15px] font-normal text-gray-400">
						Please enter your new password
					</p>
				</div>
				<div className="mt-2">
					<Input
						errors={errors}
						label="Current password"
						id="currentPassword"
						name="currentPassword"
						placeholder="Enter current password"
						defaultValue={""}
						type={showPassword.currentPassword ? "text" : "password"}
						register={register}
						className="w-full border border-slate-300 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4"
					>
						<div
							onClick={() => {
								toggleShowPassword("currentPassword");
							}}
							className="absolute inset-y-0 right-0 flex items-center pr-3"
						>
							{showPassword.currentPassword ? (
								<EyeIcon className="w-5 h-5 mt-2" aria-hidden="true" />
							) : (
								<EyeSlashIcon className="w-5 h-5 mt-2" aria-hidden="true" />
							)}
						</div>
					</Input>
				</div>
				<div className="mt-2">
					<Input
						errors={errors}
						label="New password"
						id="newPassword"
						name="newPassword"
						defaultValue={""}
						placeholder="Enter new password"
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
								<EyeIcon className="w-5 h-5 mt-2" aria-hidden="true" />
							) : (
								<EyeSlashIcon className="w-5 h-5 mt-2" aria-hidden="true" />
							)}
						</div>
					</Input>
				</div>
				<div className="mt-2">
					<Input
						errors={errors}
						label="Confirm password"
						id="confirmPassword"
						name="confirmPassword"
						placeholder="Enter confirm password"
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
								<EyeIcon className="w-5 h-5 mt-2" aria-hidden="true" />
							) : (
								<EyeSlashIcon className="w-5 h-5 mt-2" aria-hidden="true" />
							)}
						</div>
					</Input>
				</div>

				<div className="text-center">
					<Button
						className="w-full text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700 dark:border-gray-700"
						type="submit"
						isLoading={isLoading}
					>
						<div className="flex items-center justify-center gap-1">
							<span className="p-1.5 pad">Save</span>
						</div>
					</Button>
				</div>
			</form>
		</div>
	);
};

export default UpdatePasswordForm;
