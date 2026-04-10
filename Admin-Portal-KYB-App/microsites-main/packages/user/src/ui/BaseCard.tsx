import { cn } from "@/lib/utils";

export default function BaseCard({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLDivElement>) {
	return (
		<div
			className={cn(
				"rounded-xl bg-card text-card-foreground overflow-hidden border",
				className,
			)}
			{...props}
		>
			{children}
		</div>
	);
}
