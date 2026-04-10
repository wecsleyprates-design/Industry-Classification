import React, { type ReactNode, useState } from "react";
import {
	ArrowTopRightOnSquareIcon,
	CheckCircleIcon,
	ChevronDownIcon,
} from "@heroicons/react/24/outline";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@radix-ui/react-dropdown-menu";
import { InfoIcon } from "lucide-react";
import { type NpiDoctor, type NpiDoctorLicense } from "@/types/integrations";
import { CardList, CardListItem } from "../../components";

import { VALUE_NOT_AVAILABLE } from "@/constants";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";

interface DoctorsResultProps {
	caseId: string;
	doctorsList: NpiDoctor[];
}

type Detail = {
	label: ReactNode;
	value: ReactNode;
};

type Details = Detail[];

interface DetailsCardProps {
	title: string | ReactNode;
	details: Details;
	badge?: ReactNode;
	dropdown?: ReactNode;
}

const DetailsCard: React.FC<DetailsCardProps> = ({
	title,
	details,
	badge,
	dropdown,
}) => (
	<Card>
		<div className="flex flex-col bg-white rounded-xl">
			<CardHeader className="flex flex-row items-center justify-between">
				<div className="flex items-center gap-3">
					<CardTitle>{title}</CardTitle>
					{badge}
				</div>
				{dropdown}
			</CardHeader>
			<CardContent>
				<CardList>
					{details.map((detail: Detail, i) => (
						<CardListItem
							key={i}
							label={detail.label}
							value={detail.value}
						/>
					))}
				</CardList>
			</CardContent>
		</div>
	</Card>
);

function getMostRecentLicense(licenses?: NpiDoctorLicense[]) {
	return licenses?.reduce((latest, current) =>
		new Date(current.updated_at) > new Date(latest.updated_at)
			? current
			: latest,
	);
}

export const DoctorsResult: React.FC<DoctorsResultProps> = ({
	caseId: _caseId,
	doctorsList,
}) => {
	const [selectedIndex, setSelectedIndex] = useState(0);

	if (!doctorsList.length) return null;

	const doctor = doctorsList[selectedIndex];
	const mostRecentLicense = getMostRecentLicense(doctor.doctor_licenses);

	let formattedDoctorDetails: Details | null = null;

	formattedDoctorDetails = [
		{
			label: "Provider",
			value: doctor.name,
		},
		{
			label: "NPI Type",
			value: "NPI-1 Individual",
		},
		{
			label: "NPI Number",
			value: doctor.npi_id ? (
				<a
					href={`https://npiregistry.cms.hhs.gov/provider-view/${doctor.npi_id}`}
					target="_blank"
					rel="noopener noreferrer"
					className="text-blue-600 hover:underline flex gap-1"
				>
					{doctor.npi_id}
					<ArrowTopRightOnSquareIcon className="w-4 h-4" />
				</a>
			) : (
				VALUE_NOT_AVAILABLE
			),
		},
		{
			label: "Status",
			value: (
				<div className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-green-800 text-xs">
					<CheckCircleIcon className="h-4 w-4" />
					<span>Active</span>
				</div>
			),
		},
		{
			label: "Primary Taxonomy",
			value:
				mostRecentLicense?.license_taxonomy_code ?? VALUE_NOT_AVAILABLE,
		},
		{
			label: "State #1 License Issuer",
			value: mostRecentLicense?.license_number_state_code,
		},
		{
			label: "State #1 License Number",
			value: mostRecentLicense?.license_number,
		},
		{
			label: "Last Updated",
			value: formatDate(mostRecentLicense?.updated_at),
		},
	];

	return (
		<DetailsCard
			title="NPI"
			details={formattedDoctorDetails}
			badge={
				doctorsList.length > 1 && (
					<Badge
						variant="secondary"
						className="flex items-center gap-1 text-xs rounded-md border ml-4"
					>
						<InfoIcon className="h-2 w-2" /> Multiple Records Found
					</Badge>
				)
			}
			dropdown={
				doctorsList.length > 1 && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="sm"
								className="w-[115px] h-[48px] rounded-md p-[10px] text-sm font-medium"
							>
								Record #{selectedIndex + 1}
								<ChevronDownIcon />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							{doctorsList.map((_, idx) => (
								<DropdownMenuItem
									className="cursor-pointer hover:backdrop-brightness-90 p-1"
									key={idx}
									onClick={() => {
										setSelectedIndex(idx);
									}}
								>
									Record #{idx + 1}
								</DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				)
			}
		/>
	);
};

const formatDate = (dateString?: string) => {
	if (!dateString) return VALUE_NOT_AVAILABLE;
	const date = new Date(dateString);
	return date.toLocaleDateString("en-US", {
		month: "2-digit",
		day: "2-digit",
		year: "numeric",
	});
};
