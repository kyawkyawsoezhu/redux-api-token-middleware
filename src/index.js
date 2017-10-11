import jwt from 'jsonwebtoken';
import moment from 'moment';
import axios from 'axios';
import SecureKeys from 'secure-keys';


const isTokenAboutToExpire = (token) => {
  const tokenPayload = jwt.decode(token.access_token);
  const expiry = moment.unix(tokenPayload.exp);
  return expiry.diff(moment(), 'seconds') < 300;
};

const retrieveTokenFromLocal = (key, crypto) => {
  const storedValue = localStorage.getItem(key);
  if (storedValue) {
    try {
      const decrypt = crypto.decrypt(JSON.parse(localStorage.getItem(key)));
      return JSON.parse(decrypt.token);
    } catch (e) {
      if (e instanceof SyntaxError) {
        return null;
      }
      throw e;
    }
  }
  return false;
};

const saveToken = (key, token, crypto) => {
  const encrypt = crypto.encrypt({ token: JSON.stringify(token) });
  localStorage.setItem(key, JSON.stringify(encrypt));
};

const requestNewToken = ({ accessTokenURL, grantType, clientID, clientSecret }) => (
  axios({
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

const shouldRequestNewToken = (tokenStorageKey, crypto) => {
  const token = retrieveTokenFromLocal(tokenStorageKey, crypto);
  return token ? isTokenAboutToExpire(token) : true;
};

const fetchAPIToken = config => (
  new Promise((resolve, reject) => {
    if (shouldRequestNewToken(config.tokenStorageKey, config.crypto)) {
      requestNewToken(config).then((response) => {
        const token = response.data;
        saveToken(config.tokenStorageKey, token, config.crypto);
        resolve(token);
      }).catch(reason => (reject(reason)));
    } else {
      return resolve(retrieveTokenFromLocal(config.tokenStorageKey, config.crypto));
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
    if (!isFetching) {
      isFetching = true;
      const crypto = new SecureKeys({
        secret: config.cryptionSecret
      });

      tokenPromise = fetchAPIToken(
        Object.assign({}, config, {
          grantType: action.tokenGrantType,
          tokenStorageKey: `${config.tokenStorageKey}_for_${action.tokenGrantType}`,
          crypto,
        })).then((response) => {
        isFetching = false;
        return response
      });
    }
    tokenPromise.then((token) => {
      const accessToken = token.access_token;
      const apiRequest = axios.create({
        baseURL: config.apiBaseURL,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
        }
      });
      const payload = apiRequest(Object.assign({}, action.payload));
      const newAction = Object.assign({}, action, {payload, needToken: false});
      resolve(next(newAction));
    }).catch((reason) => {
      throw reason;
    })
  });
};