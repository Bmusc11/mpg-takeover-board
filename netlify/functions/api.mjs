// node_modules/@netlify/runtime-utils/dist/main.js
var getString = (input) => typeof input === "string" ? input : JSON.stringify(input);
var base64Decode = globalThis.Buffer ? (input) => Buffer.from(input, "base64").toString() : (input) => atob(input);
var base64Encode = globalThis.Buffer ? (input) => Buffer.from(getString(input)).toString("base64") : (input) => btoa(getString(input));
var getEnvironment = () => {
  const { Deno, Netlify, process: process2 } = globalThis;
  return Netlify?.env ?? Deno?.env ?? {
    delete: (key) => delete process2?.env[key],
    get: (key) => process2?.env[key],
    has: (key) => Boolean(process2?.env[key]),
    set: (key, value) => {
      if (process2?.env) {
        process2.env[key] = value;
      }
    },
    toObject: () => process2?.env ?? {}
  };
};

// node_modules/@netlify/otel/dist/main.js
var GET_TRACER = "__netlify__getTracer";
var getTracer = (name, version) => {
  return globalThis[GET_TRACER]?.(name, version);
};
function withActiveSpan(tracer, name, optionsOrFn, contextOrFn, fn) {
  const func = typeof contextOrFn === "function" ? contextOrFn : typeof optionsOrFn === "function" ? optionsOrFn : fn;
  if (!func) {
    throw new Error("function to execute with active span is missing");
  }
  if (!tracer) {
    return func();
  }
  return tracer.withActiveSpan(name, optionsOrFn, contextOrFn, func);
}

