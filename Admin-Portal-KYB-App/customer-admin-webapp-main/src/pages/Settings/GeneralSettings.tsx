import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate } from "react-router";
import {
	InformationCircleIcon,
	Square2StackIcon,
} from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import { toast } from "sonner";
import { Input } from "@/components/Input";
import PhoneNumber from "@/components/PhoneInput/PhoneNumber";
import { ReactCustomTooltip } from "@/components/Tooltip";
import { getItem } from "@/lib/localStorage";
import { settingsSchema } from "@/lib/validation";
import useAuthStore from "@/store/useAuthStore";
import { type ILoginResponseUserDetails } from "@/types/auth";
import UpdatePasswordModal from "./UpdatePasswordModal";

import { MODULES } from "@/constants/Modules";
import { URL } from "@/constants/URL";

const GeneralSettings = () => {
	const permissions = useAuthStore((state) => state.permissions);

	const { register, reset, control, getValues } = useForm({
		resolver: yupResolver(settingsSchema),
	});

	const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
	const [userDetails] = useState<ILoginResponseUserDetails | null>(
		getItem("userDetails"),
	);

	useEffect(() => {
		if (userDetails) {
			const customerId = getItem<string>("customerId");
			const userId = getItem<string>("userId");
			const subrole = getItem<{ label: string }>("subrole");
			const customerName = getItem<string>("customerName");

			reset({
				name: `${userDetails.first_name ?? ""} ${userDetails.last_name ?? ""}`,
				email: userDetails.email || undefined,
				customerId: customerId ?? "",
				userId: userId ?? "__",
				role: subrole?.label ?? "__",
				businessName: customerName ?? "__",
			});
		}
	}, [userDetails, reset]);

	// Copy handler
	const handleCopy = async (value: string, msg: string = "Copied") => {
		try {
			await navigator.clipboard.writeText(value);
			toast.success(msg);
		} catch (err) {
			toast.error("Failed to copy");
		}
	};

	return permissions[MODULES.SETTINGS]?.read ? (
		<>
			<div className="flex flex-col w-full border rounded-2xl bg-white p-6 mb-8">
				<div className="font-semibold text-[#1F2937] text-[16px] leading-[24px] mb-1">
					Personal Settings
				</div>
				<div className="text-gray-500 text-sm mb-6 mt-3">
					Manage your personal accounting settings, including changing your
					password.
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
					<Input
						name="name"
						label="Name"
						disabled
						register={register}
						className="w-full border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] py-2.5 px-4 bg-gray-50 disabled:text-[#6B7280]"
						labelClassName="text-[12px] font-medium text-[#6B7280] leading-[18px] mb-1.5"
					/>

					<Input
						name="email"
						label="Email Address"
						disabled
						isRequired
						register={register}
						className="w-full border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] py-2.5 px-4 bg-gray-50 disabled:text-[#6B7280]"
						labelClassName="text-[12px] font-medium text-[#6B7280] leading-[18px] mb-1.5"
					/>

					<Input
						name="password"
						label="Password"
						disabled
						value="**********************"
						register={register}
						className="w-full border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] py-2.5 px-4 bg-gray-50 relative disabled:text-[#6B7280]"
						labelClassName="text-[12px] font-medium text-[#6B7280] leading-[10px] mb-1.5"
					>
						{permissions[MODULES.SETTINGS]?.write && (
							<div className="absolute top-2.5 right-4">
								<p
									onClick={() => {
										setIsPasswordModalOpen(true);
									}}
									className="text-sm font-medium text-blue-600 cursor-pointer hover:text-blue-400"
								>
									Update
								</p>
							</div>
						)}
					</Input>

					<Input
						name="role"
						label="Role"
						disabled
						register={register}
						className="w-full border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] py-2.5 px-4 bg-gray-50 disabled:text-[#6B7280]"
						labelClassName="text-[12px] font-medium text-[#6B7280] leading-[10px] mb-1.5"
					/>

					<Input
						name="userId"
						label="User ID"
						disabled
						register={register}
						className="w-full border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] py-2.5 px-4 bg-gray-50 disabled:text-[#6B7280]"
						labelClassName="text-[12px] font-medium text-[#6B7280] leading-[10px] mb-1.5"
						tooltip={
							<ReactCustomTooltip
								id={"user_id_tooltip"}
								tooltip={<>Unique ID assigned to your user account.</>}
								place="top"
								tooltipStyle={{
									maxWidth: "400px",
									zIndex: 1000,
									fontSize: "12px",
								}}
							>
								<InformationCircleIcon className="w-4 h-4 text-gray-500 cursor-pointer -mt-1" />
							</ReactCustomTooltip>
						}
					>
						<Square2StackIcon
							className="w-5 h-5 text-gray-600 absolute rotate-90 top-3 right-3 cursor-pointer hover:text-blue-400"
							onClick={() => {
								void handleCopy(getValues("userId") || "", "User ID Copied");
							}}
						/>
					</Input>

					<Input
						name="customerId"
						label="Customer ID"
						disabled
						register={register}
						className="w-full border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] py-2.5 px-4 bg-gray-50 disabled:text-[#6B7280]"
						labelClassName="text-[12px] font-medium text-[#6B7280] leading-[10px] mb-1.5"
						tooltip={
							<ReactCustomTooltip
								id={"customer_id_tooltip"}
								tooltip={
									<>Identifier associated with your organization’s account.</>
								}
								place="top"
								tooltipStyle={{
									maxWidth: "400px",
									zIndex: 1000,
									fontSize: "12px",
								}}
							>
								<InformationCircleIcon className="w-4 h-4 text-gray-500 cursor-pointer -mt-1" />
							</ReactCustomTooltip>
						}
					>
						<Square2StackIcon
							className="w-5 h-5 text-gray-600 absolute rotate-90 top-3 right-3 cursor-pointer hover:text-blue-400"
							onClick={() => {
								void handleCopy(
									getValues("customerId") || "",
									"Customer ID Copied",
								);
							}}
						/>
					</Input>
				</div>
			</div>

			<div className="flex flex-col w-full border rounded-2xl bg-white p-6 mb-8">
				<div className="font-semibold text-[#1F2937] text-[16px] leading-[24px] mb-1">
					Business Settings
				</div>
				<div className="text-gray-500 text-sm mb-6 mt-3">
					Edit and manage the details of your business.
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
					<Input
						name="businessName"
						label="Business Name"
						disabled
						register={register}
						className="w-full border border-[#E5E7EB] rounded-lg text-sm text-[#1F2937] py-2.5 px-4 bg-gray-50 disabled:text-[#6B7280]"
						labelClassName="text-[12px] font-medium text-[#6B7280] leading-[18px] mb-1.5"
					/>

					<PhoneNumber
						label="Business Contact Phone Number"
						labelClassName="mb-1.5 text-[#6B7280] font-inter font-medium text-[12px] leading-[18px]"
						placeholder="Enter business contact number"
						value={undefined}
						name="companyNumber"
						control={control}
						error=""
						disabled={true}
						international={true}
						countryCallingCodeEditable={false}
						className="w-full border border-gray-200 rounded-lg text-sm text-[#1F2937] py-2.5 px-4"
					/>
				</div>
			</div>
			{isPasswordModalOpen && (
				<UpdatePasswordModal
					open={isPasswordModalOpen}
					handleCloseModal={() => {
						setIsPasswordModalOpen(false);
					}}
				/>
			)}
		</>
	) : (
		<Navigate to={URL.AUTH_ERROR} />
	);
};

export default GeneralSettings;
