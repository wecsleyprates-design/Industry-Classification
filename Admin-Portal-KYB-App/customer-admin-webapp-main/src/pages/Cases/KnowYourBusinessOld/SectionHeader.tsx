import { isNonEmptyString } from "@austinburns/type-guards";
import StatusBadge, { type Ttype } from "@/components/Badge/StatusBadge";

export const SectionHeader = ({
	titleText,
	badgeText,
	badgeType,
}: {
	titleText: string;
	badgeText?: string;
	badgeType?: Ttype;
}) => (
	<div className="relative">
		<div className="absolute inset-0 flex items-center" aria-hidden="true">
			<div className="w-full border-t border-gray-200" />
		</div>
		<div className="relative flex justify-start">
			<div className="bg-white pr-2 text-base font-semibold leading-6 text-gray-900">
				<div className="flex gap-2">
					<h1 className="text-[16px] font-light text-gray-400">{titleText}</h1>
					{isNonEmptyString(badgeText) && isNonEmptyString(badgeType) && (
						<StatusBadge text={badgeText} type={badgeType} />
					)}
				</div>
			</div>
		</div>
	</div>
);
