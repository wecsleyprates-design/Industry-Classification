import { ChevronUpDownIcon } from "@heroicons/react/24/outline";
import DropdownWithIcon from "@/components/Dropdown/DropDownWithIcon";
import { LANGUAGE_VERSIONS } from "./constant";
interface LanguageSelectorProps {
	language: string;
	onSelect: (lang: string) => void;
}

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
	language,
	onSelect,
}) => {
	return (
		<>
			<DropdownWithIcon
				title={"Choose"}
				options={LANGUAGE_VERSIONS}
				onChange={(value: string | number | Record<string, any>) => {
					onSelect(String(value));
				}}
				value={language}
				className="bottom-auto font-normal shadow-none ring-0 bg-gray-50"
				icon={ChevronUpDownIcon}
			/>
		</>
	);
};

export default LanguageSelector;
