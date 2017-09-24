# redux-api-token-middleware
A redux middleware for token base API endpoint, will help you request token and save it to local storage before fetching actual endpoint.

## Installation

    $ npm install redux-api-token-middleware
  
#### Examples

##### Setup (in store configure file)

```javascript
import { createStore, applyMiddleware } from 'redux';
import apiTokenMiddleware from 'redux-api-token-middleware';

const config = {
    clientID: '1', 
    clientSecret: 'secret',
    redirectURL: 'http://www.example.com/callback',
    authorizeURL: 'http://www.example.com/oauth/authorize',
    accessTokenURL: 'http://www.example.com/oauth/token',
    urlResourceOwnerDetails: 'http://www.example.com/api/user',
    tokenStorageKey: 'token_key', // key to use for saving to browser local storage    
};

const enhancers = applyMiddleware(apiTokenMiddleware(config));

export default function configureStore(initialState) {
  return createStore(rootReducer, initialState, enhancers);
}
```

##### Your action creator will look this this
```javascript
export function fetchPosts(params = {}) {
  return {
    type: 'FETCH_POSTS',
    needToken: true,
    tokenGrantType: 'client_credentials', // currently only support `client_credentials`
    payload: {
      url: 'http://www.example.com/api/posts',
      method: 'GET',
      params,
    },
  };
}
```

You have to use [redux-promise-middleware](https://github.com/pburtchaell/redux-promise-middleware) for handling async code in your component.

------
**Note** this is just a beta version, this package was create due to my current project needed.