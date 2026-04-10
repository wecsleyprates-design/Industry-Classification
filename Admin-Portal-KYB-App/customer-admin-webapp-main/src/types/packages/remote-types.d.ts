declare module "caseApp/CustomerCaseTable" {
	const Component: React.ComponentType<any>;
	export default Component;
}

declare module "caseApp/CustomerCaseDetails" {
	const Component: React.ComponentType<any>;
	export default Component;
}

declare module "dashboardApp/Home" {
	const Component: React.ComponentType<any>; // Adjust based on your exported type
	export default Component;
}

declare module "customerApp/CustomerFeature" {
	const Component: React.ComponentType<any>;
	export default Component;
}

declare module "userApp/CustomerUserTable" {
	const Component: React.ComponentType<any>;
	export default Component;
}

declare module "userApp/TeamsTab" {
	const Component: React.ComponentType<any>;
	export default Component;
}

declare module "userApp/CreateRole" {
	const Component: React.ComponentType<any>;
	export default Component;
}

declare module "userApp/EditRole" {
	const Component: React.ComponentType<any>;
	export default Component;
}

declare module "customerApp/CustomerFeature" {
	const Component: React.ComponentType<any>;
	export default Component;
}

declare module "customerApp/CustomerRiskMonitoringScoring" {
	const Component: React.ComponentType<any>;
	export default Component;
}

declare module "caseApp/BusinessCaseTable" {
	const Component: React.ComponentType<{ platform: "customer" | "admin" }>;
	export default Component;
}

declare module "customerApp/CustomerNotifications" {
	const Component: React.ComponentType<any>;
	export default Component;
}

declare module "customerApp/Workflows" {
	const Component: React.ComponentType<any>;
	export default Component;
}
