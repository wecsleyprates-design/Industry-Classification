import React, { type FC } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

const UploadSkeleton: FC<{ title: string }> = ({ title }) => {
	return (
		<Card className="h-full pb-10 overflow-hidden">
			<CardHeader className="flex flex-row items-center justify-between">
				<CardTitle className="text-lg">{title}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{[1, 2].map((_, idx) => (
					<div
						key={idx}
						className="flex items-center justify-between p-4 border rounded-lg animate-pulse bg-gray-50"
					>
						<div className="flex items-center space-x-4">
							<div className="w-10 h-10 bg-gray-300 rounded-full" />
							<div className="w-40 h-4 bg-gray-300 rounded" />
						</div>
						<div className="w-5 h-5 bg-gray-300 rounded" />
					</div>
				))}
			</CardContent>
		</Card>
	);
};

export default UploadSkeleton;
