import React, { Fragment, type ReactElement } from "react";
import { Menu, Transition } from "@headlessui/react";
import { twMerge } from "tailwind-merge";

const ButtonDropdown: React.FC<{
	buttonElement: ReactElement;
	options: React.ReactElement[] | null | undefined;
	orientation?: string;
	divider?: boolean;
}> = ({ buttonElement, options, orientation = "right-0", divider = true }) => {
	return (
		<div>
			<Menu as="div" className="relative right-0">
				<div>
					<Menu.Button className="text-[8px] w-full bg-white justify-center text-sm font-semibold hover:bg-gray-50">
						{buttonElement}
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
						as="div"
						className={twMerge(
							`absolute ${orientation} p-4 z-10 mt-2 origin-top-right rounded-xl bg-white shadow-lg border border-gray-200 ring-opacity-5 transition-all focus:outline-none data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in`,
							divider && options && options?.filter((val) => val)?.length > 1
								? "divide-y p-2"
								: "",
						)}
					>
						{options?.map((item, index: number) => (
							<div key={index}>{item}</div>
						))}
					</Menu.Items>
				</Transition>
			</Menu>
		</div>
	);
};

export default ButtonDropdown;
