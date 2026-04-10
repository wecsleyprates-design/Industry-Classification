import { isNonEmptyString } from "@austinburns/type-guards";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import StatusBadge, { type Ttype } from "@/components/Badge/StatusBadge";
import { type KybUpdatedResponseTypeData } from "@/types/integrations";

import {
	SOS_BADGE_TEXT,
	SOS_BADGE_TOOLTIPS,
	SOS_BADGE_TYPES,
} from "@/constants/SOSBadges";

const getSosBadgeConfig = (
	sosBadgeData?: KybUpdatedResponseTypeData,
): { text: string; type: Ttype; tooltip: string } => {
	const isMatch = sosBadgeData?.sos_match_boolean?.value === true;
	const isActive = sosBadgeData?.sos_active?.value === true;
	if (isMatch) {
		return {
			text: isActive
				? SOS_BADGE_TEXT.VERIFIED
				: SOS_BADGE_TEXT.MISSING_ACTIVE_FILING,
			type: isActive
				? SOS_BADGE_TYPES.VERIFIED
				: SOS_BADGE_TYPES.MISSING_ACTIVE_FILING,
			tooltip: isActive
				? SOS_BADGE_TOOLTIPS.VERIFIED
				: SOS_BADGE_TOOLTIPS.MISSING_ACTIVE_FILING_INACTIVE,
		};
	}
	const isWarning = sosBadgeData?.sos_match?.value === "warning";
	return {
		text: isWarning
			? SOS_BADGE_TEXT.UNVERIFIED
			: SOS_BADGE_TEXT.MISSING_ACTIVE_FILING,
		type: isWarning
			? SOS_BADGE_TYPES.UNVERIFIED
			: SOS_BADGE_TYPES.MISSING_ACTIVE_FILING,
		tooltip: isWarning
			? SOS_BADGE_TOOLTIPS.UNVERIFIED
			: SOS_BADGE_TOOLTIPS.MISSING_ACTIVE_FILING_NONE,
	};
};

export const SectionHeader = ({
	titleText,
	badgeText,
	badgeType,
	sosBadgeData,
}: {
	titleText: string;
	badgeText?: string;
	badgeType?: Ttype;
	sosBadgeData?: KybUpdatedResponseTypeData;
}) => (
	<div className="relative">
		<div className="absolute inset-0 flex items-center" aria-hidden="true">
			<div className="w-full border-t border-gray-200" />
		</div>
		<div className="relative flex justify-start">
			<div className="pr-2 text-base font-semibold leading-6 text-gray-900 bg-white">
				<div className="flex gap-2">
					<h1 className="text-[16px] font-light text-gray-400">{titleText}</h1>
					{sosBadgeData
						? (() => {
								const sosBadgeConfig = getSosBadgeConfig(sosBadgeData);
								return (
									<StatusBadge
										text={sosBadgeConfig.text}
										type={sosBadgeConfig.type}
										tooltip={sosBadgeConfig.tooltip}
									/>
								);
							})()
						: isNonEmptyString(badgeText) &&
							isNonEmptyString(badgeType) && (
								<StatusBadge text={badgeText} type={badgeType} />
							)}
				</div>
			</div>
		</div>
	</div>
);

export const HitCard = ({
	hitNumber,
	title,
	agency,
	country,
	sourceLink,
}: {
	hitNumber: number;
	title: string;
	agency: string;
	country: string;
	sourceLink: string;
}) => {
	return (
		<div>
			<span className="text-sm text-gray-500">Hit #{hitNumber}</span>
			<h3 className="text-gray-700">{title}</h3>
			<p className="font-light text-gray-400">{agency}</p>
			<p className="font-light text-gray-400">{country}</p>
			{sourceLink ? (
				<a
					href={sourceLink}
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-1 text-blue-600"
				>
					Source
					<ArrowTopRightOnSquareIcon className="h-4 ml-2 text-blue-600 min-w-4" />
				</a>
			) : null}
		</div>
	);
};
