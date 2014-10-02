'use strict';

(function() {
	// Messages Controller Spec
	describe('MessagesController', function() {
		// Initialize global variables
		var MessagesController,
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

			// Initialize the Messages controller.
			MessagesController = $controller('MessagesController', {
				$scope: scope
			});
		}));

		it('$scope.find() should create an array with at least one message object fetched from XHR', inject(function(Messages) {
			// Create sample message using the messages service
			var sampleMessage = new Messages({
				title: 'An message about MEAN',
				content: 'MEAN rocks!'
			});

			// Create a sample messages array that includes the new message
			var sampleMessages = [sampleMessage];

			// Set GET response
			$httpBackend.expectGET('messages').respond(sampleMessages);

			// Run controller functionality
			scope.find();
			$httpBackend.flush();

			// Test scope value
			expect(scope.messages).toEqualData(sampleMessages);
		}));

		it('$scope.findOne() should create an array with one message object fetched from XHR using a messageId URL parameter', inject(function(Messages) {
			// Define a sample message object
			var sampleMessage = new Messages({
				title: 'An Message about MEAN',
				content: 'MEAN rocks!'
			});

			// Set the URL parameter
			$stateParams.messageId = '525a8422f6d0f87f0e407a33';

			// Set GET response
			$httpBackend.expectGET(/messages\/([0-9a-fA-F]{24})$/).respond(sampleMessage);

			// Run controller functionality
			scope.findOne();
			$httpBackend.flush();

			// Test scope value
			expect(scope.message).toEqualData(sampleMessage);
		}));

		it('$scope.create() with valid form data should send a POST request with the form input values and then locate to new object URL', inject(function(Messages) {
			// Create a sample message object
			var sampleMessagePostData = new Messages({
				title: 'An Message about MEAN',
				content: 'MEAN rocks!'
			});

			// Create a sample message response
			var sampleMessageResponse = new Messages({
				_id: '525cf20451979dea2c000001',
				title: 'An Message about MEAN',
				content: 'MEAN rocks!'
			});

			// Fixture mock form input values
			scope.title = 'An Message about MEAN';
			scope.content = 'MEAN rocks!';

			// Set POST response
			$httpBackend.expectPOST('messages', sampleMessagePostData).respond(sampleMessageResponse);

			// Run controller functionality
			scope.create();
			$httpBackend.flush();

			// Test form inputs are reset
			expect(scope.title).toEqual('');
			expect(scope.content).toEqual('');

			// Test URL redirection after the message was created
			expect($location.path()).toBe('/messages/' + sampleMessageResponse._id);
		}));

		it('$scope.update() should update a valid message', inject(function(Messages) {
			// Define a sample message put data
			var sampleMessagePutData = new Messages({
				_id: '525cf20451979dea2c000001',
				title: 'An Message about MEAN',
				content: 'MEAN Rocks!'
			});

			// Mock message in scope
			scope.message = sampleMessagePutData;

			// Set PUT response
			$httpBackend.expectPUT(/messages\/([0-9a-fA-F]{24})$/).respond();

			// Run controller functionality
			scope.update();
			$httpBackend.flush();

			// Test URL location to new object
			expect($location.path()).toBe('/messages/' + sampleMessagePutData._id);
		}));

		it('$scope.remove() should send a DELETE request with a valid messageId and remove the message from the scope', inject(function(Messages) {
			// Create new message object
			var sampleMessage = new Messages({
				_id: '525a8422f6d0f87f0e407a33'
			});

			// Create new messages array and include the message
			scope.messages = [sampleMessage];

			// Set expected DELETE response
			$httpBackend.expectDELETE(/messages\/([0-9a-fA-F]{24})$/).respond(204);

			// Run controller functionality
			scope.remove(sampleMessage);
			$httpBackend.flush();

			// Test array after successful delete
			expect(scope.messages.length).toBe(0);
		}));
	});
}());