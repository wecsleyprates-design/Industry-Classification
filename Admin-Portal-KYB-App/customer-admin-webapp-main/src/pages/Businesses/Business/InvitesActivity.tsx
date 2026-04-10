import { capitalize, classNames, convertToLocalDate } from "@/lib/helper";

const InvitesActivity = (data: any) => {
	const steps = data?.data;

	return (
		<div className="p-7 pt-0">
			<div>
				<p className="text-base font-bold py-4">Activity</p>
			</div>
			<nav aria-label="Progress">
				<ol role="list" className="overflow-hidden">
					{steps?.map((step: any, stepIdx: any) => (
						<li
							key={step.name}
							className={classNames(
								stepIdx !== steps.length - 1 ? "pb-10" : "",
								"relative",
							)}
						>
							<>
								{stepIdx !== steps.length - 1 ? (
									<div
										className="absolute left-4 top-4 -ml-px mt-4 h-full w-0.5 bg-gray-300"
										aria-hidden="true"
									/>
								) : null}
								<a className="group relative flex items-start">
									<span className="flex h-9 items-center" aria-hidden="true">
										<span className="rounded-full  items-center justify-center bg-white border-4 translate-x-[4px] border-white">
											<span className="relative  z-10 flex h-4 w-4 items-center justify-center rounded-full border-2 border-gray-300 bg-[#F8F8F8] " />
										</span>
									</span>
									<span className="ml-4 flex min-w-0 flex-col pt-2">
										<span className="text-xs font-medium text-black">
											<span className="font-bold ">
												{capitalize(step.status)}
											</span>
										</span>
										<span className="text-xs text-gray-500">
											{convertToLocalDate(
												step.created_at,
												"MM-DD-YYYY - h:mmA",
											)}
										</span>
									</span>
								</a>
							</>
						</li>
					))}
				</ol>
			</nav>
		</div>
	);
};

export default InvitesActivity;
