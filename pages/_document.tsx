import Document, { Head, Html, Main, NextScript } from "next/document";

export default class extends Document {
	public override render() {
		return (
			<Html lang="en">
				<Head />
				<body>
					<Main />
					<NextScript />
				</body>
			</Html>
		);
	}
}
