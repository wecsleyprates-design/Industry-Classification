import { ArrowPathIcon } from "@heroicons/react/24/solid";
import { convertToLocalDate } from "@/lib/helper";
import useAuthStore from "@/store/useAuthStore";
import Banner from "../Banner";
import Button from "../Button";

import { MODULES } from "@/constants/Modules";

interface BusinessBannerProps {
	type: "archived" | "deleted";
	userName: string;
	date: string | Date;
	onRestore: () => void;
	isLoading?: boolean;
}

const BusinessBanner = ({
	type,
	userName,
	date,
	onRestore,
	isLoading = false,
}: BusinessBannerProps) => {
	const permissions = useAuthStore((state) => state.permissions);

	const isArchived = type === "archived";

	const bannerText = isArchived
		? `The business was archived by ${userName} on ${convertToLocalDate(
				date ?? null,
				"MM-DD-YYYY",
			)}.`
		: `The business was deleted by ${userName} on ${convertToLocalDate(
				date ?? null,
				"MM-DD-YYYY",
			)}.`;

	return (
		<Banner
			type="info-red"
			className="-ml-8 -mr-6 -mt-6 mb-6 flex items-center justify-between rounded-none px-8 py-2 sm:px-6 lg:px-8 text-sm"
		>
			<div className="text-red-600">{bannerText}</div>
			{permissions[MODULES.BUSINESS]?.write && (
				<Button
					color="white"
					outline
					className="flex items-center px-3 space-x-1 border rounded-lg h-9 bg-red-100 text-red-600 border-red-600"
					onClick={onRestore}
					isLoading={isLoading}
				>
					<ArrowPathIcon className="w-4 h-4 font-medium" />
					<span className="font-medium">Restore Business</span>
				</Button>
			)}
		</Banner>
	);
};

export default BusinessBanner;
