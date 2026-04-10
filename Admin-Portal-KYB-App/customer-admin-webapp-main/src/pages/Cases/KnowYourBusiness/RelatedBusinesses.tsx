import React, { useEffect, useMemo } from "react";
import { generatePath, Link } from "react-router-dom";
import useCustomToast from "@/hooks/useCustomToast";
import { convertToLocalDate } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import { Bulk360Button } from "@/pages/Businesses/RelatedBusinesses";
import { useGetRelatedBusinesses } from "@/services/queries/businesses.query";
import {
	useDownloadBulkReport,
	useGenerateBulkReport,
	useGetBulkReportStatus,
} from "@/services/queries/report.query";
import { SectionHeader } from "./SectionHeader";

import { URL } from "@/constants/URL";

const RelatedBusinessesKYB = ({ businessId }: { businessId: string }) => {
	const customerId: string = getItem("customerId") ?? "";

	const { data: relatedBusinessesData, refetch } = useGetRelatedBusinesses(
		businessId ?? "",
		customerId,
		{ pagination: false },
	);
	const { successHandler } = useCustomToast();

	// Bulk 360 Functions
	const { data: bulkReportStatusData, isLoading: bulkReportStatusLoading } =
		useGetBulkReportStatus(businessId ?? "", customerId);

	const bulkReportStatus = useMemo(
		() => bulkReportStatusData?.data?.status,
		[bulkReportStatusData],
	);

	const {
		mutateAsync: bulkGenerateReport,
		data: bulkGenerateReportData,
		isPending: bulkGenerateLoading,
	} = useGenerateBulkReport();
	const {
		mutateAsync: downloadBulkReport,
		isPending: downloadBulkReportLoading,
	} = useDownloadBulkReport();

	useEffect(() => {
		if (bulkGenerateReportData) {
			successHandler({
				message:
					"Bulk 360 Report generation request has been successfully submitted.",
			});
			refetch().catch(() => {});
		}
	}, [bulkGenerateReportData]);

	return (
		<div>
			{relatedBusinessesData?.data?.records.length ? (
				<section className="container mx-auto">
					<div className="flex flex-col gap-8">
						<SectionHeader titleText="Related Businesses" />
						<div className="grid grid-cols-3">
							<div className="text-sm">Business ID #</div>
							<div className="text-sm">Business Name</div>
							<div className="text-sm">Onboarding Date</div>
						</div>
						{relatedBusinessesData?.data?.records?.map((item) => {
							return (
								<div className="grid grid-cols-3" key={item.id}>
									<div>
										<Link
											to={generatePath(URL.BUSINESS_DETAILS, {
												slug: item.id,
											})}
										>
											<div className="text-[#2563EB] text-sm">
												{`${item?.id.slice(0, 20)}...`}
											</div>
										</Link>
									</div>
									<div>
										<Link
											to={generatePath(URL.BUSINESS_DETAILS, {
												slug: item.id,
											})}
										>
											<div className="text-[#2563EB] text-sm">{item.name}</div>
										</Link>
									</div>
									<div>
										<div className="text-sm ">
											{convertToLocalDate(item.created_at, "MM/DD/YYYY")}
										</div>
									</div>
								</div>
							);
						})}
						<Bulk360Button
							bulkReportStatusLoading={bulkReportStatusLoading}
							bulkReportStatus={bulkReportStatus}
							bulkGenerateReport={bulkGenerateReport}
							downloadBulkReport={downloadBulkReport}
							downloadBulkReportLoading={downloadBulkReportLoading}
							bulkGenerateLoading={bulkGenerateLoading}
						/>
					</div>
				</section>
			) : null}
		</div>
	);
};

export default RelatedBusinessesKYB;
