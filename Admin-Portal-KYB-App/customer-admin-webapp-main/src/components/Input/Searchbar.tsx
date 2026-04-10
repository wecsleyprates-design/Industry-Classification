import React, { useEffect, useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import useDebounce from "@/hooks/useDebounce";
import useDidMountEffect from "@/hooks/useDidMountEffect";

interface SeachbarProps {
	value?: string;
	placeholder?: string;
	onChange: (value: string) => void;
}

const SearchBar: React.FC<SeachbarProps> = ({
	placeholder = "Search",
	value,
	onChange,
}) => {
	const [searchVal, setSearchVal] = useState("");
	const val = useDebounce(searchVal, 500);

	useEffect(() => {
		if (value) setSearchVal(value);
	}, [value]);

	useDidMountEffect(() => {
		onChange(val);
	}, [val]);

	return (
		<div className="relative flex flex-1">
			<label htmlFor="search-field" className="sr-only">
				Search
			</label>
			<MagnifyingGlassIcon
				className="cursor-pointer absolute top-0.5 ml-2 h-full w-5 text-gray-400"
				aria-hidden="true"
			/>
			<input
				id="search-field"
				className="bg-gray-50 h-10 px-2 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full py-2.5 pl-6 ml-1 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
				placeholder={placeholder}
				value={searchVal}
				onChange={(e) => {
					setSearchVal(e.target.value);
				}}
				name="search"
			/>
		</div>
	);
};

export default SearchBar;
