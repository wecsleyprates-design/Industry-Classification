import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

export const WebsiteDetailsSkeleton = () => (
	<Card>
		<CardHeader>
			<CardTitle>Website Details</CardTitle>
		</CardHeader>
		<CardContent>
			<div>
				{[...Array(5)].map((_, index) => (
					<div
						key={index}
						className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 min-h-[56px] sm:items-center justify-between"
					>
						<Skeleton className="h-4 sm:col-span-1" />
						<Skeleton className="mt-1 h-4 sm:col-span-1 sm:mt-0" />
					</div>
				))}
			</div>
		</CardContent>
	</Card>
);

export const WebsitePagesSkeleton = () => (
	<Card>
		<CardHeader>
			<CardTitle>Website Pages</CardTitle>
		</CardHeader>
		<CardContent className="space-y-6">
			{[...Array(2)].map((_, index) => (
				<div key={index} className="border border-gray-100 rounded-2xl">
					<Skeleton className="w-full h-64 rounded-t-2xl" />
					<div className="p-4 space-y-4">
						<div className="flex items-center space-x-2">
							<Skeleton className="w-32 h-6" />
							<Skeleton className="w-16 h-6" />
						</div>
						<Skeleton className="w-full h-4" />
						<Skeleton className="w-full h-12 rounded-md" />
					</div>
				</div>
			))}
		</CardContent>
	</Card>
);
