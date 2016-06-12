'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    errorHandler = require(path.resolve('./modules/core/server/controllers/errors.server.controller')),
    userHandler = require(path.resolve('./modules/users/server/controllers/users.server.controller')),
    textProcessor = require(path.resolve('./modules/core/server/controllers/text-processor.server.controller')),
    sanitizeHtml = require('sanitize-html'),
    mongoose = require('mongoose'),
    Offer = mongoose.model('Offer'),
    User = mongoose.model('User');

/**
 * Create a fuzzy offset between specified distances
 * @param {Number} minimum - Minimal distance
 * @param {Number} maximum - Maximal distance
 * @returns {Array<Number>} - array of length 2 (horizontal and vertical offset)
 */
function fuzzyOffset(minimum, maximum) {
  //please note that Math.random() is not cryptographically secure.
  //for this purpose it's probably ok, but can be improved i.e. with node crypto module.
  if(maximum < minimum) throw new Error('maximum must be greater than minimum');
  var difference = maximum - minimum;
  var randomDistance = Math.floor(difference*Math.random()+minimum); //Distance will be from interval [minimum, maximum)
  var randomDirection = 2*Math.PI*Math.random(); //random direction is from interval [0, 2*PI) radians

  var horizontal = randomDistance * Math.cos(randomDirection);
  var vertical = randomDistance * Math.sin(randomDirection);

  return [horizontal, vertical]; //the order doesn't matter here
}

/**
 * Create a fuzzy location
 * Will create an alternative lat,lng by shifting location 100-200 meters to random direction
 * @link http://gis.stackexchange.com/a/2980
 */
function fuzzyLocation(location) {

  // Offsets in meters, random between 100-200 meters to random direction
  var offset = fuzzyOffset(100, 200);
  var dn = offset[0];
  var de = offset[1];

  // Position, decimal degrees
  var lat = location[0];
  var lng = location[1];

  // Earth’s radius, sphere
  var Radius = 6378137;

  // Coordinate offsets in radians
  var dLat = dn/Radius;
  var dLng = de/(Radius*Math.cos(Math.PI*lat/180));

  // OffsetPosition, decimal degrees
  var latO = lat + dLat * 180/Math.PI;
  var lngO = lng + dLng * 180/Math.PI;

  return [latO, lngO];
}


/**
 * Create (or update if exists) a Offer
 */
exports.create = function(req, res) {

  if(!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  var offer = new Offer(req.body);
  offer.user = req.user;

  // Save Fuzzy location
  offer.locationFuzzy = fuzzyLocation(offer.location);

  // Sanitize contents coming from wysiwyg editors
  ['description', 'noOfferDescription'].forEach(function(key) {
    if(offer[key] && !textProcessor.isEmpty(offer[key])) {
      // Allow some HTML
      offer[key] = textProcessor.html(offer[key]);
    }
  });

  // Convert the Model instance to a simple object using Model's 'toObject' function
  // to prevent weirdness like infinite looping...
  var upsertData = offer.toObject();

  // Delete the _id property, otherwise Mongo will return a "Mod on _id not allowed" error
  delete upsertData._id;

  // Do the upsert, which works like this: If no Offer document exists with
  // _id = offer.id, then create a new doc using upsertData.
  // Otherwise, update the existing doc with upsertData
  // @link http://stackoverflow.com/a/7855281
  Offer.update({
    user: upsertData.user,
  },
  upsertData,
  { upsert: true },
  function(err) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {
      res.json(upsertData);
    }
  });

};


/**
 * List of Offers
 */
exports.list = function(req, res) {

  if(!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  Offer.find(
    {
      $or: [
        { status: 'yes' },
        { status: 'maybe' }
      ],
      /**
       * Note:
       * http://docs.mongodb.org/manual/reference/operator/query/box
       * -> It's latitude first as in the database, not longitude first as in the documentation
       */
      locationFuzzy: {
        $geoWithin: {
          $box: [
            [Number(req.query.southWestLat), Number(req.query.southWestLng)],
            [Number(req.query.northEastLat), Number(req.query.northEastLng)]
          ]
        }
      }
    },
    'locationFuzzy status user'
  )
  .exec(function(err, offers) {
    if (err) {
      return res.status(400).send({
        message: errorHandler.getErrorMessage(err)
      });
    } else {

      /**
       * Could return something like this here already (so no need to refactor at frontend):
       *
       * lat: marker.locationFuzzy[0],
       * lng: marker.locationFuzzy[1],
       * user: marker.user,
       * icon: $scope.icons[marker.status]
       */
      res.json(offers);
    }
  });
};


/**
 * Show the current Offer
 */
exports.read = function(req, res) {
  res.json(req.offer || {});
};


// Offer reading middleware
exports.offerByUserId = function(req, res, next, userId) {

  if(!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  // Not a valid ObjectId
  if(!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).send({
      message: errorHandler.getErrorMessageByKey('invalid-id')
    });
  }

  Offer.findOne({
      user: userId
    })
    .exec(function(err, offer) {

      // Errors
      if(err) return next(err);
      if(!offer) {
			  return res.status(404).send({
			    message: errorHandler.getErrorMessageByKey('not-found')
			  });
      }

      offer = offer.toObject();

      // Sanitize each outgoing offer's contents
      offer.description = sanitizeHtml(offer.description, textProcessor.sanitizeOptions);
      offer.noOfferDescription = sanitizeHtml(offer.noOfferDescription, textProcessor.sanitizeOptions);

      // Make sure we return accurate location only for offer owner, others will see pre generated fuzzy location
      if(userId !== req.user.id) {
        offer.location = offer.locationFuzzy;
      }
      delete offer.locationFuzzy;

      req.offer = offer;
      next();
    });

};


// Offer reading middleware
exports.offerById = function(req, res, next, offerId) {

  // Not a valid ObjectId
  if(!mongoose.Types.ObjectId.isValid(offerId)) {
    return res.status(400).send({
      message: errorHandler.getErrorMessageByKey('invalid-id')
    });
  }

  // Require user
  if(!req.user) {
    return res.status(403).send({
      message: errorHandler.getErrorMessageByKey('forbidden')
    });
  }

  Offer.findById(offerId)
    .populate('user', userHandler.userListingProfileFields)
    .exec(function(err, offer) {

      if(err) return next(err);
      if(!offer) {
			  return res.status(404).send({
			    message: errorHandler.getErrorMessageByKey('not-found')
			  });
      }
      offer = offer.toObject();

      // Sanitize each outgoing offer's contents
      offer.description = sanitizeHtml(offer.description, textProcessor.sanitizeOptions);
      offer.noOfferDescription = sanitizeHtml(offer.noOfferDescription, textProcessor.sanitizeOptions);

      // Make sure we return accurate location only for offer owner, others will see pre generated fuzzy location
      if(req.user && offer.user !== req.user.id) {
        offer.location = offer.locationFuzzy;
      }
      delete offer.locationFuzzy;

      req.offer = offer;
      next();
    });

};
