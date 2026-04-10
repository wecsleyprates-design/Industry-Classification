import React from "react";
import { useNavigate } from "react-router-dom";
import { PlusIcon } from "@heroicons/react/20/solid";
import {
	ArrowDownTrayIcon,
	BoltIcon,
	DocumentDuplicateIcon,
	PaperAirplaneIcon,
} from "@heroicons/react/24/outline";
import { useFlags } from "launchdarkly-react-client-sdk";
import Button from "@/components/Button";
import { ReactCustomTooltip } from "@/components/Tooltip";
import useCustomToast from "@/hooks/useCustomToast";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useGetCustomersBusinessData } from "@/services/queries/customer.query";
import useGlobalStore from "@/store/useGlobalStore";

import FEATURE_FLAGES from "@/constants/FeatureFlags";
import { URL as URL_CONSTANT } from "@/constants/URL";

interface BusinessesActionButtonsProps {
	customerId: string;
	searchParams: URLSearchParams;
	onStartApplicationModalOpen: () => void;
}

export const BusinessesActionButtons: React.FC<
	BusinessesActionButtonsProps
> = ({ customerId, searchParams, onStartApplicationModalOpen }) => {
	const navigate = useNavigate();
	const flags = useFlags();
	const { errorHandler } = useCustomToast();
	const { checkAccess } = useFeatureAccess();
	const { setSavedPayload } = useGlobalStore((store) => store);

	const {
		mutateAsync: getCustomerBusinessData,
		isPending: customerBusinessDataLoading,
	} = useGetCustomersBusinessData();

	const downloadCSV = (csvData: string) => {
		try {
			const blob = new Blob([csvData], { type: "text/csv" });
			const link = document.createElement("a");
			link.href = URL.createObjectURL(blob);
			link.download = `${customerId}.csv`;
			link.click();
		} catch {
			errorHandler("Failed to download the file.");
		}
	};

	const handleDownloadCSV = () => {
		void getCustomerBusinessData(customerId).then((e) => {
			if (e && !e.message) {
				downloadCSV(e);
			} else {
				errorHandler({
					message: "Failed to download the file.",
				});
			}
		});
	};

	const handleSendInvite = () => {
		setSavedPayload({
			module: "businesses",
			values: searchParams,
		});
		navigate(URL_CONSTANT.SEND_INVITATION);
	};

	const handleQuickAdd = () => {
		navigate(URL_CONSTANT.NEW_BUSINESS);
	};

	const buildDropdownOptions = () => {
		const dropdownOptions = [
			<div
				key="single-business"
				className="flex cursor-pointer pb-3"
				onClick={handleQuickAdd}
			>
				<div className="flex items-center justify-center size-8 shrink-0 rounded-lg bg-blue-50">
					<BoltIcon className="size-5 text-blue-600" />
				</div>
				<div className="pl-3 width-auto">
					<h2 className="text-sm font-medium text-[#1F2937]">Quick Add</h2>
					<p className="text-[#6B7280] text-xs whitespace-nowrap">
						Provide a few details for a business
						<br />
						and get a Worth score instantly.
					</p>
				</div>
			</div>,
		];

		if (checkAccess("businesses:create:application")) {
			dropdownOptions.push(
				<div
					key="start-application"
					className="flex cursor-pointer"
					onClick={onStartApplicationModalOpen}
				>
					<div className="flex items-center justify-center size-8 shrink-0 rounded-lg bg-green-50">
						<DocumentDuplicateIcon className="size-5 text-green-600" />
					</div>
					<div className="pl-3 width-auto">
						<h2 className="text-sm font-medium text-[#1F2937]">
							Start an Application
						</h2>
						<p className="text-[#6B7280] text-xs whitespace-nowrap">
							Start, fill, and submit an application on
							<br />
							behalf of a business.
						</p>
					</div>
				</div>,
			);
		}

		// Future Scope
		// dropdownOptions.push(
		// 	<div
		// 		key="bulk-upload"
		// 		className="hidden cursor-not-allowed  w-[350px] pt-2"
		// 		onClick={() => {
		// 			// navigate(URL_CONSTANT.NEW_BUSINESS);
		// 		}}
		// 	>
		// 		<div className="pr-3">
		// 			<TableCellsIcon className="w-6 h-6" />
		// 		</div>
		// 		<div>
		// 			<h2 className="text-sm font-medium text-[#1F2937]">
		// 				Bulk Upload
		// 			</h2>
		// 			<p className="text-[#6B7280] text-xs">
		// 				Upload a CSV of your portfolio and we will provide Worth
		// 				scores for the businesses provided.
		// 			</p>
		// 		</div>
		// 	</div>
		// );

		return dropdownOptions;
	};

	return (
		<div className="flex justify-end gap-x-2">
			{flags[FEATURE_FLAGES.PAT_123_GET_BUSINESS_DATA] && (
				<ReactCustomTooltip
					id={"download-csv"}
					tooltip={<div className="text-xs w-fit">Download CSV</div>}
					tooltipStyle={{
						paddingBottom: "4px",
						paddingTop: "4px",
						paddingRight: "8px",
						paddingLeft: "8px",
						background: "#322F35",
						opacity: "0",
					}}
					noArrow={true}
				>
					<button
						type="button"
						className="flex items-center justify-center w-8 h-8 p-0 rounded-lg hover:bg-gray-100 disabled:opacity-20 disabled:cursor-not-allowed"
						disabled={customerBusinessDataLoading}
						onClick={handleDownloadCSV}
					>
						<ArrowDownTrayIcon className="w-5 h-5" />
					</button>
				</ReactCustomTooltip>
			)}
			{checkAccess("businesses:create:invite") && (
				<ReactCustomTooltip
					id={"send-invite"}
					tooltip={<div className="text-xs w-fit">Send Invite</div>}
					tooltipStyle={{
						paddingBottom: "4px",
						paddingTop: "4px",
						paddingRight: "8px",
						paddingLeft: "8px",
						background: "#322F35",
						opacity: "0",
					}}
					noArrow={true}
				>
					<Button
						onClick={handleSendInvite}
						type="button"
						className="flex items-center justify-center w-8 h-8 p-0 text-sm font-semibold rounded-lg hover:bg-gray-100 active:ring-0 active:ring-offset-0"
					>
						<PaperAirplaneIcon className="w-5 h-5" />
					</Button>
				</ReactCustomTooltip>
			)}

			{checkAccess("businesses:create") && (
				<Button
					className="w-8 h-8 p-0 bg-blue-600 rounded-full hover:bg-blue-700 active:ring-0 active:ring-offset-0"
					dropdown={{
						chevron: false,
						divider: false,
						orientation: "right-0",
						options: buildDropdownOptions(),
					}}
				>
					<PlusIcon className="w-5 h-5 text-white" />
				</Button>
			)}
		</div>
	);
};
