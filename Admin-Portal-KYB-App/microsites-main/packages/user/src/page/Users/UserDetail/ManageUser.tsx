import { type FC, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { ChevronLeftIcon, Square2StackIcon } from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import { DropdownSelect, Input, PhoneNumberInput } from "@/components/Input";
import WarningModal from "@/components/Modal/WarningModal";
import { useCustomToast } from "@/hooks";
import { getItem } from "@/lib/localStorage";
import { cn } from "@/lib/utils";
import { manageUserSchema } from "@/lib/validation";
import { useGetRolesQuery } from "@/services/queries/user.query";
import { type ManageUserFormData, type User } from "@/types/User";

import { LOCALSTORAGE } from "@/constants";
import { Button } from "@/ui/button";
import { Card, CardContent } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

const SkeletonLoader = () => (
	<>
		<div className="flex items-center gap-2 h-[76px] px-6 border-b bg-white border-gray-200">
			<Button variant="outline" size="icon" className="rounded-lg">
				<Skeleton className="h-5 w-5" />
			</Button>
			<span className="text-lg font-semibold text-gray-800">
				<Skeleton className="h-6 w-28" />
			</span>
		</div>
		<Card className="m-6 overflow-visible">
			<CardContent className="p-0 overflow-visible">
				<div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
					<Skeleton className="h-6 w-32 col-span-2" />
					<div className="space-y-2">
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-11 w-full" />
					</div>
					<div className="space-y-2">
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-11 w-full" />
					</div>
					<div className="space-y-2">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-11 w-full" />
					</div>
					<div className="space-y-2">
						<Skeleton className="h-4 w-28" />
						<Skeleton className="h-11 w-full" />
					</div>
					<div className="border-t border-gray-200 pt-2 col-span-2" />
					<Skeleton className="h-6 w-32 col-span-2" />
					<div className="space-y-2">
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-11 w-full" />
					</div>
					<div className="space-y-2">
						<Skeleton className="h-4 w-20" />
						<Skeleton className="h-11 w-full" />
					</div>
				</div>
				<div className="px-6 py-4 w-full col-span-2 flex justify-between border-t border-gray-200">
					<Skeleton className="h-10 w-32" />
					<div className="flex gap-2">
						<Skeleton className="h-10 w-20" />
						<Skeleton className="h-10 w-20" />
					</div>
				</div>
			</CardContent>
		</Card>
	</>
);

type ManageUserProps = {
	type: "edit" | "create";
	user?: User | null;
	handleSubmitCallback: (data?: Partial<ManageUserFormData>) => Promise<void>;
	handleResendUserInvite?: () => Promise<void>;
	platformType?: "customer" | "admin";
	customerId: string;
};

const ManageUser: FC<ManageUserProps> = ({
	user,
	type,
	handleSubmitCallback,
	handleResendUserInvite,
	platformType,
	customerId,
}) => {
	const [isOpen, setIsOpen] = useState(false);
	const navigate = useNavigate();
	const customerName = getItem<string>(LOCALSTORAGE.customerName) ?? "";
	const { successToast } = useCustomToast();
	const {
		register,
		control,
		formState: { errors, isDirty, isValid },
		reset,
		setValue,
		handleSubmit,
		trigger,
	} = useForm({
		defaultValues: {
			first_name: "",
			last_name: "",
			email: "",
			phone_number: "",
			role: {},
			user_id: null,
			customer: "",
		},
		resolver: yupResolver(manageUserSchema),
		mode: "onChange", // Enable validation on change for isValid to work properly
	});
	const { data: rolesData, isLoading: isLoadingRoles } = useGetRolesQuery(
		customerId ?? "",
	);

	const options = useMemo(
		() =>
			rolesData?.data?.map((role) => ({
				id: role.id,
				label: role.label,
				value: role.code,
				description: role.description ?? "",
			})),
		[rolesData],
	);

	const isSaveEnabled = type === "create" ? isValid : isDirty;

	const isLoading = type === "edit" && (!user || isLoadingRoles);

	const isOwner = type === "edit" && user?.subrole?.code === "owner";

	// Track if we've already initialized the form to prevent infinite loops
	const hasInitialized = useRef(false);
	const prevUser = useRef(user);

	useEffect(() => {
		// Only reset if user actually changed or we haven't initialized yet
		const userChanged = user?.id !== prevUser.current?.id;

		if (user && type === "edit" && (userChanged || !hasInitialized.current)) {
			// Wait for options to load before setting role
			const currentRole = options?.find(
				(role) => role.value === user.subrole.code,
			) ?? {
				id: user.subrole.id,
				label: user.subrole.label,
				value: user.subrole.code,
				description: user.subrole.description,
			};
			// Use reset to set default values so isDirty works correctly
			reset({
				first_name: user.first_name,
				last_name: user.last_name,
				email: user.email,
				phone_number: user.mobile ?? "",
				user_id: user.id,
				customer: user?.company_details?.name ?? customerName,
				role: currentRole
					? {
							id: currentRole.id,
							label: currentRole.label,
							value: currentRole.value,
							description: currentRole.description,
						}
					: {},
			});
			hasInitialized.current = true;
			prevUser.current = user;
		} else if (
			platformType === "admin" &&
			type === "create" &&
			!hasInitialized.current
		) {
			// Set customer value for create mode if user data is available
			setValue("customer", user?.company_details?.name ?? customerName);
			hasInitialized.current = true;
		}
	}, [user?.id, type, platformType, customerName]);

	const onSubmit = async (data: ManageUserFormData) => {
		// Prevent submission if user is owner
		if (isOwner) {
			return;
		}
		if (type === "edit") {
			const payload = {
				...(user?.first_name !== data.first_name && {
					first_name: data.first_name,
				}),
				...(user?.last_name !== data.last_name && {
					last_name: data.last_name,
				}),
				...(user?.email !== data.email && { email: data.email }),
				...(user?.mobile !== data.phone_number && {
					mobile: data.phone_number,
				}),
				...(user?.subrole.code !== data?.role?.value && {
					subrole: {
						label: data.role?.label,
						code: data.role?.value,
						id: data.role?.id,
					},
				}),
			};
			await handleSubmitCallback(payload);
			successToast("User updated successfully");
		} else {
			const payload = {
				first_name: data.first_name,
				last_name: data.last_name,
				email: data.email,
				...(data.phone_number &&
					data.phone_number.trim() !== "" && {
						mobile: data.phone_number,
					}),
				subrole: {
					label: data.role?.label,
					code: data.role?.value,
					id: data.role?.id,
				},
			};
			await handleSubmitCallback(payload);
			navigate(-1);
		}
	};

	// to deactivate or activate user we use same patch api but with just status as payload
	const toggleUserStatusHandler = async (action: "ACTIVE" | "INACTIVE") => {
		await handleSubmitCallback({
			status: action,
		});
		successToast(
			`User ${action === "ACTIVE" ? "activated" : "deactivated"} successfully`,
		);
	};

	if (isLoading) {
		return <SkeletonLoader />;
	}

	return (
		<>
			<div className="flex items-center gap-2 h-[76px] px-6 border-b bg-white border-gray-200">
				<Button
					variant="outline"
					size="icon"
					className="rounded-lg"
					onClick={() => {
						navigate(-1);
					}}
				>
					<ChevronLeftIcon strokeWidth={2} />
				</Button>

				<span className="text-lg font-semibold text-gray-800">Manage User</span>
			</div>
			<Card className="m-6 overflow-visible">
				<CardContent className="p-0 overflow-visible">
					<form onSubmit={handleSubmit(onSubmit)}>
						<div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 pt-5">
							<h3 className="text-lg font-semibold text-[#1F2937] col-span-2">
								General Details
							</h3>

							<Input
								className="w-full h-[44px]"
								labelClassName="text-sm font-normal text-[#1F2937]"
								label="First Name*"
								name="first_name"
								register={register}
								disabled={isOwner}
								errors={errors}
							/>
							<Input
								className="w-full h-[44px]"
								labelClassName="text-sm font-normal text-[#1F2937]"
								label="Last Name*"
								name="last_name"
								register={register}
								disabled={isOwner}
								errors={errors}
							/>
							<Input
								className="w-full h-[44px]"
								labelClassName="text-sm font-normal text-[#1F2937]"
								label="Email Address*"
								name="email"
								register={register}
								errors={errors}
								disabled={
									isOwner ||
									(type === "edit" &&
										user?.status !== "INVITED" &&
										user?.status !== "INVITE_EXPIRED")
								}
							/>
							<PhoneNumberInput
								label="Phone Number"
								control={control}
								name="phone_number"
								defaultValue={""}
								error={errors.phone_number?.message?.toString() ?? ""}
								placeholder="Enter phone number"
								disabled={isOwner}
							/>
							{platformType === "admin" && (
								<Input
									className="w-full h-[44px]"
									labelClassName="text-sm font-normal text-[#1F2937]"
									label="Customer"
									name="customer"
									register={register}
									disabled
									readOnly
								/>
							)}
							<div className="border-t border-gray-200 pt-1 col-span-2" />

							<h3 className="text-lg font-semibold text-[#1F2937] col-span-2">
								Additional Details
							</h3>

							<Controller
								name="role"
								control={control}
								render={({ field }) => (
									<DropdownSelect
										label="Role*"
										name="role"
										options={options ?? []}
										value={field.value}
										onChange={field.onChange}
										error={errors.role?.message?.toString() ?? ""}
										placeholder="Select Role"
										disabled={isOwner}
									/>
								)}
							/>

							{type === "edit" && (
								<Input
									className="w-full h-[44px]"
									labelClassName="text-sm font-normal text-[#1F2937]"
									label="User ID"
									name="user_id"
									register={register}
									disabled={type === "edit"}
									icon={
										<Square2StackIcon
											className="w-6 h-6 cursor-pointer"
											onClick={() => {
												void navigator.clipboard.writeText(user?.id ?? "");
												successToast("User ID copied to clipboard");
											}}
										/>
									}
									iconClass="right-3 z-50 top-3 cursor-pointer"
								/>
							)}
						</div>
						<div
							className={cn(
								"px-6 py-4 w-full col-span-2 flex border-t border-gray-200",
								type === "edit" ? "justify-between" : "justify-end",
							)}
						>
							{type === "edit" &&
								(user?.status === "INVITED" ||
								user?.status === "INVITE_EXPIRED" ? (
									<Button
										variant="default"
										type="button"
										onClick={async () => {
											await handleResendUserInvite?.();
										}}
									>
										Resend Invite
									</Button>
								) : (
									<Button
										variant="outline"
										color="danger"
										className={cn(
											user?.status === "INACTIVE"
												? "text-green-600"
												: "text-red-600",
										)}
										type="button"
										onClick={() => {
											setIsOpen(true);
										}}
									>
										{user?.status === "INACTIVE"
											? "Activate User"
											: "Deactivate User"}
									</Button>
								))}

							<div className="flex gap-2">
								<Button
									variant="outline"
									type="button"
									onClick={() => {
										navigate(-1);
									}}
								>
									Cancel
								</Button>
								<Button
									variant="default"
									type="button"
									disabled={isOwner}
									className={cn(
										!isSaveEnabled &&
											!isOwner &&
											"opacity-50 cursor-not-allowed",
									)}
									onClick={async () => {
										// Trigger validation for all fields
										const isFormValid = await trigger();
										// Only proceed if validation passes and form is in valid state
										if (isFormValid && isSaveEnabled) {
											void handleSubmit(onSubmit)();
										}
									}}
								>
									Save
								</Button>
							</div>
						</div>
					</form>
				</CardContent>
			</Card>

			<WarningModal
				isOpen={isOpen}
				onClose={() => {
					setIsOpen(false);
				}}
				onSuccess={async () => {
					await toggleUserStatusHandler(
						user?.status === "INACTIVE" ? "ACTIVE" : "INACTIVE",
					);
				}}
				title={` ${
					user?.status === "INACTIVE" ? "Activate" : "Deactivate"
				} user`}
				description={`Are you sure you want to ${
					user?.status === "INACTIVE" ? "activate" : "deactivate"
				} this user?`}
				buttonText={user?.status === "INACTIVE" ? "Activate" : "Deactivate"}
				type={user?.status === "INACTIVE" ? "success" : "danger"}
			/>
		</>
	);
};

export default ManageUser;
