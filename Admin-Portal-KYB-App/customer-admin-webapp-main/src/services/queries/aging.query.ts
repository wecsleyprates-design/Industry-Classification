import { useQuery } from "@tanstack/react-query";
import { getCustomerApplicantConfig } from "../api/aging.service";

export const useGetCustomerApplicantConfig = (customerId: string) =>
	useQuery({
		queryKey: ["getCustomerApplicantConfig", customerId],
		queryFn: async () => {
			const res = await getCustomerApplicantConfig(customerId);
			return res;
		},
		enabled: !!customerId,
	});
