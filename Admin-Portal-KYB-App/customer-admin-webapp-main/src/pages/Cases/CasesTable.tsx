import React, { type ReactNode, useEffect, useState } from "react";
import { generatePath, Link, useSearchParams } from "react-router-dom";
import { EyeIcon } from "@heroicons/react/24/outline";
import { useFlags } from "launchdarkly-react-client-sdk";
import CircleExclamation from "@/assets/CircleExclamation";
import { DownloadReport } from "@/components/Actions";
import StatusBadge from "@/components/Badge/StatusBadge";
import Filter from "@/components/Filter/Filter";
import {
	type DateRangeType,
	type DateType,
	type IConfigs,
	type TFilterOption,
	type TSelectedValueType,
} from "@/components/Filter/types";
import LongTextWrapper from "@/components/LongTextWrapper";
import { WarningModal } from "@/components/Modal";
import SearchBox from "@/components/SearchBox";
import Table from "@/components/Table";
import { type column, type TableData } from "@/components/Table/types";
import { ReactCustomTooltip } from "@/components/Tooltip";
import {
	capitalize,
	concatenate,
	convertToLocalDate,
	convertToStartEndDate,
	getStatusType,
} from "@/lib/helper";
import { useGetCaseTypes } from "@/services/queries/case.query";
import {
	useDownloadReport,
	useGenerateReport,
} from "@/services/queries/report.query";
import useGlobalStore from "@/store/useGlobalStore";
import { type IPayload, type TModulesName } from "@/types/common";

import { CASE_STATUS_ENUM } from "@/constants/CaseStatus";
import FEATURE_FLAGES from "@/constants/FeatureFlags";
import { URL } from "@/constants/URL";

interface Props {
	tableName: TModulesName;
	customerId: string;
	tableData: TableData;
	FilterData: TFilterOption[];
	isLoading: boolean;
	payload: IPayload;
	sortHandler: (order: string, alias: string) => void;
	paginationHandler: (pageVal: number) => void;
	itemsPerPageHandler: (itemsPerPageVal: number) => void;
	filterHandler?: (
		selectedValues: Record<string, TSelectedValueType[]>,
	) => void;
	dateFilterHandler?: (selectedDates: Record<string, DateType[]>) => void;
	searchTriggerHandler: (value: string) => void;
	initialFilterValues?: Record<string, TSelectedValueType[]>;
	dateFilterPayload?: Record<string, DateRangeType>;
	configs?: IConfigs;
	refetTableData?: any;
}

