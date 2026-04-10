import React from "react";
import { Link } from "react-router-dom";
import { BuildingOfficeIcon, EyeIcon } from "@heroicons/react/24/outline";
import { DownloadReportButtons } from "@/components/DownloadReportButtons";
import { useSearchState } from "@/hooks";
import { formatDate } from "@/lib/helper";
import { useGetRelatedBusinesses } from "@/services/queries/businesses.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type RelatedBusiness } from "@/types/business";
import { NullState } from "../../components";
import { BulkDownload360ReportsButton } from "./components/BulkDownload360ReportsButton";

import { Card, CardHeader, CardTitle } from "@/ui/card";
import { DataTable, type DataTableColumn } from "@/ui/DataTable/DataTable";
import { Tooltip } from "@/ui/tooltip";

export interface RelatedBusinessesTabProps {
	caseId: string;
	businessId: string;
}

export const RelatedBusinessesTab: React.FC<RelatedBusinessesTabProps> = ({
	caseId,
	businessId,
}) => {
	const { customerId } = useAppContextStore();
	const [page, setPage] = useSearchState<string>("page", "1");

	const { data, isLoading, refetch } = useGetRelatedBusinesses(
		customerId,
		businessId,
		`page=${page}`,
	);

	const records = data?.data?.records ?? [];
	const tableColumns: Array<DataTableColumn<RelatedBusiness>> = [
		{
			label: "Business ID #",
			accessor: "id",
			render: (id) => (
				<Link
					to={`/businesses/${id}`}
					className="text-blue-500 cursor-pointer hover:underline"
					target={"_blank"}
					rel={"noopener noreferrer"}
				>
					{id}
				</Link>
			),
		},
		{
			label: "Business Name",
			accessor: "name",
		},
		{
			label: "Onboarding Date",
			accessor: "created_at",
			render: (date) => formatDate(date, "MM/DD/YYYY", { local: false }),
		},
		{
			label: "Actions",
			accessor: "id", // We use id but render based on the full business object
			render: (_, business) => {
				const relatedBusiness = business;
				return (
					<div className="flex space-x-2">
						<Tooltip
							content="View Business"
							trigger={
								<Link
									to={`/businesses/${relatedBusiness.id}`}
									target={"_blank"}
									rel={"noopener noreferrer"}
								>
									<EyeIcon className="w-5 h-5 text-blue-700 cursor-pointer" />
								</Link>
							}
						/>
						<DownloadReportButtons
							status={relatedBusiness.report_status}
							reportId={relatedBusiness.report_id}
							businessId={relatedBusiness.id}
							caseId={caseId}
							onModalClose={refetch}
						/>
					</div>
				);
			},
		},
	];

	if (!isLoading && records.length === 0) {
		return (
			<Card>
				<NullState
					title="No related businesses found"
					description="There are no related businesses for this case."
					icon={<BuildingOfficeIcon className="w-10 h-10" />}
				/>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<CardTitle>Related Businesses</CardTitle>
					<BulkDownload360ReportsButton
						customerId={customerId}
						businessId={businessId}
						onRefetchBulkReportStatus={refetch}
					/>
				</div>
			</CardHeader>
			<div className="p-4 space-y-4">
				<DataTable<RelatedBusiness>
					columns={tableColumns}
					data={data}
					isLoading={isLoading}
					currentPage={Number(page)}
					onPageChange={(page) => {
						setPage(String(page));
					}}
				/>
			</div>
		</Card>
	);
};
