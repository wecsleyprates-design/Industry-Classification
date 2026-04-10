import { ToastContainer } from "react-toastify";

const Toast = () => {
	return (
		<>
			<ToastContainer
				position={"bottom-right"}
				autoClose={5000}
				closeOnClick
				pauseOnFocusLoss
				draggable
				pauseOnHover
				theme="light"
				toastClassName={"text-sm rounded-xl"}
			/>
		</>
	);
};

export default Toast;
