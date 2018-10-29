/*
 *  Our main js entrypoint :)
 *
 *  It looks kind of empty because almost everything is happening via webpack.shims.js for now.
 *
 */

import '@/public/dist/uib-templates';

if (process.env.NODE_ENV === 'production') {
  require('@/public/dist/templates');
}
