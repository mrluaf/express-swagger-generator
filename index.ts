import { swaggerize, common, initialise, compile, json, ensureValid } from 'swagger-spec-express';
// var j2s = require('joi-to-swagger');
import j2s from 'joi-to-swagger';
import { setup, serve } from 'swagger-ui-express';
import responsesEnum from './responsesEnum';
import { isEmpty, map, get, has, sortedIndexOf } from 'lodash';
import fs from 'fs';
import { resolve, join } from 'path';
import expressValidation from './validation/validate';
import doctrine from 'doctrine';

/**
 * This module will support all the functionality of swagger-spec-express with additonal
 * functions of this module.
 * This module uses swagger-spec-express, swagger-ui-express and joi-to-swagger modules to
 * generate swagger documentation with joi validation.
 */

export = {
  swaggerize,
  createModel,
  serveSwagger,
  validation: expressValidation
};

/**
 * This will create models for all the provides responses(with joi vlaidations).
 * @param {object} responseModel
 */

function createResponseModel({ responseModel, name }: { responseModel: any; name: string }) {
  let isArray = false;
  if (responseModel && Array.isArray(responseModel) && responseModel.length) {
    isArray = true;
    responseModel = responseModel[0];
  }
  for (const property in responseModel) {
    if (typeof responseModel[property] === 'string') {
      responseModel[property] = {
        type: responseModel[property],
      };
    }
  }
  const bodyParameter: any = {
    type: isArray ? 'array' : 'object',
  };

  if (isArray) {
    bodyParameter.items = {
      type: 'object',
      properties: responseModel,
    };
  } else {
    bodyParameter.properties = responseModel;
  }
  const model = Object.assign(
    {
      name,
    },
    bodyParameter,
  );
  common.addModel(model);
}

/**
 * Serve swagger for apis
 * @param app Express object
 * @param endPoint Swagger path on which swagger UI display
 * @param options Swagget Options.
 * @param path.routePath path to folder in which routes files defined.
 * @param path.requestModelPath path to folder in which requestModel defined.
 * @param path.responseModelPath path to folder in which responseModel defined.
 */
function serveSwagger(
  app: any,
  endPoint: string,
  options: object,
  path: { routePath: string; requestModelPath: string; responseModelPath: string },
) {
  // console.log('Generting documentation');
  describeSwagger(path.routePath, path.requestModelPath, path.responseModelPath);
  initialise(app, options);
  compile(); // compile swagger document
  const swaggerDocument = json();
  // console.log('Generated documentation successfully');
  app.get(`${endPoint}.json`, (req: any, res: any) => res.status(200).json(json()));
  app.get(`${endPoint}/rapi`, (req: any, res: any) => res.send(`
  <!doctype html> <!-- Important: must specify -->
  <html>
    <head>
      <meta charset="utf-8"> <!-- Important: rapi-doc uses utf8 characters -->
      <script type="module" src="https://unpkg.com/rapidoc/dist/rapidoc-min.js"></script>
    </head>
    <body>
      <rapi-doc spec-url = "..${endPoint}.json"> </rapi-doc>
    </body>
  </html>
  `));
  app.use(endPoint, serve, setup(swaggerDocument));
}

/**
 * This function will generate json for the success response.
 * @param {object} schema
 * @param {object} describe
 */

function createResponses(schema: any, responseModel: any, describe: any) {
  const responses: any = {
    500: {
      description: responsesEnum[500],
    },
  };
  try {
    if (responseModel && !isEmpty(responseModel)) {
      for (const key in responseModel) {
        if (responseModel.hasOwnProperty(key)) {
          createResponseModel({
            responseModel: responseModel[key],
            name: `${schema.model}${key}ResponseModel`,
          });
          responses[key] = {
            description: responsesEnum[key] ? responsesEnum[key] : '',
            schema: {
              $ref: `#/definitions/${schema.model}${key}ResponseModel`,
            },
          };
        }
      }
    }
    describe.responses = responses;
    return describe;
  } catch (error) {
    // console.log('responseModel', responseModel);
    // console.log('Error while generting response model for swagger', error);
    describe.responses = responses;
    return describe;
  }
}

