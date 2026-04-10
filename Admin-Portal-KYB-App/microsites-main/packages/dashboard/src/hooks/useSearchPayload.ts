import React from "react";
import { useSearchParams } from "react-router-dom";
import * as qs from "qs";
import { getSearchPayload } from "@/lib/helper";

type DateType = string | null | Date;

interface Props {
	pagination?: boolean;
	defaultSort?: string;
}

const useSearchPayload = (props?: Props) => {
	const [searchParams, setSearchParams] = useSearchParams();
	const lastPageBeforeFiltersRef = React.useRef<string>("1");

	// Track the last page number before any filters are applied
	React.useEffect(() => {
		if (
			!searchParams.get("search") &&
			!searchParams.get("filter") &&
			!searchParams.get("filter_date")
		) {
			lastPageBeforeFiltersRef.current = searchParams.get("page") ?? "1";
		}
	}, [searchParams]);

	const payload = getSearchPayload(
		searchParams,
		props?.defaultSort,
		props?.pagination,
	);

	const searchHandler = (value: string, searchFields: string[]) => {
		if (!value.trim()) {
			setSearchParams(
				(prev) => {
					prev.delete("search");
					prev.delete("query");
					prev.set("page", lastPageBeforeFiltersRef.current);
					return prev;
				},
				{ replace: true },
			);
			return;
		}

		setSearchParams(
			(prev) => {
				prev.set(
					"search",
					qs.stringify(
						searchFields.reduce(
							(acc: Partial<Record<string, string>>, item) => {
								acc[item] = value.trim();
								return acc;
							},
							{},
						),
					),
				);
				if (prev.get("query") === value) {
					prev.set("page", prev.get("page") ?? "1");
				} else {
					prev.set("page", "1");
				}
				prev.set("query", value);
				return prev;
			},
			{ replace: true },
		);
	};

	const sortHandler = (order: string | null, alias: string | null) => {
		setSearchParams(
			(prev) => {
				if (order === null || alias === null) {
					prev.delete("sort");
				} else {
					prev.set("sort", qs.stringify({ [alias]: order }));
				}
				return prev;
			},
			{ replace: true },
		);
	};

	const filterHandler = (
		filters: Record<string, unknown>,
		dateFilters?: Record<string, string>,
	) => {
		if (
			Object.keys(filters).length === 0 &&
			(!dateFilters || Object.keys(dateFilters).length === 0)
		) {
			setSearchParams(
				(prev) => {
					prev.delete("filter");
					prev.delete("filter_date");
					prev.set("page", lastPageBeforeFiltersRef.current);
					return prev;
				},
				{ replace: true },
			);
			return;
		}

		setSearchParams(
			(prev) => {
				prev.set("filter", qs.stringify(filters, { encode: true }));
				if (dateFilters) {
					prev.set("filter_date", qs.stringify(dateFilters));
				}
				prev.set("page", "1");
				return prev;
			},
			{ replace: true },
		);
	};

	const dateFilterHandler = (selectedDates: Record<string, DateType[]>) => {
		if (Object.keys(selectedDates).length === 0) {
			setSearchParams(
				(prev) => {
					prev.delete("filter_date");
					prev.set("page", lastPageBeforeFiltersRef.current);
					return prev;
				},
				{ replace: true },
			);
		} else {
			setSearchParams(
				(prev) => {
					prev.set(
						"filter_date",
						qs.stringify({
							...selectedDates,
						}),
					);
					prev.set("page", "1");
					return prev;
				},
				{ replace: true },
			);
		}
	};

	const paginationHandler = (pageVal: number) => {
		setSearchParams(
			(prev) => {
				prev.set("page", pageVal.toString());
				return prev;
			},
			{ replace: true },
		);
	};

	const itemsPerPageHandler = (itemsPerPageVal: number) => {
		setSearchParams(
			(prev) => {
				prev.set("page", "1");
				prev.set("itemsPerPage", itemsPerPageVal.toString());
				return prev;
			},
			{ replace: true },
		);
	};

	return {
		payload,
		searchHandler,
		sortHandler,
		filterHandler,
		dateFilterHandler,
		paginationHandler,
		itemsPerPageHandler,
	};
};

export default useSearchPayload;
