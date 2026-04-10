import React, { useEffect, useMemo, useState } from "react";
import { ChevronDownIcon, DocumentIcon } from "@heroicons/react/24/outline";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { formatSourceDate } from "@/lib/utils";
import { useGetTaxStatus } from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type TaxesData } from "@/types/taxes";
import { InternalFieldFooter, NullState } from "../../components";
import type { FieldSource } from "../../components/fieldSource.types";
import { SYSTEM_SOURCE } from "../../components/fieldSource.types";
import {
	AnnualFilingDetailsSkeleton,
	QuarterlyFilingDetailsSkeleton,
	TaxFilingDetails,
} from "./components/TaxFilingsCard";
import type { TaxFiling } from "./types";

import { formatCurrency } from "@/helpers/formatCurrency";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/ui/dropdown-menu";

function transformTaxApiResponseToTabData(taxes?: TaxesData): {
	annualFilings: TaxFiling[];
	quarterlyFilings: TaxFiling[];
} {
	const annualData = taxes?.annual_data ?? [];
	// Extract consent document if available
	const consentDocument: Array<{ fileName: string; signedUrl: string }> = [];
	if (taxes?.consent_file) {
		consentDocument.push({
			fileName: taxes?.consent_file?.fileName,
			signedUrl: taxes?.consent_file?.signedRequest,
		});
	}

	const guestOwnerEdits = taxes?.guest_owner_edits ?? [];
	const applicantSource = (fieldKey: string): FieldSource =>
		guestOwnerEdits.includes(fieldKey)
			? { type: "applicant" }
			: SYSTEM_SOURCE;

	let annualFilings: TaxFiling[] = annualData?.map((annual) => {
		const documents = (annual?.metadata?.ocr_document ?? []).map((doc) => ({
			fileName: doc.file.fileName,
			signedUrl: doc.file.signedRequest,
		}));
		return {
			year: String(annual.period),
			formType: annual.form ?? "",
			details: [
				{
					label: "Tax Document Type",
					value: annual.form ?? "-",
					fieldSource: applicantSource("form"),
				},
				{
					label: "Filed/Processed Date",
					value: annual.filed_date
						? formatSourceDate(annual.filed_date)
						: "-",
					fieldSource: applicantSource("filed_date"),
				},
				{
					label: "Total Sales",
					value: annual.total_sales
						? formatCurrency(annual.total_sales ?? 0)
						: "-",
					fieldSource: applicantSource("total_sales"),
				},
				{
					label: "Total Compensation",
					value: annual.total_compensation
						? formatCurrency(annual.total_compensation ?? 0)
						: "-",
					fieldSource: applicantSource("total_compensation"),
				},
				{
					label: "Total Wages",
					value: annual.total_wages
						? formatCurrency(annual.total_wages ?? 0)
						: "-",
					fieldSource: applicantSource("total_wages"),
				},
				{
					label: "Cost of Goods Sold (COGS)",
					value: annual.cost_of_goods_sold
						? formatCurrency(annual.cost_of_goods_sold ?? 0)
						: "-",
					fieldSource: applicantSource("cost_of_goods_sold"),
				},
				{
					label: "IRS Balance",
					value: annual.irs_balance
						? formatCurrency(annual.irs_balance ?? 0)
						: "-",
					fieldSource: applicantSource("irs_balance"),
				},
				{
					label: "IRS Liens",
					value: annual.lien_balance
						? formatCurrency(annual.lien_balance ?? 0)
						: "-",
					fieldSource: applicantSource("lien_balance"),
				},
			],
			documents,
		};
	});

	// If no annual data but there are documents, create empty filing
	if (annualFilings.length === 0 && consentDocument.length > 0) {
		annualFilings = [
			{
				year: "",
				formType: "",
				details: [
					{ label: "Tax Document Type", value: "-" },
					{ label: "Filed/Processed Date", value: "-" },
					{ label: "Total Sales", value: "-" },
					{ label: "Total Compensation", value: "-" },
					{ label: "Total Wages", value: "-" },
					{ label: "Cost of Goods Sold (COGS)", value: "-" },
					{ label: "IRS Balance", value: "-" },
					{ label: "IRS Liens", value: "-" },
				],
				documents: consentDocument,
			},
		];
	}

	const quarterlyFilings: TaxFiling[] = annualData?.flatMap((data) =>
		(data.quarterlyData ?? []).map((quarter) => ({
			year: String(quarter.periodYear),
			quarter: String(Math.ceil((quarter.periodMonth || 0) / 3)),
			formType: quarter.form ?? "",
			details: [
				{
					label: "Tax Document Type",
					value: quarter.form ?? "-",
					fieldSource: applicantSource("form"),
				},
				{
					label: "Tax Period Ending",
					value: quarter.tax_period_ending_date
						? formatSourceDate(quarter.tax_period_ending_date)
						: "-",
					fieldSource: applicantSource("tax_period_ending_date"),
				},
				{
					label: "Filed/Processed Date",
					value: quarter.filed_date
						? formatSourceDate(quarter.filed_date)
						: "-",
					fieldSource: applicantSource("filed_date"),
				},
				{
					label: "Amount Filed",
					value: quarter.amount_filed
						? formatCurrency(Number(quarter.amount_filed ?? 0))
						: "-",
					fieldSource: applicantSource("amount_filed"),
				},
				{
					label: "Account Balance",
					value: quarter.balance
						? formatCurrency(Number(quarter.balance ?? 0))
						: "-",
					fieldSource: applicantSource("balance"),
				},
				{
					label: "Accrued Interest",
					value: quarter.interest
						? formatCurrency(Number(quarter.interest ?? 0))
						: "-",
					fieldSource: applicantSource("interest"),
				},
			],
			documents: [],
		})),
	);

	// sort annual filings by descending year
	const sortedAnnualFilings = annualFilings.sort(
		(a, b) => Number(b.year) - Number(a.year),
	);

	// sort quarterly filings by descending year and quarter
	const sortedQuarterlyFilings = quarterlyFilings.sort((a, b) =>
		`${b.year}${b.quarter}`.localeCompare(`${a.year}${a.quarter}`),
	);

	return {
		annualFilings: sortedAnnualFilings,
		quarterlyFilings: sortedQuarterlyFilings,
	};
}

