import { type FC } from "react";

import { TitleLeftDivider } from "@/ui/title-left-divider";

export const Industry: FC<{ business: any }> = ({ business }) => {
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
						<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
							{business?.industry?.name ?? "-"}
						</p>
					</div>
					<div className="p-4">
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							NAICS code
						</p>
						<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
							{business?.naics_code ?? "-"}
						</p>
					</div>
					<div className="p-4">
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							MCC code
						</p>
						<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
							{business?.mcc_code ?? "-"}
						</p>
					</div>
					<div className="p-4">
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							NAICS description
						</p>
						<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
							{business?.naics_title ?? "-"}
						</p>
					</div>
					<div className="p-4">
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							MCC description
						</p>
						<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
							{business?.mcc_title ?? "-"}
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
