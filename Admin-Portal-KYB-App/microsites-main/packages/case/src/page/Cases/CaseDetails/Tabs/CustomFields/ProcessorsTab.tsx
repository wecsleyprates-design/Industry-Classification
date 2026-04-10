import React, { useCallback, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type CustomField } from "@/types/case";
import { CardList } from "../../components";
import { CardListItem } from "../KYB/components";

import { VALUE_NOT_AVAILABLE } from "@/constants/ValueConstants";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

export interface ProcessorsTabProps {
	caseId: string;
}

/** Helper function to clean label by removing processor prefix */
const cleanLabel = (label: string): string => {
	// Remove patterns like "Visa - ", "Mastercard - ", etc.
	return label.replace(/^[^-]+-\s*/, "");
};

/** Individual processor card component with expand/collapse */
const ProcessorCard: React.FC<{
	processorName: string;
	fields: CustomField[];
	businessName: string;
	dbaName: string;
	businessAddress: string;
}> = ({ processorName, fields, businessName, dbaName, businessAddress }) => {
	const [expanded, setExpanded] = useState(true);

	const toggleExpanded = useCallback(() => {
		setExpanded((prev) => !prev);
	}, []);

	const handleChevronClick = useCallback((e: React.MouseEvent) => {
		e.stopPropagation();
		setExpanded((prev) => !prev);
	}, []);

	const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			setExpanded((prev) => !prev);
		}
	}, []);

	return (
		<div className="border border-border rounded-md bg-card">
			<div
				role="button"
				tabIndex={0}
				aria-expanded={expanded}
				className="p-4 flex items-center justify-between cursor-pointer rounded-t-md"
				onClick={toggleExpanded}
				onKeyDown={handleKeyDown}
			>
				<h3 className="font-semibold text-gray-900 text-base">
					{processorName}
				</h3>

				<Button
					variant="ghost"
					size="sm"
					className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
					aria-label={expanded ? "Collapse" : "Expand"}
					onClick={handleChevronClick}
				>
					{expanded ? (
						<ChevronUp className="w-4 h-4" />
					) : (
						<ChevronDown className="w-4 h-4" />
					)}
				</Button>
			</div>

			{expanded && (
				<div className="px-4 pb-4">
					<CardList>
						{/* Business Information Fields */}
						<CardListItem
							title="Merchant Name"
							value={businessName}
						/>
						<CardListItem title="DBA" value={dbaName} />
						<CardListItem title="Address" value={businessAddress} />

						{/* Custom Fields for this processor */}
						{fields
							.sort(
								(a, b) => a.sequence_number - b.sequence_number,
							)
							.map((field) => (
								<CardListItem
									key={field.id}
									title={cleanLabel(field.label)}
									value={String(
										field.value ?? VALUE_NOT_AVAILABLE,
									)}
								/>
							))}
					</CardList>
				</div>
			)}
		</div>
	);
};

export const ProcessorsTab: React.FC<ProcessorsTabProps> = ({ caseId }) => {
	const { customerId } = useAppContextStore();

	const { caseData, caseIdQueryLoading } = useGetCaseDetails({
		caseId,
		customerId,
	});

	const business = caseData?.data?.business;
	const dbaName =
		caseData?.data?.business_names?.find((dba) => !dba.is_primary)?.name ??
		VALUE_NOT_AVAILABLE;

	/** Filter and group processor custom fields by step_name (processor type) */
	const customFields = useMemo(() => {
		if (!caseData?.data?.custom_fields) {
			return [];
		}

		return caseData.data.custom_fields
			.filter((field) => {
				return field.internalName
					?.toLowerCase()
					?.startsWith("processor_");
			})
			.map((field): CustomField => {
				const baseField: Partial<CustomField> = {
					id: field.id,
					label: field.label,
					value: field?.value ?? VALUE_NOT_AVAILABLE,
					is_sensitive: field.is_sensitive,
					internalName: field.internalName,
					step_name: field.step_name,
					sequence_number: field.sequence_number,
					rules: field.rules ?? [],
					property: field.property,
					fileName: field.fileName,
					user: field.user,
				};

				return baseField as CustomField;
			});
	}, [caseData?.data?.custom_fields]);

	const groupedFields = useMemo(() => {
		const fields = customFields;
		return fields.reduce<Record<string, CustomField[]>>((acc, field) => {
			const stepName = field.step_name;
			if (!acc[stepName]) {
				acc[stepName] = [];
			}
			acc[stepName].push(field);
			return acc;
		}, {});
	}, [customFields]);

	/** Format address from business data */
	const businessAddress = useMemo(() => {
		if (!business) return VALUE_NOT_AVAILABLE;

		const parts = [
			business.address_line_1,
			business.address_line_2,
			business.address_city,
			business.address_state,
			business.address_postal_code,
			business.address_country,
		].filter(Boolean);

		return parts.length > 0 ? parts.join(", ") : VALUE_NOT_AVAILABLE;
	}, [business]);

	const hasProcessorFields = Object.keys(groupedFields).length > 0;

	const handleResubmit = useCallback(() => {
		toast.info("Not yet configured");
	}, []);

	if (caseIdQueryLoading) {
		return (
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
				<div className="col-span-1 lg:col-span-7">
					<Card>
						<CardHeader>
							<Skeleton className="w-32 h-6" />
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								{Array.from({ length: 5 }).map((_, index) => (
									<div
										key={index}
										className="flex items-center justify-between"
									>
										<Skeleton className="w-24 h-4" />
										<Skeleton className="w-32 h-4" />
									</div>
								))}
							</div>
						</CardContent>
					</Card>
				</div>
				<div className="col-span-1 lg:col-span-5">
					<Skeleton className="w-full h-64" />
				</div>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
			<div className="col-span-1 lg:col-span-7">
				<Card>
					<CardHeader className="flex flex-row items-center justify-between">
						<div className="flex items-center gap-2">
							<CardTitle className="text-lg font-semibold">
								Processor Integrations
							</CardTitle>
							{hasProcessorFields && (
								<Button
									variant="default"
									size="sm"
									onClick={handleResubmit}
									className="gap-2 h-8 text-xs text-secondary hover:bg-blue-600/90"
								>
									<RefreshCw className="w-3.5 h-3.5" />
									Resubmit
								</Button>
							)}
						</div>
					</CardHeader>
					<CardContent>
						{hasProcessorFields ? (
							<div className="space-y-4">
								{Object.entries(groupedFields)
									.sort(([, fieldsA], [, fieldsB]) => {
										// Sort by minimum sequence number in each group
										const minA = Math.min(
											...fieldsA.map(
												(f) => f.sequence_number,
											),
										);
										const minB = Math.min(
											...fieldsB.map(
												(f) => f.sequence_number,
											),
										);
										return minA - minB;
									})
									.map(([processorName, fields]) => (
										<ProcessorCard
											key={processorName}
											processorName={processorName}
											fields={fields}
											businessName={
												business?.name ??
												VALUE_NOT_AVAILABLE
											}
											dbaName={dbaName}
											businessAddress={businessAddress}
										/>
									))}
							</div>
						) : null}
					</CardContent>
				</Card>
			</div>

			<div className="col-span-1 lg:col-span-5">
				<CaseProgressOrScore caseId={caseId} caseData={caseData} />
			</div>
		</div>
	);
};
