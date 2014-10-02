'use strict';

(function() {
	// References Controller Spec
	describe('References Controller Tests', function() {
		// Initialize global variables
		var ReferencesController,
		scope,
		$httpBackend,
		$stateParams,
		$location;

		// The $resource service augments the response object with methods for updating and deleting the resource.
		// If we were to use the standard toEqual matcher, our tests would fail because the test values would not match
		// the responses exactly. To solve the problem, we define a new toEqualData Jasmine matcher.
		// When the toEqualData matcher compares two objects, it takes only object properties into
		// account and ignores methods.
		beforeEach(function() {
			jasmine.addMatchers({
				toEqualData: function(util, customEqualityTesters) {
					return {
						compare: function(actual, expected) {
							return {
								pass: angular.equals(actual, expected)
							};
						}
					};
				}
			});
		});

		// Then we can start by loading the main application module
		beforeEach(module(ApplicationConfiguration.applicationModuleName));

		// The injector ignores leading and trailing underscores here (i.e. _$httpBackend_).
		// This allows us to inject a service but then attach it to a variable
		// with the same name as the service.
		beforeEach(inject(function($controller, $rootScope, _$location_, _$stateParams_, _$httpBackend_) {
			// Set a new global scope
			scope = $rootScope.$new();

			// Point global variables to injected services
			$stateParams = _$stateParams_;
			$httpBackend = _$httpBackend_;
			$location = _$location_;

			// Initialize the References controller.
			ReferencesController = $controller('ReferencesController', {
				$scope: scope
			});
		}));

		it('$scope.find() should create an array with at least one Reference object fetched from XHR', inject(function(References) {
			// Create sample Reference using the References service
			var sampleReference = new References({
				name: 'New Reference'
			});

			// Create a sample References array that includes the new Reference
			var sampleReferences = [sampleReference];

			// Set GET response
			$httpBackend.expectGET('references').respond(sampleReferences);

			// Run controller functionality
			scope.find();
			$httpBackend.flush();

			// Test scope value
			expect(scope.references).toEqualData(sampleReferences);
		}));

		it('$scope.findOne() should create an array with one Reference object fetched from XHR using a referenceId URL parameter', inject(function(References) {
			// Define a sample Reference object
			var sampleReference = new References({
				name: 'New Reference'
			});

			// Set the URL parameter
			$stateParams.referenceId = '525a8422f6d0f87f0e407a33';

			// Set GET response
			$httpBackend.expectGET(/references\/([0-9a-fA-F]{24})$/).respond(sampleReference);

			// Run controller functionality
			scope.findOne();
			$httpBackend.flush();

			// Test scope value
			expect(scope.reference).toEqualData(sampleReference);
		}));

		it('$scope.create() with valid form data should send a POST request with the form input values and then locate to new object URL', inject(function(References) {
			// Create a sample Reference object
			var sampleReferencePostData = new References({
				name: 'New Reference'
			});

			// Create a sample Reference response
			var sampleReferenceResponse = new References({
				_id: '525cf20451979dea2c000001',
				name: 'New Reference'
			});

			// Fixture mock form input values
			scope.name = 'New Reference';

			// Set POST response
			$httpBackend.expectPOST('references', sampleReferencePostData).respond(sampleReferenceResponse);

			// Run controller functionality
			scope.create();
			$httpBackend.flush();

			// Test form inputs are reset
			expect(scope.name).toEqual('');

			// Test URL redirection after the Reference was created
			expect($location.path()).toBe('/references/' + sampleReferenceResponse._id);
		}));

		it('$scope.update() should update a valid Reference', inject(function(References) {
			// Define a sample Reference put data
			var sampleReferencePutData = new References({
				_id: '525cf20451979dea2c000001',
				name: 'New Reference'
			});

			// Mock Reference in scope
			scope.reference = sampleReferencePutData;

			// Set PUT response
			$httpBackend.expectPUT(/references\/([0-9a-fA-F]{24})$/).respond();

			// Run controller functionality
			scope.update();
			$httpBackend.flush();

			// Test URL location to new object
			expect($location.path()).toBe('/references/' + sampleReferencePutData._id);
		}));

		it('$scope.remove() should send a DELETE request with a valid referenceId and remove the Reference from the scope', inject(function(References) {
			// Create new Reference object
			var sampleReference = new References({
				_id: '525a8422f6d0f87f0e407a33'
			});

			// Create new References array and include the Reference
			scope.references = [sampleReference];

			// Set expected DELETE response
			$httpBackend.expectDELETE(/references\/([0-9a-fA-F]{24})$/).respond(204);

			// Run controller functionality
			scope.remove(sampleReference);
			$httpBackend.flush();

			// Test array after successful delete
			expect(scope.references.length).toBe(0);
		}));
	});
}());