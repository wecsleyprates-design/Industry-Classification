import React, { useMemo, useState } from "react";
import { getInitials } from "@/lib/utils";

import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { FilterOptionsDropdown } from "@/ui/filter-options-dropdown-menu";
import { SearchField } from "@/ui/search-field";

interface ActivityItem {
	id: string;
	user: {
		name: string;
		avatar: string;
	};
	action: string;
	timestamp: string;
	comment?: string;
}

interface ActivityFeedProps {
	activities: ActivityItem[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
	return (
		<div className="space-y-8">
			{activities.length === 0 ? (
				<p className="text-center text-sm text-gray-500">
					No activity to display.
				</p>
			) : (
				activities.map((activity) => (
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
								<p className="text-sm text-gray-500">{activity.action}</p>
							</div>
							{activity.comment && (
								<p className="mt-1 text-sm text-gray-700">{activity.comment}</p>
							)}
							<p className="mt-1 text-xs text-gray-500">{activity.timestamp}</p>
						</div>
					</div>
				))
			)}
		</div>
	);
}

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
	onViewMore?: () => void;
	filterForm: React.ReactElement<FilterFormProps>;
}

export function EnhancedActivityFeed({
	activities,
	onSearch,
	onFilter,
	onViewMore,
	filterForm,
}: EnhancedActivityFeedProps) {
	const [currentFilters, setCurrentFilters] = useState<FilterFormData>({});

	const handleFilter = (formData: FilterFormData) => {
		setCurrentFilters(formData);
		onFilter?.(formData);
	};

	const filteredActivities = useMemo(() => {
		return activities.filter((activity) => {
			if (currentFilters.users && currentFilters.users.length > 0) {
				if (!currentFilters.users.includes(activity.user.name)) {
					return false;
				}
			}

			if (currentFilters.actions && currentFilters.actions.length > 0) {
				if (!currentFilters.actions.includes(activity.action)) {
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
			<div className="flex space-x-2">
				<div className="flex-grow">
					<SearchField placeholder="Search activities..." onSearch={onSearch} />
				</div>
				<FilterOptionsDropdown
					form={React.cloneElement(filterForm, { onSubmit: handleFilter })}
				/>
			</div>

			<ActivityFeed activities={filteredActivities} />

			<div className="flex justify-center">
				<Button variant="outline" onClick={onViewMore}>
					View More
				</Button>
			</div>
		</div>
	);
}
