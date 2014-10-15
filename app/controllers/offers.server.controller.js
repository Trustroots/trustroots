'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    errorHandler = require('./errors'),
    sanitizeHtml = require('sanitize-html'),
    Offer = mongoose.model('Offer'),
    _ = require('lodash');

/**
 * Rules for sanitizing offers coming in and out
 * @link https://github.com/punkave/sanitize-html
 */
var offerSanitizeOptions = {
    allowedTags: [ 'p', 'br', 'b', 'i', 'em', 'strong', 'a', 'li', 'ul', 'ol', 'blockquote', 'code', 'pre' ],
    allowedAttributes: {
      'a': [ 'href' ],
      // We don't currently allow img itself, but this would make sense if we did:
      //'img': [ 'src' ]
    },
    selfClosing: [ 'img', 'br' ],
    // URL schemes we permit
    allowedSchemes: [ 'http', 'https', 'ftp', 'mailto', 'tel' ]
  };

/**
 * Create a fuzzy location
 * Will create an alternative lat,lng by shifting location 50-100 meters to random direction
 * @link http://gis.stackexchange.com/a/2980
 */
function fuzzyLocation(location) {

  // Offsets in meters, random between 50-100
  var dn = Math.floor((Math.random() * 50) + 50);
  var de = dn;

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
  var offer = new Offer(req.body);
  offer.user = req.user;

  // Save Fuzzy location
  offer.locationFuzzy = fuzzyLocation(offer.location);

  // Sanitize offer contents
  offer.description = sanitizeHtml(offer.description, offerSanitizeOptions);
  offer.noOfferDescription = sanitizeHtml(offer.noOfferDescription, offerSanitizeOptions);

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
 * Delete an Offer
 */
exports.delete = function(req, res) {
  console.log('->offer.delete');
};

/**
 * List of Offers
 */
exports.list = function(req, res) {
  Offer.find( {
        $or: [
          { status: 'yes' },
          { status: 'maybe' }
        ],
        locationFuzzy: {
            $geoWithin: {
                $box: [
                        [Number(req.query.northEastLng), Number(req.query.northEastLat)],
                        [Number(req.query.southWestLng), Number(req.query.southWestLat)]
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

            /*
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
  res.json(req.offer);
};


// Offer reading middleware
exports.offerByUserID = function(req, res, next, userId) {
  Offer.findOne({
      user: userId
    })
    .exec(function(err, offer) {
      if (err) return next(err);
      //if (!offer) return next(new Error('Failed to load offers.'));

      if (offer) {
        // Sanitize each outgoing offer's contents
        offer.description = sanitizeHtml(offer.description, offerSanitizeOptions);
        offer.noOfferDescription = sanitizeHtml(offer.noOfferDescription, offerSanitizeOptions);

        // Make sure we return accurate location only for offer owner, others will see pre generated fuzzy location
        if(userId !== req.user.id) {
          console.log('Return fuzzy');
          offer.location = offer.locationFuzzy;
        }
        delete offer.locationFuzzy;

        req.offer = offer;
      }
      else {
        // Return default offer
        req.offer = {
          status: 'no',
          user: {
            id: userId
          }
        };
      }
      next();
    });

};


/**
 * Offer authorization middleware
 */
exports.hasAuthorization = function(req, res, next) {
  if (req.offer.user.id !== req.user.id) {
    return res.status(403).send('User is not authorized');
  }
  next();
};
