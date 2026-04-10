import { Skeleton } from "@/ui/skeleton";

const DecisioningSkeleton = () => {
	return (
		<>
			<div className="p-6 border rounded-xl bg-white border-[#E5E7EB]">
				<div className="flex items-start justify-between mb-4">
					<div className="flex items-center gap-4 flex-1">
						<Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
						<div className="flex-1">
							<Skeleton className="h-6 w-40 mb-1" />
							<Skeleton className="h-5 w-full max-w-md" />
						</div>
					</div>
					<Skeleton className="h-10 w-32 ml-4 flex-shrink-0" />
				</div>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t border-[#E5E7EB]">
					<div>
						<div className="flex items-center gap-2 mb-2">
							<Skeleton className="w-5 h-5 flex-shrink-0" />
							<Skeleton className="h-5 w-32" />
						</div>
						<Skeleton className="h-16 w-full" />
					</div>
					<div>
						<div className="flex items-center gap-2 mb-2">
							<Skeleton className="w-5 h-5 flex-shrink-0" />
							<Skeleton className="h-5 w-32" />
						</div>
						<Skeleton className="h-16 w-full" />
					</div>
					<div>
						<div className="flex items-center gap-2 mb-2">
							<Skeleton className="w-5 h-5 flex-shrink-0" />
							<Skeleton className="h-5 w-32" />
						</div>
						<Skeleton className="h-16 w-full" />
					</div>
				</div>
			</div>
		</>
	);
};

export default DecisioningSkeleton;