/**
 * This function will generate json given header parameter in schema(with joi validation).
 * @param {object} schema
 * @param {object} describe
 */

function getHeader(schema: any, describe: any) {
  const arr = [];
  for (const key in schema) {
    if (schema.hasOwnProperty(key)) {
      arr.push(key);
      const query = schema[key];
      const queryObject = {
        name: key,
        type: query.type ? query.type : query,
        required: query.required === 'undefined' ? false : true,
      };
      if (query._flags && query._flags.presence) {
        queryObject.required = query._flags.presence === 'required' ? true : false;
      }
      common.parameters.addHeader(queryObject);
    }
  }

  if (describe.common.parameters) {
    describe.common.parameters.header = arr;
  } else {
    describe.common.parameters = {};
    describe.common.parameters.header = arr;
  }

  return describe;
}

/**
 * This function will create models for given path and query schema and
 * convert it to json(with joi validation).
 * @param {object} schema
 * @param {string} value either query and path
 * @param {object} describe
 */

function getQueryAndPathParamObj(schema: any, value: string, describe: any) {
  const arr = [];
  for (const key in schema) {
    if (schema.hasOwnProperty(key)) {
      arr.push(key);
      const query = schema[key];
      const bodyParameter = j2s(schema[key]).swagger;
      // console.log('bodyParameter:::', bodyParameter);

      const queryObject = {
        name: key,
        type: query.type ? query.type : query,
        required: query.required === 'undefined' ? false : true,
        ...bodyParameter,
      };
      // console.log('queryObject::::', queryObject);
      if (query._flags && query._flags.presence) {
        queryObject.required = query._flags.presence === 'required' ? true : false;
      }
      value === 'query' ? common.parameters.addQuery(queryObject) : common.parameters.addPath(queryObject);
    }
  }
  if (describe.common.parameters) {
    value === 'query' ? (describe.common.parameters.query = arr) : (describe.common.parameters.path = arr);
  } else {
    describe.common.parameters = {};
    value === 'query' ? (describe.common.parameters.query = arr) : (describe.common.parameters.path = arr);
  }

  return describe;
}

/**
 * This function will create models for given body schema
 * and convert it to json(with joi validation).
 * @param {object} schema
 * @param {object} describe
 */
function getBodyParameters(
  schema: { body: any; model: any; description: any },
  describe: { tags?: any[]; common: any },
) {
  const bodyParameter = j2s(schema.body).swagger;
  const model = Object.assign(
    {
      name: `${schema.model}Model`,
    },
    bodyParameter,
  );
  common.addModel(model);
  common.parameters.addBody({
    name: `${schema.model}Model`,
    required: true,
    description: schema.description || undefined,
    schema: {
      $ref: `#/definitions/${schema.model}Model`,
    },
  });
  describe.common = {
    parameters: {
      body: [`${schema.model}Model`],
    },
  };
  return describe;
}

/**
 * This function will create proper schema based on given body, query, header and path parameter
 * mentioned in the schema.
 * @param {object} schema this is schema mentioned for each API in a route.
 */
function createModel(schema: any, responseModel: { [x: string]: any; hasOwnProperty: (arg0: string) => void }) {
  let describe: any = {
    tags: [schema.group],
    common: {},
  };
  describe = {
    ...createResponses(schema, responseModel, describe),
  };
  if (schema && schema.body) {
    const bodyParams = getBodyParameters(schema, describe);
    describe = {
      ...bodyParams,
    };
  }
  if (schema && schema.query) {
    const queryParams = getQueryAndPathParamObj(schema.query, 'query', describe);
    describe = {
      ...queryParams,
    };
  }

  if (schema && schema.path) {
    const pathParams = getQueryAndPathParamObj(schema.path, 'path', describe);
    describe = {
      ...pathParams,
    };
  }

  if (schema && schema.header) {
    const headerParams = getHeader(schema.header, describe);
    describe = {
      ...headerParams,
    };
  }
  // if (get(schema, 'description')) describe.description = schema.description;
  // if (get(schema, 'summary')) describe.summary = schema.summary;
  return describe;
}


