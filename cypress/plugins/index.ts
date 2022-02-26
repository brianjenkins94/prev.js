import log from "./log";

export default function(on, config) {
	on("task", {
		"log": log
	});
}
