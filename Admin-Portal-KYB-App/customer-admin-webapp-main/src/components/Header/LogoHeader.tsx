import { type ReactElement } from "react";
import React from "react";
import { Navigate } from "react-router";
import WorthIcon from "assets/svg/BrandIcons/WorthIcon";
import useAuthStore from "@/store/useAuthStore";
import { type ILoginResponseUserDetails } from "@/types/auth";
import { RightHeader } from "./Header";

interface DropdownOption {
	name: string;
	onClick: () => void;
}

interface Props {
	children: ReactElement;
	DropdownOptions?: DropdownOption[];
	userDetails?: ILoginResponseUserDetails | null;
}

const LogoHeader: React.FC<Props> = ({
	children,
	DropdownOptions,
	userDetails,
}) => {
	const { isAuthenticated } = useAuthStore((state) => state);

	return isAuthenticated ? (
		<React.Fragment>
			<div className="fixed w-full">
				<div className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
					<button type="button" className="-m-2.5 p-2.5 text-gray-700">
						<span className="sr-only">Logo</span>
						<WorthIcon />
					</button>
					<div
						className="h-6 w-px bg-gray-900/10 lg:hidden"
						aria-hidden="true"
					/>
					<RightHeader
						userDetails={userDetails}
						DropdownOptions={DropdownOptions}
					/>
				</div>
			</div>
			<div className="overflow-hidden rounded-lg bg-white">
				<div className="px-4 py-5 sm:p-6">
					<main className="py-24">
						<div className="sm:px-6 lg:px-36">{children}</div>
					</main>
				</div>
			</div>
		</React.Fragment>
	) : (
		<Navigate to="/" />
	);
};

export default LogoHeader;