const CasesTable: React.FC<Props> = ({
	tableName,
	customerId,
	tableData,
	FilterData,
	isLoading,
	payload,
	sortHandler,
	paginationHandler,
	itemsPerPageHandler,
	filterHandler,
	dateFilterHandler,
	searchTriggerHandler,
	initialFilterValues,
	dateFilterPayload,
	configs,
	refetTableData,
}) => {
	const flags = useFlags();
	const [searchParams] = useSearchParams();
	const [reportRequestedModal, setReportRequestedModal] = useState(false);
	const setSavedPayload = useGlobalStore((store) => store.setSavedPayload);
	const [caseTypes, setCaseTypes] = useState<Record<number, string>>({});
	const [caseTypesPayload] = useState<IPayload>({
		pagination: false,
	});

	const { data: caseTypesResponse } = useGetCaseTypes(caseTypesPayload);

	useEffect(() => {
		if (caseTypesResponse) {
			const caseTypesData = caseTypesResponse.data.records.reduce(
				(acc: Record<number, string>, item: { id: number; label: any }) => {
					acc[item.id] = item.label;
					return acc;
				},
				{},
			);

			setCaseTypes(caseTypesData);
		}
	}, [caseTypesResponse]);

	const renderRiskAlertIcon = (
		riskAlerts: Array<{ id: string; risk_level: string }>,
	) => {
		const set = new Set(riskAlerts.map((risk) => risk.risk_level));
		return (
			<>
				{set.has("HIGH") && <CircleExclamation color="#FF0000" />}
				{set.has("MODERATE") && <CircleExclamation color="#FF9900" />}
			</>
		);
	};

	const getCaseTypeBadge = (
		type: number,
		item: Record<string, any>,
	): ReactNode => {
		switch (caseTypes[type]) {
			case "ONBOARDING":
				return <span className="flex gap-1">Onboarding</span>;
			case "RISK":
				return (
					<p className="flex gap-1">
						Risk{" "}
						{item?.status?.label !== CASE_STATUS_ENUM.DISMISSED && (
							<span className="flex gap-1">
								{renderRiskAlertIcon(item?.risk_alerts)}
							</span>
						)}
					</p>
				);
			case "APPLICATION EDIT":
				return <span className="flex gap-1">Application Edit</span>;
			default:
				return <p className="flex gap-1">Onboarding</p>;
		}
	};

	const timeout = async (delay: number) => {
		return await new Promise((resolve) => setTimeout(resolve, delay));
	};

	/**********************************************************************
							Worth 360 changes 
	***********************************************************************/

	const { mutateAsync: generateReport, data: generateReportData } =
		useGenerateReport();
	const { mutateAsync: downloadReport, data: downloadReportData } =
		useDownloadReport();

	useEffect(() => {
		if (generateReportData) {
			setReportRequestedModal(true);
		}
	}, [generateReportData]);

	useEffect(() => {
		if (downloadReportData) {
			window.open(downloadReportData.data.pdf_url ?? "", "_blank");
		}
	}, [downloadReportData]);

	const columns: column[] = [
		{
			title: "Ticket number",
			path: "id",
			alias: "data_cases.id",
			content: (item) => (
				<Link
					to={`${generatePath(URL.CASE_DETAILS_V2, {
						id: String(item?.id ?? ""),
						mainTab: null,
						subTab: null,
					})}?tableName=${tableName}`}
					className="text-blue-600 truncate cursor-pointer"
					onClick={async () => {
						await timeout(5);
						setSavedPayload({
							module: tableName,
							values: searchParams,
						});
					}}
				>
					<LongTextWrapper text={item?.id} />
				</Link>
			),
		},
		{
			title: "Case type",
			path: "type",
			alias: "data_cases.case_type",
			content: (item) => {
				return (
					<span className="truncate">
						{getCaseTypeBadge(item?.case_type, item)}
					</span>
				);
			},
		},
		{
			title: "Assignee",
			path: "assignee",
			alias: "data_cases.assignee",
			content: (item) => {
				return (
					<span className="truncate">
						{concatenate([
							item?.assignee?.first_name,
							item?.assignee?.last_name,
						]) || "-"}
					</span>
				);
			},
		},
		{
			title: "Applicant name",
			path: "applicant.first_name",
			alias: "first_name",
			// sort: true,
			content: (item) => {
				return (
					<span className="truncate">
						{concatenate([
							item?.applicant?.first_name,
							item?.applicant?.last_name,
						]) || "-"}
					</span>
				);
			},
		},
		{
			title: "Business name",
			path: "company_name",
			alias: "data_businesses.name",
			sort: true,
			content: (item) => {
				return (
					<span className="truncate ">
						<LongTextWrapper text={item?.business_name ?? "-"} />
					</span>
				);
			},
		},
		{
			title: "Date & time",
			path: "created_at",
			sort: true,
			alias: "data_cases.created_at",
			content: (item) => {
				return (
					<span className="truncate">
						{convertToLocalDate(item?.created_at, "MM-DD-YYYY - h:mmA")}
					</span>
				);
			},
		},
		{
			title: "Status",
			path: "status_code",
			content: (item) => {
				return (
					<StatusBadge
						className="truncate"
						type={getStatusType(item?.status.code)}
						text={capitalize(item?.status.label)}
					/>
				);
			},
		},
		{
			title: "Actions",
			path: "",
			content: (item) => (
				<div className="flex gap-x-3">
					<ReactCustomTooltip
						id={"view_case"}
						tooltip={<>View Case</>}
						tooltipStyle={{ zIndex: 50 }}
					>
						<Link
							to={`${generatePath(URL.CASE_DETAILS_V2, {
								id: String(item?.id || ""),
								mainTab: null,
								subTab: null,
							})}?tableName=${tableName}`}
							className="text-blue-600 truncate cursor-pointer"
							onClick={() => {
								setSavedPayload({
									module: tableName,
									values: searchParams,
								});
							}}
						>
							<EyeIcon className="text-[#2563EB] h-5 w-5" />
						</Link>
					</ReactCustomTooltip>
					{flags[FEATURE_FLAGES.DOS_48_WORTH_360_REPORT] ? (
						<DownloadReport
							status={item?.report_status}
							generateReport={generateReport}
							downloadReport={downloadReport}
							businessId={item?.business_id}
							caseId={item?.id}
							reportId={item?.report_id}
						/>
					) : null}
				</div>
			),
		},
	];

	return (
		<React.Fragment>
			<div className="flex justify-end w-full min-w-full px-4 pb-4 align-middle border-b max-w-7xl sm:px-2 lg:px-4">
				<div className="flex flex-col justify-end w-full gap-2 md:flex-grow md:max-w-2xl sm:flex-row lg:gap-4">
					<Filter
						filterHandler={filterHandler}
						title={"Filter"}
						type="large"
						configs={configs ?? undefined}
						initialValues={
							payload.filter
								? (payload.filter as Record<string, TSelectedValueType[]>)
								: {}
						}
						dateFilterPayload={
							payload?.filter_date
								? convertToStartEndDate(
										payload?.filter_date as Record<string, DateType[]>,
									)
								: {}
						}
						dateFilterHandler={dateFilterHandler}
						data={FilterData}
					/>
					<SearchBox
						placeholder="Search by applicant name, business name and ticket number"
						value={
							payload.search ? (Object.values(payload.search)[0] as string) : ""
						}
						onChange={searchTriggerHandler}
					/>
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
			{reportRequestedModal && (
				<WarningModal
					type="success"
					isOpen={reportRequestedModal}
					onClose={async () => {
						setReportRequestedModal(false);
						await refetTableData?.();
					}}
					title="360 Report Request Received"
					description="This report can take a few minutes to generate. We’ll send you an email with your full 360 report when it’s ready to be viewed."
					onSucess={async () => {
						setReportRequestedModal(false);
						await refetTableData?.();
					}}
					buttonText={"Close"}
					showCancel={false}
				/>
			)}
		</React.Fragment>
	);
};

export default CasesTable;
