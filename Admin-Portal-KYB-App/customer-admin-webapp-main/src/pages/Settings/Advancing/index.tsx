import React, { useEffect } from "react";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid";
import { RectangleStackIcon } from "@heroicons/react/24/outline";
import { type AxiosError } from "axios";
import StatusBadge from "@/components/Badge/StatusBadge";
import Button from "@/components/Button";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import useCustomToast from "@/hooks/useCustomToast";
import { capitalize, getStatusType } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import {
	useCreateWebhookCustomer,
	useGetCustomerWebhookInfo,
} from "@/services/queries/webhook.query";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { URL } from "@/constants/URL";

const Advanced: React.FC = () => {
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const { errorHandler, warningHandler } = useCustomToast();

	const {
		data: customerWebhookDetailsData,
		error: customerWebhookDetailsError,
		refetch: refetchCustomerWebhookDetails,
		isLoading: customerWebhookDetailsLoading,
	} = useGetCustomerWebhookInfo(customerId);

	const {
		isPending: createWebhookCustomerLoading,
		mutateAsync: createWebhookCustomer,
		error: createWebhookCustomerError,
	} = useCreateWebhookCustomer();

	const handleNavigate = async () => {
		if (
			customerWebhookDetailsError &&
			(customerWebhookDetailsError as AxiosError)?.status === 405
		) {
			warningHandler({
				message: (customerWebhookDetailsError as any)?.response?.data.message,
				toastId: "webhookWarning",
			});
		} else if (customerWebhookDetailsData?.data?.is_enabled) {
			handleNavigateTab();
		} else {
			await createWebhookCustomer(customerId).then(async (data) => {
				if (data?.data?.id) handleNavigateTab();
				await refetchCustomerWebhookDetails();
			});
		}
	};

	const handleNavigateTab = () => {
		void window.open(URL.MANAGE_ENDPOINTS);
	};

	useEffect(() => {
		if (createWebhookCustomerError) errorHandler(createWebhookCustomerError);
	}, [createWebhookCustomerError]);

	useEffect(() => {
		if (
			customerWebhookDetailsError &&
			(customerWebhookDetailsError as AxiosError)?.status !== 405
		)
			errorHandler(customerWebhookDetailsError);
	}, [customerWebhookDetailsError]);

	return (
		<>
			{createWebhookCustomerLoading || customerWebhookDetailsLoading ? (
				<FullPageLoader />
			) : (
				<div className="bg-white max-w-lg p-4 mt-8 border rounded-xl border-[#E5E7EB] sm:w-[488px] sm:h-[180px]">
					<div className="flex items-start mt-2">
						<div className="flex-shrink-0">
							<div className="flex items-center p-2 ml-2 mr-2 bg-blue-50 rounded-xl w-14 h-14">
								<RectangleStackIcon className="w-8 h-8 mx-auto text-blue-700 " />
							</div>
						</div>
						<div className="flex-grow ml-4">
							<div className="flex items-center justify-start">
								<h2 className="mr-2 text-base font-semibold text-gray-800">
									Webhooks
								</h2>

								{!customerWebhookDetailsError && (
									<StatusBadge
										className="truncate"
										type={getStatusType(
											customerWebhookDetailsData?.data?.is_enabled
												? "ACTIVE"
												: "INACTIVE",
										)}
										text={capitalize(
											customerWebhookDetailsData?.data?.is_enabled
												? "ACTIVE"
												: "INACTIVE",
										)?.replace(/_/g, " ")}
									/>
								)}
							</div>
							<p className="mt-1.5 text-sm text-gray-500">
								Set up and manage events you'd like to receive in your other
								applications.
							</p>

							<Button
								color="grey"
								outline
								type="button"
								className="text-[#2563EB] text-sm rounded-lg flex px-3 items-center mt-5 hover:bg-gray-50"
								onClick={handleNavigate}
							>
								Manage
								<ArrowTopRightOnSquareIcon className="w-4 h-4 ml-2 font-bold" />
							</Button>
						</div>
					</div>
				</div>
			)}
		</>
	);
};

export default Advanced;
