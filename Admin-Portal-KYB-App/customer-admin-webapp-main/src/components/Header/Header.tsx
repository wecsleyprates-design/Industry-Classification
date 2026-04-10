import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, Transition } from "@headlessui/react";
import { Bars3Icon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { twMerge } from "tailwind-merge";
import SwitchCustomerModal from "@/components/Modal/SwitchCustomerModal";
import { capitalize } from "@/lib/helper";
import { getItem } from "@/lib/localStorage";
import useAuthStore from "@/store/useAuthStore";
import useSidebarStore from "@/store/useSidebarStore";
import { type ILoginResponseUserDetails } from "@/types/auth";
import SwitchCustomers from "./SwitchCustomers";

import { LOCALSTORAGE } from "@/constants/LocalStorage";
import { MODULES } from "@/constants/Modules";

interface DropdownOption {
	name: string;
	onClick: () => void;
}
export interface HeaderProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	className?: string;
	children?: React.ReactNode;
	userDetails: ILoginResponseUserDetails | null;
	DropdownOptions?: DropdownOption[];
}
interface RightHeaderProps {
	DropdownOptions?: DropdownOption[];
	userDetails?: ILoginResponseUserDetails | null;
	onOpenSwitchModal?: () => void;
}

const defaultClasses = `
fixed
w-screen
z-50
  `;

export const RightHeader: React.FC<RightHeaderProps> = ({
	DropdownOptions,
	userDetails,
	onOpenSwitchModal,
}) => {
	const customerName = getItem<string>(LOCALSTORAGE.customerName) ?? "";

	const permissions = useAuthStore((state) => state.permissions);
	const customerType = getItem<string>(LOCALSTORAGE.customerType) ?? "";
	return (
		<div className="flex flex-row-reverse self-stretch flex-1 gap-x-4 lg:gap-x-6">
			<div className="flex items-center gap-x-4 lg:gap-x-6">
				{/* Profile dropdown */}
				<Menu as="div" className="relative">
					<Menu.Button className="-m-1.5 flex items-center p-1.5">
						<span className="sr-only">Open user menu</span>
						<div className="flex items-center justify-center w-10 h-10 text-sm font-semibold text-white bg-blue-600 rounded-full">
							{userDetails?.first_name?.[0]?.toUpperCase()}
							{userDetails?.last_name?.[0]?.toUpperCase()}
						</div>
						<ChevronDownIcon
							className="w-5 h-5 ml-2 text-gray-400"
							aria-hidden="true"
						/>
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
						<Menu.Items className="absolute right-0 z-10 mt-2.5 w-72 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-gray-900/5 focus:outline-none">
							<div className="flex items-start gap-3 px-4 py-3 bg-gray-50 rounded-t-md">
								<div
									className={twMerge(
										"flex items-center justify-center h-12 w-12 rounded-full bg-blue-600 text-white text-sm font-semibold shrink-0",
										customerName && "mt-1",
									)}
								>
									{userDetails?.first_name?.[0]?.toUpperCase()}
									{userDetails?.last_name?.[0]?.toUpperCase()}
								</div>
								<div className="flex flex-col min-w-0">
									<p className="text-sm font-medium text-gray-800">
										{`${userDetails?.first_name ?? ""} ${
											userDetails?.last_name ?? ""
										}`}
									</p>
									{customerName && (
										<p className="text-sm text-gray-500">
											{customerName} - {capitalize(customerType)}
										</p>
									)}
									<p
										className="text-sm text-gray-500 truncate"
										title={userDetails?.email ?? ""}
									>
										{userDetails?.email ?? ""}
									</p>
								</div>
							</div>

							{permissions[MODULES.SETTINGS]?.read && (
								<Menu.Item>
									{({ active }) => (
										<Link
											to="/settings"
											className={twMerge(
												"block px-4 py-2 text-sm",
												active ? "bg-gray-50 text-gray-900" : "text-gray-700",
											)}
										>
											Settings
										</Link>
									)}
								</Menu.Item>
							)}
							<Menu.Item>
								{({ active }) => (
									<SwitchCustomers
										active={active}
										onOpenSwitchModal={onOpenSwitchModal}
									/>
								)}
							</Menu.Item>
							{DropdownOptions?.length && (
								<>
									<hr className="mx-2 my-1" />
									{DropdownOptions.map((item) => (
										<Menu.Item key={item.name}>
											{({ active }) => (
												<p
													onClick={item.onClick}
													className={twMerge(
														active
															? "bg-gray-50 text-gray-900"
															: "text-gray-700",
														"cursor-pointer block px-4 py-2 text-sm mb-1",
													)}
												>
													{item.name}
												</p>
											)}
										</Menu.Item>
									))}
								</>
							)}
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
}) => {
	const setSidebarOpen = useSidebarStore((state) => state.setSidebarOpen);
	const [switchModalOpen, setSwitchModalOpen] = useState(false);

	return (
		<div className={className ?? defaultClasses}>
			<div className="sticky top-0 z-40 flex items-center h-16 px-8 bg-white border-b border-gray-200 shadow-sm shrink-0 gap-x-4 sm:gap-x-6 sm:px-10 lg:px-12">
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
				<div className="w-px h-6 bg-gray-900/10 lg:hidden" aria-hidden="true" />

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
						{/* <div
							className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-900/10"
							aria-hidden="true"
						/> */}

						<RightHeader
							userDetails={userDetails}
							DropdownOptions={DropdownOptions}
							onOpenSwitchModal={() => setSwitchModalOpen(true)}
						/>
					</div>
				</div>
			</div>

			<SwitchCustomerModal
				isOpen={switchModalOpen}
				onClose={() => setSwitchModalOpen(false)}
			/>
		</div>
	);
};

export default Header;