// node_modules/@netlify/blobs/dist/chunk-SQCJ2S3G.js
var getEnvironmentContext = () => {
  const context = globalThis.netlifyBlobsContext || getEnvironment().get("NETLIFY_BLOBS_CONTEXT");
  if (typeof context !== "string" || !context) {
    return {};
  }
  const data = base64Decode(context);
  try {
    return JSON.parse(data);
  } catch {
  }
  return {};
};
var MissingBlobsEnvironmentError = class extends Error {
  constructor(requiredProperties) {
    super(
      `The environment has not been configured to use Netlify Blobs. To use it manually, supply the following properties when creating a store: ${requiredProperties.join(
        ", "
      )}`
    );
    this.name = "MissingBlobsEnvironmentError";
  }
};
var BASE64_PREFIX = "b64;";
var METADATA_HEADER_INTERNAL = "x-amz-meta-user";
var METADATA_HEADER_EXTERNAL = "netlify-blobs-metadata";
var METADATA_MAX_SIZE = 2 * 1024;
var encodeMetadata = (metadata) => {
  if (!metadata) {
    return null;
  }
  const encodedObject = base64Encode(JSON.stringify(metadata));
  const payload = `b64;${encodedObject}`;
  if (METADATA_HEADER_EXTERNAL.length + payload.length > METADATA_MAX_SIZE) {
    throw new Error("Metadata object exceeds the maximum size");
  }
  return payload;
};
var decodeMetadata = (header) => {
  if (!header?.startsWith(BASE64_PREFIX)) {
    return {};
  }
  const encodedData = header.slice(BASE64_PREFIX.length);
  const decodedData = base64Decode(encodedData);
  const metadata = JSON.parse(decodedData);
  return metadata;
};
var getMetadataFromResponse = (response) => {
  if (!response.headers) {
    return {};
  }
  const value = response.headers.get(METADATA_HEADER_EXTERNAL) || response.headers.get(METADATA_HEADER_INTERNAL);
  try {
    return decodeMetadata(value);
  } catch {
    throw new Error(
      "An internal error occurred while trying to retrieve the metadata for an entry. Please try updating to the latest version of the Netlify Blobs client."
    );
  }
};
var NF_ERROR = "x-nf-error";
var NF_REQUEST_ID = "x-nf-request-id";
var DEPLOY_STORE_PREFIX = "deploy:";
var SITE_STORE_PREFIX = "site:";
var isDeniedWrite = (res, { method, storeName }) => (res.status === 401 || res.status === 403) && (method === "put" || method === "delete") && storeName !== void 0 && !storeName.startsWith(DEPLOY_STORE_PREFIX);
var blobsErrorMessage = (res, context, responseBody) => {
  let details = res.headers.get(NF_ERROR) || `${res.status} status code`;
  if (res.headers.has(NF_REQUEST_ID)) {
    details += `, ID: ${res.headers.get(NF_REQUEST_ID)}`;
  }
  if (isDeniedWrite(res, context)) {
    const storeName = context.storeName?.startsWith(SITE_STORE_PREFIX) ? context.storeName.slice(SITE_STORE_PREFIX.length) : context.storeName;
    const summary = `Netlify Blobs could not write to store '${storeName}' (${details}).`;
    if (context.edgeAccess) {
      return summary;
    }
    return `${summary} Builds and build plugins can only write to deploy-specific stores: use 'getDeployStore' instead of 'getStore', or pass a 'token' with write access to the store. If this code is not running in a build, check that the token and site ID are valid. See https://docs.netlify.com/build/data-and-storage/netlify-blobs/#deploy-specific-stores`;
  }
  let message = `Netlify Blobs has generated an internal error (${details})`;
  if (!res.headers.get(NF_ERROR) && responseBody) {
    message += `: ${responseBody}`;
  }
  return message;
};
var BlobsInternalError = class extends Error {
  constructor(res, context = {}, responseBody) {
    super(blobsErrorMessage(res, context, responseBody));
    this.name = "BlobsInternalError";
    this.status = res.status;
    this.responseBody = responseBody;
  }
};
var createBlobsInternalError = async (res, context = {}) => {
  const responseBody = await res.clone().text().catch(() => void 0);
  return new BlobsInternalError(res, context, responseBody);
};
var discardBody = async (res) => {
  await res.body?.cancel().catch(() => {
  });
};
var collectIterator = async (iterator) => {
  const result = [];
  for await (const item of iterator) {
    result.push(item);
  }
  return result;
};
function withSpan(span, name, fn) {
  if (span) return fn(span);
  return withActiveSpan(getTracer(), name, (span2) => {
    return fn(span2);
  });
}
var BlobsConsistencyError = class extends Error {
  constructor() {
    super(
      `Netlify Blobs has failed to perform a read using strong consistency because the environment has not been configured with a 'uncachedEdgeURL' property`
    );
    this.name = "BlobsConsistencyError";
  }
};
var REGION_AUTO = "auto";
var regions = {
  "us-east-1": true,
  "us-east-2": true,
  "eu-central-1": true,
  "ap-southeast-1": true,
  "ap-southeast-2": true
};
var isValidRegion = (input) => Object.keys(regions).includes(input);
var InvalidBlobsRegionError = class extends Error {
  constructor(region) {
    super(
      `${region} is not a supported Netlify Blobs region. Supported values are: ${Object.keys(regions).join(", ")}.`
    );
    this.name = "InvalidBlobsRegionError";
  }
};
var DEFAULT_RETRY_DELAY = getEnvironment().get("NODE_ENV") === "test" ? 1 : 5e3;
var MIN_RETRY_DELAY = 1e3;
var MAX_RETRY = 5;
var RATE_LIMIT_HEADER = "X-RateLimit-Reset";
var fetchAndRetry = async (fetch, url, options, attemptsLeft = MAX_RETRY, getRetryUrl) => {
  try {
    const res = await fetch(url, options);
    const isRetryable = res.status === 429 || res.status >= 500 || getRetryUrl !== void 0 && res.status === 403;
    if (attemptsLeft > 0 && isRetryable) {
      await discardBody(res);
      const delay = getDelay(res.headers.get(RATE_LIMIT_HEADER));
      await sleep(delay);
      const retryUrl = getRetryUrl ? await getRetryUrl() : url;
      return fetchAndRetry(fetch, retryUrl, options, attemptsLeft - 1, getRetryUrl);
    }
    return res;
  } catch (error) {
    if (attemptsLeft === 0) {
      throw error;
    }
    const delay = getDelay();
    await sleep(delay);
    const retryUrl = getRetryUrl ? await getRetryUrl() : url;
    return fetchAndRetry(fetch, retryUrl, options, attemptsLeft - 1, getRetryUrl);
  }
};
var getDelay = (rateLimitReset) => {
  if (!rateLimitReset) {
    return DEFAULT_RETRY_DELAY;
  }
  return Math.max(Number(rateLimitReset) * 1e3 - Date.now(), MIN_RETRY_DELAY);
};
var sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});
var SIGNED_URL_ACCEPT_HEADER = "application/json;type=signed-url";
var Client = class {
  /**
   * Whether requests reach Blobs through the edge rather than the API. Only
   * runtime environments are given an edge URL.
   */
  get edgeAccess() {
    return this.edgeURL !== void 0;
  }
  constructor({ apiURL, consistency, edgeURL, fetch, region, siteID, token, uncachedEdgeURL }) {
    this.apiURL = apiURL;
    this.consistency = consistency ?? "eventual";
    this.edgeURL = edgeURL;
    this.fetch = fetch ?? globalThis.fetch;
    this.region = region;
    this.siteID = siteID;
    this.token = token;
    this.uncachedEdgeURL = uncachedEdgeURL;
    if (!this.fetch) {
      throw new Error(
        "Netlify Blobs could not find a `fetch` client in the global scope. You can either update your runtime to a version that includes `fetch` (like Node.js 18.0.0 or above), or you can supply your own implementation using the `fetch` property."
      );
    }
  }
  async getFinalRequest({
    consistency: opConsistency,
    key,
    metadata,
    method,
    parameters = {},
    storeName
  }) {
    const encodedMetadata = encodeMetadata(metadata);
    const consistency = opConsistency ?? this.consistency;
    let urlPath = `/${this.siteID}`;
    if (storeName) {
      urlPath += `/${storeName}`;
    }
    if (key) {
      urlPath += `/${key}`;
    }
    if (this.edgeURL) {
      if (consistency === "strong" && !this.uncachedEdgeURL) {
        throw new BlobsConsistencyError();
      }
      const headers = {
        authorization: `Bearer ${this.token}`
      };
      if (encodedMetadata) {
        headers[METADATA_HEADER_INTERNAL] = encodedMetadata;
      }
      if (this.region) {
        urlPath = `/region:${this.region}${urlPath}`;
      }
      const url2 = new URL(urlPath, consistency === "strong" ? this.uncachedEdgeURL : this.edgeURL);
      for (const key2 in parameters) {
        url2.searchParams.set(key2, parameters[key2]);
      }
      return {
        headers,
        url: url2.toString()
      };
    }
    const apiHeaders = { authorization: `Bearer ${this.token}` };
    const url = new URL(`/api/v1/blobs${urlPath}`, this.apiURL ?? "https://api.netlify.com");
    for (const key2 in parameters) {
      url.searchParams.set(key2, parameters[key2]);
    }
    if (this.region) {
      url.searchParams.set("region", this.region);
    }
    if (storeName === void 0 || key === void 0) {
      return {
        headers: apiHeaders,
        url: url.toString()
      };
    }
    if (encodedMetadata) {
      apiHeaders[METADATA_HEADER_EXTERNAL] = encodedMetadata;
    }
    if (method === "head" || method === "delete") {
      return {
        headers: apiHeaders,
        url: url.toString()
      };
    }
    const res = await this.fetch(url.toString(), {
      headers: { ...apiHeaders, accept: SIGNED_URL_ACCEPT_HEADER },
      method
    });
    if (res.status !== 200) {
      throw await createBlobsInternalError(res, { edgeAccess: this.edgeAccess, method, storeName });
    }
    const { url: signedURL } = await res.json();
    const userHeaders = encodedMetadata ? { [METADATA_HEADER_INTERNAL]: encodedMetadata } : void 0;
    return {
      headers: userHeaders,
      url: signedURL
    };
  }
  async makeRequest({
    body,
    conditions = {},
    consistency,
    headers: extraHeaders,
    key,
    metadata,
    method,
    parameters,
    storeName
  }) {
    const { headers: baseHeaders = {}, url } = await this.getFinalRequest({
      consistency,
      key,
      metadata,
      method,
      parameters,
      storeName
    });
    const headers = {
      ...baseHeaders,
      ...extraHeaders
    };
    if (method === "put") {
      headers["cache-control"] = "max-age=0, stale-while-revalidate=60";
    }
    if ("onlyIfMatch" in conditions && conditions.onlyIfMatch) {
      headers["if-match"] = conditions.onlyIfMatch;
    } else if ("onlyIfNew" in conditions && conditions.onlyIfNew) {
      headers["if-none-match"] = "*";
    }
    const options = {
      body,
      headers,
      method
    };
    if (body instanceof ReadableStream) {
      options.duplex = "half";
    }
    const usesSignedUrl = !this.edgeURL && key !== void 0 && storeName !== void 0 && method !== "head" && method !== "delete";
    let getRetryUrl;
    if (usesSignedUrl) {
      getRetryUrl = async () => {
        const finalRequest = await this.getFinalRequest({ consistency, key, metadata, method, parameters, storeName });
        return finalRequest.url;
      };
    }
    return fetchAndRetry(this.fetch, url, options, void 0, getRetryUrl);
  }
};
var getClientOptions = (options, contextOverride) => {
  const context = contextOverride ?? getEnvironmentContext();
  const siteID = context.siteID ?? options.siteID;
  const token = context.token ?? options.token;
  if (!siteID || !token) {
    throw new MissingBlobsEnvironmentError(["siteID", "token"]);
  }
  if (options.region !== void 0 && !isValidRegion(options.region)) {
    throw new InvalidBlobsRegionError(options.region);
  }
  const clientOptions = {
    apiURL: context.apiURL ?? options.apiURL,
    consistency: options.consistency,
    edgeURL: context.edgeURL ?? options.edgeURL,
    fetch: options.fetch,
    region: options.region,
    siteID,
    token,
    uncachedEdgeURL: context.uncachedEdgeURL ?? options.uncachedEdgeURL
  };
  return clientOptions;
};

