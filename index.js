import jwt from 'jsonwebtoken';
import moment from 'moment';
import axios from 'axios';

const request = axios.create({
  headers: {
    Accept: 'application/json',
  }
});

const isTokenAboutToExpire = (token) => {
  const tokenPayload = jwt.decode(token.access_token);
  const expiry = moment.unix(tokenPayload.exp);
  return expiry.diff(moment(), 'seconds') < 300; 
};

const retrieveTokenFromLocal = (key) => {
  const storedValue = localStorage.getItem(key);
  if (storedValue) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch (e) {
      if (e instanceof SyntaxError) {
        return null;
      }
      throw e;
    }
  }
  return false;
};

const saveToken = (key, token) => {
  localStorage.setItem(key, JSON.stringify(token));
};

const requestNewToken = ({ accessTokenURL, grantType, clientID, clientSecret }) => (
  request({
    url: accessTokenURL,
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    data: {
      grant_type: grantType,
      client_id: clientID,
      client_secret: clientSecret,
    },
  })
);

const shouldRequestNewToken = (tokenStorageKey) => {
  const token = retrieveTokenFromLocal(tokenStorageKey);
  return token ? isTokenAboutToExpire(token) : true;
};

const fetchAPIToken = config => (
  new Promise((resolve, reject) => {
    if (shouldRequestNewToken(config.tokenStorageKey)) {
      requestNewToken(config).then((response) => {
        console.log('res',response.data);
        const token = response.data;
        saveToken(config.tokenStorageKey, token);
        resolve(token);
      }).catch(reason => (reject(reason)));
    } else {
      return resolve(retrieveTokenFromLocal(config.tokenStorageKey));
    }
  })
);

let isFetching = false; // avoid requesting token multiple time
let tokenPromise = {};

export default config => store => next => action => {
  if (!action.needToken) {
    return next(action);
  }

  return new Promise((resolve) => {
    if(!isFetching){
      isFetching = true;
      tokenPromise = fetchAPIToken(
        Object.assign({}, config, {
          grantType: action.payload.tokenGrantType,
          tokenStorageKey: `${config.tokenStorageKey}_for_${action.payload.tokenGrantType}`
        })).then((response) => { isFetching = false; return response });
    }
    tokenPromise.then((token) => {
      const accessToken = token.access_token;
      const payload = request(Object.assign({}, action.payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }));
      const newAction = Object.assign({}, action, { payload });
      resolve(next(newAction));
    }).catch((reason) => {
      throw reason;
    })
  });
};
