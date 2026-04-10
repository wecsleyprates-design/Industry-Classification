const FeatureSkeleton = () => (
	<div>
		<div className="justify-between my-6 sm:flex animate-pulse">
			<div className="flex items-start px-3 sm:px-4 mt-2">
				<div className="rounded-lg bg-gray-200 h-10 w-10 mr-4" />
				<div>
					<div className="h-4 w-48 bg-gray-200 rounded mb-2" />
					<div className="h-3 w-64 bg-gray-200 rounded mb-1" />
					<div className="h-3 w-40 bg-gray-200 rounded" />
				</div>
			</div>
			<div className="mt-4">
				<div className="h-6 w-12 bg-gray-200 rounded" />
			</div>
		</div>
		<div className="justify-between my-6 sm:flex animate-pulse">
			<div className="flex items-start px-3 sm:px-4 mt-2">
				<div className="rounded-lg bg-gray-200 h-10 w-10 mr-4" />
				<div>
					<div className="h-4 w-48 bg-gray-200 rounded mb-2" />
					<div className="h-3 w-64 bg-gray-200 rounded mb-1" />
					<div className="h-3 w-40 bg-gray-200 rounded" />
				</div>
			</div>
			<div className="mt-4">
				<div className="h-6 w-12 bg-gray-200 rounded" />
			</div>
		</div>
	</div>
);

export default FeatureSkeleton;
