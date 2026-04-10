import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export const useSearchState = <V extends string>(
	key: string,
	defaultValue: V,
): [V, (value: V) => void] => {
	const [searchParams, setSearchParams] = useSearchParams();

	const value = (searchParams.get(key) as V) || defaultValue;
	const setValue = useCallback(
		(value: V) => {
			const newSearchParams = new URLSearchParams(searchParams);
			newSearchParams.set(key, value);
			setSearchParams(newSearchParams, { replace: true });
		},
		[searchParams, key],
	);

	return [value, setValue];
};
