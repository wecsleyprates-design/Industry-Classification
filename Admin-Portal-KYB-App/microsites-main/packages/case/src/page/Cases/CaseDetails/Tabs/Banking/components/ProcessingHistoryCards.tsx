import type {
	GeneralData,
	PointOfSaleData,
	SeasonalData,
} from "@/types/integrations";
import { DisplayFieldValue, FileDownloads } from "../../../components";
import type { FieldSource } from "../../../components/fieldSource.types";
import { SYSTEM_SOURCE } from "../../../components/fieldSource.types";

import { VALUE_NOT_AVAILABLE } from "@/constants/ValueConstants";
import { formatCurrency } from "@/helpers/formatCurrency";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

type FieldSourceMap = Record<string, FieldSource>;

const getFs = (map: FieldSourceMap | undefined, key: string): FieldSource =>
	map?.[key] ?? SYSTEM_SOURCE;

export const ProcessingVolumeCardSkeleton: React.FC<{ title: string }> = ({
	title,
}) => {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base font-medium">{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-0">
					{[...Array(5)].map((_, index) => (
						<div
							key={index}
							className="flex items-center justify-between py-4 border-t border-gray-100"
						>
							<Skeleton className="w-24 h-5" />
							<Skeleton className="w-20 h-5" />
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
};

export const ProcessingVolumeCard: React.FC<{
	title: string;
	data?: GeneralData & { fieldSources?: FieldSourceMap };
}> = ({ title, data }) => {
	const fs = data?.fieldSources;
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base font-medium">{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-0">
					<div className="flex items-center justify-between py-4 border-t border-gray-100">
						<span className="text-sm text-gray-600">
							Annual Volume
						</span>
						<DisplayFieldValue
							value={formatCurrency(data?.annual_volume ?? 0)}
							fieldSource={getFs(fs, "annual_volume")}
						/>
					</div>
					<div className="flex items-center justify-between py-4 border-t border-gray-100">
						<span className="text-sm text-gray-600">
							Monthly Volume
						</span>
						<DisplayFieldValue
							value={formatCurrency(data?.monthly_volume ?? 0)}
							fieldSource={getFs(fs, "monthly_volume")}
						/>
					</div>
					<div className="flex items-center justify-between py-4 border-t border-gray-100">
						<span className="text-sm text-gray-600">
							Average Volume
						</span>
						<DisplayFieldValue
							value={formatCurrency(
								data?.average_ticket_size ?? 0,
							)}
							fieldSource={getFs(fs, "average_ticket_size")}
						/>
					</div>
					<div className="flex items-center justify-between py-4 border-t border-gray-100">
						<span className="text-sm text-gray-600">
							High Ticket
						</span>
						<DisplayFieldValue
							value={formatCurrency(data?.high_ticket_size ?? 0)}
							fieldSource={getFs(fs, "high_ticket_size")}
						/>
					</div>
					<div className="flex items-center justify-between py-4 border-t border-gray-100">
						<span className="text-sm text-gray-600">
							Desired Limit
						</span>
						<DisplayFieldValue
							value={formatCurrency(data?.desired_limit ?? 0)}
							fieldSource={getFs(fs, "desired_limit")}
						/>
					</div>
					{data?.monthly_occurrence_of_high_ticket && (
						<div className="flex items-center justify-between py-4 border-t border-gray-100">
							<span className="text-sm text-gray-600">
								Monthly Occurrence of High Ticket
							</span>
							<DisplayFieldValue
								value={`${data?.monthly_occurrence_of_high_ticket ?? 0}`}
								fieldSource={getFs(
									fs,
									"monthly_occurrence_of_high_ticket",
								)}
							/>
						</div>
					)}
					{data?.explanation_of_high_ticket && (
						<div className="flex items-center justify-between py-4 border-t border-gray-100">
							<span className="text-sm text-gray-600">
								Explanation of High Ticket
							</span>
							<DisplayFieldValue
								value={
									data?.explanation_of_high_ticket ??
									VALUE_NOT_AVAILABLE
								}
								fieldSource={getFs(
									fs,
									"explanation_of_high_ticket",
								)}
							/>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
};

export const PointOfSaleVolumeCardSkeleton: React.FC = () => {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base font-medium">
					Point of Sale Volume
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-0">
					{[...Array(4)].map((_, index) => (
						<div
							key={index}
							className="flex items-center justify-between py-4 border-t border-gray-100"
						>
							<Skeleton className="w-24 h-5" />
							<Skeleton className="w-12 h-5" />
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
};

export const PointOfSaleVolumeCard: React.FC<{
	data?: PointOfSaleData & { fieldSources?: FieldSourceMap };
}> = ({ data }) => {
	const fs = data?.fieldSources;
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base font-medium">
					Point of Sale Volume
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-0">
					<div className="flex items-center justify-between py-4 border-t border-gray-100">
						<span className="text-sm text-gray-600">
							Card (Swiped)
						</span>
						<DisplayFieldValue
							value={`${data?.swiped_cards ?? 0}%`}
							fieldSource={getFs(fs, "swiped_cards")}
						/>
					</div>
					<div className="flex items-center justify-between py-4 border-t border-gray-100">
						<span className="text-sm text-gray-600">
							Card (Typed)
						</span>
						<DisplayFieldValue
							value={`${data?.typed_cards ?? 0}%`}
							fieldSource={getFs(fs, "typed_cards")}
						/>
					</div>
					<div className="flex items-center justify-between py-4 border-t border-gray-100">
						<span className="text-sm text-gray-600">eCommerce</span>
						<DisplayFieldValue
							value={`${data?.e_commerce ?? 0}%`}
							fieldSource={getFs(fs, "e_commerce")}
						/>
					</div>
					<div className="flex items-center justify-between py-4 border-t border-gray-100">
						<span className="text-sm text-gray-600">
							Mail & Telephone
						</span>
						<DisplayFieldValue
							value={`${data?.mail_telephone ?? 0}%`}
							fieldSource={getFs(fs, "mail_telephone")}
						/>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

export const SeasonalDataCardSkeleton: React.FC = () => {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base font-medium">
					Point of Sale Volume
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-0">
					{[...Array(2)].map((_, index) => (
						<div
							key={index}
							className="flex items-center justify-between py-4 border-t border-gray-100"
						>
							<Skeleton className="w-24 h-5" />
							<Skeleton className="w-12 h-5" />
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
};

export const SeasonalDataCard: React.FC<{
	data?: SeasonalData & { fieldSources?: FieldSourceMap };
}> = ({ data }) => {
	const fs = data?.fieldSources;
	let highVolumeMonths = VALUE_NOT_AVAILABLE;

	if (data?.high_volume_months) {
		if (Array.isArray(data.high_volume_months)) {
			highVolumeMonths = data.high_volume_months.join(", ");
		} else {
			highVolumeMonths = data.high_volume_months;
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base font-medium">
					Seasonal
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="space-y-0">
					<div className="flex items-center justify-between py-4 border-t border-gray-100">
						<span className="text-sm text-gray-600">
							High Volume Months
						</span>
						<DisplayFieldValue
							value={highVolumeMonths}
							fieldSource={getFs(fs, "high_volume_months")}
						/>
					</div>
					<div className="flex items-center justify-between py-4 border-t border-gray-100">
						<span className="text-sm text-gray-600">
							Explanation of High Volume Months
						</span>
						<DisplayFieldValue
							value={
								data?.explanation_of_high_volume_months ??
								VALUE_NOT_AVAILABLE
							}
							fieldSource={getFs(
								fs,
								"explanation_of_high_volume_months",
							)}
						/>
					</div>
				</div>
			</CardContent>
		</Card>
	);
};

export const StatementsCardSkeleton: React.FC = () => {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base font-medium">
					Statements
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="divide-y divide-gray-200">
					{[...Array(2)].map((_, index) => (
						<div
							key={index}
							className="flex items-center justify-between py-4"
						>
							<div className="flex items-center space-x-2">
								<Skeleton className="w-32 h-5" />
							</div>
							<Skeleton className="h-9 w-9" />
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
};

export const StatementsCard: React.FC<{
	statements?: Array<{ fileName: string; signedUrl: string }>;
	fieldSource?: FieldSource;
}> = ({ statements = [], fieldSource }) => {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base font-medium">
					Statements
				</CardTitle>
			</CardHeader>
			<CardContent>
				<FileDownloads files={statements} fieldSource={fieldSource} />
			</CardContent>
		</Card>
	);
};
