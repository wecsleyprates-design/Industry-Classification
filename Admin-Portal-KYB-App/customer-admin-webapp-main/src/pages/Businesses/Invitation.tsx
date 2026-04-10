import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import Button from "@/components/Button";
import { Input } from "@/components/Input";
import Modal from "@/components/Modal";
import PageTitle from "@/components/Title/PageTitle";
import { sendInvitationSchema } from "@/lib/validation";
import { type SendInvitationBody } from "@/types/business";
const DummyInvitations = [
	{
		applicant: "Mike Doe",
		email: "mike.doe@gmail.com",
		selected: false,
	},
	{
		applicant: "Mark Doe",
		email: "mark.doe@gmail.com",
		selected: false,
	},
	{
		applicant: "Scott Doe",
		email: "scott.doe@gmail.com",
		selected: false,
	},
];
const Invitation = () => {
	const [invitations, setInvitations] = useState(DummyInvitations);
	const [open, setOpen] = useState<boolean>(false);
	const {
		register,
		handleSubmit,
		formState: { errors },
	} = useForm<SendInvitationBody>({
		resolver: yupResolver(sendInvitationSchema) as any,
	});
	const onSubmit = (data: SendInvitationBody) => {
		setInvitations([
			...invitations,
			{
				applicant: `${data.firstName} ${data.lastName}`,
				email: `${data.email}`,
				selected: false,
			},
		]);
		setOpen(false);
	};
	return (
		<>
			<PageTitle titleText="Invitation" />
			<div>
				<div className="mx-4 mt-5">
					<div className="grid grid-flow-row grid-cols-3 text-sm text-gray-800 font-semibold w-[800px]">
						<div>Applicant</div>
						<div>Email Address</div>
						<div>Action</div>
					</div>
					{invitations.map((invitation, index) => (
						<div
							key={index}
							className="grid grid-flow-row grid-cols-3 text-sm text-gray-800 w-[800px]"
						>
							<div>{invitation.applicant}</div>
							<div>{invitation.email}</div>
							<div>
								<input
									type="checkbox"
									className="w-4 h-4 mr-2 leading-tight cursor-pointer accent-black border-1 border-slate-700"
									checked={invitation.selected}
									onChange={() => {
										const nInvitaions = invitations;
										nInvitaions[index] = {
											...invitation,
											selected: !invitation.selected,
										};
										setInvitations(() => [...nInvitaions]);
									}}
								/>
							</div>
						</div>
					))}
				</div>

				<div className="flex gap-2 mx-2 my-5">
					<Button
						color="dark"
						disabled={invitations.filter((value) => value.selected).length < 1}
					>
						Send
					</Button>
					<Button
						outline
						color="dark"
						onClick={() => {
							setOpen(true);
						}}
					>
						Add new invitee{" "}
					</Button>
				</div>
			</div>
			{open && (
				<Modal
					isOpen={open}
					onClose={() => {
						setOpen(false);
					}}
				>
					<h2 className="text-xl font-[700]">Add new invitee</h2>
					<form className="px-8 py-4" onSubmit={handleSubmit(onSubmit)}>
						<Input
							errors={errors}
							label="First name"
							id="firstName"
							name="firstName"
							isRequired
							placeholder="Enter first name"
							register={register}
							className="w-full border border-slate-300 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4"
						/>
						<Input
							errors={errors}
							label="Last name"
							id="lastName"
							name="lastName"
							isRequired
							placeholder="Enter last name"
							register={register}
							className="w-full border border-slate-300 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4"
						/>
						<Input
							errors={errors}
							label="Email address"
							id="email"
							name="email"
							isRequired
							placeholder="Enter email address"
							register={register}
							className="w-full border border-slate-300 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4"
						/>
						<Input
							errors={errors}
							label="Phone number (optional)"
							id="mobile"
							name="mobile"
							placeholder="Enter mobile number"
							register={register}
							className="w-full border border-slate-300 rounded-md mt-2.5 text-[15px] text-[#5E5E5E] py-2.5 px-4"
						/>
						<Button className="w-full my-4" color="dark" type="submit">
							Add
						</Button>
					</form>
				</Modal>
			)}
		</>
	);
};

export default Invitation;
