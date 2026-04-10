import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { downloadFile, getFileNameFromUrl } from "@/helpers";
import { Button } from "@/ui/button";

export const VantageScoreLink: React.FC<{
	score: number | undefined;
	url: string | undefined;
}> = ({ score, url }) => {
	if (typeof score === "number" && !url) {
		return <span className="text-sm text-gray-500">{score}/850</span>;
	} else if (typeof score === "number" && url) {
		// DOS-606 TODO: Figure out why the spacing is weird on this button
		return (
			<Button
				variant="link"
				size="sm"
				className="flex flex-row gap-1 items-center text-sm font-medium text-blue-600 p-0 m-0"
				onClick={async () => {
					await downloadFile(
						url,
						getFileNameFromUrl(url) ?? "equifax_report.pdf",
					);
				}}
			>
				<span>{score}/850</span>
				<ArrowDownTrayIcon />
			</Button>
		);
	} else {
		return <span>{VALUE_NOT_AVAILABLE}</span>;
	}
};