// node_modules/@netlify/blobs/dist/main.js
var LEGACY_STORE_INTERNAL_PREFIX = "netlify-internal/legacy-namespace/";
var STATUS_OK = 200;
var STATUS_PRE_CONDITION_FAILED = 412;
var STATUS_CONFLICT = 409;
var Store = class _Store {
  constructor(options) {
    this.client = options.client;
    if ("deployID" in options) {
      _Store.validateDeployID(options.deployID);
      let name = DEPLOY_STORE_PREFIX + options.deployID;
      if (options.name) {
        name += `:${options.name}`;
      }
      this.name = name;
    } else if (options.name.startsWith(LEGACY_STORE_INTERNAL_PREFIX)) {
      const storeName = options.name.slice(LEGACY_STORE_INTERNAL_PREFIX.length);
      _Store.validateStoreName(storeName);
      this.name = storeName;
    } else {
      _Store.validateStoreName(options.name);
      this.name = SITE_STORE_PREFIX + options.name;
    }
  }
  async delete(key) {
    const res = await this.client.makeRequest({ key, method: "delete", storeName: this.name });
    await discardBody(res);
    if (![200, 204, 404].includes(res.status)) {
      throw new BlobsInternalError(res, {
        edgeAccess: this.client.edgeAccess,
        method: "delete",
        storeName: this.name
      });
    }
  }
  async deleteAll() {
    let totalDeletedBlobs = 0;
    let hasMore = true;
    while (hasMore) {
      const res = await this.client.makeRequest({ method: "delete", storeName: this.name });
      if (res.status !== 200) {
        await discardBody(res);
        throw new BlobsInternalError(res, {
          edgeAccess: this.client.edgeAccess,
          method: "delete",
          storeName: this.name
        });
      }
      const data = await res.json();
      if (typeof data.blobs_deleted !== "number") {
        throw new BlobsInternalError(res);
      }
      totalDeletedBlobs += data.blobs_deleted;
      hasMore = typeof data.has_more === "boolean" && data.has_more;
    }
    return {
      deletedBlobs: totalDeletedBlobs
    };
  }
  async get(key, options) {
    return withSpan(options?.span, "blobs.get", async (span) => {
      const { consistency, type } = options ?? {};
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.type": type,
        "blobs.method": "GET",
        "blobs.consistency": consistency
      });
      const res = await this.client.makeRequest({
        consistency,
        key,
        method: "get",
        storeName: this.name
      });
      span?.setAttributes({
        "blobs.response.body.size": res.headers.get("content-length") ?? void 0,
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        await discardBody(res);
        return null;
      }
      if (res.status !== 200) {
        await discardBody(res);
        throw new BlobsInternalError(res);
      }
      if (type === void 0 || type === "text") {
        return res.text();
      }
      if (type === "arrayBuffer") {
        return res.arrayBuffer();
      }
      if (type === "blob") {
        return res.blob();
      }
      if (type === "json") {
        return res.json();
      }
      if (type === "stream") {
        return res.body;
      }
      await discardBody(res);
      throw new BlobsInternalError(res);
    });
  }
  async getMetadata(key, options = {}) {
    return withSpan(options?.span, "blobs.getMetadata", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "HEAD",
        "blobs.consistency": options.consistency
      });
      const res = await this.client.makeRequest({
        consistency: options.consistency,
        key,
        method: "head",
        storeName: this.name
      });
      span?.setAttributes({
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        return null;
      }
      if (res.status !== 200 && res.status !== 304) {
        throw new BlobsInternalError(res);
      }
      const etag = res?.headers.get("etag") ?? void 0;
      const metadata = getMetadataFromResponse(res);
      const result = {
        etag,
        metadata
      };
      return result;
    });
  }
  async getWithMetadata(key, options) {
    return withSpan(options?.span, "blobs.getWithMetadata", async (span) => {
      const { consistency, etag: requestETag, type } = options ?? {};
      const headers = requestETag ? { "if-none-match": requestETag } : void 0;
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "GET",
        "blobs.consistency": options?.consistency,
        "blobs.type": type,
        "blobs.request.etag": requestETag
      });
      const res = await this.client.makeRequest({
        consistency,
        headers,
        key,
        method: "get",
        storeName: this.name
      });
      const responseETag = res?.headers.get("etag") ?? void 0;
      span?.setAttributes({
        "blobs.response.body.size": res.headers.get("content-length") ?? void 0,
        "blobs.response.etag": responseETag,
        "blobs.response.status": res.status
      });
      if (res.status === 404) {
        await discardBody(res);
        return null;
      }
      if (res.status !== 200 && res.status !== 304) {
        await discardBody(res);
        throw new BlobsInternalError(res);
      }
      const metadata = getMetadataFromResponse(res);
      const result = {
        etag: responseETag,
        metadata
      };
      if (res.status === 304 && requestETag) {
        return { data: null, ...result };
      }
      if (type === void 0 || type === "text") {
        return { data: await res.text(), ...result };
      }
      if (type === "arrayBuffer") {
        return { data: await res.arrayBuffer(), ...result };
      }
      if (type === "blob") {
        return { data: await res.blob(), ...result };
      }
      if (type === "json") {
        return { data: await res.json(), ...result };
      }
      if (type === "stream") {
        return { data: res.body, ...result };
      }
      await discardBody(res);
      throw new Error(`Invalid 'type' property: ${type}. Expected: arrayBuffer, blob, json, stream, or text.`);
    });
  }
  list(options = {}) {
    return withSpan(options.span, "blobs.list", (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.method": "GET",
        "blobs.list.paginate": options.paginate ?? false
      });
      const iterator = this.getListIterator(options);
      if (options.paginate) {
        return iterator;
      }
      return collectIterator(iterator).then(
        (items) => items.reduce(
          (acc, item) => ({
            blobs: [...acc.blobs, ...item.blobs],
            directories: [...acc.directories, ...item.directories]
          }),
          { blobs: [], directories: [] }
        )
      );
    });
  }
  async set(key, data, options = {}) {
    return withSpan(options.span, "blobs.set", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "PUT",
        "blobs.data.size": typeof data == "string" ? data.length : data instanceof Blob ? data.size : data.byteLength,
        "blobs.data.type": typeof data == "string" ? "string" : data instanceof Blob ? "blob" : "arrayBuffer",
        "blobs.atomic": Boolean(options.onlyIfMatch ?? options.onlyIfNew)
      });
      _Store.validateKey(key);
      const conditions = _Store.getConditions(options);
      const res = await this.client.makeRequest({
        conditions,
        body: data,
        key,
        metadata: options.metadata,
        method: "put",
        storeName: this.name
      });
      const etag = res.headers.get("etag") ?? "";
      span?.setAttributes({
        "blobs.response.etag": etag,
        "blobs.response.status": res.status
      });
      if (conditions) {
        if (res.status === STATUS_PRE_CONDITION_FAILED || res.status === STATUS_CONFLICT) {
          await discardBody(res);
          return { modified: false };
        }
        if (res.ok) {
          await discardBody(res);
          return { etag, modified: true };
        }
        throw await createBlobsInternalError(res, {
          edgeAccess: this.client.edgeAccess,
          method: "put",
          storeName: this.name
        });
      }
      if (res.status === STATUS_OK) {
        await discardBody(res);
        return {
          etag,
          modified: true
        };
      }
      throw await createBlobsInternalError(res, {
        edgeAccess: this.client.edgeAccess,
        method: "put",
        storeName: this.name
      });
    });
  }
  async setJSON(key, data, options = {}) {
    return withSpan(options.span, "blobs.setJSON", async (span) => {
      span?.setAttributes({
        "blobs.store": this.name,
        "blobs.key": key,
        "blobs.method": "PUT",
        "blobs.data.type": "json",
        "blobs.atomic": Boolean(options.onlyIfMatch ?? options.onlyIfNew)
      });
      _Store.validateKey(key);
      const conditions = _Store.getConditions(options);
      const payload = JSON.stringify(data);
      const headers = {
        "content-type": "application/json"
      };
      const res = await this.client.makeRequest({
        conditions,
        body: payload,
        headers,
        key,
        metadata: options.metadata,
        method: "put",
        storeName: this.name
      });
      const etag = res.headers.get("etag") ?? "";
      span?.setAttributes({
        "blobs.response.etag": etag,
        "blobs.response.status": res.status
      });
      if (conditions) {
        if (res.status === STATUS_PRE_CONDITION_FAILED || res.status === STATUS_CONFLICT) {
          await discardBody(res);
          return { modified: false };
        }
        if (res.ok) {
          await discardBody(res);
          return { etag, modified: true };
        }
        throw await createBlobsInternalError(res, {
          edgeAccess: this.client.edgeAccess,
          method: "put",
          storeName: this.name
        });
      }
      if (res.status === STATUS_OK) {
        await discardBody(res);
        return {
          etag,
          modified: true
        };
      }
      throw await createBlobsInternalError(res, {
        edgeAccess: this.client.edgeAccess,
        method: "put",
        storeName: this.name
      });
    });
  }
  static formatListResultBlob(result) {
    if (!result.key) {
      return null;
    }
    return {
      etag: result.etag,
      key: result.key
    };
  }
  static getConditions(options) {
    if ("onlyIfMatch" in options && "onlyIfNew" in options) {
      throw new Error(
        `The 'onlyIfMatch' and 'onlyIfNew' options are mutually exclusive. Using 'onlyIfMatch' will make the write succeed only if there is an entry for the key with the given content, while 'onlyIfNew' will make the write succeed only if there is no entry for the key.`
      );
    }
    if ("onlyIfMatch" in options && options.onlyIfMatch) {
      if (typeof options.onlyIfMatch !== "string") {
        throw new Error(`The 'onlyIfMatch' property expects a string representing an ETag.`);
      }
      return {
        onlyIfMatch: options.onlyIfMatch
      };
    }
    if ("onlyIfNew" in options && options.onlyIfNew) {
      if (typeof options.onlyIfNew !== "boolean") {
        throw new Error(
          `The 'onlyIfNew' property expects a boolean indicating whether the write should fail if an entry for the key already exists.`
        );
      }
      return {
        onlyIfNew: true
      };
    }
  }
  static validateKey(key) {
    if (key === "") {
      throw new Error("Blob key must not be empty.");
    }
    if (key.startsWith("/") || key.startsWith("%2F")) {
      throw new Error("Blob key must not start with forward slash (/).");
    }
    if (new TextEncoder().encode(key).length > 600) {
      throw new Error(
        "Blob key must be a sequence of Unicode characters whose UTF-8 encoding is at most 600 bytes long."
      );
    }
  }
  static validateDeployID(deployID) {
    if (!/^\w{1,24}$/.test(deployID)) {
      throw new Error(`'${deployID}' is not a valid Netlify deploy ID.`);
    }
  }
  static validateStoreName(name) {
    if (name.includes("/") || name.includes("%2F")) {
      throw new Error("Store name must not contain forward slashes (/).");
    }
    if (new TextEncoder().encode(name).length > 64) {
      throw new Error(
        "Store name must be a sequence of Unicode characters whose UTF-8 encoding is at most 64 bytes long."
      );
    }
  }
  getListIterator(options) {
    const { client, name: storeName } = this;
    const parameters = {};
    if (options?.prefix) {
      parameters.prefix = options.prefix;
    }
    if (options?.directories) {
      parameters.directories = "true";
    }
    return {
      [Symbol.asyncIterator]() {
        let currentCursor = null;
        let done = false;
        return {
          async next() {
            return withSpan(options?.span, "blobs.list.next", async (span) => {
              span?.setAttributes({
                "blobs.store": storeName,
                "blobs.method": "GET",
                "blobs.list.paginate": options?.paginate ?? false,
                "blobs.list.done": done,
                "blobs.list.cursor": currentCursor ?? void 0
              });
              if (done) {
                return { done: true, value: void 0 };
              }
              const nextParameters = { ...parameters };
              if (currentCursor !== null) {
                nextParameters.cursor = currentCursor;
              }
              const res = await client.makeRequest({
                method: "get",
                parameters: nextParameters,
                storeName
              });
              span?.setAttributes({
                "blobs.response.status": res.status
              });
              let blobs = [];
              let directories = [];
              if (![200, 204, 404].includes(res.status)) {
                await discardBody(res);
                throw new BlobsInternalError(res);
              }
              if (res.status === 404) {
                await discardBody(res);
                done = true;
              } else {
                const page = await res.json();
                if (page.next_cursor) {
                  currentCursor = page.next_cursor;
                } else {
                  done = true;
                }
                blobs = (page.blobs ?? []).map(_Store.formatListResultBlob).filter(Boolean);
                directories = page.directories ?? [];
              }
              return {
                done: false,
                value: {
                  blobs,
                  directories
                }
              };
            });
          }
        };
      }
    };
  }
};
var getDeployStoreRegion = (clientOptions, context) => {
  if (clientOptions.region) {
    return clientOptions.region;
  }
  if (clientOptions.edgeURL || clientOptions.uncachedEdgeURL) {
    if (!context.primaryRegion) {
      throw new Error(
        "When accessing a deploy store, the Netlify Blobs client needs to be configured with a region, and one was not found in the environment. To manually set the region, set the `region` property in the store options. If you are using the Netlify CLI, you may have an outdated version; run `npm install -g netlify-cli@latest` to update and try again."
      );
    }
    return context.primaryRegion;
  }
  return REGION_AUTO;
};
var getStore = (input, options) => {
  if (typeof input === "string") {
    const contextOverride = options?.siteID && options?.token ? { siteID: options?.siteID, token: options?.token } : void 0;
    const clientOptions = getClientOptions(options ?? {}, contextOverride);
    const client = new Client(clientOptions);
    return new Store({ client, name: input });
  }
  if (typeof input?.name === "string") {
    const { name } = input;
    const contextOverride = input?.siteID && input?.token ? { siteID: input?.siteID, token: input?.token } : void 0;
    const clientOptions = getClientOptions(input, contextOverride);
    if (!name) {
      throw new MissingBlobsEnvironmentError(["name"]);
    }
    const client = new Client(clientOptions);
    return new Store({ client, name });
  }
  if (typeof input?.deployID === "string") {
    const context = getEnvironmentContext();
    const clientOptions = getClientOptions(input, context);
    const { deployID } = input;
    if (!deployID) {
      throw new MissingBlobsEnvironmentError(["deployID"]);
    }
    clientOptions.region = getDeployStoreRegion(clientOptions, context);
    const client = new Client(clientOptions);
    return new Store({ client, deployID });
  }
  throw new Error(
    "The `getStore` method requires the name of the store as a string or as the `name` property of an options object"
  );
};

