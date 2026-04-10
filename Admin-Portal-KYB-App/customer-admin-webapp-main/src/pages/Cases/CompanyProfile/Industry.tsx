import React, { type FC } from "react";
import { twMerge } from "tailwind-merge";
import ConditionalPlusIcon from "@/assets/ConditionalPlusIcon";
import { TitleLeftDivider } from "@/components/Dividers";
import type { FactBusinessDetailsResponseType } from "@/types/integrations";

import { GuestOwnerStyle } from "@/constants/TailwindStyles";

const Industry: FC<{
	business: any;
	businessDetailFacts?: FactBusinessDetailsResponseType;
}> = ({ business, businessDetailFacts }) => {
	return (
		<>
			<div className="py-2">
				<TitleLeftDivider text="Industry" />
			</div>
			<div className="container mx-auto">
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
					<div className="p-4">
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							Industry name
						</p>
						<p
							className={twMerge(
								"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
								businessDetailFacts?.guest_owner_edits?.includes("industry") &&
									GuestOwnerStyle,
							)}
						>
							{businessDetailFacts?.industry?.value?.name ??
								business?.industry?.name ??
								"-"}
							<ConditionalPlusIcon
								isNotapplicant={
									!!businessDetailFacts?.guest_owner_edits?.includes("industry")
								}
							/>
						</p>
					</div>
					<div className="p-4">
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							NAICS code
						</p>
						<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
							{businessDetailFacts?.naics_code?.value ??
								business?.naics_code ??
								"-"}
						</p>
					</div>
					<div className="p-4">
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							MCC code
						</p>
						<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
							{businessDetailFacts?.mcc_code?.value ??
								business?.mcc_code ??
								"-"}
						</p>
					</div>
					<div className="p-4">
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							NAICS description
						</p>
						<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
							{businessDetailFacts?.naics_description?.value ??
								business?.naics_title ??
								"-"}
						</p>
					</div>
					<div className="p-4">
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							MCC description
						</p>
						<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
							{businessDetailFacts?.mcc_description?.value ??
								business?.mcc_title ??
								"-"}
						</p>
					</div>
					{/* <div className="p-4">
								<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
									Risk level
								</p>
								<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
									-
								</p>
						</div> */}
				</div>
			</div>
		</>
	);
};

export default Industry;
