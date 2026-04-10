import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { APIProvider } from "@vis.gl/react-google-maps";
import CaseWrapper from "@/layouts/CaseWrapper";
import { envConfig } from "./config/envConfig";
import { ToastProvider } from "./providers/ToastProvider";
import Router from "./routes";
import "./App.css";

function App() {
	const queryClient = new QueryClient();

	return (
		<CaseWrapper>
			<APIProvider
				apiKey={envConfig.VITE_GOOGLE_MAPS_API_KEY}
				libraries={["marker", "places"]}
			>
				<QueryClientProvider client={queryClient}>
					<div className="h-screen App case">
						<Router />
						<ToastProvider />
					</div>
				</QueryClientProvider>
			</APIProvider>
		</CaseWrapper>
	);
}

export default App;
