export const LANGUAGE_VERSIONS = [
	{
		label: "javascript",
		value: "javascript",
	},
	{
		label: "typescript",
		value: "typescript",
	},
	{
		label: "python",
		value: "python",
	},
	{
		label: "java",
		value: "java",
	},
	{
		label: "ruby",
		value: "ruby",
	},
];

const fixed = `# server.rb \n# \n# Use this sample code to \n# handle webhook event in your integreation \n
# 1) Paste this code into a new file (server.rb)
#
# 2) Install dependencies
# gem install sintra
# gem install worth
#
# 3) Run the server on http://Jocalhost:4242\n`;

export const CODE_SNIPPETS: Record<string, any> = {
	javascript:
		fixed +
		`\nfunction greet(name) {\n\tconsole.log("Hello, " + name + "!");\n}\n\ngreet("Alex");\n`,
	typescript:
		fixed +
		`\ntype Params = {\n\tname: string;\n}\n\nfunction greet(data: Params) {\n\tconsole.log("Hello, " + data.name + "!");\n}\n\ngreet({ name: "Alex" });\n`,
	python:
		fixed +
		`\ndef greet(name):\n\tprint("Hello, " + name + "!")\n\ngreet("Alex")\n`,
	java:
		fixed +
		`\npublic class HelloWorld {\n\tpublic static void main(String[] args) {\n\t\tSystem.out.println("Hello World");\n\t}\n}\n`,
	csharp:
		fixed +
		'using System;\n\nnamespace HelloWorld\n{\n\tclass Hello { \n\t\tstatic void Main(string[] args) {\n\t\t\tConsole.WriteLine("Hello World in C#");\n\t\t}\n\t}\n}\n',
	php: fixed + "\n\n" + "<?php\n\n$name = 'Alex';\necho $name;\n",
	ruby:
		fixed +
		"# ruby server.rb \n\nrequire 'json' \nrequire 'sintra' \nrequire 'worth'",
};
