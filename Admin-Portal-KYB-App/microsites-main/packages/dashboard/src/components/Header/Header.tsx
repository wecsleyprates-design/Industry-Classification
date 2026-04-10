import { Fragment, memo } from "react";
import { Menu, Transition } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import { Bars3Icon, UserIcon } from "@heroicons/react/24/outline";
import useSidebarStore from "@/store/useSidebarStore";

interface DropdownOption {
	name: string;
	onClick: () => void;
}
export interface HeaderProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	worthLogo?: boolean;
	showSidebar?: boolean;
	className?: string;
	children?: React.ReactNode;
	userDetails?: Record<string, any>;
	DropdownOptions?: DropdownOption[];
}
interface RightHeaderProps {
	userDetails?: Record<string, any>;
	DropdownOptions?: DropdownOption[];
}

const defaultClasses = `
fixed
w-screen
z-50
  `;

export const RightHeader: React.FC<RightHeaderProps> = ({
	userDetails,
	DropdownOptions,
}) => {
	return (
		<div className="flex flex-row-reverse self-stretch flex-1 gap-x-4 lg:gap-x-6">
			<div className="flex items-center gap-x-4 lg:gap-x-6">
				{/* Profile dropdown */}
				<Menu as="div" className="relative">
					<Menu.Button className="-m-1.5 flex items-center p-1.5">
						<span className="sr-only">Open user menu</span>
						{/* <img
							className="w-8 h-8 rounded-full bg-gray-50"
							src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
							alt=""
						/> */}
						<span className="h-8 w-8 rounded-full bg-gray-50 border-2 border-slate-100 self-center p-0.5">
							<UserIcon height={24} width={24} />
						</span>
						<span className="hidden lg:flex lg:items-center">
							<span
								className="ml-4 text-sm font-semibold leading-6 text-gray-900"
								aria-hidden="true"
							>
								{(userDetails?.first_name as string) +
									" " +
									(userDetails?.last_name as string)}
							</span>
							<ChevronDownIcon
								className="w-5 h-5 ml-2 text-gray-400"
								aria-hidden="true"
							/>
						</span>
					</Menu.Button>
					<Transition
						as={Fragment}
						enter="transition ease-out duration-100"
						enterFrom="transform opacity-0 scale-95"
						enterTo="transform opacity-100 scale-100"
						leave="transition ease-in duration-75"
						leaveFrom="transform opacity-100 scale-100"
						leaveTo="transform opacity-0 scale-95"
					>
						<Menu.Items className="absolute right-0 z-10 mt-2.5 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none">
							{DropdownOptions?.length &&
								DropdownOptions.map((item) => (
									<Menu.Item key={item.name}>
										{({ active }) => (
											<p
												onClick={item.onClick}
												className={`${
													active ? "bg-gray-50" : ""
												}" cursor-pointer block px-3 py-1 text-sm leading-6 text-gray-900`}
											>
												{item.name}
											</p>
										)}
									</Menu.Item>
								))}
						</Menu.Items>
					</Transition>
				</Menu>
			</div>
		</div>
	);
};

const Header: React.FC<HeaderProps> = ({
	className,
	children,
	userDetails,
	DropdownOptions,
	showSidebar = true,
	worthLogo = false,
}) => {
	const setSidebarOpen = useSidebarStore((state) => state.setSidebarOpen);

	return (
		<div className={className ?? defaultClasses}>
			{worthLogo && (
				<img
					className="absolute z-50 h-5 mt-5 ml-5"
					src="/logo.svg"
					alt="Your Company"
				/>
			)}
			<div className="sticky top-0 z-40 flex items-center h-16 px-8 bg-white border-b border-gray-200 shadow-sm shrink-0 gap-x-4 sm:gap-x-6 sm:px-10 lg:px-12">
				{showSidebar && (
					<>
						<button
							type="button"
							className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
							onClick={() => {
								setSidebarOpen(true);
							}}
						>
							<span className="sr-only">Open sidebar</span>
							<Bars3Icon className="w-6 h-6" aria-hidden="true" />
						</button>
						{children}
						{/* Separator */}
						<div
							className="w-px h-6 bg-gray-900/10 lg:hidden"
							aria-hidden="true"
						/>
					</>
				)}
				<div className="flex self-stretch flex-1 gap-x-4 lg:gap-x-6">
					<form className="relative flex flex-1" action="#" method="GET"></form>
					<div className="flex items-center gap-x-4 lg:gap-x-6">
						{/* <button
							type="button"
							className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500"
						>
							<span className="sr-only">View notifications</span>
							<BellIcon className="w-6 h-6" aria-hidden="true" />
						</button> */}

						{/* Separator */}
						<div
							className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-900/10"
							aria-hidden="true"
						/>

						<RightHeader
							userDetails={userDetails}
							DropdownOptions={DropdownOptions}
						/>
					</div>
				</div>
			</div>
		</div>
	);
};

export default memo(Header);
