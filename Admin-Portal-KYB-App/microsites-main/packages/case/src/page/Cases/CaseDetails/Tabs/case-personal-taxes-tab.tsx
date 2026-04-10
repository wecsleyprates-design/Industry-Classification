import React from "react";
import {
	ArrowDownTrayIcon,
	ChevronDownIcon,
	DocumentIcon,
	ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { useAppContextStore } from "@/store/useAppContextStore";

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

interface PersonalTaxFiling {
	year: string;
	form: string;
	filingDate: string;
	filingStatus: string;
	adjustedGrossIncome: number;
	totalTaxableIncome: number;
	totalTaxAmount: number;
	irsBalance: number;
	irsLiens: number;
	documents: Array<{
		name: string;
		downloadUrl: string;
	}>;
}

export interface CasePersonalTaxesTabProps {
	caseId: string;
	taxFilings: PersonalTaxFiling[];
}

const formatCurrency = (value: number) => {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 2,
	}).format(value);
};

const TaxDetails: React.FC<{ filing: PersonalTaxFiling }> = ({ filing }) => {
	const hasAnyData =
		filing.adjustedGrossIncome !== 0 ||
		filing.totalTaxableIncome !== 0 ||
		filing.totalTaxAmount !== 0 ||
		filing.irsBalance !== 0 ||
		filing.irsLiens !== 0;

	return (
		<div className="space-y-6">
			{!hasAnyData && (
				<div className="p-4 rounded-md bg-red-50">
					<div className="flex">
						<div className="flex-shrink-0">
							<ExclamationCircleIcon
								className="w-5 h-5 text-red-700"
								aria-hidden="true"
							/>
						</div>
						<div className="ml-3">
							<h3 className="text-sm font-medium text-red-700">
								We were unable to extract data for this tax
								document. Please download the document for
								further insights.
							</h3>
						</div>
					</div>
				</div>
			)}

			{hasAnyData && (
				<div className="grid grid-cols-2 gap-4">
					<div>
						<p className="text-sm font-medium text-gray-500">
							Tax Document Type
						</p>
						<p className="text-sm font-light tracking-wide">
							{filing.form}
						</p>
					</div>
					<div>
						<p className="text-sm font-medium text-gray-500">
							Filing Status
						</p>
						<p className="text-sm font-light tracking-wide">
							{filing.filingStatus}
						</p>
					</div>
					<div>
						<p className="text-sm font-medium text-gray-500">
							Filed/Processed Date
						</p>
						<p className="text-sm font-light tracking-wide">
							{filing.filingDate}
						</p>
					</div>
					<div>
						<p className="text-sm font-medium text-gray-500">
							Adjusted Gross Income
						</p>
						<p className="text-sm font-light tracking-wide">
							{formatCurrency(filing.adjustedGrossIncome)}
						</p>
					</div>
					<div>
						<p className="text-sm font-medium text-gray-500">
							Total Taxable Income
						</p>
						<p className="text-sm font-light tracking-wide">
							{formatCurrency(filing.totalTaxableIncome)}
						</p>
					</div>
					<div>
						<p className="text-sm font-medium text-gray-500">
							Total Tax Amount
						</p>
						<p className="text-sm font-light tracking-wide">
							{formatCurrency(filing.totalTaxAmount)}
						</p>
					</div>
					<div>
						<p className="text-sm font-medium text-gray-500">
							IRS Balance
						</p>
						<p className="text-sm font-light tracking-wide">
							{formatCurrency(filing.irsBalance)}
						</p>
					</div>
					<div>
						<p className="text-sm font-medium text-gray-500">
							IRS Liens
						</p>
						<p className="text-sm font-light tracking-wide">
							{formatCurrency(filing.irsLiens)}
						</p>
					</div>
				</div>
			)}

			{filing.documents.length > 0 && (
				<div>
					<h3 className="mb-3 text-sm font-medium text-gray-500">
						Documents
					</h3>
					<div className="space-y-2">
						{filing.documents.map((doc, index) => (
							<div
								key={index}
								className="flex items-center justify-between py-2"
							>
								<div className="flex items-center space-x-3">
									<DocumentIcon className="w-5 h-5 text-gray-400" />
									<span className="text-sm">{doc.name}</span>
								</div>
								<Button variant="outline" size="sm" asChild>
									<a href={doc.downloadUrl} download>
										<ArrowDownTrayIcon className="w-4 h-4" />
										<span className="sr-only">
											Download
										</span>
									</a>
								</Button>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
};

export const CasePersonalTaxesTab: React.FC<CasePersonalTaxesTabProps> = ({
	caseId,
	taxFilings,
}) => {
	const { customerId } = useAppContextStore();
	const [selectedYear, setSelectedYear] = React.useState(taxFilings[0]?.year);

	const selectedFiling = taxFilings.find(
		(filing) => filing.year === selectedYear,
	);

	const { caseData } = useGetCaseDetails({ caseId, customerId });

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between">
						<CardTitle className="text-lg font-medium tracking-wide">
							Personal Tax Filings
						</CardTitle>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									className="flex items-center gap-1"
								>
									{selectedYear} (Form {selectedFiling?.form})
									<ChevronDownIcon className="w-4 h-4" />
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
								{taxFilings.map((filing) => (
									<DropdownMenuCheckboxItem
										key={filing.year}
										checked={selectedYear === filing.year}
										onCheckedChange={() => {
											setSelectedYear(filing.year);
										}}
									>
										{filing.year} (Form {filing.form})
									</DropdownMenuCheckboxItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					</CardHeader>
					<CardContent>
						{selectedFiling && (
							<TaxDetails filing={selectedFiling} />
						)}
					</CardContent>
				</Card>
			</div>
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-5">
				<CaseProgressOrScore caseId={caseId} caseData={caseData} />
			</div>
		</div>
	);
};
