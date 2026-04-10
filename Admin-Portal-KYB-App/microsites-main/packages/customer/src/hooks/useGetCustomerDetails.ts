import { useEffect } from "react";
import { useNavigate } from "react-router";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { useGetCustomerById } from "@/services/queries/customer.query";

import { URL } from "@/constants";

export const useGetCustomerDetails = (customerId: string) => {
	const navigate = useNavigate();

	const {
		data: customerData,
		error: customerError,
		refetch: refetchCustomerData,
		isLoading: customerLoading,
	} = useGetCustomerById(customerId);

	useEffect(() => {
		if (customerError && isAxiosError(customerError)) {
			const errorMessage =
				customerError?.response?.data?.message ||
				customerError?.message ||
				"Error fetching customer data";
			toast.error(errorMessage);
			if (customerError?.response?.status === 401) {
				navigate(URL.CUSTOMERS);
			}
		}
	}, [customerError, navigate]);

	return {
		customerData,
		customerError,
		refetchCustomerData,
		customerLoading,
	};
};

export default useGetCustomerDetails;
