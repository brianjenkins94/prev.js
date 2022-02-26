/// <reference types="cypress" />

describe(__filename.substring("cypress/integration".length), function() {
	it("Loads", function() {
		cy.visit("http://localhost:3000");
	});
});
