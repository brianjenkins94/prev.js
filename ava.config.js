export default {
	"extensions": {
		"ts": "module"
	},
	"files": [
		"test/**/*",
	],
	"nodeArguments": [
		"--experimental-specifier-resolution=node",
		"--loader=ts-node/esm"
	]
}
