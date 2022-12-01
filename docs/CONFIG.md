```javascript
module.exports = ({ env }) => ({
  connection: {
    node: env('ELASTICSEARCH_HOST', 'localhost'),
    auth: {
      username: env('ELASTICSEARCH_USERNAME', 'USERNAME'),
      password: env('ELASTICSEARCH_PASSWORD', 'PASSWORD'),
    },
  },
  setting: {
    validStatus: [200, 201],
    validMethod: ['PUT', 'POST', 'DELETE'],
    fillByResponse: false,
    importLimit: 3000,
    removeExistIndexForMigration: false,
    indexPrefix: env('ELASTICSEARCH_INDEX_PREFIX', 'my-index'),
    migration: {
      allowEntities: ['all'],
      disallowEntities: [],
    },
  },
  urls: {},
  adminUrls: {}
  );
```
