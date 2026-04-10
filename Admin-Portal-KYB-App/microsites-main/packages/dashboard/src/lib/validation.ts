import ERROR_MSG from "constants/ErrorMessages";
import * as yup from "yup";

export const loginSchema = yup.object().shape({
	email: yup.string().required(ERROR_MSG.REQUIRED_EMAIL),
	password: yup.string().required(ERROR_MSG.REQUIRED_PASSWORD),
});
