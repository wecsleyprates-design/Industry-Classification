import React from "react";
import { twMerge } from "tailwind-merge";

type Props = {
	loading: boolean;
	children?: React.ReactNode;
	className: string;
};

const SkeletonLoader: React.FC<Props> = ({ loading, children, className }) => {
	return (
		<div>
			{loading && (
				<div
					className={twMerge(
						"animate-pulse bg-gray-200 rounded-md p-4",
						className,
					)}
				/>
			)}
		</div>
	);
};

export default SkeletonLoader;
