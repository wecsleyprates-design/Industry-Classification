import { useState } from "react";
import { useForm } from "react-hook-form";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { yupResolver } from "@hookform/resolvers/yup";
import Button from "@/components/Button";
import { Input } from "@/components/Input";
import { ssoLoginSchema } from "@/lib/validation";
import Spinner from "../Spinner";
import Modal from "./Modal";

interface SSOModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (email: string) => Promise<void>;
	ssoError: string;
	setSsoError: (error: string) => void;
}

const SSOModal: React.FC<SSOModalProps> = ({
	isOpen,
	onClose,
	onSubmit,
	ssoError,
	setSsoError,
}) => {
	const {
		register,
		handleSubmit,
		formState: { errors },
		reset,
	} = useForm<{ ssoEmail: string }>({
		resolver: yupResolver(ssoLoginSchema),
		defaultValues: { ssoEmail: "" },
	});

	const [loading, setLoading] = useState(false);
	const [showAliasNotice, setShowAliasNotice] = useState(false);

	const handleSsoSubmit = async ({ ssoEmail }: { ssoEmail: string }) => {
		setLoading(true);
		const email = ssoEmail.trim();
		const hasAlias = email.includes("+");

		const attemptLogin = async () => {
			try {
				await onSubmit(email);
			} catch {
				setSsoError("An unexpected error occurred. Please try again.");
				setLoading(false);
				setShowAliasNotice(false);
			}
		};

		if (hasAlias) {
			setShowAliasNotice(true);
			setTimeout(() => {
				void attemptLogin();
			}, 4000);
		} else {
			await attemptLogin();
		}
	};

	const handleClose = () => {
		reset();
		setSsoError("");
		setLoading(false);
		setShowAliasNotice(false);
		onClose();
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={handleClose}
			customWidth="w-full sm:w-full sm:max-w-xl"
			cardColorClass="bg-white"
		>
			{/* Header */}
			<div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
				<h2 className="text-lg font-medium text-gray-900">Email for SSO</h2>
				<button onClick={handleClose}>
					<span className="sr-only">Close</span>
					<XMarkIcon className="w-6 h-6" aria-hidden="true" />
				</button>
			</div>

			{/* Content */}
			<div className="p-5">
				{showAliasNotice ? (
					<div className="flex flex-col items-center justify-center min-h-[150px] text-center space-y-4">
						<div className="flex items-center justify-center">
							<div className="pr-2 invert-[0.8]">
								<Spinner type="lg" />
							</div>
						</div>
						<p className="text-sm text-gray-700 max-w-md">
							<strong>Redirecting to your Identity Provider.</strong>
							<br />
							Since your email contains an alias, you will need to sign in using
							<strong className="text-gray-900">
								{" "}
								your base email address (without the alias){" "}
							</strong>
							at the Identity Provider's login page.
						</p>
					</div>
				) : (
					<form
						onSubmit={handleSubmit(handleSsoSubmit)}
						className="px-4 py-5 space-y-6 sm:p-6"
					>
						<div>
							<Input
								errors={errors}
								label="Email"
								id="ssoEmail"
								name="ssoEmail"
								placeholder="Email"
								register={register}
								className="w-full border border-slate-300 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4"
								autoComplete="username"
								onChange={(e) => {
									setSsoError("");
									void register("ssoEmail").onChange(e);
								}}
							/>
						</div>

						{ssoError && (
							<div className="text-sm text-red-600 font-medium">{ssoError}</div>
						)}

						<div className="text-center">
							<Button
								type="submit"
								isLoading={loading}
								disabled={loading}
								className="h-12 w-full text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700 dark:border-gray-700"
							>
								<span className="p-1.5 pad text-sm text-white-700 font-bold">
									Sign in with SAML SSO
								</span>
							</Button>
						</div>
					</form>
				)}
			</div>
		</Modal>
	);
};

export default SSOModal;
