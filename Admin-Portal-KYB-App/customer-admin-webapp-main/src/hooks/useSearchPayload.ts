import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import * as qs from "qs";
import {
	type DateType,
	type TSelectedValueType,
} from "@/components/Filter/types";
import { getSearchPayload } from "@/lib/helper";

interface Props {
	pagination?: boolean;
	defaultSort?: string;
}

const useSearchPayload = (props?: Props) => {
	const [searchParams, setSearchParams] = useSearchParams();
	const navigate = useNavigate();
	const location = useLocation();
	const payload = getSearchPayload(
		searchParams,
		props?.defaultSort,
		props?.pagination,
	);

	const searchHandler = (value: string, searchFields: string[]) => {
		if (value) {
			setSearchParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					next.set(
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
					if (next.get("query") === value)
						next.set("page", next.get("page") ?? "1");
					else next.set("page", "1");
					next.set("query", value);
					return next;
				},
				{ replace: true },
			);
		} else
			setSearchParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					next.delete("search");
					next.set("page", "1");
					return next;
				},
				{ replace: true },
			);
	};

	const sortHandler = (order: string, alias: string) => {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				next.set("sort", qs.stringify({ [alias]: order }));
				return next;
			},
			{ replace: true },
		);
	};

	const filterHandler = (
		selectedValues: Record<string, TSelectedValueType[]>,
	) => {
		// Use current URL so sequential filter then dateFilter calls merge (fallback when applyFiltersAndDates not used)
		const currentSearch =
			typeof window !== "undefined"
				? window.location.search
				: searchParams.toString();
		const next = new URLSearchParams(currentSearch);
		if (Object.keys(selectedValues).length > 0) {
			const filterString = qs.stringify({ ...selectedValues });
			next.set("filter", filterString);
		} else {
			next.delete("filter");
		}
		next.set("page", "1");
		navigate(
			{ pathname: location.pathname, search: next.toString() },
			{ replace: true },
		);
	};

	const dateFilterHandler = (selectedDates: Record<string, DateType[]>) => {
		const currentSearch =
			typeof window !== "undefined"
				? window.location.search
				: searchParams.toString();
		const next = new URLSearchParams(currentSearch);
		if (Object.keys(selectedDates).length > 0) {
			const filterDateString = qs.stringify({ ...selectedDates });
			next.set("filter_date", filterDateString);
		} else {
			next.delete("filter_date");
		}
		next.set("page", "1");
		navigate(
			{ pathname: location.pathname, search: next.toString() },
			{ replace: true },
		);
	};

	/** Single navigate for filter + date so second call does not overwrite first (same searchParams) */
	const applyFiltersAndDates = (
		selectedValues: Record<string, TSelectedValueType[]>,
		selectedDates: Record<string, DateType[]>,
	) => {
		const next = new URLSearchParams(searchParams);
		// filter
		if (Object.keys(selectedValues).length > 0) {
			next.set("filter", qs.stringify({ ...selectedValues }));
		} else {
			next.delete("filter");
		}
		// filter_date
		if (Object.keys(selectedDates).length > 0) {
			next.set("filter_date", qs.stringify({ ...selectedDates }));
		} else {
			next.delete("filter_date");
		}
		next.set("page", "1");
		const newSearch = next.toString();
		navigate(
			{ pathname: location.pathname, search: newSearch },
			{ replace: true },
		);
	};

	const paginationHandler = (pageVal: number) => {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				next.set("page", pageVal.toString());
				return next;
			},
			{ replace: true },
		);
	};

	const itemsPerPageHandler = (itemsPerPageVal: number) => {
		setSearchParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				next.set("page", "1");
				next.set("itemsPerPage", itemsPerPageVal.toString());
				return next;
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
		applyFiltersAndDates,
		paginationHandler,
		itemsPerPageHandler,
	};
};

export default useSearchPayload;
