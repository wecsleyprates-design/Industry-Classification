import { Fragment } from "react";
import { Menu, Transition } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import classNames from "classnames";
import { type TOption } from "@/lib/types/common";

interface DropdownProps {
	title: any;
	options: TOption[] | [];
	onChange: (value: string | number | Record<string, unknown>) => void;
	value: number | string | Record<string, unknown>;
}

const DropdownWithIcon: React.FC<DropdownProps> = ({
	title,
	options,
	onChange,
	value,
}) => {
	const displayValue: any = value;
	return (
		<Menu as="div" className="relative text-left">
			<div>
				<Menu.Button className="inline-flex text-[8px] w-full justify-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50">
					{displayValue}
					<ChevronDownIcon
						className="-mr-1 h-5 w-5 text-gray-400"
						aria-hidden="true"
					/>
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
				<Menu.Items className="absolute right-0 z-30 mt-2 max-w-fit origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none bottom-full">
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
