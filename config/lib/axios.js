import axios from 'axios';

// create an axios instance with defaults
export default axios.create({
  transformResponse: [({ data }) => data] // return only request body
});