function jsdoc2Json(jsDoc: any) {
  const tags = get(jsDoc, 'tags', []);
  const tagJson = {
    description: get(jsDoc, 'description', ''),
    ...tags.reduce((acc: any, tag: any) => {
      if (tag && tag.title && tag.description) {
        acc[tag.title] = tag.description;
      }
      return acc;
    }, {})
  };
  
  return tagJson;
}

function extractSwaggerInfoFromJSDoc(jsDocComments: any, method: string, route: string) {
  try {
    // console.log('method:', method, 'route:', route);
    let result = jsDocComments.find((item: any) => {
      const tagJson = jsdoc2Json(item);
      const tagRoute = get(tagJson, 'route', '');
      // console.log('tagRoute::', tagRoute, `${method.toUpperCase()} ${route}`);
      const splitTag = tagRoute.split(' ');
      const tagMethod = get(splitTag, '[0]', '');
      const tagRoutePath = get(splitTag, '[1]', '');

      if (
        tagMethod.toLowerCase() === method.toLowerCase() &&
        tagRoutePath === route)
      {
        return true;
      }
  
    });
    
    result = jsdoc2Json(result);
    
    return result;
  } catch (error) {
    console.log('extractSwaggerInfoFromJSDoc error:', error);
    return {};
  }
}

/**
 *
 * @param routePath : routh folder path.
 * @param requestModelPath : request model path
 * @param responseModelPath : responsemodel model path.
 */
function describeSwagger(routePath: string, requestModelPath: string, responseModelPath: any) {
  try {
    const rootPath = resolve(__dirname).split('node_modules')[0];
    fs.readdirSync(join(rootPath, routePath)).forEach((file: any) => {
      if (!file) {
        // console.log('No router file found in given folder');
        return;
      }
      let responseModel;
      let requestModel;
      const jsDocRegex = /\/\*\*([\s\S]*?)\*\//gm;
      const jsdoc = [];
      let regexResults = null;
      const route = join(rootPath, routePath, file);
      const fileContent = fs.readFileSync(route, { encoding: 'utf8' });
      
      regexResults = fileContent.match(jsDocRegex) || [];
      for (const result of regexResults) {
        jsdoc.push(result);
      }

      let jsDocComments = [];

      for (const annotation of jsdoc) {
        const jsDocComment = doctrine.parse(annotation, { unwrap: true });
        jsDocComments.push(jsDocComment);
        // // console.log('jsDocComment::::', jsDocComment);
      }

      // console.log('jsDocComments:', JSON.stringify(jsDocComments));
      // // console.log(':::extractSwaggerInfoFromJSDoc::', extractSwaggerInfoFromJSDoc(jsDocComments, 'createUser', 'post', '/'));
      


      // // console.log('Source file:::', route, 'jsdoc:::', jsdoc);
      let router = require(route);
      if (!router) {
        // console.log('Router missing');
        return;
      }
      router = router.router || router;

      if (responseModelPath) {
        const responseModelFullPath = join(rootPath, responseModelPath, file);
        if (fs.existsSync(responseModelFullPath)) {
          responseModel = require(responseModelFullPath);
        } else {
          // console.log('Response model path does not exist responseModelFullPath->', responseModelFullPath);
        }
      }

      if (requestModelPath) {
        const requestModelFullPath = join(rootPath, requestModelPath, file);
        if (fs.existsSync(requestModelFullPath)) {
          requestModel = require(requestModelFullPath);
        } else {
          // console.log('Response model path does not exist requestModelFullPath->', requestModelFullPath);
        }
      }

      processRouter(router, requestModel, responseModel, file.split('.')[0], jsDocComments);
    });
  } catch (error) {
    // console.log(error);
    console.log(`Error in describeSwagger ${error}`);
    return;
  }
}

