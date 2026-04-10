import React, { Suspense, useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useFlags } from "launchdarkly-react-client-sdk";
import { ErrorBoundary } from "@/components/ErrorBoundary/ErrorBoundary";
import { Skeleton } from "@/components/Skeleton";
import UserpilotWrapper from "@/components/Userpilot";
import { getRemoteComponent } from "@/lib/helper";
import { Archived } from "@/pages/Archived";
import {
	AcceptInvite,
	CustomerSelection,
	ForgotPassword,
	Login,
	ResetPassword,
	SSOCallback,
} from "@/pages/Auth";
import VerifyFailed from "@/pages/Auth/VerifyFailed";
import VerifyInvite from "@/pages/Auth/VerifyInvite";
import {
	BusinessAuditTrail,
	BusinessDetails,
	Businesses,
	HistoricalScoreData,
	NewBusiness,
	SendInvitation,
} from "@/pages/Businesses";
import BusinessCaseDetails from "@/pages/Businesses/Business/BusinessCaseDetail";
import InvitationDetails from "@/pages/Businesses/Business/InvitationDetails";
import { AddACase, AllCases } from "@/pages/Cases";
import ArchivedCases from "@/pages/Cases/ArchivedCases";
import AttentionCases from "@/pages/Cases/AttentionCases";
import RenderCaseDetails from "@/pages/Cases/RenderCaseDetails";
import RenderCaseTable from "@/pages/Cases/RenderCaseTable";
import NotFound from "@/pages/Error/NotFound";
import SSOMultiCustomer from "@/pages/Error/SSOMultiCustomer";
import Unauthorized from "@/pages/Error/Unauthorized";
import { Report } from "@/pages/Report";
import { RiskMonitoring } from "@/pages/RiskMonitoring";
import {
	AddEndpoints,
	Advancing,
	DesignAndBranding,
	FeatureSetting,
	GeneralSettings,
	Integrations,
	Manage,
	Notifications,
	Scoring,
	Settings,
	WebhookDetail,
} from "@/pages/Settings";
import {
	CreateUser,
	EditUser,
	RenderUserTable,
	UserDetails,
} from "@/pages/Users";
import useAuthStore from "@/store/useAuthStore";
import { type TAccessType, type TCodeModule } from "@/types/common";
import { URL } from "../constants/URL";
import PermittedRoute from "./PermittedRoute";
import PrivateRoute from "./PrivateRoute";
import PublicRoute from "./PublicRoute";
import StyleRoute from "./StyleRoute";

import FEATURE_FLAGES from "@/constants/FeatureFlags";
import { ACCESS, MODULES } from "@/constants/Modules";

const RemoteCaseTable = React.lazy(async () => {
	const module = await getRemoteComponent("case", "CustomerCaseTable");
	return { default: module.default };
}) as React.ComponentType;

const RemoteCaseDetails = React.lazy(async () => {
	const module = await getRemoteComponent("case", "CustomerCaseDetails");
	return { default: module.default };
}) as React.ComponentType;

const RemoteDashboard = React.lazy(async () => {
	const module = await getRemoteComponent("dashboard", "Home");
	return { default: module.default };
}) as React.ComponentType;

const RemoteUserTable = React.lazy(async () => {
	const module = await getRemoteComponent("user", "TeamsTab");
	return { default: module.default };
}) as React.ComponentType;

const CreateRole = React.lazy(async () => {
	const module = await getRemoteComponent("user", "CreateRole");
	return { default: module.default };
}) as React.ComponentType;

const EditRole = React.lazy(async () => {
	const module = await getRemoteComponent("user", "EditRole");
	return { default: module.default };
}) as React.ComponentType;

const CustomerCreateUser = React.lazy(async () => {
	const module = await getRemoteComponent("user", "CustomerCreateUser");
	return { default: module.default };
}) as React.ComponentType;

const CustomerUserDetail = React.lazy(async () => {
	const module = await getRemoteComponent("user", "CustomerUserDetail");
	return { default: module.default };
}) as React.ComponentType;

