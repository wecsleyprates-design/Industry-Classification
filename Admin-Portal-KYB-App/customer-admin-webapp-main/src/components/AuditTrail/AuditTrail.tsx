import { useEffect, useState } from "react";
// import useCustomToast from "@/hooks/useCustomToast";
import {
	convertToStartEndDate,
	sortVariables,
	transformText2,
} from "@/lib/helper";
import {
	useGetAuditTrail,
	useGetAuditTrailActions,
} from "@/services/queries/notification.query";
import { type GetAuditTrailDataRecord } from "@/types/notifications";
// import { useUpdateCaseAuditTrail } from "@/services/queries/case.query";
import Filter from "../Filter/Filter";
import {
	type DateType,
	type TFilterOption,
	type TSelectedValueType,
} from "../Filter/types";
import TableLoader from "../Spinner/TableLoader";
import ActivityTimeline from "./ActivityTimeline";
import "./AuditTrailTextArea.css";

interface Props {
	businessId: string;
	inCase?: boolean;
	title?: string;
	caseId?: string;
	resetAuditTrail?: boolean;
	setResetAuditTrail?: (value: boolean) => void;
}

interface StepType {
	description: string;
	id: string;
	templateVariables?: any;
	status: string;
	time: string;
	edit: boolean;
	toBeLinked?: string[];
}

interface payloadType {
	suppress_pagination_error: boolean;
	items_per_page: number;
	page: number;
	pagination: boolean;
	filter?: Record<string, TSelectedValueType[] | string>;
	filter_date?: Record<string, unknown>;
	case_id?: string;
}

