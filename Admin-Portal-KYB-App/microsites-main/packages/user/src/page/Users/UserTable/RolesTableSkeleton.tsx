import React from "react";

const RolesTableSkeleton = () => {
	return (
		<div className="rounded-lg">
			{/* Roles List Skeleton */}
			<div className="flex flex-col gap-4 p-2 sm:p-4">
				{/* Skeleton for 3 role cards */}
				{[...Array(3)].map((_, index) => (
					<div
						key={index}
						className="flex flex-col p-3 border border-gray-200 sm:p-4 rounded-xl"
					>
						{/* Role Header Skeleton */}
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							{/* Left side */}
							<div className="flex items-center flex-1 min-w-0 gap-2">
								{/* Chevron skeleton */}
								<div className="flex-shrink-0 w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
								{/* Role name skeleton */}
								<div className="w-20 h-5 bg-gray-200 rounded sm:w-24 animate-pulse"></div>
								{/* Badge skeleton - hidden on very small screens */}
								<div className="hidden w-12 h-5 bg-gray-200 rounded xs:block sm:w-16 animate-pulse"></div>
							</div>

							{/* Right side */}
							<div className="flex items-center gap-2 ml-10 sm:gap-4 sm:ml-0">
								{/* Users button skeleton */}
								<div className="w-16 h-8 bg-gray-200 rounded-md sm:w-20 animate-pulse"></div>
								{/* Edit button skeleton */}
								<div className="w-12 h-8 bg-gray-200 rounded-md sm:w-16 animate-pulse"></div>
							</div>
						</div>

						{/* Description Skeleton */}
						<div className="pb-2 mt-3 ml-0 border-gray-200 sm:ml-10">
							<div className="w-full h-4 bg-gray-200 rounded sm:w-3/4 animate-pulse"></div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
};

export default RolesTableSkeleton;
