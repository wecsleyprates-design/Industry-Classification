import React, { type FC } from "react";
import Button from "@/components/Button";
interface LinkModalProps {
	url: string;
	setUrl: React.Dispatch<React.SetStateAction<string>>;
	label: string;
	setLabel: React.Dispatch<React.SetStateAction<string>>;
	applyLink: () => void;
	removeLink?: () => void;
}
const LinkModal: FC<LinkModalProps> = ({
	url,
	setUrl,
	label,
	setLabel,
	applyLink,
}) => {
	return (
		<div className="rounded w-[250px] sm:w-[300px]">
			<label className="block mb-1.5 text-xs">URL*</label>
			<input
				type="text"
				name="url"
				className="w-full p-2 border rounded-lg"
				value={url}
				onChange={(e) => {
					setUrl(e.target.value.trim());
				}}
			/>
			<label className="block mt-2 mb-1.5 text-xs">Label</label>
			<input
				type="text"
				name="text"
				className="w-full p-2 border rounded-lg"
				value={label}
				onChange={(e) => {
					setLabel(e.target.value);
				}}
			/>

			<div className="flex justify-end mt-3.5 gap-x-2">
				{/* <Button
					onClick={removeLink}
					type="button"
					className="py-2 text-black bg-white border border-black rounded-lg hover:text-white"
					>
					Remove Link
					</Button> */}
				<Button
					onClick={applyLink}
					type="button"
					color="dark"
					disabled={!url}
					className="pt-2 rounded-lg"
				>
					Apply
				</Button>
			</div>
		</div>
	);
};

export default LinkModal;
