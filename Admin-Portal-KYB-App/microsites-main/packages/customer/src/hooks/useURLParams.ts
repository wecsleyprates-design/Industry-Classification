import { useCallback } from "react";
import { useSearchParams as useRouterSearchParams } from "react-router-dom";

export const useURLParams = () => {
	const [searchParams, setSearchParams] = useRouterSearchParams();

	const updateParams = useCallback(
		(updates: Record<string, string | null>) => {
			const currentParams = new URLSearchParams(window.location.search);
			Object.entries(updates).forEach(([key, value]) => {
				if (value === null) {
					currentParams.delete(key);
				} else {
					currentParams.set(key, value);
				}
			});
			setSearchParams(currentParams);
		},
		[setSearchParams],
	);

	return { searchParams, setSearchParams, updateParams };
};
