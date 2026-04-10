import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CustomerWrapper } from "./layouts/CustomerWrapper";
import { ToastProvider } from "./providers/ToastProvider";
import Router from "./routes";

function App() {
	const queryClient = new QueryClient();
	return (
		<CustomerWrapper>
			<QueryClientProvider client={queryClient}>
				<div className="h-screen App customer">
					<Router />
					<ToastProvider />
				</div>
			</QueryClientProvider>
		</CustomerWrapper>
	);
}

export default App;
