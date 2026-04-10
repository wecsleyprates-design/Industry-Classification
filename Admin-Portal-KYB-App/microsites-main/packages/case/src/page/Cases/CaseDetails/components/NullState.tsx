import React from "react";
import { ArchiveBoxXMarkIcon } from "@heroicons/react/24/outline";

type NullStateProps = {
	title: string;
	description?: React.ReactNode;
	icon?: React.ReactNode;
};

export const NullState: React.FC<NullStateProps> = ({
	title,
	description,
	icon,
}) => {
	return (
		<div className="flex flex-col items-center justify-center h-full gap-2 p-16">
			<div className="flex flex-row items-center justify-between overflow-hidden rounded-[8px] border border-gray-200 p-4">
				{icon ?? (
					<ArchiveBoxXMarkIcon className="w-10 h-10 text-blue-600" />
				)}
			</div>
			<h3 className="pt-2 text-2xl font-semibold text-gray-800">
				{title || "No Data to Display"}
			</h3>
			{description && (
				<p className="mt-2 text-center text-gray-500">{description}</p>
			)}
		</div>
	);
};
