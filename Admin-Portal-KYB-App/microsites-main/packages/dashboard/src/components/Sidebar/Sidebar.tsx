import React, { Fragment, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { Link } from "react-router-dom";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import classNames from "classnames";
import useSidebarStore from "@/store/useSidebarStore";
import { URL } from "../../constants/index";

type navItem = {
	name: string;
	href: string;
	icon: any;
	current: boolean;
	isAccessible: boolean;
};

interface Props {
	navItems: navItem[];
}

const SidebarNavItems: React.FC<Props> = ({ navItems }) => {
	const { setSidebarOpen } = useSidebarStore((state) => state);
	return (
		<nav className="flex flex-col flex-1">
			<ul role="list" className="flex flex-col flex-1 gap-y-7">
				<li>
					<ul role="list" className="-mx-2 space-y-1">
						{navItems.map((item) => {
							return (
								item.isAccessible && (
									<li key={item.name}>
										<Link
											to={item.href}
											onClick={() => {
												setSidebarOpen(false);
											}}
											className={classNames(
												item.current
													? "bg-gray-800 text-white"
													: "text-gray-400 hover:text-white hover:bg-gray-800",
												"group flex items-center gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold",
											)}
										>
											<div className="w-5">
												<item.icon fill={item.current ? "#FFF" : "#B1B1B1"} />
											</div>
											{item.name}
										</Link>
									</li>
								)
							);
						})}
					</ul>
				</li>
			</ul>
		</nav>
	);
};

const SidebarLogo = () => {
	return <div className="flex items-center h-16 shrink-0">Icon</div>;
};

const Sidebar = () => {
	const location = useLocation();

	const { sidebarOpen, setSidebarOpen } = useSidebarStore((state) => state);
	const [sidebarNavItems, setSidebarNavItems] = useState<navItem[]>([
		{
			name: "Dashboard",
			href: "/dashboard",
			icon: <></>,
			current: true,
			isAccessible: true,
		},
		{
			name: "Transactions",
			href: "/transactions",
			icon: <></>,
			current: false,
			isAccessible: true,
		},

		{
			name: "Profile",
			href: "/profile",
			icon: <></>,
			current: true,
			isAccessible: true,
		},
	]);

	useEffect(() => {
		const url = location.pathname;
		const activeTabURL = url ?? URL.HOME;

		const clonesidebarNavItemss = sidebarNavItems.map((item) => {
			if (item.href === activeTabURL) {
				return { ...item, current: true };
			} else return { ...item, current: false };
		});
		setSidebarNavItems(clonesidebarNavItemss);
	}, [location.pathname]);

	return (
		<React.Fragment>
			<Transition.Root show={sidebarOpen} as={Fragment}>
				<Dialog
					as="div"
					className="relative z-50 lg:hidden"
					onClose={setSidebarOpen}
				>
					<Transition.Child
						as={Fragment}
						enter="transition-opacity ease-linear duration-300"
						enterFrom="opacity-0"
						enterTo="opacity-100"
						leave="transition-opacity ease-linear duration-300"
						leaveFrom="opacity-100"
						leaveTo="opacity-0"
					>
						<div className="fixed inset-0 bg-gray-900/80" />
					</Transition.Child>

					<div className="fixed inset-0 flex">
						<Transition.Child
							as={Fragment}
							enter="transition ease-in-out duration-300 transform"
							enterFrom="-translate-x-full"
							enterTo="translate-x-0"
							leave="transition ease-in-out duration-300 transform"
							leaveFrom="translate-x-0"
							leaveTo="-translate-x-full"
						>
							<Dialog.Panel className="relative flex flex-1 w-full max-w-xs mr-16">
								<Transition.Child
									as={Fragment}
									enter="ease-in-out duration-300"
									enterFrom="opacity-0"
									enterTo="opacity-100"
									leave="ease-in-out duration-300"
									leaveFrom="opacity-100"
									leaveTo="opacity-0"
								>
									<div className="absolute top-0 flex justify-center w-16 pt-5 left-full">
										<button
											type="button"
											className="-m-2.5 p-2.5"
											onClick={() => {
												setSidebarOpen(false);
											}}
										>
											<span className="sr-only">Close sidebar</span>
											<XMarkIcon
												className="w-6 h-6 text-white"
												aria-hidden="true"
											/>
										</button>
									</div>
								</Transition.Child>
								{/* Sidebar component, swap this element with another sidebar if you like */}
								<div className="flex flex-col px-6 pb-4 overflow-y-auto bg-gray-900 grow gap-y-5 ring-1 ring-white/10">
									<SidebarLogo />
									<SidebarNavItems navItems={sidebarNavItems} />
								</div>
							</Dialog.Panel>
						</Transition.Child>
					</div>
				</Dialog>
			</Transition.Root>
			<div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
				{/* Sidebar component, swap this element with another sidebar if you like */}
				<div className="flex flex-col px-6 pb-4 overflow-y-auto bg-gray-900 grow gap-y-5">
					<SidebarLogo />
					<SidebarNavItems navItems={sidebarNavItems} />
				</div>
			</div>
		</React.Fragment>
	);
};

export default Sidebar;
