import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UserWrapper } from "@/layouts/UserWrapper";
import { ToastProvider } from "./providers/ToastProvider";
import Router from "./routes";

function App() {
	const queryClient = new QueryClient();
	return (
		<UserWrapper>
			<QueryClientProvider client={queryClient}>
				<div className="h-screen App user">
					<Router />
					<ToastProvider />
				</div>
			</QueryClientProvider>
		</UserWrapper>
	);
}

export default App;
