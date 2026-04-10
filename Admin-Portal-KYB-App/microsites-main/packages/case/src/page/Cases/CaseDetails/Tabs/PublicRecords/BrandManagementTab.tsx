import React from "react";
import CaseProgressOrScore from "@/components/CaseProgressOrScore/CaseProgressOrScore";
import useGetCaseDetails from "@/hooks/useGetCaseDetails";
import { useGetBusinessPublicRecords } from "@/services/queries/integration.query";
import { useAppContextStore } from "@/store/useAppContextStore";
import { type PublicRecordsData } from "@/types/integrations";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";
import { StarRating } from "@/ui/star-rating";

interface ReviewSource {
	source: string;
	logo: string;
	url: string;
	numberOfReviews: number;
	// averageRating: number;
	percentageOfReviews: number;
}

interface ReviewStats {
	sources: ReviewSource[];
	averageRating: number | null;
	totalReviews: number;
	ratingBreakdown: Record<
		number,
		{
			count: number;
			percentage: number;
		}
	>;
	insights: {
		totalReviewers: number | null;
		duplicateReviews: number | null;
		alertWordReviews: number | null;
		minRating: number | null;
		medianRating: number | null;
		maxRating: number | null;
	};
}

export interface BrandManagementTabProps {
	caseId: string;
}

const ReviewSourcesTable: React.FC<{ sources: ReviewSource[] }> = ({
	sources,
}) => (
	<div className="mt-6">
		<table className="min-w-full">
			<thead>
				<tr className="text-sm text-left text-gray-500">
					<th className="pb-2 font-semibold">Review Source</th>
					<th className="pb-2 font-semibold text-center">
						# of Reviews
					</th>
					{/* <th className="pb-2 font-semibold text-center">Average Rating</th> */}
					<th className="pb-2 font-semibold text-center">
						% of Reviews
					</th>
				</tr>
			</thead>
			<tbody className="border-t border-gray-100 divide-y divide-gray-100">
				{sources.map((source, index) => (
					<tr key={index} className="text-sm">
						<td className="py-4">
							<div className="flex items-center gap-2">
								{source.logo ? (
									<img
										src={source.logo}
										alt=""
										className="p-1 border border-gray-200 rounded-md size-10"
									/>
								) : (
									<div className="flex items-center justify-center p-1 border border-gray-200 rounded-md size-10 bg-gray-50">
										<span className="text-xs text-gray-400">
											{source.source.charAt(0)}
										</span>
									</div>
								)}
								{source.url ? (
									<a
										href={source.url}
										target="_blank"
										className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
										rel="noreferrer"
									>
										{source.source}
										<svg
											className="w-4 h-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
											/>
										</svg>
									</a>
								) : (
									<span>{source.source}</span>
								)}
							</div>
						</td>
						<td className="py-4 text-center">
							{source.numberOfReviews}
						</td>
						{/* <td className="py-4 text-center">{source.averageRating}</td> */}
						<td className="py-4 text-center">
							{source.percentageOfReviews}%
						</td>
					</tr>
				))}
			</tbody>
		</table>
	</div>
);

const CustomerReviewsSection: React.FC<{ stats: ReviewStats }> = ({
	stats,
}) => (
	<Card>
		<div className="flex flex-col">
			<CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
				<CardTitle>Customer Reviews</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex items-center gap-2 mb-4">
					<StarRating rating={stats.averageRating ?? 0} />
					<span className="text-lg font-medium">
						{stats.averageRating
							? `${stats.averageRating}/5`
							: "-/5"}
					</span>
					<span className="text-sm text-gray-500">
						{stats.totalReviews} Total Ratings
					</span>
				</div>
				<div className="grid grid-cols-3">
					<div className="p-4 border rounded-tl-lg rounded-bl-lg">
						<div className="text-sm text-gray-500">
							Total Reviewers
						</div>
						<div className="text-lg font-medium text-blue-600">
							{stats.insights.totalReviewers == null
								? "-"
								: stats.insights.totalReviewers}
						</div>
					</div>
					<div className="p-4 border border-l-0 border-r-0">
						<div className="text-sm text-gray-500">
							Answers Resolved
						</div>
						<div className="text-lg font-medium text-blue-600">
							{stats.insights.duplicateReviews == null
								? "-"
								: stats.insights.duplicateReviews}
						</div>
					</div>
					<div className="p-4 border rounded-tr-lg rounded-br-lg">
						<div className="text-sm text-gray-500">
							Complaints All Time
						</div>
						<div className="text-lg font-medium text-blue-600">
							{stats.insights.alertWordReviews == null
								? "-"
								: stats.insights.alertWordReviews}{" "}
							(
							{stats.insights.alertWordReviews == null
								? "-"
								: stats.insights.alertWordReviews != null &&
									  stats.totalReviews > 0
									? Math.round(
											(stats.insights.alertWordReviews /
												stats.totalReviews) *
												100,
										)
									: 0}
							%)
						</div>
					</div>
				</div>

				<div className="grid grid-cols-3 mt-4">
					<div className="p-4 border rounded-tl-lg rounded-bl-lg">
						<div className="text-sm text-gray-500">Min Rating</div>
						<div className="text-lg font-medium text-blue-600">
							{stats.insights.minRating ?? "-"}
						</div>
					</div>
					<div className="p-4 border border-l-0 border-r-0">
						<div className="text-sm text-gray-500">
							Median Rating
						</div>
						<div className="text-lg font-medium text-blue-600">
							{stats.insights.medianRating ?? "-"}
						</div>
					</div>
					<div className="p-4 border rounded-tr-lg rounded-br-lg">
						<div className="text-sm text-gray-500">Max Rating</div>
						<div className="text-lg font-medium text-blue-600">
							{stats.insights.maxRating ?? "-"}
						</div>
					</div>
				</div>

				<ReviewSourcesTable sources={stats.sources} />
			</CardContent>
		</div>
	</Card>
);

