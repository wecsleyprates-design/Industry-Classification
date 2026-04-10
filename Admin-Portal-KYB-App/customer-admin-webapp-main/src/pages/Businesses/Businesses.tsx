import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import qs from "qs";
import Filter from "@/components/Filter/Filter";
import {
	type DateType,
	type TFilterOption,
	type TSelectedValueType,
} from "@/components/Filter/types";
import { WarningModal } from "@/components/Modal";
import SearchBox from "@/components/SearchBox";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import { StartApplicationModal } from "@/components/StartApplication";
import Table from "@/components/Table";
import { type column } from "@/components/Table/types";
import { RiskMonitoringToggle } from "@/components/Toggle";
import useCustomToast from "@/hooks/useCustomToast";
import useSearchPayload from "@/hooks/useSearchPayload";
import {
	convertToLocalDate,
	convertToStartEndDate,
	getSlugReplacedURL,
} from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import { unArchiveBusiness } from "@/services/api/businesses.service";
import {
	useGetBusinesses,
	useUpdateRiskMonitoring,
} from "@/services/queries/businesses.query";
import useAuthStore from "@/store/useAuthStore";
import useGlobalStore from "@/store/useGlobalStore";
import { type UpdateRiskMonitoring } from "@/types/business";
import { BusinessesActionButtons } from "./BusinessesActionButtons";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { MODULES } from "@/constants/Modules";
import { URL as URL_CONSTANT } from "@/constants/URL";