const AuditTrail: React.FC<Props> = ({
	businessId,
	inCase = false,
	title = "Case activity",
	caseId,
	resetAuditTrail,
	setResetAuditTrail,
}) => {
	const [steps, setSteps] = useState<StepType[]>([]);
	const [pageEnd, setPageEnd] = useState(false);
	const [filterData, setFilterData] = useState<TFilterOption[]>([]);
	const [addComment, setAddComment] = useState(false);

	const [payload, setPayload] = useState<payloadType>({
		suppress_pagination_error: true,
		items_per_page: 10,
		page: 1,
		pagination: true,
		case_id: caseId,
	});

	const { data: auditTrailActionsData, isLoading: auditTrailActionsLoading } =
		useGetAuditTrailActions();

	const {
		data: caseAuditTrailData,
		isLoading: caseAuditTrailCommentLoading,
		refetch: refetchCaseAuditTrail,
	} = useGetAuditTrail({ businessID: businessId, params: payload });

	// Handles the filter options
	const filterHandler = async (
		selectedValues: Record<string, TSelectedValueType[] | string>,
	) => {
		await resetData();

		if (Object.keys(selectedValues).length > 0) {
			setPayload((values) => {
				return {
					...values,
					page: 1,
					filter: { ...selectedValues },
				};
			});
		} else {
			setPayload((values) => {
				delete values?.filter;
				return { ...values, page: 1 };
			});
		}
	};

	// Handles the date filter options
	const dateFilterHandler = (selectedDates: Record<string, DateType[]>) => {
		setPageEnd(false);
		setSteps([]);

		if (Object.keys(selectedDates).length > 0) {
			setPayload((values) => {
				return {
					...values,
					page: 1,
					filter_date: { ...selectedDates },
				};
			});
		} else {
			setPayload((values) => {
				delete values?.filter_date;
				return values;
			});
		}
	};

	// Used to reset data after adding or editing a comment or filter
	const resetData = async () => {
		setPayload({
			...payload,
			suppress_pagination_error: true,
			items_per_page: 10,
			page: 1,
			pagination: true,
			case_id: caseId,
		});
		await refetchCaseAuditTrail();
		setPageEnd(false);
		setAddComment(false);
	};

	// const {
	// 	mutateAsync: CaseAuditTrailComment,
	// 	data: CaseAuditTrailCommentData,
	// 	 error: CaseAuditTrailCommentError,
	// 	isLoading: caseAuditTrailCommentLoading,
	// } = useUpdateCaseAuditTrail();

	const fetchMoreData = () => {
		setPayload({ ...payload, page: Number(payload.page) + 1 });
		setTimeout(() => {
			void refetchCaseAuditTrail();
		}, 1500);
	};

	useEffect(() => {
		if (payload) {
			void refetchCaseAuditTrail();
		}
	}, [JSON.stringify(payload)]);

	// Detects end of data so we can add comment box at the end
	useEffect(() => {
		if (caseAuditTrailData && caseAuditTrailData?.data?.records.length < 10) {
			setPageEnd(true);
		}
	}, [caseAuditTrailData]);

	// Set filter data
	useEffect(() => {
		if (auditTrailActionsData?.status === "success") {
			const transformedFilterOptions = auditTrailActionsData?.data.map(
				(item: any) => ({
					label: item.label,
					value: item.code.toString(),
				}),
			);

			const updatedFilterData: TFilterOption[] = [
				{
					title: "Case activity",
					type: "checkbox",
					alias: "core_audit_trail_actions.code",
					filterOptions: transformedFilterOptions,
				},
				{
					title: "Date & time",
					type: "date-range",
					alias: "data_case_audit_trails.created_at",
				},
			];
			setFilterData(updatedFilterData);
		}
	}, [auditTrailActionsData]);

	// Set data to be displayed
	useEffect(() => {
		if (caseAuditTrailData?.data?.records) {
			setSteps((prevSteps) => {
				const existingIds = new Set(prevSteps.map((step) => step.id));
				const newSteps = caseAuditTrailData.data.records
					.filter((record: any) => !existingIds.has(record.id))
					.map((record: GetAuditTrailDataRecord) => ({
						id: record.id,
						description: transformText2(
							record.template,
							record.to_be_bold,
							record.to_be_hyperlinked,
						),
						templateVariables: sortVariables(
							record.template,
							record.metadata as unknown as Record<string, unknown>,
						),
						commentId: record.id,
						status: "auditTrail",
						time: record.created_at,
						edit: record.is_edited,
						toBeLinked: record.to_be_hyperlinked,
						attachments: record.attachments ?? {},
					}));
				if (caseAuditTrailData?.data?.page === "1")
					return [...newSteps, ...prevSteps];
				else return [...prevSteps, ...newSteps];
			});
		}
	}, [caseAuditTrailData]);

	// Add comment box at the end of the data
	useEffect(() => {
		if (caseAuditTrailData && pageEnd && inCase && !addComment) {
			setAddComment(true);
			setSteps((prevSteps) => {
				const existingIds = new Set(prevSteps.map((step) => step.id));
				if (existingIds.has("AddComment")) {
					return prevSteps;
				}
				return [
					...prevSteps,
					{
						description: "No more data",
						inCase,
						id: "AddComment",
						status: "addComment",
						time: "",
						edit: false,
					},
				];
			});
		}
	}, [pageEnd, steps, inCase, addComment, caseAuditTrailData]);

	useEffect(() => {
		if (resetAuditTrail && setResetAuditTrail) {
			void resetData();
			setResetAuditTrail(false);
		}
	}, [resetAuditTrail, setResetAuditTrail]);

	return (
		<>
			<div className="flex flex-row items-center justify-between">
				<p className="py-4 text-base font-bold">{title}</p>
				{filterData.length > 0 && (
					<Filter
						title={"Filter"}
						data={filterData}
						filterHandler={filterHandler}
						initialValues={
							(payload.filter ?? "") as Record<string, TSelectedValueType[]>
						}
						dateFilterPayload={
							payload?.filter_date
								? convertToStartEndDate(
										(payload.filter_date ?? "") as Record<string, DateType[]>,
									)
								: {}
						}
						dateFilterHandler={dateFilterHandler}
						type="small"
					/>
				)}
			</div>
			{(caseAuditTrailCommentLoading && steps.length < 1) ||
			auditTrailActionsLoading ? (
				<div className="flex justify-center py-2 tracking-tight">
					<TableLoader />
				</div>
			) : (
				<ActivityTimeline
					fetchMoreData={fetchMoreData}
					inCase={inCase}
					steps={steps}
					pageEnd={pageEnd}
					title={title}
					caseId={caseId ?? ""}
					businessId={businessId ?? ""}
					resetData={resetData}
				/>
			)}
		</>
	);
};

export default AuditTrail;
