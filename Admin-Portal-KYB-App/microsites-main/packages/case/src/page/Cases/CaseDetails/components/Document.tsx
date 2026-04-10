import React from "react";
import {
	ArrowTopRightOnSquareIcon,
	DocumentIcon,
} from "@heroicons/react/24/outline";

export const Document: React.FC<{ title: string; url: string }> = ({
	title,
	url,
}) => {
	return (
		<a href={url} target="_blank" rel="noopener noreferrer">
			<div className="flex flex-row items-center justify-between overflow-hidden rounded-[8px] border border-gray-200 p-4">
				<div className="flex flex-row items-center gap-4">
					<div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
						<DocumentIcon className="w-5 h-5 text-gray-800" />
					</div>
					<span>{title}</span>
				</div>
				<ArrowTopRightOnSquareIcon className="w-4 h-4 text-blue-600" />
			</div>
		</a>
	);
};