const Businesses: React.FC = () => {
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const customerId: string = getItem(LOCALSTORAGE.customerId) ?? "";

	const {
		payload,
		searchHandler,
		filterHandler,
		dateFilterHandler,
		applyFiltersAndDates,
		sortHandler,
		paginationHandler,
		itemsPerPageHandler,
	} = useSearchPayload({
		pagination: true,
		defaultSort: "data_businesses.created_at",
	});

	const { errorHandler, successHandler } = useCustomToast();
	const permissions = useAuthStore((state) => state.permissions);
	const { savedPayload, setSavedPayload } = useGlobalStore((store) => store);

	const [isRiskModalOpened, setIsRiskedModalOpened] = useState(false);
	const [updateBusinessId, setUpdateBusinessId] = useState<string | null>(null);
	const [riskMonitoringStatus, setRiskMonitoringStatus] = useState<
		boolean | null
	>(null);
	const [restoreBusinessId, setRestoreBusinessId] = useState<string | null>(
		null,
	);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isStartApplicationModalOpen, setIsStartApplicationModalOpen] =
		useState(false);

	const [tableData, setTableData] = useState({
		records: [],
		total_items: 0,
		total_pages: 1,
	});

	const {
		data: businessesData,
		isLoading,
		error: businessesError,
		refetch: refetchBusinesses,
	} = useGetBusinesses({
		customerId,
		params: payload,
	});

	const {
		mutateAsync: updateRiskMonitoring,
		isPending: isUpdateRiskMonitoringLoading,
		data: riskMonitoringData,
		error: riskMonitoringError,
	} = useUpdateRiskMonitoring();

	useEffect(() => {
		setSearchParams(
			(prev) => {
				const current = new URLSearchParams(prev);
				if (
					current.has("filter") ||
					current.has("filter_date") ||
					current.has("search")
				)
					return prev;
				// If there are any existing search params (e.g. page, sort), respect them
				if (Array.from(current.keys()).length > 0) return prev;
				if (savedPayload?.businesses)
					return new URLSearchParams(savedPayload.businesses);
				return prev;
			},
			{ replace: true },
		);
	}, [savedPayload?.businesses]);

	useEffect(() => {
		if (businessesData?.status === "success") {
			const response = businessesData?.data;
			setTableData(response);
		} else if (
			businessesData?.status === "error" ||
			businessesData?.status === "fail"
		) {
			errorHandler({
				message: businessesData?.message as string,
			});
		}
	}, [businessesData]);

	useEffect(() => {
		if (businessesError) {
			errorHandler(businessesError);
		}
	}, [businessesError]);

	useEffect(() => {
		if (riskMonitoringData) {
			successHandler({ message: riskMonitoringData.message });
			void refetchBusinesses();
		}
	}, [riskMonitoringData]);

	useEffect(() => {
		if (riskMonitoringError) {
			errorHandler(riskMonitoringError);
		}
	}, [riskMonitoringError]);

	const isShowingArchived = payload?.filter?.["data_businesses.is_deleted"];

	const columns: column[] = [
		{
			title: "Business name",
			path: "name",
			alias: "data_businesses.name",
			sort: true,
			content: (item) => {
				return <span className="md:max-w-[200px]">{item?.name as string}</span>;
			},
		},

		{
			title: "Onboarding date",
			path: "created_at",
			alias: "data_businesses.created_at",
			sort: true,
			content: (item) => {
				return (
					<span className="truncate">
						{convertToLocalDate(item?.created_at, "MM-DD-YYYY - h:mmA")}
					</span>
				);
			},
		},
		{
			title: "Action",
			path: "",
			content: (item) =>
				item?.is_deleted && permissions[MODULES.BUSINESS]?.write ? (
					<button
						type="button"
						className="text-blue-600 truncate cursor-pointer hover:text-blue-400 max-w-fit"
						onClick={() => {
							setRestoreBusinessId(item?.id);
							setIsModalOpen(true);
						}}
					>
						Restore Business
					</button>
				) : (
					<Link
						to={getSlugReplacedURL(URL_CONSTANT.BUSINESS_DETAILS, item?.id)}
						replace
						className="text-blue-600 truncate cursor-pointer hover:text-blue-400 max-w-fit"
						onClick={() => {
							setSavedPayload({
								module: "businesses",
								values: searchParams,
							});
						}}
					>
						View details
					</Link>
				),
		},
	];

	if (!isShowingArchived) {
		columns.splice(2, 0, {
			title: "Risk monitoring",
			path: "is_monitoring_enabled",
			alias: "is_monitoring_enabled",
			content: (item) => {
				return (
					<div className="w-min">
						<RiskMonitoringToggle
							value={item.is_monitoring_enabled}
							onChange={() => {
								setUpdateBusinessId(item.id);
								setRiskMonitoringStatus(!item.is_monitoring_enabled);
								setIsRiskedModalOpened(true);
							}}
							disabled={
								isUpdateRiskMonitoringLoading ||
								!permissions[MODULES.RISK_MONITORING_MODULE]?.write
							}
						/>
					</div>
				);
			},
		});

		columns.push({
			title: "Audit trail",
			path: "",
			alias: "",
			content: (item) => {
				return (
					<div
						className="tracking-tight text-blue-600 cursor-pointer hover:text-blue-400"
						onClick={() => {
							navigate(
								getSlugReplacedURL(
									URL_CONSTANT.BUSINESS_AUDIT_TRAIL,
									item?.id ?? "",
								),
							);
						}}
					>
						View
					</div>
				);
			},
		});
	}

	// Stable primitive so memo doesn't recompute every render (payload.filter_date is a new object each time from qs.parse)
	const filterDateParam = searchParams.get("filter_date") ?? "";
	const dateFilterPayloadMemo = useMemo(() => {
		if (!filterDateParam) return {};
		const parsed = qs.parse(filterDateParam) as Record<string, DateType[]>;
		return convertToStartEndDate(parsed);
	}, [filterDateParam]);

	const FilterData: TFilterOption[] = [
		{
			title: "Status",
			type: "radio",
			alias: "data_businesses.is_deleted",
			isBooleanField: true,
			filterOptions: [
				{ label: "Active", value: "false" },
				{ label: "Archived", value: "true" },
			],
		},
		{
			title: "Risk monitoring",
			type: "checkbox",
			alias: "rel_business_customer_monitoring.is_monitoring_enabled",
			filterOptions: [
				{ label: "Enabled", value: "true" },
				{ label: "Disabled", value: "false" },
			],
		},
		{
			title: "Onboarding date",
			type: "date-range",
			alias: "data_businesses.created_at",
		},
	];

	const searchTriggerHandler = (value: string) => {
		searchHandler(value, ["data_businesses.name", "data_businesses.id"]);
	};

	return (
		<>
			{isUpdateRiskMonitoringLoading && <FullPageLoader />}
			<div className="bg-white border rounded-lg shadow">
				<div className="w-full min-w-full px-2 py-4 border-b max-w-7xl sm:px-4">
					<div className="flex flex-col justify-between sm:flex-auto sm:items-center sm:flex-row">
						<div className="w-full sm:w-1/5">
							<h1 className="text-base font-semibold leading-6 text-gray-900">
								Businesses
							</h1>
						</div>
						<div className="flex flex-col justify-end gap-2 mt-2 md:flex-grow md:max-w-2xl sm:flex-row sm:mt-0">
							<Filter
								filterHandler={filterHandler}
								dateFilterHandler={dateFilterHandler}
								applyFiltersAndDates={applyFiltersAndDates}
								title={"Filter"}
								initialValues={
									payload.filter
										? (payload.filter as Record<string, TSelectedValueType[]>)
										: {}
								}
								dateFilterPayload={dateFilterPayloadMemo}
								data={FilterData}
							/>
							<SearchBox
								placeholder="Search by business name"
								value={
									payload.search
										? (Object.values(payload.search)[0] as string)
										: ""
								}
								onChange={searchTriggerHandler}
							/>
							<BusinessesActionButtons
								customerId={customerId}
								searchParams={searchParams}
								onStartApplicationModalOpen={() => {
									setIsStartApplicationModalOpen(true);
								}}
							/>
						</div>
					</div>
				</div>
				<Table
					columns={columns}
					tableData={tableData}
					isLoading={isLoading}
					page={payload.page ?? 1}
					itemsPerPage={payload.items_per_page ?? 10}
					sortHandler={sortHandler}
					paginationHandler={paginationHandler}
					itemsPerPageHandler={itemsPerPageHandler}
					payload={payload}
				/>
			</div>
			{isRiskModalOpened && (
				<WarningModal
					isOpen={isRiskModalOpened}
					onClose={() => {
						setIsRiskedModalOpened(false);
					}}
					onSucess={async () => {
						if (typeof riskMonitoringStatus === "boolean") {
							const payload: UpdateRiskMonitoring = {
								businessId: updateBusinessId ?? "",
								customerId: getItem(LOCALSTORAGE.customerId) ?? "",
								body: {
									risk_monitoring: riskMonitoringStatus,
								},
							};
							await updateRiskMonitoring(payload);
						}
						setIsRiskedModalOpened(false);
					}}
					title="Confirmation"
					description={`Do you want to ${
						riskMonitoringStatus ? "enable" : "disable"
					} risk monitoring on this business?`}
					buttonText="Yes"
					type="dark"
				/>
			)}
			{isModalOpen && (
				<WarningModal
					isOpen={isModalOpen}
					onClose={() => {
						setIsModalOpen(false);
						setRestoreBusinessId(null);
					}}
					onSucess={async () => {
						if (!restoreBusinessId) return;
						try {
							await unArchiveBusiness([restoreBusinessId]);
							successHandler({ message: "Business restored successfully!" });
							void refetchBusinesses();
						} catch (error) {
							errorHandler({ message: "Failed to restore business." });
						}
						setIsModalOpen(false);
						setRestoreBusinessId(null);
					}}
					title="Restore Business?"
					description="Are you sure you want to restore this business?"
					buttonText="Yes"
					type="danger"
				/>
			)}
			<StartApplicationModal
				isOpen={isStartApplicationModalOpen}
				onClose={() => {
					setIsStartApplicationModalOpen(false);
				}}
			/>
		</>
	);
};

export default Businesses;
