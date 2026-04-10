import { type FC, useEffect, useMemo, useState } from "react";
import { twMerge } from "tailwind-merge";
import ConditionalPlusIcon from "@/assets/ConditionalPlusIcon";
import { Skeleton } from "@/components/Skeleton";
import { capitalize, concatenateAddress } from "@/lib/helper";
import {
	type FactBusinessDetailsResponseType,
	type KybUpdatedResponseTypeData,
} from "@/types/integrations";
import { type PublicRecordsResponse } from "@/types/publicRecords";

import { GuestOwnerStyle } from "@/constants/TailwindStyles";

interface Props {
	business: any;
	publicRecords?: PublicRecordsResponse;
	businessAge: number;
	applicantData?: any;
	businessVerificationDetails?: any;
	businessNames?: any;
	businessAddresses?: any;
	kybFactsData?: KybUpdatedResponseTypeData | null;
	factsKYBLoading?: boolean;
	businessDetailFacts?: FactBusinessDetailsResponseType;
}
const Business: FC<Props> = ({
	business,
	businessAge,
	publicRecords,
	businessVerificationDetails,
	businessNames,
	businessAddresses,
	kybFactsData,
	factsKYBLoading = false,
	businessDetailFacts,
	applicantData,
}) => {
	const [mailingAddress, setMailingAddress] = useState<any>([]);
	const [dba, setDba] = useState<any>([]);

	const guestOwnerEdits: string[] = useMemo(() => {
		const applicantEdits = Array.isArray(applicantData?.guest_owner_edits)
			? applicantData.guest_owner_edits
			: [];
		const businessEdits = Array.isArray(businessDetailFacts?.guest_owner_edits)
			? businessDetailFacts.guest_owner_edits
			: [];
		const combinedEdits = [...applicantEdits, ...businessEdits];
		const uniqueEdits = Array.from(new Set(combinedEdits));
		return uniqueEdits;
	}, [applicantData, businessDetailFacts]);

	useEffect(() => {
		if (businessAddresses)
			setMailingAddress(
				businessAddresses?.filter(
					(address: any) => address.is_primary === false,
				),
			);
		if (businessNames)
			setDba(businessNames?.filter((names: any) => names.is_primary === false));
	}, [businessAddresses, businessNames]);

	return (
		<div className="container mx-auto">
			<div className="grid grid-flow-row-dense grid-cols-1 gap-4 sm:grid-cols-2">
				<div className="p-4">
					<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
						Business Name
					</p>
					<p
						className={twMerge(
							"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
							guestOwnerEdits.includes("name") && GuestOwnerStyle,
						)}
					>
						{businessDetailFacts?.business_name?.value ?? business?.name ?? "-"}
						<ConditionalPlusIcon
							isNotapplicant={guestOwnerEdits.includes("name")}
						/>
					</p>
				</div>
				{businessNames && (
					<div className="p-4">
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							DBA
						</p>
						<p
							className={twMerge(
								"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
								guestOwnerEdits.includes("dba_names") && GuestOwnerStyle,
							)}
						>
							{businessDetailFacts?.dba?.value ? (
								Array.isArray(businessDetailFacts?.dba?.value) ? (
									businessDetailFacts?.dba?.value?.map(
										(name: any, index: any) => (
											<div key={index}>
												{name}
												<ConditionalPlusIcon
													isNotapplicant={guestOwnerEdits.includes("dba_names")}
												/>
											</div>
										),
									)
								) : (
									<div key={0}>
										{businessDetailFacts?.dba?.value}
										<ConditionalPlusIcon
											isNotapplicant={guestOwnerEdits.includes("dba_names")}
										/>
									</div>
								)
							) : Array.isArray(dba) ? (
								dba.map((data: any, index: any) => (
									<div key={index}>
										{data.name}
										<ConditionalPlusIcon
											isNotapplicant={guestOwnerEdits.includes("dba_names")}
										/>
									</div>
								))
							) : (
								<div key={0}>{dba}</div>
							)}
							{dba.length === 0 && "-"}
						</p>
					</div>
				)}
				<div className="p-4">
					<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
						Business age
					</p>
					<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
						{businessAge
							? `${businessAge} ${businessAge === 1 ? "year" : "years"}`
							: "-"}
					</p>
				</div>
				<div className="p-4">
					<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
						Corporation Type
					</p>
					<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
						{factsKYBLoading ? (
							<Skeleton className="h-6 w-28"></Skeleton>
						) : kybFactsData?.corporation?.value ? (
							capitalize(kybFactsData?.corporation?.value)
						) : (
							"N/A"
						)}
					</p>
				</div>
				<div className="p-4">
					<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
						Number of Employees
					</p>
					<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
						{businessDetailFacts?.num_employees?.value
							? businessDetailFacts?.num_employees?.value
							: !isNaN(
										Number(
											publicRecords?.data?.public_records?.additional_records
												?.number_of_employees,
										),
								  )
								? publicRecords?.data?.public_records?.additional_records
										?.number_of_employees
								: (businessVerificationDetails?.data?.businessEntityVerification
										?.number_of_employees ?? "N/A")}
					</p>
				</div>
				<div className="w-full p-4">
					<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
						Business Address
					</p>
					<p
						className={twMerge(
							"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
							[
								"address_line_1",
								"address_city",
								"address_postal_code",
								"address_state",
								"address_line_2",
							].some((e: any) => guestOwnerEdits.includes(e)) &&
								GuestOwnerStyle,
						)}
					>
						{concatenateAddress([
							business?.address_line_1,
							business?.address_line_2,
							business?.address_city,
							String(business?.address_state ?? "") +
								" " +
								String(business?.address_postal_code ?? ""),
						])}
						<ConditionalPlusIcon
							isNotapplicant={[
								"address_line_1",
								"address_city",
								"address_postal_code",
								"address_state",
								"address_line_2",
							].some((e: any) => guestOwnerEdits.includes(e))}
						/>
					</p>
				</div>
				{businessAddresses && (
					<div className="w-full p-4">
						<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
							Mailing Address
						</p>
						{mailingAddress.length > 1 ? (
							<ul
								className={twMerge(
									"text-sm font-medium tracking-tight list-disc list-inside text-slate-800",
									[
										"mailing_address.line_1",
										"mailing_address.apartment",
										"mailing_address.city",
										"mailing_address.state",
										"mailing_address.postal_code",
									].some((e: any) => guestOwnerEdits.includes(e)) &&
										GuestOwnerStyle,
								)}
							>
								{mailingAddress.map((data: any, index: any) => (
									<li key={index}>
										{concatenateAddress([
											data?.apartment as string,
											data?.line_1 as string,
											data?.address_line_2 as string,
											data?.city as string,
											(data?.state as string) +
												" " +
												(data?.postal_code as string),
										])}
										<ConditionalPlusIcon
											isNotapplicant={[
												"mailing_address.line_1",
												"mailing_address.apartment",
												"mailing_address.city",
												"mailing_address.state",
												"mailing_address.postal_code",
											].some((e: any) => guestOwnerEdits.includes(e))}
										/>
									</li>
								))}
							</ul>
						) : mailingAddress.length > 0 ? (
							mailingAddress.length === 1 && (
								<div
									className={twMerge(
										"text-sm font-medium tracking-tight text-slate-800",
										[
											"mailing_address.line_1",
											"mailing_address.apartment",
											"mailing_address.city",
											"mailing_address.state",
											"mailing_address.postal_code",
										].some((e: any) => guestOwnerEdits.includes(e)) &&
											GuestOwnerStyle,
									)}
								>
									{concatenateAddress([
										mailingAddress[0]?.apartment as string,
										mailingAddress[0]?.line_1 as string,
										mailingAddress[0]?.address_line_2 as string,
										mailingAddress[0]?.city as string,
										(mailingAddress[0]?.state as string) +
											" " +
											(mailingAddress[0]?.postal_code as string),
									])}
									<ConditionalPlusIcon
										isNotapplicant={[
											"mailing_address.line_1",
											"mailing_address.apartment",
											"mailing_address.city",
											"mailing_address.state",
											"mailing_address.postal_code",
										].some((e: any) => guestOwnerEdits.includes(e))}
									/>
								</div>
							)
						) : (
							"-"
						)}
					</div>
				)}
				<div className="w-full p-4">
					<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
						Business Phone Number
					</p>
					<p
						className={twMerge(
							"py-2 text-sm font-medium tracking-tight break-words text-slate-800",
							guestOwnerEdits.includes("mobile") && GuestOwnerStyle,
						)}
					>
						{businessDetailFacts?.business_phone?.value ??
							business?.mobile ??
							"-"}
						<ConditionalPlusIcon
							isNotapplicant={guestOwnerEdits.includes("name")}
						/>
					</p>
				</div>
				{/* <div className="">
            <p className="py-2 text-xs font-normal tracking-tight text-gray-500">
              Business email
            </p>
            <p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
              -
            </p>
        </div> */}

				{/* <div className="">
            <p className="py-2 text-xs font-normal tracking-tight text-gray-500">
              Industry
            </p>
            <p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
              -
            </p>
        </div> */}
				<div className="p-4">
					<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
						Woman-Owned Business
					</p>
					<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
						{typeof kybFactsData?.woman_owned?.value === "boolean"
							? capitalize(kybFactsData?.woman_owned?.value ? "Yes" : "No")
							: typeof publicRecords?.data?.public_records?.additional_records
										?.woman_owned_enterprise === "boolean"
								? publicRecords?.data?.public_records?.additional_records
										?.woman_owned_enterprise
									? "Yes"
									: "No"
								: "N/A"}
					</p>
				</div>
				<div className="col-span-1 p-4 ">
					<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
						Minority Business Enterprise
					</p>
					<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
						{typeof kybFactsData?.minority_owned?.value === "boolean"
							? capitalize(kybFactsData.minority_owned.value ? "Yes" : "No")
							: typeof publicRecords?.data?.public_records?.additional_records
										?.minority_owned_enterprise === "boolean"
								? publicRecords?.data?.public_records?.additional_records
										?.minority_owned_enterprise
									? "Yes"
									: "No"
								: "N/A"}
					</p>
				</div>

				<div className="col-span-1 p-4 ">
					<p className="py-2 text-xs font-normal tracking-tight text-gray-500">
						Veteran-Owned Business
					</p>
					<p className="py-2 text-sm font-medium tracking-tight break-words text-slate-800">
						{typeof kybFactsData?.veteran_owned?.value === "boolean"
							? capitalize(kybFactsData.veteran_owned.value ? "Yes" : "No")
							: typeof publicRecords?.data?.public_records?.additional_records
										?.veteran_owned_enterprise === "boolean"
								? publicRecords?.data?.public_records?.additional_records
										?.veteran_owned_enterprise
									? "Yes"
									: "No"
								: "N/A"}
					</p>
				</div>
			</div>
		</div>
	);
};

export default Business;
