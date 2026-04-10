import React, {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useRef,
	useState,
} from "react";
import { HexColorPicker } from "react-colorful";
import useClickOutside from "@/components/PopUpColorPicker/useClickOutside";

type Props = {
	color: string;
	onChange: Dispatch<SetStateAction<string>>;
};

export const HexColorPicketPopOver = ({ color, onChange }: Props) => {
	const popover = useRef<HTMLDivElement>(null);
	const [isOpen, toggle] = useState(false);

	const close = useCallback(() => {
		toggle(false);
	}, []);
	useClickOutside(popover as React.RefObject<HTMLElement>, close);

	return (
		<div className="">
			<div
				className="absolute w-5 h-5 transform -translate-y-1/2 rounded-full cursor-pointer top-1/2 left-3 border-[#D1D5DB] border"
				style={{ backgroundColor: `${color}` }}
				onClick={() => {
					toggle(true);
				}}
			/>

			{isOpen && (
				<div
					className="z-50 border border-[#D1D5DB] absolute top-full left-0 mt-0.5 rounded-lg shadow-lg"
					ref={popover}
				>
					<HexColorPicker color={color} onChange={onChange} />
				</div>
			)}
		</div>
	);
};
