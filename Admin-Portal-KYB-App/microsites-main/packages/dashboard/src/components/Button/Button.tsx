import React, { Fragment } from "react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import { twMerge } from "tailwind-merge";
import Spinner from "../Spinner";
import ButtonDropdown from "./ButtonDropdown";

interface BtnPropsWithChildren {
	icon?: React.ReactNode;
}

interface BtnProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>, BtnPropsWithChildren {
	block?: boolean;
	children: React.ReactNode;
	className?: string;
	color?:
		| "primary"
		| "success"
		| "danger"
		| "warning"
		| "indigo"
		| "dark"
		| "transparent"
		| "grey"
		| "white";

	disabled?: boolean;
	outline?: boolean;
	rounded?: boolean;
	bold?: boolean;
	size?: "sm" | "md" | "lg";
	type?: "submit" | "reset" | "button";
	text?: string;
	isLoading?: boolean;
	dropdown?: boolean;
	options?: any;
	showDropdwon?: boolean;
	whiteLabel?: boolean;
}

type ButtonRef = React.ForwardedRef<HTMLButtonElement>;

const style = {
	rounded: `rounded-full`,
	block: `flex justify-center w-full`,
	default: `focus:outline-none transition ease-in duration-200 rounded-lg`,
	disabled: `opacity-20 cursor-not-allowed`,
	sizes: {
		sm: "px-2 py-1 text-xs",
		md: "px-6 py-2 text-sm",
		lg: "px-8 py-3 text-lg",
	},
	bold: `font-bold`,
	color: {
		primary: {
			bg: `bg-blue-700 border text-white border-blue-700 active:ring-2 active:ring-black`,
			outline: `border-blue-700 border text-blue-700 active:ring-2 active:ring-black`,
		},
		success: {
			bg: `bg-green-700 active:ring-1 active:ring-offset-1 active:ring-green-700 active:ring-offset-green-200`,
			outline: `border-green-700 border text-green-700 active:bg-green-700 active:text-white`,
		},
		danger: {
			bg: `bg-red-600 active:ring-1 active:ring-offset-1 active:ring-red-600 active:ring-offset-red-200`,
			outline: `border-red-600 border text-red-600 active:bg-red-600 active:text-white`,
		},
		dark: {
			bg: `bg-black border border-[#333] text-white px-12 px-3 py-2.5 active:ring-2 active:ring-black`,
			outline: `border-black border text-gray-900 active:ring-2 active:ring-black`,
		},
		warning: {
			bg: `bg-yellow-500 border border-yellow-500 active:ring-1  active:ring-offset-1 active:ring-yellow-500 active:ring-offset-yellow-200`,
			outline: `border-yellow-500 border text-yellow-500 active:bg-yellow-500 active:text-white`,
		},
		indigo: {
			bg: `bg-indigo-900 border border-indigo-900 active:ring-2 active:ring-offset-2 active:ring-indigo-900 active:ring-offset-indigo-200`,
			outline: `border-indigo-900 border text-indigo-900 active:bg-indigo-900 active:text-white`,
		},
		transparent: {
			bg: `bg-transparent border border-transparent active:ring-2 active:ring-black`,
			outline: `text-gray-900  border border-gray-900 active:ring-2 active:ring-black`,
		},
		grey: {
			bg: `bg-[#DFDFDF] border border-[#DFDFDF] active:ring-2 active:ring-black`,
			outline: `text-gray-900 border border-[#DFDFDF] active:ring-2 active:ring-black`,
		},
		white: {
			bg: `bg-[#FFFFFF] border border-[#DFDFDF] active:ring-2 active:ring-black`,
			outline: `text-gray-900 border border-[#DFDFDF] active:ring-2 active:ring-black`,
		},
	},
};

const colors = (outline: boolean | undefined) => ({
	primary: outline ? style.color.primary.outline : style.color.primary.bg,
	success: outline ? style.color.success.outline : style.color.success.bg,
	danger: outline ? style.color.danger.outline : style.color.danger.bg,
	dark: outline ? style.color.dark.outline : style.color.dark.bg,
	warning: outline ? style.color.warning.outline : style.color.warning.bg,
	indigo: outline ? style.color.indigo.outline : style.color.indigo.bg,
	transparent: outline
		? style.color.transparent.outline
		: style.color.transparent.bg,
	grey: outline ? style.color.grey.outline : style.color.grey.bg,
	white: outline ? style.color.grey.outline : style.color.white.bg,
});

const Button = React.forwardRef(
	(
		{
			block = false,
			children,
			className,
			color = "transparent",
			disabled = false,
			outline,
			bold,
			rounded,
			size = "md",
			type,
			isLoading,
			dropdown,
			options,
			showDropdwon,
			whiteLabel,
			...props
		}: BtnProps,
		ref: ButtonRef,
	) => {
		const buttonElement = (
			<button
				ref={ref}
				{...props}
				type={type}
				disabled={disabled}
				className={twMerge(
					block ? style.block : "",
					bold ? style.bold : "font-medium",
					disabled ? style.disabled : "",
					style.sizes[size],
					style.default,
					rounded ? style.rounded : "rounded-lg",
					color ? colors(outline)[color] : colors(outline).dark,
					(isLoading ?? dropdown)
						? "flex h-py-1 flex-row justify-center justify-items-center items-center"
						: "",
					className ?? "",
				)}
			>
				{isLoading && (
					<div className="pr-2">
						<Spinner type="sm" />
					</div>
				)}
				{children}
				{dropdown && showDropdwon && <ChevronDownIcon className="w-4 h-4" />}
			</button>
		);

		if (dropdown) {
			return (
				<>
					<ButtonDropdown buttonElement={buttonElement} options={options} />
				</>
			);
		}

		return buttonElement;
	},
);

Button.displayName = "Button";

export default Button;
