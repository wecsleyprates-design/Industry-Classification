import * as yup from "yup";

export const manageUserSchema = yup.object().shape({
	first_name: yup.string().required("First Name is required"),
	last_name: yup.string().required("Last Name is required"),
	email: yup
		.string()
		.email("Invalid email address")
		.required("Email is required"),
	phone_number: yup.string().optional().nullable().default(""),
	role: yup
		.object()
		.shape({
			id: yup.string().required(),
			label: yup.string().required(),
			value: yup.string().required(),
			description: yup.string().required(),
		})
		.required("Role is required")
		.test("is-valid-role", "Role is required", function (value) {
			if (!value) return false;
			const hasId = value.id != null && value.id !== "";
			const hasValue = value.value != null && value.value !== "";
			return hasId || hasValue;
		}),
	user_id: yup.string().optional().nullable().default(""),
	customer: yup.string().optional().default(""),
});
