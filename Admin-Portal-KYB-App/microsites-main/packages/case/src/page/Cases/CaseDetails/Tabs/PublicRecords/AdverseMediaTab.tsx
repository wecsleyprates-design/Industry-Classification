import React, { useMemo, useState } from "react";
import {
	InformationCircleIcon,
	NewspaperIcon,
} from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import calendar from "dayjs/plugin/calendar";
import relativeTime from "dayjs/plugin/relativeTime";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { formatAdverseMediaSourceAndDate, truncateTitle } from "@/lib/helper";
import { cn } from "@/lib/utils";
import {
	useGetAdverseMedia,
	useGetAdverseMediaByBusinessId,
} from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import {
	type AdverseMediaItem,
	type MediaEntry,
	type RiskLevel,
} from "@/types/case";

import { VerificationBadge } from "@/ui/badge";
import { Card, CardHeader, CardTitle } from "@/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover";
import { Skeleton } from "@/ui/skeleton";

export interface AdverseMediaTabProps {
	caseId: string;
	businessId?: string;
}

export interface FilterToggleProps {
	allArticles: MediaEntry[];
	showAllArticles: boolean;
	mediaType: string;
	onToggleFilter: (mediaType: string) => void;
}

// Initialize the plugins
dayjs.extend(calendar);
dayjs.extend(relativeTime);

const getRiskVariant = (risk: RiskLevel) => {
	switch (risk) {
		case "low":
			return "success";
		case "moderate":
			return "warning";
		case "high":
			return "destructive";
		default:
			return "default";
	}
};

const getRiskBadgeClass = (risk: RiskLevel) => {
	switch (risk) {
		case "high":
			return "bg-red-50 text-red-700 shadow-none";
		case "moderate":
			return "bg-yellow-50 text-yellow-800 shadow-none";
		case "low":
			return "bg-green-50 text-green-700 shadow-none";
	}
};

