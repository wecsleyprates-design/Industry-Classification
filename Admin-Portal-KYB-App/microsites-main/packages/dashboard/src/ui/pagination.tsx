import React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import { cn } from "@/lib/utils";

interface PaginationProps {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}

const PageButton = React.memo(
	({
		page,
		currentPage,
		onClick,
	}: {
		page: number;
		currentPage: number;
		onClick: () => void;
	}) => (
		<button
			onClick={onClick}
			className={cn(
				"inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 hover:bg-gray-100",
				page === currentPage && "bg-gray-100 font-semibold",
			)}
			aria-current={page === currentPage ? "page" : undefined}
		>
			{page}
		</button>
	),
);
PageButton.displayName = "PageButton";

const Ellipsis = React.memo(() => (
	<span className="inline-flex items-center justify-center w-8 h-8 text-gray-600">
		...
	</span>
));
Ellipsis.displayName = "Ellipsis";

const NavigationButton = React.memo(
	({
		direction,
		onClick,
		disabled,
	}: {
		direction: "prev" | "next";
		onClick: () => void;
		disabled: boolean;
	}) => (
		<button
			onClick={onClick}
			className={cn(
				"inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100",
				disabled && "opacity-50 cursor-not-allowed",
			)}
			aria-label={`Go to ${direction === "prev" ? "previous" : "next"} page`}
			disabled={disabled}
		>
			{direction === "prev" ? (
				<ChevronLeftIcon className="w-4 h-4" />
			) : (
				<ChevronRightIcon className="w-4 h-4" />
			)}
		</button>
	),
);
NavigationButton.displayName = "NavigationButton";

const RenderPageButtons = React.memo(
	({ currentPage, totalPages, onPageChange }: PaginationProps) => {
		const buttons = [];

		if (totalPages <= 5) {
			for (let i = 1; i <= totalPages; i++) {
				buttons.push(
					<li key={i}>
						<PageButton
							page={i}
							currentPage={currentPage}
							onClick={() => {
								onPageChange(i);
							}}
						/>
					</li>,
				);
			}
		} else {
			buttons.push(
				<li key={1}>
					<PageButton
						page={1}
						currentPage={currentPage}
						onClick={() => {
							onPageChange(1);
						}}
					/>
				</li>,
			);
			if (currentPage > 3)
				buttons.push(
					<li key="ellipsis1">
						<Ellipsis />
					</li>,
				);

			let start = Math.max(2, currentPage - 1);
			let end = Math.min(currentPage + 1, totalPages - 1);

			if (currentPage <= 3) end = 3;
			if (currentPage >= totalPages - 2) start = totalPages - 2;

			for (let i = start; i <= end; i++) {
				buttons.push(
					<li key={i}>
						<PageButton
							page={i}
							currentPage={currentPage}
							onClick={() => {
								onPageChange(i);
							}}
						/>
					</li>,
				);
			}

			if (currentPage < totalPages - 2)
				buttons.push(
					<li key="ellipsis2">
						<Ellipsis />
					</li>,
				);
			buttons.push(
				<li key={totalPages}>
					<PageButton
						page={totalPages}
						currentPage={currentPage}
						onClick={() => {
							onPageChange(totalPages);
						}}
					/>
				</li>,
			);
		}

		return <>{buttons}</>;
	},
);
RenderPageButtons.displayName = "RenderPageButtons";

export function Pagination({
	currentPage,
	totalPages,
	onPageChange,
}: PaginationProps) {
	return (
		<nav className="flex justify-center">
			<ul className="flex items-center gap-1 text-sm">
				<li>
					<NavigationButton
						direction="prev"
						onClick={() => {
							onPageChange(Math.max(1, currentPage - 1));
						}}
						disabled={currentPage === 1}
					/>
				</li>
				<RenderPageButtons
					currentPage={currentPage}
					totalPages={totalPages}
					onPageChange={onPageChange}
				/>
				<li>
					<NavigationButton
						direction="next"
						onClick={() => {
							onPageChange(Math.min(totalPages, currentPage + 1));
						}}
						disabled={currentPage === totalPages}
					/>
				</li>
			</ul>
		</nav>
	);
}
