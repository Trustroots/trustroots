const swaggerAutogen = require('swagger-autogen')({ openapi: '3.1.0' });

const doc = {
  info: {
    title: 'Trustroots API',
    description: 'API for Trustroots.org',
  },
  servers: [{ url: '/' }],
};

const outputFile = '../apidocs/openapi.json';
const routes = ['../config/lib/express.js', '../modules/*/server/routes/*'];

swaggerAutogen(outputFile, routes, doc);
