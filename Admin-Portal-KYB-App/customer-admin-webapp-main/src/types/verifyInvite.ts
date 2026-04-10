export interface verifyInviteEmailResponse {
	status: string;
	message: string;
	data: {
		user_id: string;
		redirect: string;
	};
}
