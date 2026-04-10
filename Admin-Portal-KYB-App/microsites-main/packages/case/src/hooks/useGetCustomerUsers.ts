import { useGetCustomer } from "@/services/queries/case.query";

export const useGetCustomerUsers = (customerId: string) => {
	const { data } = useGetCustomer(customerId);

	const users = data?.data?.records ?? [];

	// Transform API users into `Person[]` shape
	const transformedUsers = users
		.filter((user) => user.id)
		.map((user) => ({
			id: `${user.id}`,
			name: `${user.first_name} ${user.last_name}`,
			email: user.email,
			role: user.subrole?.label ?? "",
		}));

	const assignedUserOptions = [
		{ name: "Unassigned", role: "", id: null },
		...transformedUsers,
	];

	return assignedUserOptions;
};
