import { useEffect } from "react";
import { Userpilot } from "userpilot";
import useAuthStore from "@/store/useAuthStore";

export const useUserPilot = () => {
	const loginData = useAuthStore((state) => state.loginData);
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

	useEffect(() => {
		if (isAuthenticated && loginData) {
			const user = loginData.user_details;
			const subrole = loginData.subrole;
			const company = loginData.customer_details;
			const today = new Date();

			Userpilot.identify(user.id, {
				name: user.first_name + " " + user.last_name,
				email: user.email,
				first_name: user.first_name,
				last_name: user.last_name,
				user_type: "Customer",
				role: `Customer ${subrole.label}`,
				created_at: today.toISOString(), // ISO8601 Date,
				"Last Visited Company": company.name,
				company: {
					id: company.id,
					name: company.name,
					company_type: "Enterprise",
					created_at: today.toISOString(), // ISO8601 Date
				},
				AssociatedBusinesses: JSON.stringify([
					{ id: company.id, name: company.name },
				]),
				"No of Businesses": 1,
			});

			Userpilot.reload();
		}
	}, [loginData, isAuthenticated]);
};
