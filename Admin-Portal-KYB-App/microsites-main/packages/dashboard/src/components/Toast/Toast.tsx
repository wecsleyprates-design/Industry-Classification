import { ToastContainer } from "react-toastify";

const Toast = () => {
	return (
		<>
			<ToastContainer
				position={"top-right"}
				autoClose={5000}
				closeOnClick
				pauseOnFocusLoss
				draggable
				pauseOnHover
				theme="light"
				toastClassName={"text-sm"}
			/>
		</>
	);
};

export default Toast;
