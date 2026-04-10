import React, { useMemo, useState } from "react";
import { ListBulletIcon } from "@heroicons/react/24/outline";
import dayjs from "dayjs";
import sanitizeHTML from "sanitize-html";
import { unescapeHTMLEntities } from "@/lib/unescapeHTMLEntities";
import { getInitials } from "@/lib/utils";
import CommentSection from "./comment-section";
import { type FilterConfigItem } from "./filter-form";

import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { FilterOptionsDropdown } from "@/ui/filter-options-dropdown-menu";
import { SearchField } from "@/ui/search-field";
import { Skeleton } from "@/ui/skeleton";

export interface ActivityItem {
	id: string;
	user: {
		name: string;
		avatar: string;
	};
	message: {
		text: string;
		boldSegments: string[];
	};
	actionCode?: string;
	timestamp: string;
	attachments?: Array<{
		fileName: string;
		url: string;
	}>;
}

interface ActivityFeedProps {
	activities: ActivityItem[];
	currentPage?: number;
	isLoading?: boolean;
}

// Helper function to wrap bold segments in <strong> tags
export const getMessageWithBoldedHTML = (message: {
	text: string;
	boldSegments: string[];
}) => {
	let formattedText = unescapeHTMLEntities(String(message.text));

	// Sort boldSegments by length in descending order to handle overlapping matches
	const sortedBoldSegments = [...message.boldSegments].sort(
		(a, b) => b.length - a.length,
	);

	sortedBoldSegments.forEach((segment) => {
		const formattedSegment = unescapeHTMLEntities(segment).replace(
			/[.*+?^${}()|[\]\\]/g,
			"\\$&",
		);
		formattedText = formattedText.replace(
			new RegExp(formattedSegment, "g"),
			`<strong>${segment}</strong>`,
		);
	});

	return formattedText;
};

export function ActivityFeed({
	activities,
	currentPage = 1,
	isLoading = false,
}: ActivityFeedProps) {
	return (
		<div className="space-y-8">
			{activities.length === 0 ? (
				<CaseActivityEmptyState />
			) : (
				<>
					{activities.map((activity) => (
						<div key={activity.id} className="flex space-x-3">
							<Avatar
								src={activity.user.avatar}
								alt={activity.user.name}
								initials={getInitials(activity.user.name)}
								size="md"
							/>
							<div className="flex-1">
								<div className="flex flex-wrap items-center gap-x-2">
									<p className="text-sm font-medium text-gray-900">
										{activity.user.name}
									</p>
								</div>
								<div className="text-sm text-gray-500">
									<span
										className="text-sm text-gray-500 [&>strong]:font-medium [&>strong]:text-gray-600"
										dangerouslySetInnerHTML={{
											__html: sanitizeHTML(
												getMessageWithBoldedHTML(
													activity.message,
												),
											),
										}}
									/>
								</div>
								{activity.attachments &&
									activity.attachments.length > 0 && (
										<div className="mt-2 flex flex-wrap gap-2">
											{activity.attachments.map(
												(attachment) => (
													<a
														key={
															attachment.fileName
														}
														href={attachment.url}
														target="_blank"
														rel="noopener noreferrer"
														className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
													>
														<svg
															className="h-4 w-4"
															fill="none"
															stroke="currentColor"
															viewBox="0 0 24 24"
															xmlns="http://www.w3.org/2000/svg"
														>
															<path
																strokeLinecap="round"
																strokeLinejoin="round"
																strokeWidth={2}
																d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
															/>
														</svg>
														{attachment.fileName}
													</a>
												),
											)}
										</div>
									)}
								<p className="mt-1 text-xs text-gray-500">
									{dayjs(activity.timestamp).format(
										"MM/DD/YY h:mm A",
									)}
								</p>
							</div>
						</div>
					))}
					{isLoading && currentPage !== 1 && (
						<SkeletonActivityFeedReduced />
					)}
				</>
			)}
		</div>
	);
}

const CaseActivityEmptyState: React.FC = () => (
	<div className="flex flex-col items-center justify-center gap-4 p-16">
		<div className="flex items-center justify-center w-16 h-16 bg-white rounded-xl border border-gray-200">
			<ListBulletIcon className="w-8 h-8 text-blue-600" />
		</div>
		<h3 className="text-xl font-semibold text-gray-800">
			No Case Activity to Display
		</h3>
		<p className="text-center text-gray-500 max-w-md">
			Updates and comments on the case will appear here.
		</p>
	</div>
);

export interface FilterFormData {
	users?: string[];
	actions?: string[];
	dateRange?: {
		from: Date | undefined;
		to: Date | undefined;
	};
}

interface FilterFormProps {
	onSubmit: (data: FilterFormData) => void;
}

interface EnhancedActivityFeedProps extends ActivityFeedProps {
	onSearch?: (query: string) => void;
	onFilter?: (filters: FilterFormData) => void;
	filterForm: React.ReactElement<FilterFormProps>;
	currentPage?: number;
	totalPages?: number;
	onPageChange?: (page: number) => void;
	totalItems?: number;
	itemsPerPage?: number;
	searchValue?: string;
	caseId: string;
	businessId?: string;
	onCommentPosted: () => void;
	filterConfig: FilterConfigItem[];
	onFilterChange: (values: any) => void;
	isLoading?: boolean;
}

