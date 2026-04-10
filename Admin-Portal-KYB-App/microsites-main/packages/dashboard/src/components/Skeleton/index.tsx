import cx from "classnames";

export const Skeleton = ({
	className,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => {
	return (
		<div className={cx("animate-pulse bg-slate-200", className)} {...props} />
	);
};