const MediaEntryItem: React.FC<{ entry: MediaEntry }> = ({ entry }) => {
	const formattedDate = entry.publishedDate
		? dayjs.utc(entry.publishedDate).calendar(null, {
				sameDay: "[TODAY]",
				lastDay: "[YESTERDAY]",
				lastWeek: "MM/DD/YY h:mm A",
				sameElse: "MM/DD/YY h:mm A",
			})
		: null;

	const getConfidenceScoreClass = (score: number) => {
		if (score >= 7) return "bg-green-50 text-green-700";
		if (score >= 3) return "bg-yellow-50 text-yellow-800";
		return "bg-red-50 text-red-700";
	};

	return (
		<div className="py-4 border-t border-gray-100 first:border-t-0">
			<div className="flex flex-col items-start gap-2 mb-3">
				{entry.sourceUrl ? (
					<a
						href={entry.sourceUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="text-base font-medium text-blue-600 hover:underline"
					>
						{truncateTitle(entry.title)}
					</a>
				) : (
					<h4 className="text-base font-medium text-gray-700">
						{truncateTitle(entry.title)}
					</h4>
				)}
				<div className="flex items-center gap-2 text-sm text-gray-500">
					{formatAdverseMediaSourceAndDate(
						entry.source,
						formattedDate,
					)}
				</div>
			</div>
			<p className="mb-4 text-sm leading-relaxed text-gray-600">
				{entry.summary}
			</p>
			<div className="flex items-start space-x-6">
				<div className="flex flex-col items-start gap-1">
					<div className="flex items-center gap-1">
						<span className="text-sm text-gray-500">
							Confidence Score
						</span>
						<Popover>
							<PopoverTrigger>
								<InformationCircleIcon className="text-gray-500 cursor-pointer size-4" />
							</PopoverTrigger>
							<PopoverContent side="top">
								<p className="p-0 m-0 text-sm leading-normal">
									Confidence score is a measure of the
									likelihood that the information in the media
									is accurate.
								</p>
							</PopoverContent>
						</Popover>
					</div>
					<div
						className={cn(
							"inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-sm font-medium",
							getConfidenceScoreClass(entry.confidenceScore),
						)}
					>
						{entry.confidenceScore}
					</div>
				</div>
				<div className="flex flex-col items-start gap-1">
					<div className="flex items-center gap-1">
						<span className="text-sm text-gray-500">Risk</span>
						<Popover>
							<PopoverTrigger>
								<InformationCircleIcon className="text-gray-500 cursor-pointer size-4" />
							</PopoverTrigger>
							<PopoverContent side="top">
								<p className="p-0 m-0 text-sm leading-normal">
									Risk is a measure of the likelihood that the
									information in the media is accurate.
								</p>
							</PopoverContent>
						</Popover>
					</div>
					<VerificationBadge
						variant={getRiskVariant(entry.risk)}
						className={getRiskBadgeClass(entry.risk)}
					>
						{entry.risk.charAt(0).toUpperCase() +
							entry.risk.slice(1)}{" "}
						Risk
					</VerificationBadge>
				</div>
			</div>
		</div>
	);
};

const FilterToggle = ({
	allArticles,
	showAllArticles,
	mediaType,
	onToggleFilter,
}: FilterToggleProps) => {
	const relevantCount = allArticles.filter(
		(article) =>
			article.confidenceScore >= 8 &&
			(article.risk === "moderate" || article.risk === "high"),
	).length;

	const allCount = allArticles.length;

	return (
		<div className="flex items-center gap-2">
			<button
				onClick={() => {
					onToggleFilter(mediaType);
				}}
				disabled={!showAllArticles}
				className={cn(
					"text-sm font-medium transition-colors",
					!showAllArticles
						? "text-blue-600 cursor-default"
						: "text-gray-500 hover:text-gray-700 cursor-pointer",
				)}
			>
				Relevant ({relevantCount})
			</button>
			<span className="text-gray-400">/</span>
			<button
				onClick={() => {
					onToggleFilter(mediaType);
				}}
				disabled={showAllArticles}
				className={cn(
					"text-sm font-medium transition-colors",
					showAllArticles
						? "text-blue-600 cursor-default"
						: "text-gray-500 hover:text-gray-700 cursor-pointer",
				)}
			>
				All ({allCount})
			</button>
		</div>
	);
};

const MediaTypeSection: React.FC<{
	title: string;
	articles: MediaEntry[];
	allArticles: MediaEntry[];
	riskLevel: RiskLevel;
	mediaType: string;
	showAllArticles: boolean;
	onToggleFilter: (mediaType: string) => void;
}> = ({
	title,
	articles,
	allArticles,
	riskLevel,
	mediaType,
	showAllArticles,
	onToggleFilter,
}) => (
	<div className="flex flex-col overflow-hidden bg-white border border-gray-100 rounded-2xl">
		<CardHeader className="flex flex-row items-center justify-between px-6 pt-4 pb-4 space-y-0">
			<div className="flex items-center space-x-3">
				<CardTitle className="text-lg font-semibold text-gray-900">
					{title}
				</CardTitle>
				<VerificationBadge
					variant={getRiskVariant(riskLevel)}
					className={cn("font-medium", getRiskBadgeClass(riskLevel))}
				>
					{riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}{" "}
					Risk
				</VerificationBadge>
			</div>
			<FilterToggle
				allArticles={allArticles}
				showAllArticles={showAllArticles}
				mediaType={mediaType}
				onToggleFilter={onToggleFilter}
			/>
		</CardHeader>
		<div className="px-6 pb-2">
			{articles.map((entry, index) => (
				<MediaEntryItem key={index} entry={entry} />
			))}
		</div>
	</div>
);

const EmptyState: React.FC = () => (
	<Card className="flex flex-col items-center justify-center px-4 py-12">
		<NewspaperIcon className="w-12 h-12 mb-4 text-gray-300" />
		<h3 className="mb-2 text-lg font-semibold text-gray-900">
			No Adverse Media Found
		</h3>
		<p className="max-w-sm text-sm text-center text-gray-500">
			We haven't found any adverse media mentions for this entity in our
			searches.
		</p>
	</Card>
);

const LoadingState: React.FC<{ key: number }> = ({ key }) => (
	<Card key={key} className="p-4 space-y-4">
		<div className="flex items-center justify-start gap-2">
			<Skeleton className="w-48 h-6" />
			<Skeleton className="w-20 h-6 rounded-lg" />{" "}
		</div>
		<Skeleton className="w-3/4 h-5" />
		<Skeleton className="w-32 h-4" />
		<div className="space-y-2">
			<Skeleton className="w-full h-4" />
			<Skeleton className="w-11/12 h-4" />
			<Skeleton className="w-10/12 h-4" />
			<Skeleton className="w-3/4 h-4" />
		</div>
		<div className="flex justify-start gap-x-4">
			<div className="flex flex-col gap-y-2">
				<Skeleton className="w-24 h-5" />
				<Skeleton className="w-6 h-6 rounded-full" />
			</div>
			<div className="flex flex-col gap-y-2">
				<Skeleton className="w-24 h-5" />
				<Skeleton className="w-20 h-4" />
			</div>
		</div>
	</Card>
);

export const AdverseMediaTab: React.FC<AdverseMediaTabProps> = ({ caseId }) => {
	const { customerId } = useAppContextStore();

	const { caseData: getApplicantData } = useGetCaseDetails({
		caseId,
		customerId,
	});
	const businessId = getApplicantData?.data?.business.id ?? "";

	const { data: caseData, isLoading: isCaseLoading } =
		useGetAdverseMedia(caseId);
	const { data: businessData, isLoading: isBusinessLoading } =
		useGetAdverseMediaByBusinessId(businessId);

	const apiData = useMemo(() => {
		const caseArticles = caseData?.data?.articles;
		const businessArticles = businessData?.data?.articles;

		if (Array.isArray(caseArticles) && caseArticles.length > 0) {
			return caseData;
		} else if (
			Array.isArray(businessArticles) &&
			businessArticles.length > 0
		) {
			return businessData;
		} else {
			return caseData ?? businessData;
		}
	}, [caseData, businessData]);

	const isLoading = isCaseLoading || isBusinessLoading;

	const [sectionFilters, setSectionFilters] = useState<
		Record<string, boolean>
	>({});

	const mediaSourcesByType: Record<
		string,
		{
			articles: MediaEntry[];
			riskLevel: RiskLevel;
			allArticles: MediaEntry[];
		}
	> = useMemo(() => {
		const rawSources = apiData?.data?.articles ?? [];

		// Group articles by media type
		const groupedByMediaType: Record<string, any[]> = {};

		rawSources.forEach((item: AdverseMediaItem) => {
			const mediaType = item.media_type ?? "business";
			if (!groupedByMediaType[mediaType]) {
				groupedByMediaType[mediaType] = [];
			}
			groupedByMediaType[mediaType].push(item);
		});

		// Convert each group to the new format
		const result: Record<
			string,
			{
				articles: MediaEntry[];
				riskLevel: RiskLevel;
				allArticles: MediaEntry[];
			}
		> = {};

		Object.keys(groupedByMediaType).forEach((mediaType) => {
			const allArticles = groupedByMediaType[mediaType].map((item) => {
				const risk = item?.risk_level
					? ((item.risk_level.toLowerCase() === "medium"
							? "moderate"
							: item.risk_level.toLowerCase()) as RiskLevel)
					: "low";

				return {
					title: item.title,
					publishedDate: item.date,
					summary: item.risk_description,
					confidenceScore: item.entity_focus_score || 0,
					risk,
					sourceUrl: item.link,
					mediaType: item.media_type,
					source: item.source || "Unknown",
				} as MediaEntry & { source: string };
			});

			// Filter for relevant articles: high confidence (8+) AND medium to high risk
			const relevantArticles = allArticles.filter(
				(article) =>
					article.confidenceScore >= 8 &&
					(article.risk === "moderate" || article.risk === "high"),
			);

			// Determine the highest risk level for this media type
			const riskLevels = allArticles.map((a) => a.risk);
			const highestRisk: RiskLevel = riskLevels.includes("high")
				? "high"
				: riskLevels.includes("moderate")
					? "moderate"
					: "low";

			// Use section-specific filter state, default to false (show relevant)
			const showAllForSection = sectionFilters[mediaType] || false;

			result[mediaType] = {
				articles: showAllForSection ? allArticles : relevantArticles,
				riskLevel: highestRisk,
				allArticles,
			};
		});

		return result;
	}, [apiData, sectionFilters]);

	const getSectionTitle = (mediaType: string) => {
		if (mediaType === "business") {
			return getApplicantData?.data?.business?.name ?? "Business";
		}
		// Capitalize each word for individual names
		return mediaType
			.split(" ")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	};

	const renderAdverseMediaContent = () => {
		if (isLoading) {
			return Array.from({ length: 2 }, (_, index) => (
				<LoadingState key={index} />
			));
		} else if (Object.keys(mediaSourcesByType).length > 0) {
			// Sort media types: business first, then individual names alphabetically
			const sortedMediaTypes = Object.keys(mediaSourcesByType).sort(
				(a, b) => {
					if (a === "business") return -1;
					if (b === "business") return 1;
					return a.localeCompare(b);
				},
			);

			return sortedMediaTypes.map((mediaType) => {
				const { articles, allArticles, riskLevel } =
					mediaSourcesByType[mediaType];
				const sectionTitle = getSectionTitle(mediaType);
				const showAllForSection = sectionFilters[mediaType] ?? false;

				return (
					<MediaTypeSection
						key={mediaType}
						title={sectionTitle}
						articles={articles}
						allArticles={allArticles}
						riskLevel={riskLevel}
						mediaType={mediaType}
						showAllArticles={showAllForSection}
						onToggleFilter={(mediaTypeKey: string) => {
							setSectionFilters(
								(prev: Record<string, boolean>) => ({
									...prev,
									[mediaTypeKey]: !prev[mediaTypeKey],
								}),
							);
						}}
					/>
				);
			});
		} else return <EmptyState />;
	};

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
				{renderAdverseMediaContent()}
			</div>
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-5">
				<CaseProgressOrScore
					caseId={caseId}
					caseData={getApplicantData}
				/>
			</div>
		</div>
	);
};
