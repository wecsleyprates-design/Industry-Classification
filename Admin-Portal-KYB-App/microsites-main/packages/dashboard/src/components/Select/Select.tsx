import { Controller } from "react-hook-form";
import { type TOption } from "@/lib/types/common";
import CommonSelect from "../Dropdown";

type Props = {
	defaultValue: string;
	label: string;
	options: TOption[];
	isRequired: boolean;
	placeholder: string;
	value: string;
	name: string;
	onChange: (arg0: TOption) => void;
	error?: string;
};

const Select = (props: Props) => {
	return (
		<Controller
			{...props}
			render={({ field }) => <CommonSelect {...props} {...field} />}
		/>
	);
};

export default Select;
