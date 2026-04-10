import React, { Fragment, type ReactElement } from "react";
import { Menu, Transition } from "@headlessui/react";
import { twMerge } from "tailwind-merge";

const ButtonDropdown: React.FC<{
	buttonElement: ReactElement;
	options: any;
}> = ({ buttonElement, options }) => {
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
						key={String(options)}
						className={twMerge(
							"absolute right-0 p-3 z-10 mt-2 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 transition focus:outline-none data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in",
							options?.filter((val: any) => val)?.length > 1
								? "divide-y p-2"
								: "",
						)}
					>
						{options?.map((item: any, index: number) => (
							<div key={index}>{item}</div>
						))}
					</Menu.Items>
				</Transition>
			</Menu>
		</div>
	);
};

export default ButtonDropdown;
