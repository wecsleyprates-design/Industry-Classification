import { Skeleton } from "@/components/Skeleton";
import { getTaxIdLabel } from "@/lib/taxIdLabels";
import { SectionHeader } from "./SectionHeader";

export const SkeletonUI = ({
	countryCode,
}: { countryCode?: string | undefined } = {}) => (
	<div className="flex flex-col gap-10 pt-8">
		{/* Tax ID Verification */}
		<section className="container mx-auto">
			<div className="flex flex-col gap-8">
				<SectionHeader titleText={getTaxIdLabel(countryCode, "sectionTitle")} />

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<h3 className="py-1 text-xs font-light text-gray-500">
							Business name
						</h3>
						<Skeleton className="h-4 w-[100px]" />
					</div>
					<div>
						<h3 className="py-1 text-xs font-light text-gray-500">
							{getTaxIdLabel(countryCode, "fieldLabel")}
						</h3>
						<Skeleton className="h-4 w-[85px]" />
					</div>
				</div>
			</div>
		</section>

		{/* Secretary of State Filings */}
		<section className="container mx-auto">
			<div className="flex flex-col gap-8">
				<SectionHeader titleText="Secretary of State Filings" />

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<h3 className="py-1 text-xs font-light text-gray-500">Status</h3>
						<Skeleton className="h-4 w-[85px]" />
					</div>
					<div>
						<h3 className="py-1 text-xs font-light text-gray-500">State</h3>
						<Skeleton className="h-4 w-[35px]" />
					</div>
					<div>
						<h3 className="py-1 text-xs font-light text-gray-500">
							Legal entity name
						</h3>
						<Skeleton className="h-4 w-[100px]" />
					</div>
					<div>
						<h3 className="py-1 text-xs font-light text-gray-500">
							Registration date
						</h3>
						<Skeleton className="h-4 w-[50px]" />
					</div>
					<div>
						<h3 className="py-1 text-xs font-light text-gray-500">
							Entity type
						</h3>
						<Skeleton className="h-4 w-[75px]" />
					</div>
					<div>
						<h3 className="py-1 text-xs font-light text-gray-500">
							Corporate officers
						</h3>
						<Skeleton className="h-4 w-[75px]" />
					</div>
				</div>
			</div>
		</section>

		{/* Known Addresses */}
		<section className="container mx-auto">
			<div className="flex flex-col gap-8">
				<SectionHeader titleText="Known Addresses" />

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<h3 className="py-1 text-xs font-light text-gray-500">
							Address retrieved
						</h3>

						<Skeleton className="h-4 w-[185px]" />
					</div>
					<div>
						<h3 className="py-1 text-xs font-light text-gray-500">
							Deliverable
						</h3>

						<Skeleton className="h-4 w-[55px]" />
					</div>
				</div>
			</div>
		</section>

		{/* Business Name(s) */}
		<section className="container mx-auto">
			<div className="flex flex-col gap-8">
				<SectionHeader titleText="Business Name(s)" />

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<h3 className="py-1 text-xs font-light text-gray-500">
							Names retrieved
						</h3>
						<div className="flex flex-col gap-2">
							<Skeleton className="h-4 w-[100px]" />
							<Skeleton className="h-4 w-[75px]" />
						</div>
					</div>
				</div>
			</div>
		</section>

		{/* Watchlist Summary */}
		<section className="container mx-auto">
			<div className="flex flex-col gap-8">
				<SectionHeader titleText="Watchlist Summary" />
				<h2 className="-mt-8 text-xs font-light leading-tight text-gray-400">
					Searching 14 Watchlists
				</h2>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<h3 className="py-1 text-xs font-light text-gray-500">
							Bureau of Industry and Security
						</h3>
						<div className="flex flex-col gap-2">
							<Skeleton className="h-4 w-[75px]" />
							<Skeleton className="h-4 w-[125px]" />
							<Skeleton className="h-4 w-[80px]" />
							<Skeleton className="h-4 w-[85px]" />
						</div>
					</div>

					<div>
						<h3 className="py-1 text-xs font-light text-gray-500">
							State Department
						</h3>
						<div className="flex flex-col gap-2">
							<Skeleton className="h-4 w-[75px]" />
							<Skeleton className="h-4 w-[85px]" />
						</div>
					</div>

					<div>
						<h3 className="py-1 text-xs font-light text-gray-500">
							Office of Foreign Assets Control
						</h3>
						<div className="flex flex-col gap-2">
							<Skeleton className="h-4 w-[75px]" />
							<Skeleton className="h-4 w-[125px]" />
							<Skeleton className="h-4 w-[80px]" />
							<Skeleton className="h-4 w-[125px]" />
							<Skeleton className="h-4 w-[135px]" />
							<Skeleton className="h-4 w-[85px]" />
							<Skeleton className="h-4 w-[125px]" />
							<Skeleton className="h-4 w-[95px]" />
						</div>
					</div>
				</div>
			</div>
		</section>
	</div>
);
