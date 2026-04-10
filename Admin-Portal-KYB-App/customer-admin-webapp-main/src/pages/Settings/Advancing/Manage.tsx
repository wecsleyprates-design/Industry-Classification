import { useEffect } from "react";
import { useNavigate } from "react-router";
import { RectangleStackIcon } from "@heroicons/react/24/outline";
import { type AxiosError } from "axios";
import Button from "@/components/Button";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import useCustomToast from "@/hooks/useCustomToast";
import { getItem } from "@/lib/localStorage";
import { useGetWebhookEndpoints } from "@/services/queries/webhook.query";
import HostedEndpointsTable from "./HostedEndpointsTable";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { URL } from "@/constants/URL";

const Manage = () => {
	const navigate = useNavigate();
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";
	const { errorHandler } = useCustomToast();

	const handleAddEndpoints = () => {
		navigate(URL.ADD_ENDPOINTS);
	};

	const {
		data: webhookEndpointsData,
		isLoading: webhookEndpointsLoading,
		error: webhookEndpointsError,
	} = useGetWebhookEndpoints(customerId);

	useEffect(() => {
		if (webhookEndpointsError) {
			errorHandler(webhookEndpointsError);
			if ((webhookEndpointsError as AxiosError)?.response?.status === 405) {
				navigate(URL.DASHBOARD);
			}
		}
	}, [webhookEndpointsError]);

	return (
		<>
			{webhookEndpointsLoading ? (
				<FullPageLoader />
			) : webhookEndpointsData && webhookEndpointsData?.data?.length < 1 ? (
				<div className="flex items-start justify-center min-w-full min-h-full">
					<div className="px-20 py-14 bg-white rounded-3xl text-center w-[660px] h-[376px]">
						<div className="flex justify-center mb-1">
							<div className="p-2 mt-1 mb-3 bg-blue-50 rounded-2xl">
								<RectangleStackIcon className="w-12 h-12 text-blue-600" />
							</div>
						</div>

						<h2 className="mb-2 text-lg font-semibold text-gray-800">
							Get Started with Webhooks
						</h2>

						<p className="mb-4 text-sm text-gray-500">
							To utilize webhooks and begin listening for particular events,
							<br />
							please add an endpoint. Need a little extra help?
							<br />
							Read our
							<a
								href="https://docs.worthai.com/webhooks/webhooks"
								className="ml-1 text-blue-600"
								target="_blank"
								rel="noreferrer"
							>
								webhooks documentation
							</a>
						</p>

						<Button
							color="blue"
							type="button"
							className="text-white rounded-lg hover:bg-blue-700 h-[44px]"
							onClick={handleAddEndpoints}
							size="md"
							rounded={true}
						>
							<span className="">Add Endpoint</span>
						</Button>
					</div>
				</div>
			) : (
				<div>
					<HostedEndpointsTable
						endpointHandle={handleAddEndpoints}
						endpointsData={webhookEndpointsData?.data}
						dataLoading={webhookEndpointsLoading}
					/>
				</div>
			)}
		</>
	);
};

export default Manage;
