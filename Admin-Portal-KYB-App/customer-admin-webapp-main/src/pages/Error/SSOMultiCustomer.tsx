import { useNavigate } from "react-router-dom";
import authError from "@/assets/png/authError.png";
import Button from "@/components/Button";
import FullPageLoader from "@/components/Spinner/FullPageLoader";
import useLogout from "@/hooks/useLogout";
import useAuthStore from "@/store/useAuthStore";

import { URL } from "@/constants/URL";

const SSOMultiCustomer = () => {
	const navigate = useNavigate();
	const { isLoading } = useLogout();
	// Replace with your auth condition
	const { clearIsAuthenticated } = useAuthStore((state) => state);

	return (
		<>
			{isLoading && <FullPageLoader />}
			<div className="pt-16 overflow-hidden bg-white rounded-lg">
				<div className="flex flex-col justify-center">
					<div className="flex justify-center">
						<img src={authError} alt="" className="scale-75 md:scale-90" />
					</div>
					<p className="text-[32px] text-center mt-5 font-bold">
						We couldn’t log you in
					</p>
					<p className="text-[18px] text-center mt-2 font-normal">
						You are trying to log in using an email alias. <br /> Please contact{" "}
						<span className="text-[#1A56DB]">support@joinworth.com</span> to
						assign your account to the correct customer.
					</p>
					<div className="flex justify-center mt-5 gap-x-3">
						<Button
							className="text-center w-[100px] rounded-lg"
							color="dark"
							onClick={() => {
								clearIsAuthenticated();
								navigate(URL.CASE);
							}}
						>
							Go Back
						</Button>
					</div>
				</div>
			</div>
		</>
	);
};

export default SSOMultiCustomer;