export function EnhancedActivityFeed({
	activities,
	onSearch,
	onFilter,
	filterForm,
	currentPage = 1,
	onPageChange,
	totalItems = 0,
	itemsPerPage = 3,
	searchValue = "",
	caseId,
	businessId,
	onCommentPosted,
	filterConfig,
	onFilterChange,
	isLoading = false,
}: EnhancedActivityFeedProps) {
	const [currentFilters, setCurrentFilters] = useState<FilterFormData>({});
	const [localSearchValue, setLocalSearchValue] = useState(searchValue);
	const dropdownRef = React.useRef<{
		setOpen: (open: boolean) => void;
	} | null>(null);

	const handleFilter = (formData: FilterFormData) => {
		setCurrentFilters(formData);
		onFilter?.(formData);
		dropdownRef.current?.setOpen(false);
	};

	const filteredActivities = useMemo(() => {
		return activities.filter((activity) => {
			if (currentFilters.users && currentFilters.users.length > 0) {
				if (!currentFilters.users.includes(activity.user.name)) {
					return false;
				}
			}

			if (currentFilters.actions && currentFilters.actions.length > 0) {
				if (
					!currentFilters.actions.includes(activity.actionCode ?? "")
				) {
					return false;
				}
			}

			if (currentFilters.dateRange) {
				const activityDate = new Date(activity.timestamp);
				if (
					currentFilters.dateRange.from &&
					activityDate < currentFilters.dateRange.from
				) {
					return false;
				}
				if (
					currentFilters.dateRange.to &&
					activityDate > currentFilters.dateRange.to
				) {
					return false;
				}
			}

			return true;
		});
	}, [activities, currentFilters]);

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-lg font-semibold">Case Activity</h2>
				<div className="flex justify-end space-x-2">
					<SearchField
						placeholder="Search activities..."
						onSearch={onSearch}
						value={localSearchValue}
						onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
							setLocalSearchValue(e.target.value);
						}}
					/>
					<FilterOptionsDropdown
						form={React.cloneElement(filterForm, {
							onSubmit: handleFilter,
						})}
						dropdownRef={dropdownRef}
						onFilterChange={onFilterChange}
						filterConfig={filterConfig}
						onClose={() => {
							dropdownRef.current?.setOpen?.(false);
						}}
					/>
				</div>
			</div>

			<CommentSection
				caseId={caseId}
				businessId={businessId}
				onCommentPosted={onCommentPosted}
			/>
			<div
				className={
					filteredActivities.length > itemsPerPage
						? "max-h-[980px] overflow-y-auto"
						: ""
				}
			>
				<ActivityFeed
					activities={filteredActivities}
					currentPage={currentPage}
					isLoading={isLoading}
				/>

				<div className="flex flex-col items-center gap-4">
					{totalItems > 0 && (
						<p className="text-sm text-gray-500">
							Showing{" "}
							{Math.min(currentPage * itemsPerPage, totalItems)}{" "}
							of {totalItems} activities
						</p>
					)}
					<div className="flex justify-center">
						{onPageChange &&
							totalItems > currentPage * itemsPerPage && (
								<Button
									variant="outline"
									onClick={() => {
										onPageChange(currentPage + 1);
									}}
									className="px-6 py-2 text-gray-700 border-gray-300 hover:bg-gray-50"
								>
									View More
								</Button>
							)}
					</div>
				</div>
			</div>
		</div>
	);
}

export function SkeletonActivityFeed() {
	return (
		<div className="space-y-4">
			{/* Search and filter skeleton */}
			<div className="flex space-x-2">
				<Skeleton className="h-10 flex-grow" />
				<Skeleton className="h-10 w-[100px]" />
			</div>

			{/* Activity items skeleton */}
			<SkeletonActivityFeedItems numRows={3} />

			{/* View more button skeleton */}
			<div className="flex justify-center">
				<Skeleton className="h-10 w-[100px]" />
			</div>
		</div>
	);
}

function SkeletonActivityFeedReduced() {
	return (
		<div className="space-y-4">
			{/* Activity items skeleton */}
			<SkeletonActivityFeedItems numRows={1} />

			{/* View more button skeleton */}
			<div className="flex justify-center">
				<Skeleton className="h-10 w-[100px]" />
			</div>
		</div>
	);
}

function SkeletonActivityFeedItems({ numRows }: { numRows: number }) {
	return (
		<div className="space-y-8">
			{Array.from({ length: numRows }, (_, i) => (
				<div key={i} className="flex space-x-3">
					<Skeleton className="h-10 w-10 rounded-full" />
					<div className="flex-1 space-y-2">
						<div className="flex flex-wrap items-center gap-x-2">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-4 w-32" />
						</div>
						<Skeleton className="h-4 w-full" />
						<Skeleton className="h-3 w-20" />
					</div>
				</div>
			))}
		</div>
	);
}