function processRouter(item: any, requestModel: any, responseModel: any, routerName: any, jsDocComments: any) {
  // console.log('requestModel:', requestModel, 'jsDocComments::', jsDocComments);
  try {
    if (item.stack && item.stack.length > 0) {
      let count = 0;
      // tslint:disable-next-line:no-unused-expression
      map(item.stack, (route: any) => {
        // console.log(routerName, 'route path:', route.route.path, route.route.methods);

        const routeMethod = Object.keys(route.route.methods)[0];
        const extraDataFromJsDOC = extractSwaggerInfoFromJSDoc(jsDocComments, routeMethod, route.route.path);

        // let routeRequestModel = get(requestModel, [count]);
        let routeRequestModel = undefined;
        if (get(extraDataFromJsDOC, 'model')) {
          routeRequestModel = get(requestModel, get(extraDataFromJsDOC, 'model'));
        }
        
        const routeResposeModel = get(responseModel, get(extraDataFromJsDOC, 'model'));
        // // console.log('--------routeResposeModel:::::', routeResposeModel);
        if (routeRequestModel && routeRequestModel.excludeFromSwagger) {
          count++;
          return;
        }
        if (!routeRequestModel || !has(routeRequestModel, 'group')) {
          routeRequestModel = {
            group: routerName,
            description: routerName,
          };
        }
        const data = Object.assign({}, createModel(routeRequestModel, routeResposeModel));
        // console.log('extraDataFromJsDOC:', extraDataFromJsDOC);
        
        if (extraDataFromJsDOC.description) data.description = extraDataFromJsDOC.description;
        if (extraDataFromJsDOC.summary) data.summary = extraDataFromJsDOC.summary;
        if (extraDataFromJsDOC.security) {
          try {
            const parseSecurity = JSON.parse(extraDataFromJsDOC.security);
            // console.log('parseSecurity:', parseSecurity);
            data.security = parseSecurity;
          } catch (error) {
            console.log('parseSecurity error:', error);
          }
        };
        

        describeRouterRoute(route, data);
        count++;
        return item;
      })[0];
    }
    if (item._router) {
      // console.log('item._router:::', item._router);
      describeRouterRoute(item._router, requestModel);
      return item;
    }
  } catch (error) {
    console.log('Error in processRouter::', error);
    console.log(`Error in processRouter:: ${error}`);
    return;
  }
}

function describeRouterRoute(router: any, metaData: any) {
  // console.log('metaData:::', metaData);
  if (metaData.described) {
    console.warn('Route already described');
    return;
  }
  if (!metaData) {
    throw new Error('Metadata must be set when calling describe');
  }
  if (!router) {
    throw new Error(
      // tslint:disable-next-line:max-line-length
      'router was null, either the item that swaggerize & describe was called on is not an express app/router or you have called describe before adding at least one route',
    );
  }

  if (!router.route) {
    throw new Error(
      // tslint:disable-next-line:max-line-length
      'Unable to add swagger metadata to last route since the last item in the stack was not a route. Route name :' +
        router.route.name +
        '. Metadata :' +
        JSON.stringify(metaData),
    );
  }
  const verb = Object.keys(router.route.methods)[0];
  if (!verb) {
    throw new Error(
      // tslint:disable-next-line:max-line-length
      "Unable to add swagger metadata to last route since the last route's methods property was empty" +
        router.route.name +
        '. Metadata :' +
        JSON.stringify(metaData),
    );
  }
  ensureValid(metaData);
  ensureAtLeastOneResponse(metaData);
  metaData.path = router.route.path;
  metaData.verb = verb;
  router.route.swaggerData = metaData;
  metaData.described = true;
}

function ensureAtLeastOneResponse(metaData: any) {
  if (metaData.responses && Object.keys(metaData.responses).length > 0) {
    return;
  }
  if (metaData.common && metaData.common.responses.length > 0) {
    return;
  }
  throw new Error(
    // tslint:disable-next-line:max-line-length
    'Each metadata description for a route must have at least one response, either specified in metaData.responses or metaData.common.responses.',
  );
}