// netlify/lib/core.mjs
import { createHash, timingSafeEqual, randomUUID } from "node:crypto";
var DEFAULT_REMINDER_HASH = "6e1b98f738250191539adec13c1eb1e63be3e5a2d77db2a081955bb8ed57ea82";
var DEFAULT_TEAM = ["Brenden", "Brittney", "Brian"];
var STEP_KEYS = ["form6", "termination", "ownerLetter", "form6Copy", "portal", "keys"];
var STEP_NAMES = {
  form6: "Form 6 signed by the landlords",
  termination: "Termination email sent from PropertyMe",
  ownerLetter: "Change of management letter sent to owner",
  form6Copy: "Copy of Form 6 sent to owner",
  portal: "Owner portal set up and access sent",
  keys: "Keys and files received from outgoing agent"
};
var ID_RE = /^[a-f0-9-]{36}$/;
var sha = (s) => createHash("sha256").update(String(s)).digest("hex");
var same = (a, b) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
var sleep2 = (ms) => new Promise((r) => setTimeout(r, ms));
var S = (v, n = 300) => typeof v === "string" ? v.trim().slice(0, n) : "";
var D = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
var isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
var json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
var text = (body, status = 200) => new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
var brisToday = (now = /* @__PURE__ */ new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Brisbane", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
var utc = (s) => {
  const p = s.split("-").map(Number);
  return Date.UTC(p[0], p[1] - 1, p[2]);
};
var daysBetween = (from, to) => Math.round((utc(to) - utc(from)) / 864e5);
var longDate = (s) => new Date(utc(s)).toLocaleDateString("en-AU", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
function cleanPatch(b) {
  const out = {};
  if (!isObj(b)) return out;
  for (const k of ["street", "suburb", "keyNote", "assignee"]) if (k in b) out[k] = S(b[k], k === "keyNote" ? 200 : 160);
  if ("postcode" in b) out.postcode = S(b.postcode, 10);
  if ("noticeDate" in b) out.noticeDate = D(b.noticeDate);
  if ("handoverDate" in b) out.handoverDate = D(b.handoverDate);
  if ("noticeDays" in b) {
    const n = parseInt(b.noticeDays, 10);
    out.noticeDays = n > 0 && n <= 365 ? n : 30;
  }
  if ("handoverManual" in b) out.handoverManual = !!b.handoverManual;
  if ("owners" in b && Array.isArray(b.owners)) out.owners = b.owners.slice(0, 10).filter(isObj).map((o) => ({ name: S(o.name, 120), phone: S(o.phone, 40), email: S(o.email, 160) }));
  if ("agency" in b && isObj(b.agency)) {
    out.agency = {};
    for (const k of ["name", "contact", "phone", "email"]) if (k in b.agency) out.agency[k] = S(b.agency[k], 160);
  }
  if ("steps" in b && isObj(b.steps)) {
    out.steps = {};
    for (const k of STEP_KEYS) if (isObj(b.steps[k])) {
      const done = !!b.steps[k].done;
      out.steps[k] = done ? { done: true, by: S(b.steps[k].by, 60), at: (/* @__PURE__ */ new Date()).toISOString() } : { done: false, by: "", at: "" };
    }
  }
  return out;
}
function merge(a, b) {
  for (const k of Object.keys(b)) {
    if (isObj(b[k]) && isObj(a[k])) merge(a[k], b[k]);
    else a[k] = b[k];
  }
  return a;
}
function finalise(t, prevHandover) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  t.steps = t.steps || {};
  for (const k of STEP_KEYS) if (!isObj(t.steps[k])) t.steps[k] = { done: false, by: "", at: "" };
  const all = STEP_KEYS.every((k) => t.steps[k].done);
  t.completedAt = all ? t.completedAt || now : "";
  if (prevHandover !== void 0 && prevHandover !== t.handoverDate) t.reminders = { d7: "", d1: "", for: "" };
  if (!isObj(t.reminders)) t.reminders = { d7: "", d1: "", for: "" };
  t.updatedAt = now;
  return t;
}
async function loadAll(store) {
  const { blobs } = await store.list();
  const items = await Promise.all(blobs.map(async (b) => {
    const v = await store.get(b.key, { type: "json" });
    return v ? { ...v, id: b.key } : null;
  }));
  return items.filter(Boolean);
}
var PLACES = "https://places.googleapis.com/v1/";
var TOKEN_RE = /^[A-Za-z0-9-]{8,64}$/;
var PLACE_RE = /^[A-Za-z0-9_-]{10,300}$/;
var UNIT_RE = /^(unit|apartment|apt|flat|suite|villa|townhouse)\s*/i;
var BIAS = { circle: { center: { latitude: -27.8, longitude: 153.1 }, radius: 5e4 } };
function addressFrom(d) {
  const comps = Array.isArray(d?.addressComponents) ? d.addressComponents : [];
  const get = (type, short) => {
    const c = comps.find((x) => isObj(x) && Array.isArray(x.types) && x.types.includes(type));
    return c ? S(short ? c.shortText : c.longText, 120) : "";
  };
  const num = get("street_number"), route = get("route"), sub = get("subpremise");
  let street = [num, route].filter(Boolean).join(" ");
  if (sub && street) {
    const unit = sub.replace(UNIT_RE, "");
    street = /^[A-Za-z0-9-]+$/.test(unit) && num ? `${unit}/${street}` : `${sub}, ${street}`;
  }
  return {
    street,
    suburb: get("locality") || get("sublocality_level_1") || get("sublocality"),
    postcode: get("postal_code").slice(0, 4),
    state: get("administrative_area_level_1", true),
    formatted: S(d?.formattedAddress, 240)
  };
}
async function places(parts, url, env2, fetchFn) {
  const key = env2("GOOGLE_MAPS_API_KEY");
  if (!key) return json({ error: "Address lookup is not set up" }, 503);
  const s = url.searchParams.get("s") || "";
  const sessionToken = TOKEN_RE.test(s) ? s : "";
  if (parts[1] === "suggest") {
    const input = S(url.searchParams.get("q"), 120);
    if (input.length < 3) return json({ suggestions: [] });
    const base = { input, includedRegionCodes: ["au"], regionCode: "au", languageCode: "en-AU", locationBias: BIAS };
    if (sessionToken) base.sessionToken = sessionToken;
    const call = (body) => fetchFn(PLACES + "places:autocomplete", {
      method: "POST",
      headers: { "content-type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat" },
      body: JSON.stringify(body)
    });
    let r = await call({ ...base, includedPrimaryTypes: ["street_address", "premise", "subpremise", "route"] });
    if (r.status === 400) r = await call(base);
    if (!r.ok) {
      console.error("places suggest", r.status, await r.text().catch(() => ""));
      return json({ error: "Address lookup failed" }, 502);
    }
    const d = await r.json().catch(() => ({}));
    const suggestions = (Array.isArray(d.suggestions) ? d.suggestions : []).map((x) => x && x.placePrediction).filter((p) => p && typeof p.placeId === "string" && PLACE_RE.test(p.placeId)).slice(0, 6).map((p) => ({ id: p.placeId, main: S(p.structuredFormat?.mainText?.text || p.text?.text, 200), secondary: S(p.structuredFormat?.secondaryText?.text, 200) }));
    return json({ suggestions });
  }
  if (parts[1] === "detail") {
    const id = url.searchParams.get("id") || "";
    if (!PLACE_RE.test(id)) return json({ error: "Bad address id" }, 400);
    const q = new URLSearchParams({ languageCode: "en-AU", regionCode: "au" });
    if (sessionToken) q.set("sessionToken", sessionToken);
    const r = await fetchFn(PLACES + "places/" + encodeURIComponent(id) + "?" + q, { headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "addressComponents,formattedAddress" } });
    if (!r.ok) {
      console.error("places detail", r.status, await r.text().catch(() => ""));
      return json({ error: "Address lookup failed" }, 502);
    }
    return json(addressFrom(await r.json().catch(() => ({}))));
  }
  return json({ error: "Not found" }, 404);
}
function codeOk(req, env2) {
  const given = req.headers.get("x-team-code") || "";
  if (!given) return false;
  const team = env2("TEAM_CODE");
  if (!team) return false;
  return same(sha(given), sha(team));
}
async function reminders(url, stores, env2, now) {
  const key = url.searchParams.get("key") || "";
  const want = env2("REMINDER_KEY") ? sha(env2("REMINDER_KEY")) : DEFAULT_REMINDER_HASH;
  if (!key || !same(sha(key), want)) {
    await sleep2(500);
    return text("Forbidden", 403);
  }
  const today = brisToday(now);
  const ack = url.searchParams.get("ack");
  if (ack) {
    let n = 0;
    for (const part of ack.split(",").slice(0, 50)) {
      const [id, kind] = part.split(":");
      if (!ID_RE.test(id || "") || !["d7", "d1"].includes(kind)) continue;
      const t = await stores.takeovers.get(id, { type: "json" });
      if (!t || !D(t.handoverDate)) continue;
      const r = isObj(t.reminders) && t.reminders.for === t.handoverDate ? { ...t.reminders } : { d7: "", d1: "" };
      r[kind] = today;
      if (kind === "d1" && !r.d7) r.d7 = today;
      r.for = t.handoverDate;
      t.reminders = r;
      await stores.takeovers.setJSON(id, t);
      n++;
    }
    return text(`OK acknowledged ${n}`);
  }
  const due = [];
  for (const t of await loadAll(stores.takeovers)) {
    if (t.steps?.keys?.done || !D(t.handoverDate)) continue;
    const days = daysBetween(today, t.handoverDate);
    const r = isObj(t.reminders) && t.reminders.for === t.handoverDate ? t.reminders : {};
    let kind = null;
    if (days >= 0 && days <= 1 && !r.d1) kind = "d1";
    else if (days >= 2 && days <= 7 && !r.d7) kind = "d7";
    if (kind) due.push({ t, kind, days });
  }
  const lines = [`MPG key collection reminders for ${today} (Brisbane)`, `DUE: ${due.length}`];
  for (const { t, kind, days } of due) {
    const a = t.agency || {};
    lines.push(
      "---",
      `id: ${t.id}`,
      `kind: ${kind}`,
      `days_until: ${days}`,
      `address: ${[t.street, t.suburb, t.postcode].filter(Boolean).join(", ")}`,
      `key_collection_date: ${longDate(t.handoverDate)}`,
      `time_and_place: ${t.keyNote || "not set"}`,
      `outgoing_agency: ${[a.name, a.contact, a.phone].filter(Boolean).join(" | ") || "not set"}`,
      `owners: ${(t.owners || []).map((o) => o.name).filter(Boolean).join(" & ") || "not set"}`,
      `assigned: ${t.assignee || "unassigned"}`,
      `outstanding_steps: ${STEP_KEYS.filter((k) => !t.steps?.[k]?.done).map((k) => STEP_NAMES[k]).join("; ") || "none"}`
    );
  }
  lines.push("---", "END");
  return text(lines.join("\n"));
}
async function handle(req, stores, env2 = () => "", now = /* @__PURE__ */ new Date(), fetchFn = (...a) => globalThis.fetch(...a)) {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean);
  const m = req.method;
  try {
    if (parts[0] === "health") return json({ ok: true });
    if (parts[0] === "reminders" && m === "GET") return await reminders(url, stores, env2, now);
    if (!codeOk(req, env2)) {
      await sleep2(500);
      return json({ error: "Wrong team code" }, 401);
    }
    if (parts[0] === "places" && m === "GET") return await places(parts, url, env2, fetchFn);
    let body = null;
    if (m === "POST" || m === "PATCH" || m === "PUT") {
      if (Number(req.headers.get("content-length") || 0) > 1e5) return json({ error: "Too large" }, 413);
      try {
        body = await req.json();
      } catch {
        return json({ error: "Bad JSON" }, 400);
      }
    }
    if (parts[0] === "state" && m === "GET") {
      const t = await stores.settings.get("team", { type: "json" });
      return json({ takeovers: await loadAll(stores.takeovers), team: Array.isArray(t?.members) ? t.members : DEFAULT_TEAM, today: brisToday(now) });
    }
    if (parts[0] === "takeovers") {
      const id = parts[1];
      if (!id && m === "POST") {
        const nid = randomUUID();
        const t = finalise(merge({ street: "", suburb: "", postcode: "", owners: [], agency: { name: "", contact: "", phone: "", email: "" }, assignee: "", noticeDate: "", noticeDays: 30, handoverDate: "", handoverManual: false, keyNote: "", createdAt: (/* @__PURE__ */ new Date()).toISOString() }, cleanPatch(body)));
        if (!t.street) return json({ error: "Street address is required" }, 400);
        await stores.takeovers.setJSON(nid, t);
        return json({ ...t, id: nid }, 201);
      }
      if (id && ID_RE.test(id)) {
        const cur = await stores.takeovers.get(id, { type: "json" });
        if (!cur) return json({ error: "Not found" }, 404);
        if (m === "PATCH") {
          const prev = cur.handoverDate;
          const t = finalise(merge(cur, cleanPatch(body)), prev);
          await stores.takeovers.setJSON(id, t);
          return json({ ...t, id });
        }
        if (m === "DELETE") {
          await stores.takeovers.delete(id);
          return json({ ok: true });
        }
      }
    }
    if (parts[0] === "team" && m === "PUT") {
      const members = Array.isArray(body?.members) ? [...new Set(body.members.map((x) => S(x, 60)).filter(Boolean))].slice(0, 30) : [];
      await stores.settings.setJSON("team", { members });
      return json({ members });
    }
    return json({ error: "Not found" }, 404);
  } catch (e) {
    console.error(e);
    return json({ error: "Server error" }, 500);
  }
}

// netlify/src/api.mjs
var env = (k) => globalThis.Netlify?.env?.get?.(k) ?? process.env[k] ?? "";
var api_default = async (req) => handle(req, {
  get takeovers() {
    return getStore({ name: "takeovers", consistency: "strong" });
  },
  get settings() {
    return getStore({ name: "settings", consistency: "strong" });
  }
}, env);
var config = { path: "/api/*" };
export {
  config,
  api_default as default
};
