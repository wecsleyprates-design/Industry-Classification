import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useMediaQuery } from "@/hooks/use-media-query";

import { Button } from "@/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/ui/dialog";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
} from "@/ui/drawer";

interface WatchlistHit {
	title: string;
	description?: string;
	source: {
		name: string;
		organization: string;
		country: string;
		url?: string;
	};
	person: string;
}

interface WatchlistHitsDisplayProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	hits: WatchlistHit[];
}

export function WatchlistHitsDisplay({
	open,
	onOpenChange,
	hits,
}: WatchlistHitsDisplayProps) {
	const isDesktop = useMediaQuery("(min-width: 768px)");

	// Group hits by person
	const hitsByPerson = hits.reduce<Record<string, WatchlistHit[]>>(
		(acc, hit) => {
			if (!acc[hit.person]) {
				acc[hit.person] = [];
			}
			acc[hit.person].push(hit);
			return acc;
		},
		{},
	);

	const content = (
		<div className="flex flex-col gap-8">
			{Object.entries(hitsByPerson).map(([person, personHits]) => (
				<div key={person} className="flex flex-col gap-4">
					<h3 className="text-md font-medium">Hits for {person}</h3>
					{personHits.map((hit, index) => (
						<div
							key={index}
							className="rounded-lg border border-gray-100 p-4 flex flex-col gap-2"
						>
							<div className="flex items-start gap-3">
								<div className="rounded-full bg-red-50 p-2">
									<ExclamationTriangleIcon className="size-5 text-red-700" />
								</div>
								<div className="flex flex-col gap-1">
									<h4 className="font-medium">{hit.title}</h4>
									<p className="text-gray-600">{hit.source.organization}</p>
									<p className="text-gray-600">{hit.source.country}</p>
									{hit.source.url && (
										<a
											href={hit.source.url}
											target="_blank"
											rel="noopener noreferrer"
											className="text-blue-600 hover:text-blue-800 text-sm mt-1"
										>
											Source ↗
										</a>
									)}
								</div>
							</div>
						</div>
					))}
				</div>
			))}
		</div>
	);

	if (isDesktop) {
		return (
			<Dialog open={open} onOpenChange={onOpenChange}>
				<DialogContent className="sm:max-w-[600px]">
					<DialogHeader className="border-b pb-4">
						<div className="flex items-center justify-between">
							<DialogTitle className="text-md font-normal leading-normal tracking-wide -mt-3">
								Watchlist Hits
							</DialogTitle>
							<DialogClose className="opacity-70 hover:opacity-100" />
						</div>
					</DialogHeader>
					<div className="px-1 py-4">{content}</div>
				</DialogContent>
			</Dialog>
		);
	}

	return (
		<Drawer open={open} onOpenChange={onOpenChange}>
			<DrawerContent>
				<DrawerHeader className="border-b">
					<div className="flex items-center justify-between">
						<DrawerTitle className="text-md font-normal leading-normal tracking-wide">
							Watchlist Hits
						</DrawerTitle>
						<DrawerClose className="opacity-70 hover:opacity-100" />
					</div>
				</DrawerHeader>
				<div className="px-4 py-6">{content}</div>
				<div className="p-4">
					<DrawerClose asChild>
						<Button variant="outline" className="w-full">
							Close
						</Button>
					</DrawerClose>
				</div>
			</DrawerContent>
		</Drawer>
	);
}
