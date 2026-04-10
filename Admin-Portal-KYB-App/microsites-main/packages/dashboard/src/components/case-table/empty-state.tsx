import React from "react";
import { Link } from "react-router-dom";

import { EmptyResultsDisplay } from "@/ui/empty-states";

export const EmptyState: React.FC = () => {
	return (
		<div className="p-8 space-y-6 bg-white rounded-2xl">
			<div className="flex flex-col items-center justify-center text-center">
				<EmptyResultsDisplay message="No Cases to Display" />
				<p className="mt-1 text-sm text-gray-500">
					Start creating new cases by inviting businesses to{" "}
					<Link to="/businesses/send-invitation" style={{ color: "#2563EB" }}>
						fill out an application
					</Link>
					.
				</p>
			</div>
		</div>
	);
};
