import { ToastContainer } from "react-toastify";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import useAddClassName from "./hooks/useAddClassName";
import Router from "./routes";
import "react-toastify/dist/ReactToastify.css";

function App() {
	const queryClient = new QueryClient();
	useAddClassName(["data-radix-popper-content-wrapper"]);
	return (
		<QueryClientProvider client={queryClient}>
			<div className="w-screen h-screen dashboard">
				<Router />
			</div>
			<ToastContainer />
		</QueryClientProvider>
	);
}

export default App;
