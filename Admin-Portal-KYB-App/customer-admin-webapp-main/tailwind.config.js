// eslint-disable-next-line no-undef
const defaultTheme = require("tailwindcss/defaultTheme");

module.exports = {
	content: [
		"./src/**/*.tsx",
		"./node_modules/react-tailwindcss-datepicker/dist/index.esm.js",
	],
	theme: {
		fontFamily: {
			sans: ['"Inter"', "sans-serif"],
		},
		extend: {
			lineHeight: {
				"extra-loose": "4.3",
				120: "4.375rem",
			},
			colors: {
				"dark-blue": "#050038",
			},
		},
	},
};
