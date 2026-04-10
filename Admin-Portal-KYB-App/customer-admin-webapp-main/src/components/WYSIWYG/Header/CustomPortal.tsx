import React, { type ReactElement } from "react";
import { Popover } from "@headlessui/react";

const Portal: React.FC<{ children: ReactElement; component: ReactElement }> = ({
	children,
	component,
}) => {
	return (
		<div className="relative">
			<Popover className="relative">
				{({ open }) => (
					<>
						<Popover.Button>{children}</Popover.Button>
						<Popover.Panel
							className={`z-50 absolute mt-2 border bg-white shadow rounded-lg p-4 transition transform origin-top`}
						>
							{component}
						</Popover.Panel>
					</>
				)}
			</Popover>
		</div>
	);
};

export default Portal;
