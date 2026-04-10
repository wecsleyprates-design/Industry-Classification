import React, { useEffect, useState } from "react";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import useDebounce from "@/hooks/useDebounce";
import useDidMountEffect from "@/hooks/useDidMountEffect";
import Tooltip from "../Tooltip";

interface SeachbarProps {
	value?: string;
	placeholder?: string;
	onChange: (value: string) => void;
}

const SearchBox: React.FC<SeachbarProps> = ({
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
		<div className="relative flex flex-1 sm:max-w-[280px]">
			<label htmlFor="search-field" className="sr-only">
				Search
			</label>
			<Tooltip tooltip={placeholder} isLeft>
				<MagnifyingGlassIcon
					className="absolute w-4 h-full ml-3 text-gray-400 "
					aria-hidden="true"
				/>
			</Tooltip>
			<input
				id="search-field-unique"
				className="w-full focus:outline-none bg-white h-8 border-0  ring-1 ring-inset ring-gray-300 text-gray-900 text-xs rounded-lg block py-2.5 pl-8"
				placeholder={"Search"}
				value={searchVal}
				type="text"
				onChange={(e) => {
					setSearchVal(e.target.value);
				}}
				name="search-unique"
			/>
		</div>
	);
};

export default SearchBox;
