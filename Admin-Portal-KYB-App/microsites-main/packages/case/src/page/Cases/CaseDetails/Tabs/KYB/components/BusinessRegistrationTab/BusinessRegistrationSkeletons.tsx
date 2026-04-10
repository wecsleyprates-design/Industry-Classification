import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Skeleton } from "@/ui/skeleton";

export const BusinessRegistrationSkeleton = () => {
	const taxFields = [
		{ labelWidth: "w-36", valueWidth: "w-36" }, // Business Name
		{ labelWidth: "w-40", valueWidth: "w-24" }, // Tax ID Number (EIN)
	];

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center space-x-2">
					<CardTitle>Business Registration</CardTitle>
					<Skeleton className="w-20 h-6 rounded-full" />
				</div>
			</CardHeader>
			<CardContent>
				<div>
					{taxFields.map((field, i) => (
						<div
							key={i}
							className="py-4 sm:flex sm:flex-row sm:gap-4 justify-between items-start"
						>
							<Skeleton className={`h-4 ${field.labelWidth}`} />
							<Skeleton className={`h-4 ${field.valueWidth}`} />
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
};

export const SOSFilingsSkeleton = () => {
	const sosFields = [
		{ labelWidth: "w-24", valueWidth: "w-20" }, // Filing Status
		{ labelWidth: "w-40", valueWidth: "w-16" }, // Entity Jurisdiction Type
		{ labelWidth: "w-36", valueWidth: "w-8" }, // State
		{ labelWidth: "w-32", valueWidth: "w-24" }, // Registration Date
		{ labelWidth: "w-24", valueWidth: "w-32" }, // Entity Type
		{ labelWidth: "w-36", valueWidth: "w-36" }, // Corporate Officers
		{ labelWidth: "w-36", valueWidth: "w-36" }, // Legal Entity Name
	];

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center space-x-2">
					<CardTitle>Secretary of State Filings</CardTitle>
					<Skeleton className="w-20 h-6 rounded-full" />
				</div>
			</CardHeader>
			<CardContent>
				<div>
					{sosFields.map((field, i) => (
						<div
							key={i}
							className="py-4 sm:flex sm:flex-row sm:gap-4 justify-between items-start"
						>
							<Skeleton className={`h-4 ${field.labelWidth}`} />
							<Skeleton className={`h-4 ${field.valueWidth}`} />
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
};
