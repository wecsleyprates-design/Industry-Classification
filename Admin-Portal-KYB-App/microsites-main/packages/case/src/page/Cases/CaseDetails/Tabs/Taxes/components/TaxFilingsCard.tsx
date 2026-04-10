import React from "react";
import {
	ChevronDownIcon,
	ExclamationCircleIcon,
} from "@heroicons/react/24/outline";
import { DisplayFieldValue, FileDownloads } from "../../../components";
import type { TaxFiling, TaxFilingDetail } from "../types";

import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

export const AnnualFilingDetailsSkeleton: React.FC = () => (
	<Card>
		<CardHeader className="flex flex-row items-center justify-between">
			<CardTitle className="text-lg font-medium tracking-wide">
				Annual Filings
			</CardTitle>
			<Button
				variant="outline"
				className="flex items-center gap-1"
				disabled
			>
				<Skeleton className="w-24 h-4" />
				<ChevronDownIcon className="w-4 h-4" />
			</Button>
		</CardHeader>
		<CardContent>
			<div className="flex flex-col py-3 sm:flex-row sm:justify-between sm:items-center">
				<p className="text-sm font-medium text-gray-500">
					Tax Document Type
				</p>
				<Skeleton className="w-32 h-5 mt-1" />
			</div>
			<div className="flex flex-col py-3 sm:flex-row sm:justify-between sm:items-center">
				<p className="text-sm font-medium text-gray-500">
					Filed/Processed Date
				</p>
				<Skeleton className="w-32 h-5 mt-1" />
			</div>
			<div className="flex flex-col py-3 sm:flex-row sm:justify-between sm:items-center">
				<p className="text-sm font-medium text-gray-500">
					Total Sales*
				</p>
				<Skeleton className="w-32 h-5 mt-1" />
			</div>
			<div className="flex flex-col py-3 sm:flex-row sm:justify-between sm:items-center">
				<p className="text-sm font-medium text-gray-500">
					Total Compensation*
				</p>
				<Skeleton className="w-32 h-5 mt-1" />
			</div>
			<div className="flex flex-col py-3 sm:flex-row sm:justify-between sm:items-center">
				<p className="text-sm font-medium text-gray-500">
					Total Wages*
				</p>
				<Skeleton className="w-32 h-5 mt-1" />
			</div>
			<div className="flex flex-col py-3 sm:flex-row sm:justify-between sm:items-center">
				<p className="text-sm font-medium text-gray-500">
					Cost of Goods Sold (COGS)*
				</p>
				<Skeleton className="w-32 h-5 mt-1" />
			</div>
			<div className="flex flex-col py-3 sm:flex-row sm:justify-between sm:items-center">
				<p className="text-sm font-medium text-gray-500">
					IRS Balance*
				</p>
				<Skeleton className="w-32 h-5 mt-1" />
			</div>
			<div className="flex flex-col py-3 sm:flex-row sm:justify-between sm:items-center">
				<p className="text-sm font-medium text-gray-500">IRS Liens*</p>
				<Skeleton className="w-32 h-5 mt-1" />
			</div>
		</CardContent>
	</Card>
);

export const QuarterlyFilingDetailsSkeleton: React.FC = () => (
	<Card>
		<CardHeader className="flex flex-row items-center justify-between">
			<CardTitle className="text-lg font-medium tracking-wide">
				Quarterly Filings
			</CardTitle>
			<Button
				variant="outline"
				className="flex items-center gap-1"
				disabled
			>
				<Skeleton className="w-24 h-4" />
				<ChevronDownIcon className="w-4 h-4" />
			</Button>
		</CardHeader>
		<CardContent>
			<div className="flex flex-col py-3 sm:flex-row sm:justify-between sm:items-center">
				<p className="text-sm font-medium text-gray-500">
					Tax Document Type
				</p>
				<Skeleton className="w-32 h-5 mt-1" />
			</div>
			<div className="flex flex-col py-3 sm:flex-row sm:justify-between sm:items-center">
				<p className="text-sm font-medium text-gray-500">
					Tax Period Ending
				</p>
				<Skeleton className="w-32 h-5 mt-1" />
			</div>
			<div className="flex flex-col py-3 sm:flex-row sm:justify-between sm:items-center">
				<p className="text-sm font-medium text-gray-500">
					Filed/Processed Date
				</p>
				<Skeleton className="w-32 h-5 mt-1" />
			</div>
			<div className="flex flex-col py-3 sm:flex-row sm:justify-between sm:items-center">
				<p className="text-sm font-medium text-gray-500">
					Amount Filed
				</p>
				<Skeleton className="w-32 h-5 mt-1" />
			</div>
			<div className="flex flex-col py-3 sm:flex-row sm:justify-between sm:items-center">
				<p className="text-sm font-medium text-gray-500">
					Account Balance
				</p>
				<Skeleton className="w-32 h-5 mt-1" />
			</div>
			<div className="flex flex-col py-3 sm:flex-row sm:justify-between sm:items-center">
				<p className="text-sm font-medium text-gray-500">
					Accrued Interest
				</p>
				<Skeleton className="w-32 h-5 mt-1" />
			</div>
		</CardContent>
	</Card>
);

export const TaxFilingDetails: React.FC<{
	filing?: TaxFiling;
}> = ({ filing }) => {
	const isEmptyData = filing?.details?.every(
		(detail: TaxFilingDetail) => detail.value === "-",
	);

	return (
		<div className="space-y-4">
			{isEmptyData && !!filing?.documents?.length && (
				<div className="p-4 mb-6 rounded-md bg-red-50">
					<div className="flex">
						<div className="flex-shrink-0">
							<ExclamationCircleIcon
								className="w-5 h-5 text-red-400"
								aria-hidden="true"
							/>
						</div>
						<div className="ml-3">
							<p className="text-sm text-red-600">
								We were unable to extract data for this tax
								document. Please download the document for
								further insights.
							</p>
						</div>
					</div>
				</div>
			)}

			<div className="flex flex-col divide-y divide-gray-100">
				{filing?.details?.map((detail: TaxFilingDetail) => (
					<div
						key={detail.label}
						className="flex flex-col py-3 sm:flex-row sm:justify-between sm:items-center"
					>
						<p className="text-sm text-gray-500">{detail.label}</p>
						<DisplayFieldValue
							value={detail.value}
							fieldSource={detail.fieldSource}
						/>
					</div>
				))}
			</div>
			{!!filing?.documents?.length && (
				<FileDownloads files={filing?.documents ?? []} />
			)}
		</div>
	);
};
