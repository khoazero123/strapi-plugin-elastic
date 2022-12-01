const _ = require('lodash');
const {
  helper: { generateMappings, findMappingConfig },
} = require('../services');

module.exports = {
  fetchModels: (ctx) => {
    const { models } = strapi.config.elasticsearch;

    const enabledModels = models.filter((model) => model.enabled);

    const sortedEnabledModels = _.orderBy(enabledModels, ['model'], ['asc']);

    const disabledModels = models.filter((model) => !model.enabled);

    const sortedDisabledModels = _.orderBy(disabledModels, ['model'], ['asc']);

    // there is a bug here
    // models are not sorted
    const allModels = [...sortedEnabledModels, ...sortedDisabledModels];

    const response = _.map(
      allModels,
      _.partialRight(_.pick, [
        'model',
        'plugin',
        'index',
        'migration',
        'pk',
        'enabled',
      ])
    );

    return ctx.send(response);
  },
  fetchModel: async (ctx) => {
    const { setting: {indexPrefix} } = strapi.config.elasticsearch;
    const { index, _start, _limit } = ctx.query;
    let data, count, map;
    let status = {};
    const indexName = indexPrefix ? `${indexPrefix}-${index}` : index;
    try {
      //
      count = await strapi.elastic.count({ index: indexName });
      //
      map = await strapi.elastic.indices.getMapping({ index: indexName });
      //
      status = {
        deleted: false,
        created: true,
      };
      //
    } catch (e) {
      status = {
        deleted: true,
        created: false,
      };
    }
    if (status.created && !_.isEmpty(map.body[indexName])) {
      //
      status.hasMapping = true;
      //
    } else {
      //
      status.hasMapping = false;
      //
    }
    try {
      data = await strapi.elastic.search({
        index: indexName,
        size: _limit || 10,
        from: _limit * (_start - 1),
        body: {
          sort: [
            {
              updated_at: {
                order: 'desc',
              },
            },
          ],
          query: {
            match_all: {},
          },
        },
      });
    } catch (e) {
      strapi.log.error(e.message);
      return ctx.send({ data: null, total: 0, status,  index: indexName });
    }

    if (data.statusCode !== 200) return ctx.badRequest();

    const res = [];
    for (const item of data.body.hits.hits) {
      const source = item['_source'];
      if (!_.isEmpty(source)) {
        //
        const sourceKeys = Object.keys(source);

        for (const key of sourceKeys) {
          //
          if (_.isArray(source[key])) {
            //
            source[key] = '[Array]';
            //
          } else if (_.isObject(source[key])) {
            //
            source[key] = '[Object]';
            //
          }
        }
        res.push(source);
      }
    }
    return ctx.send({
      data: res,
      total: count && count.body && count.body.count,
      status,
      index: indexName
    });
  },
  migrateModels: async (ctx) => {
    await ctx.send({
      message: 'on progress it can take a few minuets',
    });

    strapi.elastic.migrateModels();
  },
  migrateModel: async (ctx) => {
    const { model } = ctx.request.body;

    await strapi.elastic.migrateModel(model);
    return ctx.send({ success: true });
  },
  generateIndexConfig: async (ctx) => {
    const data = ctx.request.body;
    const { model } = ctx.params;

    if (!data || !model) return ctx.badRequest();

    await strapi.elastic.index({
      index: 'strapi_elastic_lab',
      body: data,
    });

    const map = await strapi.elastic.indices.getMapping({
      index: 'strapi_elastic_lab',
    });

    await strapi.elastic.indices.delete({
      index: 'strapi_elastic_lab',
    });

    const { models } = strapi.config.elasticsearch;
    const targetModel = models.find((item) => item.model === model);

    await generateMappings({
      data: map.body['strapi_elastic_lab'],
      targetModels: targetModel,
    });

    return ctx.send({ success: true });
  },
  createIndex: async (ctx) => {
    const { model } = ctx.request.body;

    const { models, setting: {indexPrefix} } = strapi.config.elasticsearch;
    const targetModel = models.find((item) => item.model === model);

    const mapping = await findMappingConfig({ targetModel });

    const indexConfig = strapi.elastic.indicesMapping[targetModel.model];

    const indexName = indexPrefix ? `${indexPrefix}-${targetModel.index}` : targetModel.index;
    const options = {
      index: indexName,
    };

    if (mapping || indexConfig) {
      options.body = mapping || indexConfig;
    }

    await strapi.elastic.indices.create(options);

    return ctx.send({ success: true });
  },
  deleteIndex: async (ctx) => {
    const { model } = ctx.request.body;

    const { models, setting: {indexPrefix} } = strapi.config.elasticsearch;
    const targetModel = models.find((item) => item.model === model);
    const indexName = indexPrefix ? `${indexPrefix}-${targetModel.index}` : targetModel.index;
    try {
      await strapi.elastic.indices.delete({
        index: indexName,
      });
      return ctx.send({ success: true });
    } catch (e) {
      return ctx.throw(500);
    }
  },
};
