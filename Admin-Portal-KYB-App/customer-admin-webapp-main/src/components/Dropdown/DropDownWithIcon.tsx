import { Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import {
	ChevronDownIcon,
	ChevronUpDownIcon,
} from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";
import { type TOption } from "@/types/common";

function classNames(...classes: string[]) {
	return classes.filter(Boolean).join(" ");
}

interface DropdownProps {
	title: any;
	options: TOption[] | [];
	onChange: (value: string | number | Record<string, unknown>) => void;
	value: number | string | Record<string, unknown>;
	className?: string;
	icon?: any;
}

const DropdownWithIcon: React.FC<DropdownProps> = ({
	title,
	options,
	onChange,
	value,
	className,
	icon,
}) => {
	const displayValue: any = value;
	return (
		<Menu as="div" className="relative text-left">
			<div>
				<Menu.Button
					className={twMerge(
						"inline-flex text-[8px] w-full justify-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50",
						className,
					)}
				>
					{displayValue}
					{!icon && (
						<ChevronDownIcon
							className="w-5 h-5 -mr-1 text-gray-400"
							aria-hidden="true"
						/>
					)}
					{icon && (
						<ChevronUpDownIcon
							className="w-5 h-5 -mr-1 text-gray-400"
							aria-hidden="true"
						/>
					)}
				</Menu.Button>
			</div>

			<Transition
				as={Fragment}
				enter="transition ease-out duration-100"
				enterFrom="opacity-0 translate-y-4 scale-95"
				enterTo="opacity-100 translate-y-0 scale-100"
				leave="transition ease-in duration-75"
				leaveFrom="opacity-100 translate-y-0 scale-100"
				leaveTo="opacity-0 translate-y-4 sm:translate-y-0 scale-95"
			>
				<Menu.Items
					className={twMerge(
						"absolute z-30 mt-2 bg-white bottom-full divide-y divide-gray-100 rounded-md shadow-lg left-5 max-w-fit ring-1 ring-black ring-opacity-5 focus:outline-none",
						className,
					)}
				>
					<div className="py-1">
						{options.map((item, index) => (
							<Menu.Item key={index}>
								{
									<a
										onClick={() => {
											onChange(item.value);
										}}
										className={classNames(
											item.value === value
												? "bg-gray-100 text-blue-900"
												: "text-gray-700",
											"group flex items-center px-4 py-2 text-xs font-medium text-center cursor-pointer",
										)}
									>
										{item.label}
									</a>
								}
							</Menu.Item>
						))}
					</div>
				</Menu.Items>
			</Transition>
		</Menu>
	);
};

export default DropdownWithIcon;
