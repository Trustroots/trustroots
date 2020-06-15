const connectMongo = require('connect-mongo');
const cookieParser = require('cookie-parser');
const http = require('http');
const passport = require('passport');
const path = require('path');
const session = require('express-session');
const WebSocket = require('ws');

const config = require('../config');
const MongoStore = connectMongo(session);

function authenticateSession(req, connection, callback) {
  // Create a MongoDB storage object
  const mongoStore = new MongoStore({
    collection: config.sessionCollection,
    mongooseConnection: connection,
  });

  const cookieParserMiddleware = cookieParser(config.sessionSecret);

  // Use the 'cookie-parser' module to parse the request cookies
  cookieParserMiddleware(req, {}, err => {
    if (err) {
      console.error('[WebSocket] cookieParser error:', err);
      return;
    }

    // Get the session id from the request cookies
    const sessionId = req.signedCookies
      ? req.signedCookies['connect.sid']
      : undefined;

    if (!sessionId) {
      console.warn(
        '[WebSocket] sessionId was not found in request',
        req.signedCookies,
      );
      return;
    }

    // Use the mongoStorage instance to get the Express session information
    mongoStore.get(sessionId, (err, session) => {
      if (err) {
        return console.error('[WebSocket] session error', err);
      }

      if (!session) {
        console.warn(`[WebSocket] session was not found for ${sessionId}`);
        return;
      }

      // Set the WebSocket session information
      req.session = session;

      // Use Passport to populate the user details
      passport.initialize()(req, {}, () => {
        passport.session()(req, {}, () => {
          if (!req.user) {
            return console.error(
              new Error('[WebSocket] User is not authenticated'),
            );
          }

          callback();
        });
      });
    });
  });
}

module.exports.start = function (app, connection) {
  const map = new Map();

  // Create HTTP server by ourselves.
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ clientTracking: false, noServer: true });

  server.on('upgrade', (req, socket, head) => {
    console.log('[WebSocket] upgrade request');

    // @TODO: Why doesn't simply passing existing session parser from the app work?
    /*
    sessionParser(req, {}, () => {
      if (!req.session.userId) {
        socket.destroy();
        return;
      }
    */

    // Authenticate before letting Websocket connection proceed
    authenticateSession(req, connection, () => {
      console.log(
        '[WebSocket] Session is parsed and user authenticated!',
        req.user,
      );

      wss.handleUpgrade(req, socket, head, ws => {
        wss.emit('[WebSocket] connected', ws, req);
      });
    });
  });

  wss.on('connection', (ws, req) => {
    console.log('[WebSocket] Connection');
    const userId = req.session.userId;

    console.log('[WebSocket]', userId, req.session);

    map.set(userId, ws);

    ws.on('message', message => {
      // Here we can now use session parameters
      console.log(
        `[WebSocket] Received message ${message} from user ${userId}`,
      );
    });

    ws.on('close', () => {
      console.log(`[WebSocket] Received "close" ('${userId})`);
      map.delete(userId);
    });

    config.files.server.sockets.forEach(socketConfiguration => {
      require(path.resolve(socketConfiguration))(ws, req);
    });
  });

  // Start the server.
  server.listen(config.websocket.port, () => {
    console.log(`WebSocket server listening on port ${config.websocket.port}`);
  });
};
