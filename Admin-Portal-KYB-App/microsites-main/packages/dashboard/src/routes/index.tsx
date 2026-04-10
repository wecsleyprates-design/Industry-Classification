import { BrowserRouter, Route, Routes } from "react-router-dom";
import Home from "page/Home";
import Login from "page/Login";
import { URL } from "../constants";
import PrivateRoute from "./PrivateRoute";
import PublicRoute from "./PublicRoute";

const Router = () => (
	<BrowserRouter>
		<Routes>
			<Route element={<PublicRoute />}>
				<Route path={URL.LOGIN} element={<Login />} />
			</Route>
			<Route element={<PrivateRoute />}>
				<Route path={URL.HOME} element={<Home />} />
			</Route>
		</Routes>
	</BrowserRouter>
);

export default Router;