export const BusinessTaxesTab: React.FC<{ caseId: string }> = ({ caseId }) => {
	const { customerId } = useAppContextStore();

	const { caseData } = useGetCaseDetails({ caseId, customerId });

	const businessId = caseData?.data?.business.id ?? "";

	const {
		data: taxesData,
		isLoading: isTaxesLoading,
		error: taxesError,
	} = useGetTaxStatus({
		businessId,
		caseId,
	});

	const { annualFilings, quarterlyFilings } = useMemo(
		() => transformTaxApiResponseToTabData(taxesData?.data),
		[taxesData],
	);

	const [selectedAnnualFiling, setSelectedAnnualFiling] =
		useState<TaxFiling | null>(null);
	const [selectedQuarterlyFiling, setSelectedQuarterlyFiling] =
		useState<TaxFiling | null>(null);

	// sets initial filings to be the first filing in the lists
	useEffect(() => {
		if (annualFilings.length > 0 && !selectedAnnualFiling) {
			setSelectedAnnualFiling(annualFilings[0]);
		}
		if (quarterlyFilings.length > 0 && !selectedQuarterlyFiling) {
			setSelectedQuarterlyFiling(quarterlyFilings[0]);
		}
	}, [
		annualFilings,
		quarterlyFilings,
		selectedAnnualFiling,
		selectedQuarterlyFiling,
	]);

	if (isTaxesLoading) {
		return (
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
				<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
					<AnnualFilingDetailsSkeleton />
					<QuarterlyFilingDetailsSkeleton />
				</div>
				<div className="flex flex-col col-span-1 gap-4 lg:col-span-5">
					<CaseProgressOrScore caseId={caseId} caseData={caseData} />
				</div>
			</div>
		);
	}

	if (taxesError) {
		return <div className="p-4 text-red-500">Error loading tax data</div>;
	}

	if (
		annualFilings.length === 0 &&
		quarterlyFilings.length === 0 &&
		!taxesData?.data.consent_file
	) {
		return (
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
				<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
					<Card>
						<NullState
							icon={
								<DocumentIcon className="text-blue-600 size-10" />
							}
							title="No Tax Filings"
							description="No tax filings were found for the associated TIN."
						/>
					</Card>
				</div>
				<div className="flex flex-col col-span-1 gap-4 lg:col-span-5">
					<CaseProgressOrScore caseId={caseId} caseData={caseData} />
				</div>
			</div>
		);
	}

	// hide the annual filing dropdown if there is a single filing without a year
	// this is to primarily handle the case where there is no annual data but there is a document
	const showAnnualFilingDropdown =
		!!selectedAnnualFiling?.year ||
		(!selectedAnnualFiling && annualFilings.length > 1);

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
				{annualFilings.length > 0 && (
					<Card>
						<CardHeader className="flex flex-row items-center justify-between px-6 py-4 bg-white">
							<CardTitle className="text-lg font-medium">
								Annual Filings
							</CardTitle>
							{showAnnualFilingDropdown && (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="outline"
											className="flex items-center gap-2 h-9"
										>
											{selectedAnnualFiling?.year}
											{selectedAnnualFiling?.formType
												? ` (Form ${selectedAnnualFiling?.formType})`
												: ""}
											<ChevronDownIcon className="w-4 h-4 text-gray-500" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent
										align="end"
										className="w-[200px]"
									>
										<DropdownMenuLabel>
											Select Year
										</DropdownMenuLabel>
										<DropdownMenuSeparator />
										{annualFilings.map((filing) => (
											<DropdownMenuCheckboxItem
												key={filing.year}
												checked={
													selectedAnnualFiling?.year ===
													filing.year
												}
												onCheckedChange={() => {
													setSelectedAnnualFiling(
														filing,
													);
												}}
											>
												{filing.year}
												{filing.formType
													? ` (Form ${filing.formType})`
													: ""}
											</DropdownMenuCheckboxItem>
										))}
									</DropdownMenuContent>
								</DropdownMenu>
							)}
						</CardHeader>
						<CardContent className="px-6 py-4">
							{selectedAnnualFiling && (
								<TaxFilingDetails
									filing={selectedAnnualFiling}
								/>
							)}
						</CardContent>
					</Card>
				)}
				{quarterlyFilings.length > 0 && (
					<Card>
						<CardHeader className="flex flex-row items-center justify-between px-6 py-4 bg-white">
							<CardTitle className="text-lg font-medium">
								Quarterly Filings
							</CardTitle>
							{selectedQuarterlyFiling && (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="outline"
											className="flex items-center gap-2 h-9"
										>
											{selectedQuarterlyFiling
												? `${selectedQuarterlyFiling.year} Q${selectedQuarterlyFiling.quarter} (Form ${selectedQuarterlyFiling.formType})`
												: "Select Period"}
											<ChevronDownIcon className="w-4 h-4 text-gray-500" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent
										align="end"
										className="w-[200px]"
									>
										<DropdownMenuLabel>
											Select Period
										</DropdownMenuLabel>
										<DropdownMenuSeparator />
										{quarterlyFilings.map((filing) => (
											<DropdownMenuCheckboxItem
												key={`${filing.year}-${filing.quarter}`}
												checked={
													selectedQuarterlyFiling?.year ===
														filing.year &&
													selectedQuarterlyFiling?.quarter ===
														filing.quarter
												}
												onCheckedChange={() => {
													setSelectedQuarterlyFiling(
														filing,
													);
												}}
											>
												{filing.year} Q{filing.quarter}{" "}
												(Form {filing.formType})
											</DropdownMenuCheckboxItem>
										))}
									</DropdownMenuContent>
								</DropdownMenu>
							)}
						</CardHeader>
						<CardContent className="px-6 py-4">
							{selectedQuarterlyFiling && (
								<TaxFilingDetails
									filing={selectedQuarterlyFiling}
								/>
							)}
						</CardContent>
					</Card>
				)}
				<InternalFieldFooter
					hasApplicantFields={
						(taxesData?.data?.guest_owner_edits?.length ?? 0) > 0
					}
					hasInternalFields={false}
				/>
			</div>
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-5">
				<CaseProgressOrScore caseId={caseId} caseData={caseData} />
			</div>
		</div>
	);
};