const CustomerReviewsSkeleton: React.FC = () => (
	<Card>
		<div className="flex flex-col">
			<CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
				<CardTitle>Customer Reviews</CardTitle>
			</CardHeader>
			<CardContent>
				{/* Rating Summary */}
				<div className="flex items-center gap-2 mb-4">
					<div className="flex gap-1">
						{[...Array(5)].map((_, i) => (
							<Skeleton key={i} className="w-5 h-5" />
						))}
					</div>
					<Skeleton className="w-16 h-6" />
					<Skeleton className="w-32 h-5" />
				</div>
				{/* Stats Grid */}
				<div className="grid grid-cols-3">
					<div className="p-4 border rounded-tl-lg rounded-bl-lg">
						<div className="text-sm text-gray-500">
							Total Reviewers
						</div>
						<Skeleton className="w-16 h-6 mt-1" />
					</div>
					<div className="p-4 border border-l-0 border-r-0">
						<div className="text-sm text-gray-500">
							Answers Resolved
						</div>
						<Skeleton className="w-16 h-6 mt-1" />
					</div>
					<div className="p-4 border rounded-tr-lg rounded-br-lg">
						<div className="text-sm text-gray-500">
							Complaints All Time
						</div>
						<Skeleton className="w-24 h-6 mt-1" />
					</div>
				</div>

				{/* Second Stats Grid */}
				<div className="grid grid-cols-3 mt-4">
					<div className="p-4 border rounded-tl-lg rounded-bl-lg">
						<div className="text-sm text-gray-500">Min Rating</div>
						<Skeleton className="w-16 h-6 mt-1" />
					</div>
					<div className="p-4 border border-l-0 border-r-0">
						<div className="text-sm text-gray-500">
							Median Rating
						</div>
						<Skeleton className="w-16 h-6 mt-1" />
					</div>
					<div className="p-4 border rounded-tr-lg rounded-br-lg">
						<div className="text-sm text-gray-500">Max Rating</div>
						<Skeleton className="w-16 h-6 mt-1" />
					</div>
				</div>

				{/* Review Sources Table */}
				<div className="mt-6">
					<table className="min-w-full">
						<thead>
							<tr className="text-sm text-left text-gray-500">
								<th className="pb-2 font-semibold">
									Review Source
								</th>
								<th className="pb-2 font-semibold text-center">
									# of Reviews
								</th>
								{/* <th className="pb-2 font-semibold text-center">
									Average Rating
								</th> */}
								<th className="pb-2 font-semibold text-center">
									% of Reviews
								</th>
							</tr>
						</thead>
						<tbody className="border-t border-gray-100 divide-y divide-gray-100">
							{[...Array(4)].map((_, index) => (
								<tr key={index} className="text-sm">
									<td className="py-4">
										<div className="flex items-center gap-2">
											<Skeleton className="rounded-md size-10" />
											<Skeleton className="w-24 h-4" />
										</div>
									</td>
									<td className="py-4 text-center">
										<Skeleton className="w-12 h-4 mx-auto" />
									</td>
									{/* <td className="py-4 text-center">
										<Skeleton className="w-12 h-4 mx-auto" />
									</td> */}
									<td className="py-4 text-center">
										<Skeleton className="w-12 h-4 mx-auto" />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</CardContent>
		</div>
	</Card>
);

/**
 * Maps PublicRecordsData to ReviewStats structure
 */
const mapPublicRecordsToReviewStats = (
	data?: PublicRecordsData,
): ReviewStats | null => {
	if (!data) return null;

	// Ensure review_statistics exists
	if (!data?.public_records?.review_statistics) {
		// Missing review_statistics, return null
		return null;
	}

	// Get total reviews
	const totalReviews =
		data.public_records.review_statistics.review_count ?? 0;

	// Ensure reviews array exists
	const reviews = data?.public_records?.reviews ?? [];

	// Map review sources
	const sources = reviews.map((review) => ({
		source: review.source,
		logo: "", // No logo available in the data
		url: isUrl(review.source) ? review.source : "", // Use source as URL if it looks like a URL
		numberOfReviews: review.count,
		// todo: get average rating from the data
		// averageRating: Number(data.average_rating) ?? 0,
		percentageOfReviews: Number(review.percentage ?? 0),
	}));

	// Use the actual values from the API response
	const minRating =
		data.public_records.review_statistics.min_rating_all_time ?? null;
	const maxRating =
		data.public_records.review_statistics.max_rating_all_time ?? null;
	const medianRating =
		data.public_records.review_statistics.median_rating_all_time ?? null;

	// Ensure complaint_statistics exists
	const complaintStats = data.public_records.complaint_statistics || {};

	return {
		sources,
		averageRating:
			data.public_records.average_rating != null
				? Number(data.public_records.average_rating)
				: null,
		totalReviews,
		ratingBreakdown: {
			5: {
				count:
					data.public_records.review_statistics
						.count_of_5_star_ratings_all_time || 0,
				percentage: Math.round(
					(data.public_records.review_statistics
						.percentage_of_5_star_ratings_all_time || 0) * 100,
				),
			},
			4: {
				count:
					data.public_records.review_statistics
						.count_of_4_star_ratings_all_time || 0,
				percentage: Math.round(
					(data.public_records.review_statistics
						.percentage_of_4_star_ratings_all_time || 0) * 100,
				),
			},
			3: {
				count:
					data.public_records.review_statistics
						.count_of_3_star_ratings_all_time || 0,
				percentage: Math.round(
					(data.public_records.review_statistics
						.percentage_of_3_star_ratings_all_time || 0) * 100,
				),
			},
			2: {
				count:
					data.public_records.review_statistics
						.count_of_2_star_ratings_all_time || 0,
				percentage: Math.round(
					(data.public_records.review_statistics
						.percentage_of_2_star_ratings_all_time || 0) * 100,
				),
			},
			1: {
				count:
					data.public_records.review_statistics
						.count_of_0_or_1_star_ratings_all_time || 0,
				percentage: Math.round(
					(data.public_records.review_statistics
						.percentage_of_0_or_1_star_ratings_all_time || 0) * 100,
				),
			},
		},
		insights: {
			totalReviewers:
				complaintStats.count_of_total_reviewers_all_time ?? null,
			duplicateReviews:
				complaintStats.count_of_answered_resolved_status_all_time ??
				null,
			alertWordReviews:
				complaintStats.count_of_complaints_all_time ?? null,
			minRating,
			medianRating,
			maxRating,
		},
	};
};

/**
 * Check if a string is a URL
 */
const isUrl = (str: string): boolean => {
	try {
		return Boolean(new URL(str));
	} catch {
		return false;
	}
};

/**
 * Empty state component when no review data is available
 */
const EmptyReviewsState: React.FC = () => (
	<Card>
		<div className="flex flex-col bg-white rounded-xl">
			<CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
				<CardTitle>Customer Reviews</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col items-center justify-center py-10">
					<svg
						className="w-16 h-16 mb-4 text-gray-300"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={1.5}
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
					<h3 className="mb-1 text-lg font-medium text-gray-900">
						No Review Data Available
					</h3>
					<p className="max-w-md text-center text-gray-500">
						We don't have any public records data for this case at
						the moment.
					</p>
				</div>
			</CardContent>
		</div>
	</Card>
);

export const BrandManagementTab: React.FC<BrandManagementTabProps> = ({
	caseId,
}) => {
	const { customerId } = useAppContextStore();

	const { caseData } = useGetCaseDetails({ caseId, customerId });

	const businessId = caseData?.data?.business.id ?? "";

	const { data: reviewsData, isLoading: isLoadingReviews } =
		useGetBusinessPublicRecords({
			businessId,
			caseId,
		});

	// Map verdata to ReviewStats structure
	const mappedReviewStats = mapPublicRecordsToReviewStats(reviewsData?.data);

	return (
		<div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-7">
				<>
					{isLoadingReviews && <CustomerReviewsSkeleton />}
					{!mappedReviewStats && <EmptyReviewsState />}
					{mappedReviewStats && (
						<CustomerReviewsSection stats={mappedReviewStats} />
					)}
				</>
			</div>
			<div className="flex flex-col col-span-1 gap-4 lg:col-span-5">
				<CaseProgressOrScore caseId={caseId} caseData={caseData} />
			</div>
		</div>
	);
};
