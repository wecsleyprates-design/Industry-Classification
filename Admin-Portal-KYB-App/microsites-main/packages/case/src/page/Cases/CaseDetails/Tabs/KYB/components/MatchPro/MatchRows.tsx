import React from "react";
import { MatchFieldBadge } from "./MatchFieldBadge";

export const Row: React.FC<{
	label: string;
	children: React.ReactNode;
}> = ({ label, children }) => (
	<div className="py-3 flex items-start justify-between gap-4">
		<dt className="text-sm text-gray-500 w-2/5 shrink-0">{label}</dt>
		<dd className="w-full text-sm text-gray-900 flex items-center gap-2 flex-wrap justify-between">
			{children}
		</dd>
	</div>
);

export const MatchRow: React.FC<{
	label: string;
	value: string;
	signal: string | undefined;
}> = ({ label, value, signal }) => (
	<Row label={label}>
		<span>{value}</span>
		<MatchFieldBadge value={signal} />
	</Row>
);
