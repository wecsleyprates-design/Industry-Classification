import { useState } from "react";
import { useNavigate } from "react-router";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { URL } from "constants/URL";
import Badge from "@/components/Badge/Badge";
import SkeletonLoader from "@/components/Loader/SkeletonLoader";
import useCustomToast from "@/hooks/useCustomToast";
import useLogout from "@/hooks/useLogout";
import { scheduleProactiveRefresh } from "@/lib/api";
import { capitalize, defaultHomePage, getAllPermissions } from "@/lib/helper";
import { getItem, setItem } from "@/lib/localStorage";
import {
	useCustomerAccessQuery,
	useUserCustomers,
} from "@/services/queries/auth.query";
import useAuthStore from "@/store/useAuthStore";
import { type CustomerSelectionResponseArray } from "@/types/auth";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { MODULES } from "@/constants/Modules";

const CustomerSelection = () => {
	const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
	const navigate = useNavigate();
	const { setIsAuthenticated } = useAuthStore((state) => state);
	const userId: string = getItem(LOCALSTORAGE.userId) ?? "";
	const { data: userCustomersData, isLoading: customersLoading } =
		useUserCustomers(userId);
	const { mutateAsync: getCustomerAccess } = useCustomerAccessQuery();
	const validCustomers = userCustomersData?.data || [];

	const { logoutAsync } = useLogout();

	const { errorHandler } = useCustomToast();

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

	const handleSelect = async (
		customer: CustomerSelectionResponseArray,
		idx: number,
	) => {
		setSelectedIndex(idx);
		try {
			const accessDataResponse = await getCustomerAccess({
				customer_id: customer.id,
			});

			const login = accessDataResponse.data;

			// decrypt permissions
			// const decryptedPermissions = decryptPermissionsHybrid(
			// 	login.permissions as any
			// );

			const permissions = getAllPermissions(
				login.permissions,
				Object.values(MODULES),
			);

			setItem(LOCALSTORAGE.permissions, permissions);
			setItem("token", login.access_token);
			setItem(LOCALSTORAGE.token, login.id_token);
			scheduleProactiveRefresh();

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
		} catch (err) {
			errorHandler(err);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-[#F9FAFB]">
			<div className="relative bg-white rounded-2xl shadow-lg border border-gray-200 flex flex-col w-[488px] pt-10 pr-6 pb-10 pl-6 gap-[10px] max-h-[90vh] overflow-y-auto">
				{/* Close button */}
				<button
					onClick={async () => {
						await logoutAsync();
						navigate(URL.LOGIN, { replace: true });
					}}
					aria-label="Close"
					className="absolute p-1 rounded-full right-6 top-6 hover:bg-gray-100"
				>
					<XMarkIcon className="w-6 h-6 text-gray-500" />
				</button>

				{/* Title & Subheader */}
				<div className="flex flex-col items-center text-center gap-[10px]">
					<h2 className="text-lg font-semibold leading-7 text-gray-900 font-inter">
						Select an Account
					</h2>
					<p className="text-sm font-normal leading-5 text-center text-gray-500 font-inter">
						You are a member of multiple accounts. <br />
						Please choose one to continue.
					</p>
				</div>

				{/* Divider */}
				<div className="mt-5 border-t border-gray-200" />

				{/* Customer list */}
				<div className="mt-4 space-y-[10px]">
					{customersLoading ? (
						<>
							{[1, 2, 3].map((i) => (
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
							))}
						</>
					) : (
						validCustomers.map(
							(customer: CustomerSelectionResponseArray, idx: number) => {
								const displayName = customer?.name ?? "Account";
								const role = customer?.subrole?.label ?? "Customer Admin";
								const initial = displayName.charAt(0).toUpperCase() ?? "C"; // default character C for customer
								const colors = ["bg-[#2563EB]", "bg-violet-500", "bg-pink-500"];
								const circleColor = colors[idx % colors.length];
								const isSelected = selectedIndex === idx;
								const customerType = customer?.customer_type;
								return (
									<button
										key={idx}
										onClick={async () => {
											await handleSelect(customer, idx).catch((err) => {
												errorHandler(err);
											});
										}}
										className={`flex items-center gap-4 rounded-lg border transition text-left px-4 py-3 w-[424px] h-[80px] ${
											isSelected
												? "border-blue-500 ring-1 ring-blue-200 bg-blue-50"
												: "border-gray-200 hover:border-gray-300"
										}`}
									>
										{/* Avatar */}
										<div
											className={`flex items-center justify-center rounded-full text-white font-medium ${circleColor} w-12 h-12`}
										>
											{initial}
										</div>

										{/* Text */}
										<div>
											<p className="text-sm font-medium leading-5 text-gray-900 font-inter">
												{displayName}
												<span>
													{customerType && (
														<Badge
															text={capitalize(customerType ?? "-")}
															color={getBadgeColor(customerType)}
															className="ml-2"
														/>
													)}
												</span>
											</p>
											<p className="text-sm font-normal leading-5 text-gray-500 font-inter">
												Role: {role}
											</p>
										</div>
									</button>
								);
							},
						)
					)}
				</div>
			</div>
		</div>
	);
};

export default CustomerSelection;