const RemoteWorkflows = React.lazy(async () => {
	const module = await getRemoteComponent("customer", "Workflows");
	return { default: module.default };
}) as React.ComponentType;

const Router = () => {
	const flags = useFlags();
	const permissions = useAuthStore((state) => state.permissions);
	const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

	const hasPermissions = Object.keys(permissions).length > 0;

	const routerKey = `${isAuthenticated ? "auth" : "guest"}-${
		hasPermissions ? "perms" : "no-perms"
	}`;

	const checkForAccess = (module: TCodeModule, type?: TAccessType): boolean => {
		const canRead = !!permissions[module]?.read;
		const canWrite = !!permissions[module]?.write;
		const canCreate = !!permissions[module]?.create;

		if (type === "read") return canRead;
		else if (type === "write") return canWrite;
		else if (type === "create") return canCreate;

		return canCreate ?? canRead ?? canWrite;
	};

	useEffect(() => {
		// Always preload dashboard home
		void getRemoteComponent("dashboard", "Home");

		void getRemoteComponent("case", "CustomerCaseTable");
		void getRemoteComponent("case", "CustomerCaseDetails");
		void getRemoteComponent("case", "BusinessCaseTable");
		void getRemoteComponent("customer", "RiskMonitoring");

		if (flags[FEATURE_FLAGES.PAT_805_CUSTOMER_MICROSITE]) {
			void getRemoteComponent("customer", "CustomerFeature");
			void getRemoteComponent("customer", "CustomerRiskMonitoringScoring");
			void getRemoteComponent("customer", "CustomerNotifications");
		}
		if (flags[FEATURE_FLAGES.FOTC_79_APPROVAL_WORKFLOWS]) {
			void getRemoteComponent("customer", "Workflows");
		}
		if (flags[FEATURE_FLAGES.PAT_703_USER_MANAGEMENT_V2]) {
			void getRemoteComponent("user", "CreateRole");
			void getRemoteComponent("user", "EditRole");
			void getRemoteComponent("user", "TeamsTab");
			void getRemoteComponent("user", "CustomerCreateUser");
			void getRemoteComponent("user", "CustomerUserDetail");
		}
	}, [flags]);

	return (
		<BrowserRouter>
			<ErrorBoundary>
				<Routes key={routerKey}>
					<Route element={<UserpilotWrapper />}>
						<Route element={<PublicRoute />}>
							<Route path={URL.ROOT} element={<Login />} />
							<Route path={URL.LOGIN} element={<Login />} />
							{flags[FEATURE_FLAGES.FOTC_1_ENABLE_SAML_SSO] && (
								<Route path={URL.SSO_CALLBACK} element={<SSOCallback />} />
							)}
							<Route path={URL.FORGOT_PASSWORD} element={<ForgotPassword />} />
							<Route path={URL.RESET_PASSWORD} element={<ResetPassword />} />
							<Route path={URL.SET_PASSWORD} element={<AcceptInvite />} />
							<Route path={`${URL.VERIFY}`} element={<VerifyInvite />} />
							<Route
								path={URL.VERIFICATION_FAILED}
								element={<VerifyFailed />}
							/>
						</Route>
						<Route element={<PrivateRoute hideSidebar={true} />}>
							<Route
								path={URL.CUSTOMER_SELECTION}
								element={<CustomerSelection />}
							/>
						</Route>
						<Route element={<PrivateRoute />}>
							<Route element={<PermittedRoute />}>
								{checkForAccess(MODULES.CRO, ACCESS.READ) && (
									<Route
										path={URL.DASHBOARD}
										element={
											<Suspense fallback={<></>}>
												<div className="-m-8">
													<RemoteDashboard />
												</div>
											</Suspense>
										}
									/>
								)}

								{checkForAccess(MODULES.SETTINGS, ACCESS.READ) && (
									<Route path={URL.SETTINGS} element={<Settings />}>
										<Route
											path={URL.GENERAL_SETTINGS}
											element={<GeneralSettings />}
										/>
										<Route
											path={URL.BRANDING_SETTINGS}
											element={<DesignAndBranding />}
										/>
										<Route
											path={URL.NOFITICATIONS_SETTINGS}
											element={<Notifications />}
										/>
										<Route
											path={URL.FEATURE_SETTINGS}
											element={<FeatureSetting />}
										/>
										<Route path={URL.SCORING_SETTING} element={<Scoring />} />
										<Route
											path={URL.ADVANCED_SETTINGS}
											element={<Advancing />}
										/>
										<Route
											path={URL.INTEGRATIONS_SETTINGS}
											element={<Integrations />}
										/>
									</Route>
								)}
								{checkForAccess(MODULES.SETTINGS, ACCESS.READ) &&
									flags[FEATURE_FLAGES.FOTC_79_APPROVAL_WORKFLOWS] && (
										<Route
											path={URL.WORKFLOWS}
											element={
												<Suspense
													fallback={<Skeleton className="w-full h-48" />}
												>
													<div className="-m-8">
														<RemoteWorkflows />
													</div>
												</Suspense>
											}
										/>
									)}
								{checkForAccess(MODULES.SETTINGS, ACCESS.READ) && (
									<>
										<Route path={URL.MANAGE_ENDPOINTS} element={<Manage />} />
										<Route
											path={URL.ADD_ENDPOINTS}
											element={<AddEndpoints />}
										/>
										<Route
											path={URL.ENDPOINT_DETAILS}
											element={<WebhookDetail />}
										/>
									</>
								)}
								{checkForAccess(MODULES.SETTINGS, ACCESS.WRITE) && (
									<>
										<Route
											path={URL.ADD_ENDPOINTS}
											element={<AddEndpoints />}
										/>
									</>
								)}
								{checkForAccess(MODULES.CUSTOMER_USER, ACCESS.READ) && (
									<>
										<Route path={URL.USERS} element={<RenderUserTable />} />
										<Route path={URL.USER_DETAILS} element={<UserDetails />} />
										<Route
											path={URL.CUSTOMER_USER_DETAILS}
											element={
												flags[FEATURE_FLAGES.PAT_703_USER_MANAGEMENT_V2] ? (
													<Suspense fallback={<></>}>
														<div className="-m-8">
															<CustomerUserDetail />
														</div>
													</Suspense>
												) : (
													<UserDetails />
												)
											}
										/>
										<Route
											path={URL.TEAM_USERS}
											element={<RenderUserTable />}
										/>
									</>
								)}
								{checkForAccess(MODULES.CUSTOMER_USER, ACCESS.CREATE) &&
									flags[FEATURE_FLAGES.PAT_703_USER_MANAGEMENT_V2] && (
										<Route
											path={URL.CREATE_USER}
											element={
												<Suspense fallback={<></>}>
													<div className="-m-8">
														<CustomerCreateUser />
													</div>
												</Suspense>
											}
										/>
									)}
								{checkForAccess(MODULES.ROLES, ACCESS.READ) && (
									<>
										<Route
											path={URL.TEAM_ROLES}
											element={
												<Suspense
													fallback={<Skeleton className="w-full h-48" />}
												>
													<div className="-m-8">
														<RemoteUserTable />
													</div>
												</Suspense>
											}
										/>
										{checkForAccess(MODULES.ROLES, ACCESS.CREATE) && (
											<Route
												path={URL.CREATE_ROLE}
												element={
													<Suspense>
														<div className="-m-8">
															<CreateRole />
														</div>
													</Suspense>
												}
											/>
										)}
										{checkForAccess(MODULES.ROLES, ACCESS.WRITE) && (
											<Route
												path={URL.EDIT_ROLE}
												element={
													<Suspense>
														<div className="-m-8">
															<EditRole />
														</div>
													</Suspense>
												}
											/>
										)}
									</>
								)}
								{checkForAccess(MODULES.CASES, ACCESS.READ) && (
									<>
										<Route path={URL.CASE} element={<RenderCaseTable />}>
											<Route index element={<AttentionCases />} />
											<Route path={URL.All_CASES} element={<AllCases />} />
											<Route
												path={URL.ARCHIVED_CASES}
												element={<ArchivedCases />}
											/>
										</Route>
										<Route path={URL.ARCHIVED} element={<Archived />} />

										<Route
											path={URL.CASE_DETAILS_V2}
											element={<RenderCaseDetails />}
										/>
									</>
								)}
								{checkForAccess(MODULES.CASES, ACCESS.READ) && (
									<>
										<Route
											path={URL.CASE_NEW}
											element={
												<Suspense fallback={<></>}>
													<RemoteCaseTable />
												</Suspense>
											}
										/>
										<Route
											path={URL.CASE_DETAILS_NEW}
											element={
												<Suspense fallback={<></>}>
													<div className="-mx-8">
														<RemoteCaseDetails />
													</div>
												</Suspense>
											}
										/>
									</>
								)}
								{checkForAccess(
									MODULES.RISK_MONITORING_MODULE,
									ACCESS.READ,
								) && (
									<Route
										path={URL.RISK_MONITORING}
										element={
											<Suspense fallback={<Skeleton className="w-full h-48" />}>
												<RiskMonitoring />
											</Suspense>
										}
									/>
								)}
								{checkForAccess(MODULES.REPORT, ACCESS.READ) && (
									<Route path={URL.REPORT} element={<Report />} />
								)}

								{checkForAccess(MODULES.BUSINESS, ACCESS.READ) && (
									<>
										<Route path={URL.BUSINESSES} element={<Businesses />} />
										<Route
											path={URL.BUSINESS_DETAILS}
											element={<BusinessDetails />}
										/>
										<Route
											path={URL.BUSINESS_APPLICANT_CASE_DETAILS}
											element={<BusinessCaseDetails />}
										/>
										<Route
											path={URL.BUSINESS_AUDIT_TRAIL}
											element={<BusinessAuditTrail />}
										/>
										{checkForAccess(MODULES.BUSINESS, ACCESS.CREATE) && (
											<Route
												path={URL.NEW_BUSINESS}
												element={<NewBusiness />}
											/>
										)}
										<Route
											path={URL.BUSINESS_HISTORICAL_SCORE_DATA}
											element={<HistoricalScoreData />}
										/>
									</>
								)}
								<Route
									path={URL.BUSINESS_INVITEE_DETAILS}
									element={<InvitationDetails />}
								/>
							</Route>
						</Route>

						<Route element={<StyleRoute />}>
							<Route element={<PermittedRoute />}>
								{checkForAccess(MODULES.CUSTOMER_USER, ACCESS.CREATE) &&
									!flags[FEATURE_FLAGES.PAT_703_USER_MANAGEMENT_V2] && (
										<Route path={URL.CREATE_USER} element={<CreateUser />} />
									)}
								{checkForAccess(MODULES.CUSTOMER_USER, ACCESS.WRITE) &&
									!flags[FEATURE_FLAGES.PAT_703_USER_MANAGEMENT_V2] && (
										<Route path={`${URL.EDIT_USER}`} element={<EditUser />} />
									)}
								{checkForAccess(MODULES.CASES, ACCESS.CREATE) && (
									<Route path={URL.CREATE_CASE} element={<AddACase />} />
								)}
								{checkForAccess(MODULES.BUSINESS, ACCESS.WRITE) && (
									<Route
										path={URL.SEND_INVITATION}
										element={<SendInvitation />}
									/>
								)}
							</Route>
						</Route>

						<Route path={`${URL.AUTH_ERROR}`} element={<Unauthorized />} />
						{flags[FEATURE_FLAGES.FOTC_1_ENABLE_SAML_SSO] && (
							<Route path={`${URL.SSO_MULTI}`} element={<SSOMultiCustomer />} />
						)}
						<Route path="*" element={<NotFound />} />
					</Route>
				</Routes>
			</ErrorBoundary>
		</BrowserRouter>
	);
};

export default Router;
