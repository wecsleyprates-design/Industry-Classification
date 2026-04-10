import React from "react";
import { useAppVersions } from "@/hooks/useAppVersions";

type Props = {
	copied: boolean;
	onCopy: () => void;
	direction?: "up" | "down";
};

const FloatingSessionDetails: React.FC<Props> = ({
	copied,
	onCopy,
	direction = "down",
}) => {
	const versions = useAppVersions();
	return (
		<div
			className={`absolute left-0 ${
				direction === "down" ? "top-[110%]" : "bottom-[110%]"
			} min-w-[300px] bg-[#f9f9f9] rounded-lg py-3 px-4 shadow-md text-[15px] z-20`}
		>
			<b className="block mb-1 text-[16px] font-semibold">Current Session</b>

			{/* Get RUM Session URL row */}
			<div className="flex items-center justify-between mt-2">
				<span className="font-medium text-[14px]">RUM Session URL</span>
				<button
					className="py-1 px-4 bg-[#1976d2] text-white rounded font-medium text-[14px] ml-4 hover:bg-[#125ea2] transition"
					onClick={onCopy}
					title="Copy session url"
				>
					Copy
				</button>
			</div>
			{copied && <div className="text-[12px] text-green-600 mt-1">Copied!</div>}

			<b className="block mt-4 mb-2 text-[16px] font-semibold">App Versions</b>

			<div className="space-y-1 text-[13px]">
				{versions.map((v) => (
					<div key={v.label} className="flex justify-between">
						<span className="text-gray-600">{v.label}</span>
						<span className="font-mono text-gray-900">{v.version ?? "—"}</span>
					</div>
				))}
			</div>
		</div>
	);
};

export default FloatingSessionDetails;
