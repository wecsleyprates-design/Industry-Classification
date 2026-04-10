import { Fragment, useEffect, useRef, useState } from "react";
import { Menu, Transition } from "@headlessui/react";
import CircleExclamation from "@/assets/CircleExclamation";

interface DropdownProps {
	options?: Array<{
		title: string;
		description: string;
		risk_level: "HIGH" | "MODERATE" | "LOW";
	}>;
	value: any;
}

const AlertsDropdown: React.FC<DropdownProps> = ({ options, value }) => {
	const [positionClasses, setPositionClasses] = useState("left-0 md:left-0");
	const buttonRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (buttonRef.current) {
			const rect = buttonRef.current.getBoundingClientRect();
			const screenWidth = window.innerWidth;

			// Calculate if there's enough space to the right
			if (Number(rect.left) + 330 > screenWidth) {
				setPositionClasses("right-0");
			} else {
				setPositionClasses("left-0");
			}
		}
	}, [buttonRef.current]);

	return (
		<Menu as="div" className="relative right-0" ref={buttonRef}>
			<div>
				<Menu.Button className="inline-flex text-[8px] w-full bg-white justify-center text-sm font-semibold hover:bg-gray-50">
					{value}
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
					className={`absolute z-50 mt-3 origin-top-left bg-white divide-y divide-gray-100 rounded-md shadow-lg min-w-80 ${positionClasses}`}
				>
					<div className="overflow-auto max-h-[330px] bg-white">
						{options?.map((item, index) => (
							<div key={index} className="grid grid-cols-6 mx-4 my-2">
								<div className="mt-1">
									<CircleExclamation
										color={item.risk_level === "HIGH" ? "#C81E1E" : "#FF9900"}
									/>
								</div>
								<div className="col-span-5">
									<div className="">
										<p className="text-[#1F2A37] text-sm font-bold cursor-pointer">
											{item.title}
										</p>
										<p className="text-xs text-[#071437]">{item.description}</p>
									</div>
								</div>
							</div>
						))}
					</div>
				</Menu.Items>
			</Transition>
		</Menu>
	);
};

export default AlertsDropdown;
