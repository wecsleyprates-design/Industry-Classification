import React from "react";
import { useNavigate } from "react-router";
import {
	ArrowTopRightOnSquareIcon,
	EyeIcon,
} from "@heroicons/react/24/outline";
import StatusBadge from "@/components/Badge/StatusBadge";
import Button from "@/components/Button";
import TableBody from "@/components/Table/TableBody";
import TableHeader from "@/components/Table/TableHeader";
import { type column } from "@/components/Table/types";
import { capitalize, getSlugReplacedURL, getStatusType } from "@/lib/helper";
import useAuthStore from "@/store/useAuthStore";
import { type GetWebhookEndpointsData } from "@/types/webhooks";

import { MODULES } from "@/constants/Modules";
import { URL } from "@/constants/URL";

interface HostedEndpointsTableProps {
	endpointHandle: () => void;
	endpointsData?: GetWebhookEndpointsData[];
	dataLoading: boolean;
}

const HostedEndpointsTable: React.FC<HostedEndpointsTableProps> = ({
	endpointHandle,
	endpointsData,
	dataLoading,
}) => {
	const navigate = useNavigate();
	const permissions = useAuthStore((state) => state.permissions);

	const columns: column[] = [
		{
			title: "URL",
			path: "url",
			content: (item: GetWebhookEndpointsData) => (
				<div
					className="text-blue-600 truncate cursor-pointer max-w-64"
					onClick={() => {
						navigate(
							getSlugReplacedURL(URL.ENDPOINT_DETAILS, String(item?.id ?? "1")),
						);
					}}
				>
					{item?.url}
				</div>
			),
		},
		{
			title: "Error Rate",
			path: "error_rate",
			content: (item: GetWebhookEndpointsData) => {
				const sum: number =
					item?.stats?.success +
					item?.stats?.fail +
					item?.stats?.sending +
					item?.stats?.pending;
				const errorRate =
					(Number(
						item?.stats?.fail + item?.stats?.sending + item?.stats?.pending,
					) /
						sum) *
					100;
				return (
					<span className="truncate">
						{sum === 0 || isNaN(errorRate) ? "-" : String(errorRate) + "%"}
					</span>
				);
			},
		},
		{
			title: "# of Event Listeners",
			path: "event_listners",
			content: (item: GetWebhookEndpointsData) => {
				return <span className="truncate">{item?.events?.length}</span>;
			},
		},
		{
			title: "Status",
			path: "status",
			content: (item: GetWebhookEndpointsData) => {
				return (
					<StatusBadge
						className="truncate"
						type={getStatusType(item?.status)}
						text={capitalize(item?.status)?.replace(/_/g, " ")}
					/>
				);
			},
		},
		{
			title: "Actions",
			path: "Actions",
			content: (item: GetWebhookEndpointsData) => (
				<div
					className="text-blue-600 cursor-pointer hover:text-blue-800"
					onClick={() => {
						navigate(
							getSlugReplacedURL(URL.ENDPOINT_DETAILS, String(item.id ?? "1")),
						);
					}}
				>
					<EyeIcon className="h-4 ml-3 text-lg" />
				</div>
			),
		},
	];

	return (
		<div className="px-6 pt-5 pb-6 bg-white rounded-3xl">
			<div className="items-center justify-between block mb-3 overflow-y-auto sm:flex ">
				<div className="flex justify-start">
					<h2 className="px-2 mr-4 text-base font-semibold text-gray-800">
						Hosted Endpoints
					</h2>

					<a
						href="https://docs.worthai.com/webhooks/webhooks"
						target="_blank"
						rel="noreferrer"
						className="flex items-center pr-5 mt-0.5 text-xs font-medium text-blue-600 hover:underline"
					>
						Documentation
						<ArrowTopRightOnSquareIcon className="w-4 h-4 ml-2 text-blue-600" />
					</a>
				</div>
				<Button
					color="blue"
					type="button"
					className="text-white rounded-lg text-sm hover:bg-blue-700 h-[40px] mt-2 sm:mt-0"
					onClick={endpointHandle}
					size="md"
					disabled={!permissions[MODULES.SETTINGS]?.write}
					rounded={true}
				>
					Add Endpoint
				</Button>
			</div>
			<div className="mx-2 overflow-x-auto sm:mx-1 lg:mx-2">
				<div className="inline-block min-w-full pb-2 align-middle">
					<table className="w-full min-w-full text-left divide-y divide-gray-300">
						<TableHeader columns={columns} />
						<TableBody
							isLoading={dataLoading ?? false}
							columns={columns}
							tableData={{
								records: endpointsData ?? [],
								total_items: endpointsData?.length ?? 10,
								total_pages: 1,
							}}
						/>
					</table>
				</div>
			</div>
		</div>
	);
};

export default HostedEndpointsTable;
