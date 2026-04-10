import { useState } from "react";
import { useNavigate } from "react-router";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";
import useCustomToast from "@/hooks/useCustomToast";
import { capitalize, defaultHomePage, getAllPermissions } from "@/lib/helper";
import { getItem, setItem } from "@/lib/localStorage";
import {
	useCustomerAccessQuery,
	useUserCustomers,
} from "@/services/queries/auth.query";
import useAuthStore from "@/store/useAuthStore";
import { type CustomerSelectionResponseArray } from "@/types/auth";
import Badge from "../Badge";
import SkeletonLoader from "../Loader/SkeletonLoader";
import Modal from "../Modal";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { MODULES } from "@/constants/Modules";

type Props = {
	isOpen: boolean;
	onClose: () => void;
};

const SwitchCustomerModal = ({ isOpen, onClose }: Props) => {
	const navigate = useNavigate();
	const { errorHandler } = useCustomToast();
	const { setIsAuthenticated } = useAuthStore((state) => state);
	const [currentCustomerID, setCurrentCustomerID] = useState(
		getItem(LOCALSTORAGE.customerId) ?? "",
	);

	const userId: string = getItem(LOCALSTORAGE.userId) ?? "";
	const { data: userCustomersData, isLoading: customersLoading } =
		useUserCustomers(userId);
	const { mutateAsync: getCustomerAccess } = useCustomerAccessQuery();

	const handleSelect = async (customer: CustomerSelectionResponseArray) => {
		try {
			setCurrentCustomerID(customer.id);
			const accessDataResponse = await getCustomerAccess({
				customer_id: customer.id,
			});

			const login = accessDataResponse.data;
			const permissions = getAllPermissions(
				login.permissions,
				Object.values(MODULES),
			);

			setItem(LOCALSTORAGE.permissions, permissions);
			setItem("token", login.access_token);
			setItem(LOCALSTORAGE.token, login.id_token);

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

			navigate(defaultHomePage());
			onClose(); // close modal after switching
		} catch (err) {
			errorHandler(err);
		}
	};

	const validCustomers = userCustomersData?.data || [];

	const getBadgeColor = (customerType: string) => {
		switch (customerType) {
			case "PRODUCTION":
				return "green";
			case "SANDBOX":
				return "blue";
			default:
				return "yellow";
		}
	};

	return (
		<Modal
			customWidth="sm:max-w-md"
			isOpen={isOpen}
			onClose={onClose}
			closeOnBackdropClick={false}
		>
			<div className="relative flex flex-col items-center justify-center text-center">
				<button
					onClick={onClose}
					className="absolute top-0 text-gray-500 right-1 hover:text-gray-700"
				>
					<XMarkIcon className="w-6 h-6" />
				</button>
				<h2 className="text-lg font-semibold text-gray-800">
					Select an Account
				</h2>
				<p className="text-[#6B7280]">
					You are a member of multiple accounts. <br /> Please choose one to
					continue.
				</p>
			</div>

			<div className="mt-4 space-y-[10px] max-h-[500px] overflow-y-auto">
				{customersLoading
					? [1, 2, 3].map((i) => (
							<div
								key={i}
								className="flex items-center gap-4 rounded-lg border border-gray-200 px-4 py-3 w-[440px] h-[72px]"
							>
								<SkeletonLoader
									loading={true}
									className="w-12 h-12 rounded-full"
								/>
								<div className="flex flex-col gap-1">
									<SkeletonLoader loading={true} className="w-40 h-4" />
									<SkeletonLoader loading={true} className="w-24 h-3" />
								</div>
							</div>
						))
					: validCustomers.map((customer, idx) => {
							const displayName = customer?.name ?? "Account";
							const role = customer?.label ?? "Customer Admin";
							const initial = displayName.charAt(0).toUpperCase() ?? "C";
							const colors = ["bg-[#2563EB]", "bg-violet-500", "bg-pink-500"];
							const circleColor = colors[idx % colors.length];
							const customerType = customer?.customer_type;

							return (
								<button
									key={idx}
									onClick={async () => {
										await handleSelect(customer).catch(errorHandler);
									}}
									className={twMerge(
										"flex items-center gap-4 rounded-lg border transition text-left px-4 py-3 w-full h-[80px]",
										customer.id === currentCustomerID
											? "border-blue-500 ring-1 ring-blue-200 bg-blue-50"
											: "border-gray-200 hover:border-gray-300",
									)}
								>
									<div
										className={`flex items-center justify-center rounded-full text-white font-medium ${circleColor} w-12 h-12`}
									>
										{initial}
									</div>

									<div>
										<p className="text-sm font-medium text-gray-900">
											{displayName}
											{customerType && (
												<Badge
													text={capitalize(customerType)}
													color={getBadgeColor(customerType)}
													className="ml-2"
												/>
											)}
										</p>
										<p className="text-sm text-gray-500">Role: {role}</p>
									</div>
								</button>
							);
						})}
			</div>
		</Modal>
	);
};

export default SwitchCustomerModal;
