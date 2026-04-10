import { useCallback } from "react";
import { type MatchProData, type ReasonCode } from "@/types/integrations";

import { REASON_CODE_MAP } from "@/constants/ReasonCodes";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/ui/accordion";

export const ReasonCodesListItem = ({
	terminatedMerchants,
}: {
	terminatedMerchants: MatchProData["terminatedMerchants"];
}) => {
	const getReasonCodeDescription = useCallback(
		(reasonCode: string): ReasonCode | undefined => {
			if (!reasonCode?.trim()) return undefined;
			return REASON_CODE_MAP[Number(reasonCode.trim())];
		},
		[],
	);

	// Filter out merchants without reason codes
	const merchantsWithReasonCodes = terminatedMerchants.filter(
		(merchant) => merchant.reasonCode,
	);

	if (merchantsWithReasonCodes.length === 0) {
		return (
			<span className="text-sm text-gray-500 italic">
				No reason codes available
			</span>
		);
	}

	return (
		<>
			<Accordion type="single" collapsible>
				{merchantsWithReasonCodes.map((merchant, index) => {
					const reasonCodeInfo = getReasonCodeDescription(
						merchant.reasonCode || "",
					);
					const key = merchant.merchRefNum || `merchant-${index}`;
					const reasonCode = merchant.reasonCode || "";

					return (
						<AccordionItem
							key={key}
							value={key}
							className="last:border-b-0"
						>
							<AccordionTrigger className="hover:no-underline">
								<span className="font-regular text-sm text-[#1F2937]">
									{reasonCode} -{" "}
									{reasonCodeInfo?.title ?? `Unknown Code`}
								</span>
							</AccordionTrigger>
							<AccordionContent className="text-xs text-gray-500 font-normal pb-3">
								{reasonCodeInfo?.description ??
									"No description available for this reason code."}
							</AccordionContent>
						</AccordionItem>
					);
				})}
			</Accordion>
		</>
	);
};
