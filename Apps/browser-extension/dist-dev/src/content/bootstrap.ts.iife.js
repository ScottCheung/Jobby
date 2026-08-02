var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
(function() {
  "use strict";
  var _a, _b;
  var util;
  (function(util2) {
    util2.assertEqual = (_) => {
    };
    function assertIs(_arg) {
    }
    util2.assertIs = assertIs;
    function assertNever(_x) {
      throw new Error();
    }
    util2.assertNever = assertNever;
    util2.arrayToEnum = (items) => {
      const obj = {};
      for (const item of items) {
        obj[item] = item;
      }
      return obj;
    };
    util2.getValidEnumValues = (obj) => {
      const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
      const filtered = {};
      for (const k of validKeys) {
        filtered[k] = obj[k];
      }
      return util2.objectValues(filtered);
    };
    util2.objectValues = (obj) => {
      return util2.objectKeys(obj).map(function(e) {
        return obj[e];
      });
    };
    util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
      const keys = [];
      for (const key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
          keys.push(key);
        }
      }
      return keys;
    };
    util2.find = (arr, checker) => {
      for (const item of arr) {
        if (checker(item))
          return item;
      }
      return void 0;
    };
    util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
    function joinValues(array, separator = " | ") {
      return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
    }
    util2.joinValues = joinValues;
    util2.jsonStringifyReplacer = (_, value) => {
      if (typeof value === "bigint") {
        return value.toString();
      }
      return value;
    };
  })(util || (util = {}));
  var objectUtil;
  (function(objectUtil2) {
    objectUtil2.mergeShapes = (first, second) => {
      return {
        ...first,
        ...second
        // second overwrites first
      };
    };
  })(objectUtil || (objectUtil = {}));
  const ZodParsedType = util.arrayToEnum([
    "string",
    "nan",
    "number",
    "integer",
    "float",
    "boolean",
    "date",
    "bigint",
    "symbol",
    "function",
    "undefined",
    "null",
    "array",
    "object",
    "unknown",
    "promise",
    "void",
    "never",
    "map",
    "set"
  ]);
  const getParsedType = (data) => {
    const t = typeof data;
    switch (t) {
      case "undefined":
        return ZodParsedType.undefined;
      case "string":
        return ZodParsedType.string;
      case "number":
        return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
      case "boolean":
        return ZodParsedType.boolean;
      case "function":
        return ZodParsedType.function;
      case "bigint":
        return ZodParsedType.bigint;
      case "symbol":
        return ZodParsedType.symbol;
      case "object":
        if (Array.isArray(data)) {
          return ZodParsedType.array;
        }
        if (data === null) {
          return ZodParsedType.null;
        }
        if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
          return ZodParsedType.promise;
        }
        if (typeof Map !== "undefined" && data instanceof Map) {
          return ZodParsedType.map;
        }
        if (typeof Set !== "undefined" && data instanceof Set) {
          return ZodParsedType.set;
        }
        if (typeof Date !== "undefined" && data instanceof Date) {
          return ZodParsedType.date;
        }
        return ZodParsedType.object;
      default:
        return ZodParsedType.unknown;
    }
  };
  const ZodIssueCode = util.arrayToEnum([
    "invalid_type",
    "invalid_literal",
    "custom",
    "invalid_union",
    "invalid_union_discriminator",
    "invalid_enum_value",
    "unrecognized_keys",
    "invalid_arguments",
    "invalid_return_type",
    "invalid_date",
    "invalid_string",
    "too_small",
    "too_big",
    "invalid_intersection_types",
    "not_multiple_of",
    "not_finite"
  ]);
  class ZodError extends Error {
    get errors() {
      return this.issues;
    }
    constructor(issues) {
      super();
      this.issues = [];
      this.addIssue = (sub) => {
        this.issues = [...this.issues, sub];
      };
      this.addIssues = (subs = []) => {
        this.issues = [...this.issues, ...subs];
      };
      const actualProto = new.target.prototype;
      if (Object.setPrototypeOf) {
        Object.setPrototypeOf(this, actualProto);
      } else {
        this.__proto__ = actualProto;
      }
      this.name = "ZodError";
      this.issues = issues;
    }
    format(_mapper) {
      const mapper = _mapper || function(issue) {
        return issue.message;
      };
      const fieldErrors = { _errors: [] };
      const processError = (error) => {
        for (const issue of error.issues) {
          if (issue.code === "invalid_union") {
            issue.unionErrors.map(processError);
          } else if (issue.code === "invalid_return_type") {
            processError(issue.returnTypeError);
          } else if (issue.code === "invalid_arguments") {
            processError(issue.argumentsError);
          } else if (issue.path.length === 0) {
            fieldErrors._errors.push(mapper(issue));
          } else {
            let curr = fieldErrors;
            let i = 0;
            while (i < issue.path.length) {
              const el = issue.path[i];
              const terminal = i === issue.path.length - 1;
              if (!terminal) {
                curr[el] = curr[el] || { _errors: [] };
              } else {
                curr[el] = curr[el] || { _errors: [] };
                curr[el]._errors.push(mapper(issue));
              }
              curr = curr[el];
              i++;
            }
          }
        }
      };
      processError(this);
      return fieldErrors;
    }
    static assert(value) {
      if (!(value instanceof ZodError)) {
        throw new Error(`Not a ZodError: ${value}`);
      }
    }
    toString() {
      return this.message;
    }
    get message() {
      return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
    }
    get isEmpty() {
      return this.issues.length === 0;
    }
    flatten(mapper = (issue) => issue.message) {
      const fieldErrors = {};
      const formErrors = [];
      for (const sub of this.issues) {
        if (sub.path.length > 0) {
          const firstEl = sub.path[0];
          fieldErrors[firstEl] = fieldErrors[firstEl] || [];
          fieldErrors[firstEl].push(mapper(sub));
        } else {
          formErrors.push(mapper(sub));
        }
      }
      return { formErrors, fieldErrors };
    }
    get formErrors() {
      return this.flatten();
    }
  }
  ZodError.create = (issues) => {
    const error = new ZodError(issues);
    return error;
  };
  const errorMap = (issue, _ctx) => {
    let message;
    switch (issue.code) {
      case ZodIssueCode.invalid_type:
        if (issue.received === ZodParsedType.undefined) {
          message = "Required";
        } else {
          message = `Expected ${issue.expected}, received ${issue.received}`;
        }
        break;
      case ZodIssueCode.invalid_literal:
        message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
        break;
      case ZodIssueCode.unrecognized_keys:
        message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
        break;
      case ZodIssueCode.invalid_union:
        message = `Invalid input`;
        break;
      case ZodIssueCode.invalid_union_discriminator:
        message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
        break;
      case ZodIssueCode.invalid_enum_value:
        message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
        break;
      case ZodIssueCode.invalid_arguments:
        message = `Invalid function arguments`;
        break;
      case ZodIssueCode.invalid_return_type:
        message = `Invalid function return type`;
        break;
      case ZodIssueCode.invalid_date:
        message = `Invalid date`;
        break;
      case ZodIssueCode.invalid_string:
        if (typeof issue.validation === "object") {
          if ("includes" in issue.validation) {
            message = `Invalid input: must include "${issue.validation.includes}"`;
            if (typeof issue.validation.position === "number") {
              message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
            }
          } else if ("startsWith" in issue.validation) {
            message = `Invalid input: must start with "${issue.validation.startsWith}"`;
          } else if ("endsWith" in issue.validation) {
            message = `Invalid input: must end with "${issue.validation.endsWith}"`;
          } else {
            util.assertNever(issue.validation);
          }
        } else if (issue.validation !== "regex") {
          message = `Invalid ${issue.validation}`;
        } else {
          message = "Invalid";
        }
        break;
      case ZodIssueCode.too_small:
        if (issue.type === "array")
          message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
        else if (issue.type === "string")
          message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
        else if (issue.type === "number")
          message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
        else if (issue.type === "bigint")
          message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
        else if (issue.type === "date")
          message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
        else
          message = "Invalid input";
        break;
      case ZodIssueCode.too_big:
        if (issue.type === "array")
          message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
        else if (issue.type === "string")
          message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
        else if (issue.type === "number")
          message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
        else if (issue.type === "bigint")
          message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
        else if (issue.type === "date")
          message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
        else
          message = "Invalid input";
        break;
      case ZodIssueCode.custom:
        message = `Invalid input`;
        break;
      case ZodIssueCode.invalid_intersection_types:
        message = `Intersection results could not be merged`;
        break;
      case ZodIssueCode.not_multiple_of:
        message = `Number must be a multiple of ${issue.multipleOf}`;
        break;
      case ZodIssueCode.not_finite:
        message = "Number must be finite";
        break;
      default:
        message = _ctx.defaultError;
        util.assertNever(issue);
    }
    return { message };
  };
  let overrideErrorMap = errorMap;
  function getErrorMap() {
    return overrideErrorMap;
  }
  const makeIssue = (params) => {
    const { data, path, errorMaps, issueData } = params;
    const fullPath = [...path, ...issueData.path || []];
    const fullIssue = {
      ...issueData,
      path: fullPath
    };
    if (issueData.message !== void 0) {
      return {
        ...issueData,
        path: fullPath,
        message: issueData.message
      };
    }
    let errorMessage = "";
    const maps = errorMaps.filter((m) => !!m).slice().reverse();
    for (const map of maps) {
      errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
    }
    return {
      ...issueData,
      path: fullPath,
      message: errorMessage
    };
  };
  function addIssueToContext(ctx, issueData) {
    const overrideMap = getErrorMap();
    const issue = makeIssue({
      issueData,
      data: ctx.data,
      path: ctx.path,
      errorMaps: [
        ctx.common.contextualErrorMap,
        // contextual error map is first priority
        ctx.schemaErrorMap,
        // then schema-bound map if available
        overrideMap,
        // then global override map
        overrideMap === errorMap ? void 0 : errorMap
        // then global default map
      ].filter((x) => !!x)
    });
    ctx.common.issues.push(issue);
  }
  class ParseStatus {
    constructor() {
      this.value = "valid";
    }
    dirty() {
      if (this.value === "valid")
        this.value = "dirty";
    }
    abort() {
      if (this.value !== "aborted")
        this.value = "aborted";
    }
    static mergeArray(status, results) {
      const arrayValue = [];
      for (const s of results) {
        if (s.status === "aborted")
          return INVALID;
        if (s.status === "dirty")
          status.dirty();
        arrayValue.push(s.value);
      }
      return { status: status.value, value: arrayValue };
    }
    static async mergeObjectAsync(status, pairs) {
      const syncPairs = [];
      for (const pair of pairs) {
        const key = await pair.key;
        const value = await pair.value;
        syncPairs.push({
          key,
          value
        });
      }
      return ParseStatus.mergeObjectSync(status, syncPairs);
    }
    static mergeObjectSync(status, pairs) {
      const finalObject = {};
      for (const pair of pairs) {
        const { key, value } = pair;
        if (key.status === "aborted")
          return INVALID;
        if (value.status === "aborted")
          return INVALID;
        if (key.status === "dirty")
          status.dirty();
        if (value.status === "dirty")
          status.dirty();
        if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
          finalObject[key.value] = value.value;
        }
      }
      return { status: status.value, value: finalObject };
    }
  }
  const INVALID = Object.freeze({
    status: "aborted"
  });
  const DIRTY = (value) => ({ status: "dirty", value });
  const OK = (value) => ({ status: "valid", value });
  const isAborted = (x) => x.status === "aborted";
  const isDirty = (x) => x.status === "dirty";
  const isValid = (x) => x.status === "valid";
  const isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
  var errorUtil;
  (function(errorUtil2) {
    errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
    errorUtil2.toString = (message) => typeof message === "string" ? message : message == null ? void 0 : message.message;
  })(errorUtil || (errorUtil = {}));
  class ParseInputLazyPath {
    constructor(parent, value, path, key) {
      this._cachedPath = [];
      this.parent = parent;
      this.data = value;
      this._path = path;
      this._key = key;
    }
    get path() {
      if (!this._cachedPath.length) {
        if (Array.isArray(this._key)) {
          this._cachedPath.push(...this._path, ...this._key);
        } else {
          this._cachedPath.push(...this._path, this._key);
        }
      }
      return this._cachedPath;
    }
  }
  const handleResult = (ctx, result2) => {
    if (isValid(result2)) {
      return { success: true, data: result2.value };
    } else {
      if (!ctx.common.issues.length) {
        throw new Error("Validation failed but no issues detected.");
      }
      return {
        success: false,
        get error() {
          if (this._error)
            return this._error;
          const error = new ZodError(ctx.common.issues);
          this._error = error;
          return this._error;
        }
      };
    }
  };
  function processCreateParams(params) {
    if (!params)
      return {};
    const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
    if (errorMap2 && (invalid_type_error || required_error)) {
      throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
    }
    if (errorMap2)
      return { errorMap: errorMap2, description };
    const customMap = (iss, ctx) => {
      const { message } = params;
      if (iss.code === "invalid_enum_value") {
        return { message: message ?? ctx.defaultError };
      }
      if (typeof ctx.data === "undefined") {
        return { message: message ?? required_error ?? ctx.defaultError };
      }
      if (iss.code !== "invalid_type")
        return { message: ctx.defaultError };
      return { message: message ?? invalid_type_error ?? ctx.defaultError };
    };
    return { errorMap: customMap, description };
  }
  class ZodType {
    get description() {
      return this._def.description;
    }
    _getType(input) {
      return getParsedType(input.data);
    }
    _getOrReturnCtx(input, ctx) {
      return ctx || {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      };
    }
    _processInputParams(input) {
      return {
        status: new ParseStatus(),
        ctx: {
          common: input.parent.common,
          data: input.data,
          parsedType: getParsedType(input.data),
          schemaErrorMap: this._def.errorMap,
          path: input.path,
          parent: input.parent
        }
      };
    }
    _parseSync(input) {
      const result2 = this._parse(input);
      if (isAsync(result2)) {
        throw new Error("Synchronous parse encountered promise.");
      }
      return result2;
    }
    _parseAsync(input) {
      const result2 = this._parse(input);
      return Promise.resolve(result2);
    }
    parse(data, params) {
      const result2 = this.safeParse(data, params);
      if (result2.success)
        return result2.data;
      throw result2.error;
    }
    safeParse(data, params) {
      const ctx = {
        common: {
          issues: [],
          async: (params == null ? void 0 : params.async) ?? false,
          contextualErrorMap: params == null ? void 0 : params.errorMap
        },
        path: (params == null ? void 0 : params.path) || [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data,
        parsedType: getParsedType(data)
      };
      const result2 = this._parseSync({ data, path: ctx.path, parent: ctx });
      return handleResult(ctx, result2);
    }
    "~validate"(data) {
      var _a2, _b2;
      const ctx = {
        common: {
          issues: [],
          async: !!this["~standard"].async
        },
        path: [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data,
        parsedType: getParsedType(data)
      };
      if (!this["~standard"].async) {
        try {
          const result2 = this._parseSync({ data, path: [], parent: ctx });
          return isValid(result2) ? {
            value: result2.value
          } : {
            issues: ctx.common.issues
          };
        } catch (err) {
          if ((_b2 = (_a2 = err == null ? void 0 : err.message) == null ? void 0 : _a2.toLowerCase()) == null ? void 0 : _b2.includes("encountered")) {
            this["~standard"].async = true;
          }
          ctx.common = {
            issues: [],
            async: true
          };
        }
      }
      return this._parseAsync({ data, path: [], parent: ctx }).then((result2) => isValid(result2) ? {
        value: result2.value
      } : {
        issues: ctx.common.issues
      });
    }
    async parseAsync(data, params) {
      const result2 = await this.safeParseAsync(data, params);
      if (result2.success)
        return result2.data;
      throw result2.error;
    }
    async safeParseAsync(data, params) {
      const ctx = {
        common: {
          issues: [],
          contextualErrorMap: params == null ? void 0 : params.errorMap,
          async: true
        },
        path: (params == null ? void 0 : params.path) || [],
        schemaErrorMap: this._def.errorMap,
        parent: null,
        data,
        parsedType: getParsedType(data)
      };
      const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
      const result2 = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
      return handleResult(ctx, result2);
    }
    refine(check, message) {
      const getIssueProperties = (val) => {
        if (typeof message === "string" || typeof message === "undefined") {
          return { message };
        } else if (typeof message === "function") {
          return message(val);
        } else {
          return message;
        }
      };
      return this._refinement((val, ctx) => {
        const result2 = check(val);
        const setError = () => ctx.addIssue({
          code: ZodIssueCode.custom,
          ...getIssueProperties(val)
        });
        if (typeof Promise !== "undefined" && result2 instanceof Promise) {
          return result2.then((data) => {
            if (!data) {
              setError();
              return false;
            } else {
              return true;
            }
          });
        }
        if (!result2) {
          setError();
          return false;
        } else {
          return true;
        }
      });
    }
    refinement(check, refinementData) {
      return this._refinement((val, ctx) => {
        if (!check(val)) {
          ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
          return false;
        } else {
          return true;
        }
      });
    }
    _refinement(refinement) {
      return new ZodEffects({
        schema: this,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect: { type: "refinement", refinement }
      });
    }
    superRefine(refinement) {
      return this._refinement(refinement);
    }
    constructor(def) {
      this.spa = this.safeParseAsync;
      this._def = def;
      this.parse = this.parse.bind(this);
      this.safeParse = this.safeParse.bind(this);
      this.parseAsync = this.parseAsync.bind(this);
      this.safeParseAsync = this.safeParseAsync.bind(this);
      this.spa = this.spa.bind(this);
      this.refine = this.refine.bind(this);
      this.refinement = this.refinement.bind(this);
      this.superRefine = this.superRefine.bind(this);
      this.optional = this.optional.bind(this);
      this.nullable = this.nullable.bind(this);
      this.nullish = this.nullish.bind(this);
      this.array = this.array.bind(this);
      this.promise = this.promise.bind(this);
      this.or = this.or.bind(this);
      this.and = this.and.bind(this);
      this.transform = this.transform.bind(this);
      this.brand = this.brand.bind(this);
      this.default = this.default.bind(this);
      this.catch = this.catch.bind(this);
      this.describe = this.describe.bind(this);
      this.pipe = this.pipe.bind(this);
      this.readonly = this.readonly.bind(this);
      this.isNullable = this.isNullable.bind(this);
      this.isOptional = this.isOptional.bind(this);
      this["~standard"] = {
        version: 1,
        vendor: "zod",
        validate: (data) => this["~validate"](data)
      };
    }
    optional() {
      return ZodOptional.create(this, this._def);
    }
    nullable() {
      return ZodNullable.create(this, this._def);
    }
    nullish() {
      return this.nullable().optional();
    }
    array() {
      return ZodArray.create(this);
    }
    promise() {
      return ZodPromise.create(this, this._def);
    }
    or(option) {
      return ZodUnion.create([this, option], this._def);
    }
    and(incoming) {
      return ZodIntersection.create(this, incoming, this._def);
    }
    transform(transform) {
      return new ZodEffects({
        ...processCreateParams(this._def),
        schema: this,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect: { type: "transform", transform }
      });
    }
    default(def) {
      const defaultValueFunc = typeof def === "function" ? def : () => def;
      return new ZodDefault({
        ...processCreateParams(this._def),
        innerType: this,
        defaultValue: defaultValueFunc,
        typeName: ZodFirstPartyTypeKind.ZodDefault
      });
    }
    brand() {
      return new ZodBranded({
        typeName: ZodFirstPartyTypeKind.ZodBranded,
        type: this,
        ...processCreateParams(this._def)
      });
    }
    catch(def) {
      const catchValueFunc = typeof def === "function" ? def : () => def;
      return new ZodCatch({
        ...processCreateParams(this._def),
        innerType: this,
        catchValue: catchValueFunc,
        typeName: ZodFirstPartyTypeKind.ZodCatch
      });
    }
    describe(description) {
      const This = this.constructor;
      return new This({
        ...this._def,
        description
      });
    }
    pipe(target) {
      return ZodPipeline.create(this, target);
    }
    readonly() {
      return ZodReadonly.create(this);
    }
    isOptional() {
      return this.safeParse(void 0).success;
    }
    isNullable() {
      return this.safeParse(null).success;
    }
  }
  const cuidRegex = /^c[^\s-]{8,}$/i;
  const cuid2Regex = /^[0-9a-z]+$/;
  const ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
  const uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
  const nanoidRegex = /^[a-z0-9_-]{21}$/i;
  const jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
  const durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
  const emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
  const _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
  let emojiRegex;
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
  const ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
  const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
  const ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
  const base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
  const base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
  const dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
  const dateRegex = new RegExp(`^${dateRegexSource}$`);
  function timeRegexSource(args) {
    let secondsRegexSource = `[0-5]\\d`;
    if (args.precision) {
      secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
    } else if (args.precision == null) {
      secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
    }
    const secondsQuantifier = args.precision ? "+" : "?";
    return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
  }
  function timeRegex(args) {
    return new RegExp(`^${timeRegexSource(args)}$`);
  }
  function datetimeRegex(args) {
    let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
    const opts = [];
    opts.push(args.local ? `Z?` : `Z`);
    if (args.offset)
      opts.push(`([+-]\\d{2}:?\\d{2})`);
    regex = `${regex}(${opts.join("|")})`;
    return new RegExp(`^${regex}$`);
  }
  function isValidIP(ip, version) {
    if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
      return true;
    }
    if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
      return true;
    }
    return false;
  }
  function isValidJWT(jwt, alg) {
    if (!jwtRegex.test(jwt))
      return false;
    try {
      const [header] = jwt.split(".");
      if (!header)
        return false;
      const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
      const decoded = JSON.parse(atob(base64));
      if (typeof decoded !== "object" || decoded === null)
        return false;
      if ("typ" in decoded && (decoded == null ? void 0 : decoded.typ) !== "JWT")
        return false;
      if (!decoded.alg)
        return false;
      if (alg && decoded.alg !== alg)
        return false;
      return true;
    } catch {
      return false;
    }
  }
  function isValidCidr(ip, version) {
    if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
      return true;
    }
    if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
      return true;
    }
    return false;
  }
  class ZodString extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = String(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.string) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.string,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      const status = new ParseStatus();
      let ctx = void 0;
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          if (input.data.length < check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          if (input.data.length > check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "length") {
          const tooBig = input.data.length > check.value;
          const tooSmall = input.data.length < check.value;
          if (tooBig || tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            if (tooBig) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: check.value,
                type: "string",
                inclusive: true,
                exact: true,
                message: check.message
              });
            } else if (tooSmall) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: check.value,
                type: "string",
                inclusive: true,
                exact: true,
                message: check.message
              });
            }
            status.dirty();
          }
        } else if (check.kind === "email") {
          if (!emailRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "email",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "emoji") {
          if (!emojiRegex) {
            emojiRegex = new RegExp(_emojiRegex, "u");
          }
          if (!emojiRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "emoji",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "uuid") {
          if (!uuidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "uuid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "nanoid") {
          if (!nanoidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "nanoid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cuid") {
          if (!cuidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cuid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cuid2") {
          if (!cuid2Regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cuid2",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "ulid") {
          if (!ulidRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "ulid",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "url") {
          try {
            new URL(input.data);
          } catch {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "url",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "regex") {
          check.regex.lastIndex = 0;
          const testResult = check.regex.test(input.data);
          if (!testResult) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "regex",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "trim") {
          input.data = input.data.trim();
        } else if (check.kind === "includes") {
          if (!input.data.includes(check.value, check.position)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { includes: check.value, position: check.position },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "toLowerCase") {
          input.data = input.data.toLowerCase();
        } else if (check.kind === "toUpperCase") {
          input.data = input.data.toUpperCase();
        } else if (check.kind === "startsWith") {
          if (!input.data.startsWith(check.value)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { startsWith: check.value },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "endsWith") {
          if (!input.data.endsWith(check.value)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: { endsWith: check.value },
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "datetime") {
          const regex = datetimeRegex(check);
          if (!regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: "datetime",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "date") {
          const regex = dateRegex;
          if (!regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: "date",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "time") {
          const regex = timeRegex(check);
          if (!regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_string,
              validation: "time",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "duration") {
          if (!durationRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "duration",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "ip") {
          if (!isValidIP(input.data, check.version)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "ip",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "jwt") {
          if (!isValidJWT(input.data, check.alg)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "jwt",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "cidr") {
          if (!isValidCidr(input.data, check.version)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "cidr",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "base64") {
          if (!base64Regex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "base64",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "base64url") {
          if (!base64urlRegex.test(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              validation: "base64url",
              code: ZodIssueCode.invalid_string,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    _regex(regex, validation, message) {
      return this.refinement((data) => regex.test(data), {
        validation,
        code: ZodIssueCode.invalid_string,
        ...errorUtil.errToObj(message)
      });
    }
    _addCheck(check) {
      return new ZodString({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    email(message) {
      return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
    }
    url(message) {
      return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
    }
    emoji(message) {
      return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
    }
    uuid(message) {
      return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
    }
    nanoid(message) {
      return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
    }
    cuid(message) {
      return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
    }
    cuid2(message) {
      return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
    }
    ulid(message) {
      return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
    }
    base64(message) {
      return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
    }
    base64url(message) {
      return this._addCheck({
        kind: "base64url",
        ...errorUtil.errToObj(message)
      });
    }
    jwt(options) {
      return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
    }
    ip(options) {
      return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
    }
    cidr(options) {
      return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
    }
    datetime(options) {
      if (typeof options === "string") {
        return this._addCheck({
          kind: "datetime",
          precision: null,
          offset: false,
          local: false,
          message: options
        });
      }
      return this._addCheck({
        kind: "datetime",
        precision: typeof (options == null ? void 0 : options.precision) === "undefined" ? null : options == null ? void 0 : options.precision,
        offset: (options == null ? void 0 : options.offset) ?? false,
        local: (options == null ? void 0 : options.local) ?? false,
        ...errorUtil.errToObj(options == null ? void 0 : options.message)
      });
    }
    date(message) {
      return this._addCheck({ kind: "date", message });
    }
    time(options) {
      if (typeof options === "string") {
        return this._addCheck({
          kind: "time",
          precision: null,
          message: options
        });
      }
      return this._addCheck({
        kind: "time",
        precision: typeof (options == null ? void 0 : options.precision) === "undefined" ? null : options == null ? void 0 : options.precision,
        ...errorUtil.errToObj(options == null ? void 0 : options.message)
      });
    }
    duration(message) {
      return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
    }
    regex(regex, message) {
      return this._addCheck({
        kind: "regex",
        regex,
        ...errorUtil.errToObj(message)
      });
    }
    includes(value, options) {
      return this._addCheck({
        kind: "includes",
        value,
        position: options == null ? void 0 : options.position,
        ...errorUtil.errToObj(options == null ? void 0 : options.message)
      });
    }
    startsWith(value, message) {
      return this._addCheck({
        kind: "startsWith",
        value,
        ...errorUtil.errToObj(message)
      });
    }
    endsWith(value, message) {
      return this._addCheck({
        kind: "endsWith",
        value,
        ...errorUtil.errToObj(message)
      });
    }
    min(minLength, message) {
      return this._addCheck({
        kind: "min",
        value: minLength,
        ...errorUtil.errToObj(message)
      });
    }
    max(maxLength, message) {
      return this._addCheck({
        kind: "max",
        value: maxLength,
        ...errorUtil.errToObj(message)
      });
    }
    length(len, message) {
      return this._addCheck({
        kind: "length",
        value: len,
        ...errorUtil.errToObj(message)
      });
    }
    /**
     * Equivalent to `.min(1)`
     */
    nonempty(message) {
      return this.min(1, errorUtil.errToObj(message));
    }
    trim() {
      return new ZodString({
        ...this._def,
        checks: [...this._def.checks, { kind: "trim" }]
      });
    }
    toLowerCase() {
      return new ZodString({
        ...this._def,
        checks: [...this._def.checks, { kind: "toLowerCase" }]
      });
    }
    toUpperCase() {
      return new ZodString({
        ...this._def,
        checks: [...this._def.checks, { kind: "toUpperCase" }]
      });
    }
    get isDatetime() {
      return !!this._def.checks.find((ch) => ch.kind === "datetime");
    }
    get isDate() {
      return !!this._def.checks.find((ch) => ch.kind === "date");
    }
    get isTime() {
      return !!this._def.checks.find((ch) => ch.kind === "time");
    }
    get isDuration() {
      return !!this._def.checks.find((ch) => ch.kind === "duration");
    }
    get isEmail() {
      return !!this._def.checks.find((ch) => ch.kind === "email");
    }
    get isURL() {
      return !!this._def.checks.find((ch) => ch.kind === "url");
    }
    get isEmoji() {
      return !!this._def.checks.find((ch) => ch.kind === "emoji");
    }
    get isUUID() {
      return !!this._def.checks.find((ch) => ch.kind === "uuid");
    }
    get isNANOID() {
      return !!this._def.checks.find((ch) => ch.kind === "nanoid");
    }
    get isCUID() {
      return !!this._def.checks.find((ch) => ch.kind === "cuid");
    }
    get isCUID2() {
      return !!this._def.checks.find((ch) => ch.kind === "cuid2");
    }
    get isULID() {
      return !!this._def.checks.find((ch) => ch.kind === "ulid");
    }
    get isIP() {
      return !!this._def.checks.find((ch) => ch.kind === "ip");
    }
    get isCIDR() {
      return !!this._def.checks.find((ch) => ch.kind === "cidr");
    }
    get isBase64() {
      return !!this._def.checks.find((ch) => ch.kind === "base64");
    }
    get isBase64url() {
      return !!this._def.checks.find((ch) => ch.kind === "base64url");
    }
    get minLength() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxLength() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
  }
  ZodString.create = (params) => {
    return new ZodString({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodString,
      coerce: (params == null ? void 0 : params.coerce) ?? false,
      ...processCreateParams(params)
    });
  };
  function floatSafeRemainder(val, step) {
    const valDecCount = (val.toString().split(".")[1] || "").length;
    const stepDecCount = (step.toString().split(".")[1] || "").length;
    const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
    const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
    const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
    return valInt % stepInt / 10 ** decCount;
  }
  class ZodNumber extends ZodType {
    constructor() {
      super(...arguments);
      this.min = this.gte;
      this.max = this.lte;
      this.step = this.multipleOf;
    }
    _parse(input) {
      if (this._def.coerce) {
        input.data = Number(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.number) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.number,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      let ctx = void 0;
      const status = new ParseStatus();
      for (const check of this._def.checks) {
        if (check.kind === "int") {
          if (!util.isInteger(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_type,
              expected: "integer",
              received: "float",
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "min") {
          const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
          if (tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "number",
              inclusive: check.inclusive,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
          if (tooBig) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "number",
              inclusive: check.inclusive,
              exact: false,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "multipleOf") {
          if (floatSafeRemainder(input.data, check.value) !== 0) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_multiple_of,
              multipleOf: check.value,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "finite") {
          if (!Number.isFinite(input.data)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_finite,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    gte(value, message) {
      return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
      return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
      return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
      return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
      return new ZodNumber({
        ...this._def,
        checks: [
          ...this._def.checks,
          {
            kind,
            value,
            inclusive,
            message: errorUtil.toString(message)
          }
        ]
      });
    }
    _addCheck(check) {
      return new ZodNumber({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    int(message) {
      return this._addCheck({
        kind: "int",
        message: errorUtil.toString(message)
      });
    }
    positive(message) {
      return this._addCheck({
        kind: "min",
        value: 0,
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    negative(message) {
      return this._addCheck({
        kind: "max",
        value: 0,
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    nonpositive(message) {
      return this._addCheck({
        kind: "max",
        value: 0,
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    nonnegative(message) {
      return this._addCheck({
        kind: "min",
        value: 0,
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    multipleOf(value, message) {
      return this._addCheck({
        kind: "multipleOf",
        value,
        message: errorUtil.toString(message)
      });
    }
    finite(message) {
      return this._addCheck({
        kind: "finite",
        message: errorUtil.toString(message)
      });
    }
    safe(message) {
      return this._addCheck({
        kind: "min",
        inclusive: true,
        value: Number.MIN_SAFE_INTEGER,
        message: errorUtil.toString(message)
      })._addCheck({
        kind: "max",
        inclusive: true,
        value: Number.MAX_SAFE_INTEGER,
        message: errorUtil.toString(message)
      });
    }
    get minValue() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxValue() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
    get isInt() {
      return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
    }
    get isFinite() {
      let max = null;
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
          return true;
        } else if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        } else if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return Number.isFinite(min) && Number.isFinite(max);
    }
  }
  ZodNumber.create = (params) => {
    return new ZodNumber({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodNumber,
      coerce: (params == null ? void 0 : params.coerce) || false,
      ...processCreateParams(params)
    });
  };
  class ZodBigInt extends ZodType {
    constructor() {
      super(...arguments);
      this.min = this.gte;
      this.max = this.lte;
    }
    _parse(input) {
      if (this._def.coerce) {
        try {
          input.data = BigInt(input.data);
        } catch {
          return this._getInvalidInput(input);
        }
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.bigint) {
        return this._getInvalidInput(input);
      }
      let ctx = void 0;
      const status = new ParseStatus();
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
          if (tooSmall) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              type: "bigint",
              minimum: check.value,
              inclusive: check.inclusive,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
          if (tooBig) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              type: "bigint",
              maximum: check.value,
              inclusive: check.inclusive,
              message: check.message
            });
            status.dirty();
          }
        } else if (check.kind === "multipleOf") {
          if (input.data % check.value !== BigInt(0)) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.not_multiple_of,
              multipleOf: check.value,
              message: check.message
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return { status: status.value, value: input.data };
    }
    _getInvalidInput(input) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.bigint,
        received: ctx.parsedType
      });
      return INVALID;
    }
    gte(value, message) {
      return this.setLimit("min", value, true, errorUtil.toString(message));
    }
    gt(value, message) {
      return this.setLimit("min", value, false, errorUtil.toString(message));
    }
    lte(value, message) {
      return this.setLimit("max", value, true, errorUtil.toString(message));
    }
    lt(value, message) {
      return this.setLimit("max", value, false, errorUtil.toString(message));
    }
    setLimit(kind, value, inclusive, message) {
      return new ZodBigInt({
        ...this._def,
        checks: [
          ...this._def.checks,
          {
            kind,
            value,
            inclusive,
            message: errorUtil.toString(message)
          }
        ]
      });
    }
    _addCheck(check) {
      return new ZodBigInt({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    positive(message) {
      return this._addCheck({
        kind: "min",
        value: BigInt(0),
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    negative(message) {
      return this._addCheck({
        kind: "max",
        value: BigInt(0),
        inclusive: false,
        message: errorUtil.toString(message)
      });
    }
    nonpositive(message) {
      return this._addCheck({
        kind: "max",
        value: BigInt(0),
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    nonnegative(message) {
      return this._addCheck({
        kind: "min",
        value: BigInt(0),
        inclusive: true,
        message: errorUtil.toString(message)
      });
    }
    multipleOf(value, message) {
      return this._addCheck({
        kind: "multipleOf",
        value,
        message: errorUtil.toString(message)
      });
    }
    get minValue() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min;
    }
    get maxValue() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max;
    }
  }
  ZodBigInt.create = (params) => {
    return new ZodBigInt({
      checks: [],
      typeName: ZodFirstPartyTypeKind.ZodBigInt,
      coerce: (params == null ? void 0 : params.coerce) ?? false,
      ...processCreateParams(params)
    });
  };
  class ZodBoolean extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = Boolean(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.boolean) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.boolean,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  }
  ZodBoolean.create = (params) => {
    return new ZodBoolean({
      typeName: ZodFirstPartyTypeKind.ZodBoolean,
      coerce: (params == null ? void 0 : params.coerce) || false,
      ...processCreateParams(params)
    });
  };
  class ZodDate extends ZodType {
    _parse(input) {
      if (this._def.coerce) {
        input.data = new Date(input.data);
      }
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.date) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.date,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      if (Number.isNaN(input.data.getTime())) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_date
        });
        return INVALID;
      }
      const status = new ParseStatus();
      let ctx = void 0;
      for (const check of this._def.checks) {
        if (check.kind === "min") {
          if (input.data.getTime() < check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              message: check.message,
              inclusive: true,
              exact: false,
              minimum: check.value,
              type: "date"
            });
            status.dirty();
          }
        } else if (check.kind === "max") {
          if (input.data.getTime() > check.value) {
            ctx = this._getOrReturnCtx(input, ctx);
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              message: check.message,
              inclusive: true,
              exact: false,
              maximum: check.value,
              type: "date"
            });
            status.dirty();
          }
        } else {
          util.assertNever(check);
        }
      }
      return {
        status: status.value,
        value: new Date(input.data.getTime())
      };
    }
    _addCheck(check) {
      return new ZodDate({
        ...this._def,
        checks: [...this._def.checks, check]
      });
    }
    min(minDate, message) {
      return this._addCheck({
        kind: "min",
        value: minDate.getTime(),
        message: errorUtil.toString(message)
      });
    }
    max(maxDate, message) {
      return this._addCheck({
        kind: "max",
        value: maxDate.getTime(),
        message: errorUtil.toString(message)
      });
    }
    get minDate() {
      let min = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "min") {
          if (min === null || ch.value > min)
            min = ch.value;
        }
      }
      return min != null ? new Date(min) : null;
    }
    get maxDate() {
      let max = null;
      for (const ch of this._def.checks) {
        if (ch.kind === "max") {
          if (max === null || ch.value < max)
            max = ch.value;
        }
      }
      return max != null ? new Date(max) : null;
    }
  }
  ZodDate.create = (params) => {
    return new ZodDate({
      checks: [],
      coerce: (params == null ? void 0 : params.coerce) || false,
      typeName: ZodFirstPartyTypeKind.ZodDate,
      ...processCreateParams(params)
    });
  };
  class ZodSymbol extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.symbol) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.symbol,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  }
  ZodSymbol.create = (params) => {
    return new ZodSymbol({
      typeName: ZodFirstPartyTypeKind.ZodSymbol,
      ...processCreateParams(params)
    });
  };
  class ZodUndefined extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.undefined) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.undefined,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  }
  ZodUndefined.create = (params) => {
    return new ZodUndefined({
      typeName: ZodFirstPartyTypeKind.ZodUndefined,
      ...processCreateParams(params)
    });
  };
  class ZodNull extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.null) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.null,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  }
  ZodNull.create = (params) => {
    return new ZodNull({
      typeName: ZodFirstPartyTypeKind.ZodNull,
      ...processCreateParams(params)
    });
  };
  class ZodAny extends ZodType {
    constructor() {
      super(...arguments);
      this._any = true;
    }
    _parse(input) {
      return OK(input.data);
    }
  }
  ZodAny.create = (params) => {
    return new ZodAny({
      typeName: ZodFirstPartyTypeKind.ZodAny,
      ...processCreateParams(params)
    });
  };
  class ZodUnknown extends ZodType {
    constructor() {
      super(...arguments);
      this._unknown = true;
    }
    _parse(input) {
      return OK(input.data);
    }
  }
  ZodUnknown.create = (params) => {
    return new ZodUnknown({
      typeName: ZodFirstPartyTypeKind.ZodUnknown,
      ...processCreateParams(params)
    });
  };
  class ZodNever extends ZodType {
    _parse(input) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.never,
        received: ctx.parsedType
      });
      return INVALID;
    }
  }
  ZodNever.create = (params) => {
    return new ZodNever({
      typeName: ZodFirstPartyTypeKind.ZodNever,
      ...processCreateParams(params)
    });
  };
  class ZodVoid extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.undefined) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.void,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return OK(input.data);
    }
  }
  ZodVoid.create = (params) => {
    return new ZodVoid({
      typeName: ZodFirstPartyTypeKind.ZodVoid,
      ...processCreateParams(params)
    });
  };
  class ZodArray extends ZodType {
    _parse(input) {
      const { ctx, status } = this._processInputParams(input);
      const def = this._def;
      if (ctx.parsedType !== ZodParsedType.array) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.array,
          received: ctx.parsedType
        });
        return INVALID;
      }
      if (def.exactLength !== null) {
        const tooBig = ctx.data.length > def.exactLength.value;
        const tooSmall = ctx.data.length < def.exactLength.value;
        if (tooBig || tooSmall) {
          addIssueToContext(ctx, {
            code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
            minimum: tooSmall ? def.exactLength.value : void 0,
            maximum: tooBig ? def.exactLength.value : void 0,
            type: "array",
            inclusive: true,
            exact: true,
            message: def.exactLength.message
          });
          status.dirty();
        }
      }
      if (def.minLength !== null) {
        if (ctx.data.length < def.minLength.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: def.minLength.value,
            type: "array",
            inclusive: true,
            exact: false,
            message: def.minLength.message
          });
          status.dirty();
        }
      }
      if (def.maxLength !== null) {
        if (ctx.data.length > def.maxLength.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: def.maxLength.value,
            type: "array",
            inclusive: true,
            exact: false,
            message: def.maxLength.message
          });
          status.dirty();
        }
      }
      if (ctx.common.async) {
        return Promise.all([...ctx.data].map((item, i) => {
          return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
        })).then((result3) => {
          return ParseStatus.mergeArray(status, result3);
        });
      }
      const result2 = [...ctx.data].map((item, i) => {
        return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      });
      return ParseStatus.mergeArray(status, result2);
    }
    get element() {
      return this._def.type;
    }
    min(minLength, message) {
      return new ZodArray({
        ...this._def,
        minLength: { value: minLength, message: errorUtil.toString(message) }
      });
    }
    max(maxLength, message) {
      return new ZodArray({
        ...this._def,
        maxLength: { value: maxLength, message: errorUtil.toString(message) }
      });
    }
    length(len, message) {
      return new ZodArray({
        ...this._def,
        exactLength: { value: len, message: errorUtil.toString(message) }
      });
    }
    nonempty(message) {
      return this.min(1, message);
    }
  }
  ZodArray.create = (schema, params) => {
    return new ZodArray({
      type: schema,
      minLength: null,
      maxLength: null,
      exactLength: null,
      typeName: ZodFirstPartyTypeKind.ZodArray,
      ...processCreateParams(params)
    });
  };
  function deepPartialify(schema) {
    if (schema instanceof ZodObject) {
      const newShape = {};
      for (const key in schema.shape) {
        const fieldSchema = schema.shape[key];
        newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
      }
      return new ZodObject({
        ...schema._def,
        shape: () => newShape
      });
    } else if (schema instanceof ZodArray) {
      return new ZodArray({
        ...schema._def,
        type: deepPartialify(schema.element)
      });
    } else if (schema instanceof ZodOptional) {
      return ZodOptional.create(deepPartialify(schema.unwrap()));
    } else if (schema instanceof ZodNullable) {
      return ZodNullable.create(deepPartialify(schema.unwrap()));
    } else if (schema instanceof ZodTuple) {
      return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
    } else {
      return schema;
    }
  }
  class ZodObject extends ZodType {
    constructor() {
      super(...arguments);
      this._cached = null;
      this.nonstrict = this.passthrough;
      this.augment = this.extend;
    }
    _getCached() {
      if (this._cached !== null)
        return this._cached;
      const shape = this._def.shape();
      const keys = util.objectKeys(shape);
      this._cached = { shape, keys };
      return this._cached;
    }
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.object) {
        const ctx2 = this._getOrReturnCtx(input);
        addIssueToContext(ctx2, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx2.parsedType
        });
        return INVALID;
      }
      const { status, ctx } = this._processInputParams(input);
      const { shape, keys: shapeKeys } = this._getCached();
      const extraKeys = [];
      if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
        for (const key in ctx.data) {
          if (!shapeKeys.includes(key)) {
            extraKeys.push(key);
          }
        }
      }
      const pairs = [];
      for (const key of shapeKeys) {
        const keyValidator = shape[key];
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
          alwaysSet: key in ctx.data
        });
      }
      if (this._def.catchall instanceof ZodNever) {
        const unknownKeys = this._def.unknownKeys;
        if (unknownKeys === "passthrough") {
          for (const key of extraKeys) {
            pairs.push({
              key: { status: "valid", value: key },
              value: { status: "valid", value: ctx.data[key] }
            });
          }
        } else if (unknownKeys === "strict") {
          if (extraKeys.length > 0) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.unrecognized_keys,
              keys: extraKeys
            });
            status.dirty();
          }
        } else if (unknownKeys === "strip") ;
        else {
          throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
        }
      } else {
        const catchall = this._def.catchall;
        for (const key of extraKeys) {
          const value = ctx.data[key];
          pairs.push({
            key: { status: "valid", value: key },
            value: catchall._parse(
              new ParseInputLazyPath(ctx, value, ctx.path, key)
              //, ctx.child(key), value, getParsedType(value)
            ),
            alwaysSet: key in ctx.data
          });
        }
      }
      if (ctx.common.async) {
        return Promise.resolve().then(async () => {
          const syncPairs = [];
          for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            syncPairs.push({
              key,
              value,
              alwaysSet: pair.alwaysSet
            });
          }
          return syncPairs;
        }).then((syncPairs) => {
          return ParseStatus.mergeObjectSync(status, syncPairs);
        });
      } else {
        return ParseStatus.mergeObjectSync(status, pairs);
      }
    }
    get shape() {
      return this._def.shape();
    }
    strict(message) {
      errorUtil.errToObj;
      return new ZodObject({
        ...this._def,
        unknownKeys: "strict",
        ...message !== void 0 ? {
          errorMap: (issue, ctx) => {
            var _a2, _b2;
            const defaultError = ((_b2 = (_a2 = this._def).errorMap) == null ? void 0 : _b2.call(_a2, issue, ctx).message) ?? ctx.defaultError;
            if (issue.code === "unrecognized_keys")
              return {
                message: errorUtil.errToObj(message).message ?? defaultError
              };
            return {
              message: defaultError
            };
          }
        } : {}
      });
    }
    strip() {
      return new ZodObject({
        ...this._def,
        unknownKeys: "strip"
      });
    }
    passthrough() {
      return new ZodObject({
        ...this._def,
        unknownKeys: "passthrough"
      });
    }
    // const AugmentFactory =
    //   <Def extends ZodObjectDef>(def: Def) =>
    //   <Augmentation extends ZodRawShape>(
    //     augmentation: Augmentation
    //   ): ZodObject<
    //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
    //     Def["unknownKeys"],
    //     Def["catchall"]
    //   > => {
    //     return new ZodObject({
    //       ...def,
    //       shape: () => ({
    //         ...def.shape(),
    //         ...augmentation,
    //       }),
    //     }) as any;
    //   };
    extend(augmentation) {
      return new ZodObject({
        ...this._def,
        shape: () => ({
          ...this._def.shape(),
          ...augmentation
        })
      });
    }
    /**
     * Prior to zod@1.0.12 there was a bug in the
     * inferred type of merged objects. Please
     * upgrade if you are experiencing issues.
     */
    merge(merging) {
      const merged = new ZodObject({
        unknownKeys: merging._def.unknownKeys,
        catchall: merging._def.catchall,
        shape: () => ({
          ...this._def.shape(),
          ...merging._def.shape()
        }),
        typeName: ZodFirstPartyTypeKind.ZodObject
      });
      return merged;
    }
    // merge<
    //   Incoming extends AnyZodObject,
    //   Augmentation extends Incoming["shape"],
    //   NewOutput extends {
    //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
    //       ? Augmentation[k]["_output"]
    //       : k extends keyof Output
    //       ? Output[k]
    //       : never;
    //   },
    //   NewInput extends {
    //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
    //       ? Augmentation[k]["_input"]
    //       : k extends keyof Input
    //       ? Input[k]
    //       : never;
    //   }
    // >(
    //   merging: Incoming
    // ): ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"],
    //   NewOutput,
    //   NewInput
    // > {
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    setKey(key, schema) {
      return this.augment({ [key]: schema });
    }
    // merge<Incoming extends AnyZodObject>(
    //   merging: Incoming
    // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
    // ZodObject<
    //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
    //   Incoming["_def"]["unknownKeys"],
    //   Incoming["_def"]["catchall"]
    // > {
    //   // const mergedShape = objectUtil.mergeShapes(
    //   //   this._def.shape(),
    //   //   merging._def.shape()
    //   // );
    //   const merged: any = new ZodObject({
    //     unknownKeys: merging._def.unknownKeys,
    //     catchall: merging._def.catchall,
    //     shape: () =>
    //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
    //     typeName: ZodFirstPartyTypeKind.ZodObject,
    //   }) as any;
    //   return merged;
    // }
    catchall(index) {
      return new ZodObject({
        ...this._def,
        catchall: index
      });
    }
    pick(mask) {
      const shape = {};
      for (const key of util.objectKeys(mask)) {
        if (mask[key] && this.shape[key]) {
          shape[key] = this.shape[key];
        }
      }
      return new ZodObject({
        ...this._def,
        shape: () => shape
      });
    }
    omit(mask) {
      const shape = {};
      for (const key of util.objectKeys(this.shape)) {
        if (!mask[key]) {
          shape[key] = this.shape[key];
        }
      }
      return new ZodObject({
        ...this._def,
        shape: () => shape
      });
    }
    /**
     * @deprecated
     */
    deepPartial() {
      return deepPartialify(this);
    }
    partial(mask) {
      const newShape = {};
      for (const key of util.objectKeys(this.shape)) {
        const fieldSchema = this.shape[key];
        if (mask && !mask[key]) {
          newShape[key] = fieldSchema;
        } else {
          newShape[key] = fieldSchema.optional();
        }
      }
      return new ZodObject({
        ...this._def,
        shape: () => newShape
      });
    }
    required(mask) {
      const newShape = {};
      for (const key of util.objectKeys(this.shape)) {
        if (mask && !mask[key]) {
          newShape[key] = this.shape[key];
        } else {
          const fieldSchema = this.shape[key];
          let newField = fieldSchema;
          while (newField instanceof ZodOptional) {
            newField = newField._def.innerType;
          }
          newShape[key] = newField;
        }
      }
      return new ZodObject({
        ...this._def,
        shape: () => newShape
      });
    }
    keyof() {
      return createZodEnum(util.objectKeys(this.shape));
    }
  }
  ZodObject.create = (shape, params) => {
    return new ZodObject({
      shape: () => shape,
      unknownKeys: "strip",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  ZodObject.strictCreate = (shape, params) => {
    return new ZodObject({
      shape: () => shape,
      unknownKeys: "strict",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  ZodObject.lazycreate = (shape, params) => {
    return new ZodObject({
      shape,
      unknownKeys: "strip",
      catchall: ZodNever.create(),
      typeName: ZodFirstPartyTypeKind.ZodObject,
      ...processCreateParams(params)
    });
  };
  class ZodUnion extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const options = this._def.options;
      function handleResults(results) {
        for (const result2 of results) {
          if (result2.result.status === "valid") {
            return result2.result;
          }
        }
        for (const result2 of results) {
          if (result2.result.status === "dirty") {
            ctx.common.issues.push(...result2.ctx.common.issues);
            return result2.result;
          }
        }
        const unionErrors = results.map((result2) => new ZodError(result2.ctx.common.issues));
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union,
          unionErrors
        });
        return INVALID;
      }
      if (ctx.common.async) {
        return Promise.all(options.map(async (option) => {
          const childCtx = {
            ...ctx,
            common: {
              ...ctx.common,
              issues: []
            },
            parent: null
          };
          return {
            result: await option._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: childCtx
            }),
            ctx: childCtx
          };
        })).then(handleResults);
      } else {
        let dirty = void 0;
        const issues = [];
        for (const option of options) {
          const childCtx = {
            ...ctx,
            common: {
              ...ctx.common,
              issues: []
            },
            parent: null
          };
          const result2 = option._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          });
          if (result2.status === "valid") {
            return result2;
          } else if (result2.status === "dirty" && !dirty) {
            dirty = { result: result2, ctx: childCtx };
          }
          if (childCtx.common.issues.length) {
            issues.push(childCtx.common.issues);
          }
        }
        if (dirty) {
          ctx.common.issues.push(...dirty.ctx.common.issues);
          return dirty.result;
        }
        const unionErrors = issues.map((issues2) => new ZodError(issues2));
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union,
          unionErrors
        });
        return INVALID;
      }
    }
    get options() {
      return this._def.options;
    }
  }
  ZodUnion.create = (types, params) => {
    return new ZodUnion({
      options: types,
      typeName: ZodFirstPartyTypeKind.ZodUnion,
      ...processCreateParams(params)
    });
  };
  const getDiscriminator = (type) => {
    if (type instanceof ZodLazy) {
      return getDiscriminator(type.schema);
    } else if (type instanceof ZodEffects) {
      return getDiscriminator(type.innerType());
    } else if (type instanceof ZodLiteral) {
      return [type.value];
    } else if (type instanceof ZodEnum) {
      return type.options;
    } else if (type instanceof ZodNativeEnum) {
      return util.objectValues(type.enum);
    } else if (type instanceof ZodDefault) {
      return getDiscriminator(type._def.innerType);
    } else if (type instanceof ZodUndefined) {
      return [void 0];
    } else if (type instanceof ZodNull) {
      return [null];
    } else if (type instanceof ZodOptional) {
      return [void 0, ...getDiscriminator(type.unwrap())];
    } else if (type instanceof ZodNullable) {
      return [null, ...getDiscriminator(type.unwrap())];
    } else if (type instanceof ZodBranded) {
      return getDiscriminator(type.unwrap());
    } else if (type instanceof ZodReadonly) {
      return getDiscriminator(type.unwrap());
    } else if (type instanceof ZodCatch) {
      return getDiscriminator(type._def.innerType);
    } else {
      return [];
    }
  };
  class ZodDiscriminatedUnion extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.object) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.object,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const discriminator = this.discriminator;
      const discriminatorValue = ctx.data[discriminator];
      const option = this.optionsMap.get(discriminatorValue);
      if (!option) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_union_discriminator,
          options: Array.from(this.optionsMap.keys()),
          path: [discriminator]
        });
        return INVALID;
      }
      if (ctx.common.async) {
        return option._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
      } else {
        return option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
      }
    }
    get discriminator() {
      return this._def.discriminator;
    }
    get options() {
      return this._def.options;
    }
    get optionsMap() {
      return this._def.optionsMap;
    }
    /**
     * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
     * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
     * have a different value for each object in the union.
     * @param discriminator the name of the discriminator property
     * @param types an array of object schemas
     * @param params
     */
    static create(discriminator, options, params) {
      const optionsMap = /* @__PURE__ */ new Map();
      for (const type of options) {
        const discriminatorValues = getDiscriminator(type.shape[discriminator]);
        if (!discriminatorValues.length) {
          throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
        }
        for (const value of discriminatorValues) {
          if (optionsMap.has(value)) {
            throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
          }
          optionsMap.set(value, type);
        }
      }
      return new ZodDiscriminatedUnion({
        typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
        discriminator,
        options,
        optionsMap,
        ...processCreateParams(params)
      });
    }
  }
  function mergeValues(a, b) {
    const aType = getParsedType(a);
    const bType = getParsedType(b);
    if (a === b) {
      return { valid: true, data: a };
    } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
      const bKeys = util.objectKeys(b);
      const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
      const newObj = { ...a, ...b };
      for (const key of sharedKeys) {
        const sharedValue = mergeValues(a[key], b[key]);
        if (!sharedValue.valid) {
          return { valid: false };
        }
        newObj[key] = sharedValue.data;
      }
      return { valid: true, data: newObj };
    } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
      if (a.length !== b.length) {
        return { valid: false };
      }
      const newArray = [];
      for (let index = 0; index < a.length; index++) {
        const itemA = a[index];
        const itemB = b[index];
        const sharedValue = mergeValues(itemA, itemB);
        if (!sharedValue.valid) {
          return { valid: false };
        }
        newArray.push(sharedValue.data);
      }
      return { valid: true, data: newArray };
    } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
      return { valid: true, data: a };
    } else {
      return { valid: false };
    }
  }
  class ZodIntersection extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      const handleParsed = (parsedLeft, parsedRight) => {
        if (isAborted(parsedLeft) || isAborted(parsedRight)) {
          return INVALID;
        }
        const merged = mergeValues(parsedLeft.value, parsedRight.value);
        if (!merged.valid) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_intersection_types
          });
          return INVALID;
        }
        if (isDirty(parsedLeft) || isDirty(parsedRight)) {
          status.dirty();
        }
        return { status: status.value, value: merged.data };
      };
      if (ctx.common.async) {
        return Promise.all([
          this._def.left._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }),
          this._def.right._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          })
        ]).then(([left, right]) => handleParsed(left, right));
      } else {
        return handleParsed(this._def.left._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }), this._def.right._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }));
      }
    }
  }
  ZodIntersection.create = (left, right, params) => {
    return new ZodIntersection({
      left,
      right,
      typeName: ZodFirstPartyTypeKind.ZodIntersection,
      ...processCreateParams(params)
    });
  };
  class ZodTuple extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.array) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.array,
          received: ctx.parsedType
        });
        return INVALID;
      }
      if (ctx.data.length < this._def.items.length) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: this._def.items.length,
          inclusive: true,
          exact: false,
          type: "array"
        });
        return INVALID;
      }
      const rest = this._def.rest;
      if (!rest && ctx.data.length > this._def.items.length) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: this._def.items.length,
          inclusive: true,
          exact: false,
          type: "array"
        });
        status.dirty();
      }
      const items = [...ctx.data].map((item, itemIndex) => {
        const schema = this._def.items[itemIndex] || this._def.rest;
        if (!schema)
          return null;
        return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
      }).filter((x) => !!x);
      if (ctx.common.async) {
        return Promise.all(items).then((results) => {
          return ParseStatus.mergeArray(status, results);
        });
      } else {
        return ParseStatus.mergeArray(status, items);
      }
    }
    get items() {
      return this._def.items;
    }
    rest(rest) {
      return new ZodTuple({
        ...this._def,
        rest
      });
    }
  }
  ZodTuple.create = (schemas, params) => {
    if (!Array.isArray(schemas)) {
      throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
    }
    return new ZodTuple({
      items: schemas,
      typeName: ZodFirstPartyTypeKind.ZodTuple,
      rest: null,
      ...processCreateParams(params)
    });
  };
  class ZodMap extends ZodType {
    get keySchema() {
      return this._def.keyType;
    }
    get valueSchema() {
      return this._def.valueType;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.map) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.map,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const keyType = this._def.keyType;
      const valueType = this._def.valueType;
      const pairs = [...ctx.data.entries()].map(([key, value], index) => {
        return {
          key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
          value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
        };
      });
      if (ctx.common.async) {
        const finalMap = /* @__PURE__ */ new Map();
        return Promise.resolve().then(async () => {
          for (const pair of pairs) {
            const key = await pair.key;
            const value = await pair.value;
            if (key.status === "aborted" || value.status === "aborted") {
              return INVALID;
            }
            if (key.status === "dirty" || value.status === "dirty") {
              status.dirty();
            }
            finalMap.set(key.value, value.value);
          }
          return { status: status.value, value: finalMap };
        });
      } else {
        const finalMap = /* @__PURE__ */ new Map();
        for (const pair of pairs) {
          const key = pair.key;
          const value = pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      }
    }
  }
  ZodMap.create = (keyType, valueType, params) => {
    return new ZodMap({
      valueType,
      keyType,
      typeName: ZodFirstPartyTypeKind.ZodMap,
      ...processCreateParams(params)
    });
  };
  class ZodSet extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.set) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.set,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const def = this._def;
      if (def.minSize !== null) {
        if (ctx.data.size < def.minSize.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: def.minSize.value,
            type: "set",
            inclusive: true,
            exact: false,
            message: def.minSize.message
          });
          status.dirty();
        }
      }
      if (def.maxSize !== null) {
        if (ctx.data.size > def.maxSize.value) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: def.maxSize.value,
            type: "set",
            inclusive: true,
            exact: false,
            message: def.maxSize.message
          });
          status.dirty();
        }
      }
      const valueType = this._def.valueType;
      function finalizeSet(elements2) {
        const parsedSet = /* @__PURE__ */ new Set();
        for (const element of elements2) {
          if (element.status === "aborted")
            return INVALID;
          if (element.status === "dirty")
            status.dirty();
          parsedSet.add(element.value);
        }
        return { status: status.value, value: parsedSet };
      }
      const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
      if (ctx.common.async) {
        return Promise.all(elements).then((elements2) => finalizeSet(elements2));
      } else {
        return finalizeSet(elements);
      }
    }
    min(minSize, message) {
      return new ZodSet({
        ...this._def,
        minSize: { value: minSize, message: errorUtil.toString(message) }
      });
    }
    max(maxSize, message) {
      return new ZodSet({
        ...this._def,
        maxSize: { value: maxSize, message: errorUtil.toString(message) }
      });
    }
    size(size, message) {
      return this.min(size, message).max(size, message);
    }
    nonempty(message) {
      return this.min(1, message);
    }
  }
  ZodSet.create = (valueType, params) => {
    return new ZodSet({
      valueType,
      minSize: null,
      maxSize: null,
      typeName: ZodFirstPartyTypeKind.ZodSet,
      ...processCreateParams(params)
    });
  };
  class ZodLazy extends ZodType {
    get schema() {
      return this._def.getter();
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const lazySchema = this._def.getter();
      return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
    }
  }
  ZodLazy.create = (getter, params) => {
    return new ZodLazy({
      getter,
      typeName: ZodFirstPartyTypeKind.ZodLazy,
      ...processCreateParams(params)
    });
  };
  class ZodLiteral extends ZodType {
    _parse(input) {
      if (input.data !== this._def.value) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_literal,
          expected: this._def.value
        });
        return INVALID;
      }
      return { status: "valid", value: input.data };
    }
    get value() {
      return this._def.value;
    }
  }
  ZodLiteral.create = (value, params) => {
    return new ZodLiteral({
      value,
      typeName: ZodFirstPartyTypeKind.ZodLiteral,
      ...processCreateParams(params)
    });
  };
  function createZodEnum(values, params) {
    return new ZodEnum({
      values,
      typeName: ZodFirstPartyTypeKind.ZodEnum,
      ...processCreateParams(params)
    });
  }
  class ZodEnum extends ZodType {
    _parse(input) {
      if (typeof input.data !== "string") {
        const ctx = this._getOrReturnCtx(input);
        const expectedValues = this._def.values;
        addIssueToContext(ctx, {
          expected: util.joinValues(expectedValues),
          received: ctx.parsedType,
          code: ZodIssueCode.invalid_type
        });
        return INVALID;
      }
      if (!this._cache) {
        this._cache = new Set(this._def.values);
      }
      if (!this._cache.has(input.data)) {
        const ctx = this._getOrReturnCtx(input);
        const expectedValues = this._def.values;
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_enum_value,
          options: expectedValues
        });
        return INVALID;
      }
      return OK(input.data);
    }
    get options() {
      return this._def.values;
    }
    get enum() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    get Values() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    get Enum() {
      const enumValues = {};
      for (const val of this._def.values) {
        enumValues[val] = val;
      }
      return enumValues;
    }
    extract(values, newDef = this._def) {
      return ZodEnum.create(values, {
        ...this._def,
        ...newDef
      });
    }
    exclude(values, newDef = this._def) {
      return ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
        ...this._def,
        ...newDef
      });
    }
  }
  ZodEnum.create = createZodEnum;
  class ZodNativeEnum extends ZodType {
    _parse(input) {
      const nativeEnumValues = util.getValidEnumValues(this._def.values);
      const ctx = this._getOrReturnCtx(input);
      if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
        const expectedValues = util.objectValues(nativeEnumValues);
        addIssueToContext(ctx, {
          expected: util.joinValues(expectedValues),
          received: ctx.parsedType,
          code: ZodIssueCode.invalid_type
        });
        return INVALID;
      }
      if (!this._cache) {
        this._cache = new Set(util.getValidEnumValues(this._def.values));
      }
      if (!this._cache.has(input.data)) {
        const expectedValues = util.objectValues(nativeEnumValues);
        addIssueToContext(ctx, {
          received: ctx.data,
          code: ZodIssueCode.invalid_enum_value,
          options: expectedValues
        });
        return INVALID;
      }
      return OK(input.data);
    }
    get enum() {
      return this._def.values;
    }
  }
  ZodNativeEnum.create = (values, params) => {
    return new ZodNativeEnum({
      values,
      typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
      ...processCreateParams(params)
    });
  };
  class ZodPromise extends ZodType {
    unwrap() {
      return this._def.type;
    }
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.promise,
          received: ctx.parsedType
        });
        return INVALID;
      }
      const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
      return OK(promisified.then((data) => {
        return this._def.type.parseAsync(data, {
          path: ctx.path,
          errorMap: ctx.common.contextualErrorMap
        });
      }));
    }
  }
  ZodPromise.create = (schema, params) => {
    return new ZodPromise({
      type: schema,
      typeName: ZodFirstPartyTypeKind.ZodPromise,
      ...processCreateParams(params)
    });
  };
  class ZodEffects extends ZodType {
    innerType() {
      return this._def.schema;
    }
    sourceType() {
      return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
    }
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      const effect = this._def.effect || null;
      const checkCtx = {
        addIssue: (arg) => {
          addIssueToContext(ctx, arg);
          if (arg.fatal) {
            status.abort();
          } else {
            status.dirty();
          }
        },
        get path() {
          return ctx.path;
        }
      };
      checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
      if (effect.type === "preprocess") {
        const processed = effect.transform(ctx.data, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(processed).then(async (processed2) => {
            if (status.value === "aborted")
              return INVALID;
            const result2 = await this._def.schema._parseAsync({
              data: processed2,
              path: ctx.path,
              parent: ctx
            });
            if (result2.status === "aborted")
              return INVALID;
            if (result2.status === "dirty")
              return DIRTY(result2.value);
            if (status.value === "dirty")
              return DIRTY(result2.value);
            return result2;
          });
        } else {
          if (status.value === "aborted")
            return INVALID;
          const result2 = this._def.schema._parseSync({
            data: processed,
            path: ctx.path,
            parent: ctx
          });
          if (result2.status === "aborted")
            return INVALID;
          if (result2.status === "dirty")
            return DIRTY(result2.value);
          if (status.value === "dirty")
            return DIRTY(result2.value);
          return result2;
        }
      }
      if (effect.type === "refinement") {
        const executeRefinement = (acc) => {
          const result2 = effect.refinement(acc, checkCtx);
          if (ctx.common.async) {
            return Promise.resolve(result2);
          }
          if (result2 instanceof Promise) {
            throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
          }
          return acc;
        };
        if (ctx.common.async === false) {
          const inner = this._def.schema._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          executeRefinement(inner.value);
          return { status: status.value, value: inner.value };
        } else {
          return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
            if (inner.status === "aborted")
              return INVALID;
            if (inner.status === "dirty")
              status.dirty();
            return executeRefinement(inner.value).then(() => {
              return { status: status.value, value: inner.value };
            });
          });
        }
      }
      if (effect.type === "transform") {
        if (ctx.common.async === false) {
          const base = this._def.schema._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (!isValid(base))
            return INVALID;
          const result2 = effect.transform(base.value, checkCtx);
          if (result2 instanceof Promise) {
            throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
          }
          return { status: status.value, value: result2 };
        } else {
          return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
            if (!isValid(base))
              return INVALID;
            return Promise.resolve(effect.transform(base.value, checkCtx)).then((result2) => ({
              status: status.value,
              value: result2
            }));
          });
        }
      }
      util.assertNever(effect);
    }
  }
  ZodEffects.create = (schema, effect, params) => {
    return new ZodEffects({
      schema,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect,
      ...processCreateParams(params)
    });
  };
  ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
    return new ZodEffects({
      schema,
      effect: { type: "preprocess", transform: preprocess },
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      ...processCreateParams(params)
    });
  };
  class ZodOptional extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType === ZodParsedType.undefined) {
        return OK(void 0);
      }
      return this._def.innerType._parse(input);
    }
    unwrap() {
      return this._def.innerType;
    }
  }
  ZodOptional.create = (type, params) => {
    return new ZodOptional({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodOptional,
      ...processCreateParams(params)
    });
  };
  class ZodNullable extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType === ZodParsedType.null) {
        return OK(null);
      }
      return this._def.innerType._parse(input);
    }
    unwrap() {
      return this._def.innerType;
    }
  }
  ZodNullable.create = (type, params) => {
    return new ZodNullable({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodNullable,
      ...processCreateParams(params)
    });
  };
  class ZodDefault extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      let data = ctx.data;
      if (ctx.parsedType === ZodParsedType.undefined) {
        data = this._def.defaultValue();
      }
      return this._def.innerType._parse({
        data,
        path: ctx.path,
        parent: ctx
      });
    }
    removeDefault() {
      return this._def.innerType;
    }
  }
  ZodDefault.create = (type, params) => {
    return new ZodDefault({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodDefault,
      defaultValue: typeof params.default === "function" ? params.default : () => params.default,
      ...processCreateParams(params)
    });
  };
  class ZodCatch extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const newCtx = {
        ...ctx,
        common: {
          ...ctx.common,
          issues: []
        }
      };
      const result2 = this._def.innerType._parse({
        data: newCtx.data,
        path: newCtx.path,
        parent: {
          ...newCtx
        }
      });
      if (isAsync(result2)) {
        return result2.then((result3) => {
          return {
            status: "valid",
            value: result3.status === "valid" ? result3.value : this._def.catchValue({
              get error() {
                return new ZodError(newCtx.common.issues);
              },
              input: newCtx.data
            })
          };
        });
      } else {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      }
    }
    removeCatch() {
      return this._def.innerType;
    }
  }
  ZodCatch.create = (type, params) => {
    return new ZodCatch({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodCatch,
      catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
      ...processCreateParams(params)
    });
  };
  class ZodNaN extends ZodType {
    _parse(input) {
      const parsedType = this._getType(input);
      if (parsedType !== ZodParsedType.nan) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.nan,
          received: ctx.parsedType
        });
        return INVALID;
      }
      return { status: "valid", value: input.data };
    }
  }
  ZodNaN.create = (params) => {
    return new ZodNaN({
      typeName: ZodFirstPartyTypeKind.ZodNaN,
      ...processCreateParams(params)
    });
  };
  class ZodBranded extends ZodType {
    _parse(input) {
      const { ctx } = this._processInputParams(input);
      const data = ctx.data;
      return this._def.type._parse({
        data,
        path: ctx.path,
        parent: ctx
      });
    }
    unwrap() {
      return this._def.type;
    }
  }
  class ZodPipeline extends ZodType {
    _parse(input) {
      const { status, ctx } = this._processInputParams(input);
      if (ctx.common.async) {
        const handleAsync = async () => {
          const inResult = await this._def.in._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inResult.status === "aborted")
            return INVALID;
          if (inResult.status === "dirty") {
            status.dirty();
            return DIRTY(inResult.value);
          } else {
            return this._def.out._parseAsync({
              data: inResult.value,
              path: ctx.path,
              parent: ctx
            });
          }
        };
        return handleAsync();
      } else {
        const inResult = this._def.in._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return {
            status: "dirty",
            value: inResult.value
          };
        } else {
          return this._def.out._parseSync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      }
    }
    static create(a, b) {
      return new ZodPipeline({
        in: a,
        out: b,
        typeName: ZodFirstPartyTypeKind.ZodPipeline
      });
    }
  }
  class ZodReadonly extends ZodType {
    _parse(input) {
      const result2 = this._def.innerType._parse(input);
      const freeze = (data) => {
        if (isValid(data)) {
          data.value = Object.freeze(data.value);
        }
        return data;
      };
      return isAsync(result2) ? result2.then((data) => freeze(data)) : freeze(result2);
    }
    unwrap() {
      return this._def.innerType;
    }
  }
  ZodReadonly.create = (type, params) => {
    return new ZodReadonly({
      innerType: type,
      typeName: ZodFirstPartyTypeKind.ZodReadonly,
      ...processCreateParams(params)
    });
  };
  var ZodFirstPartyTypeKind;
  (function(ZodFirstPartyTypeKind2) {
    ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
    ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
    ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
    ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
    ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
    ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
    ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
    ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
    ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
    ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
    ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
    ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
    ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
    ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
    ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
    ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
    ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
    ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
    ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
    ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
    ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
    ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
    ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
    ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
    ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
    ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
    ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
    ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
    ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
    ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
    ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
    ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
    ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
    ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
    ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
    ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
  })(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
  const stringType = ZodString.create;
  const booleanType = ZodBoolean.create;
  ZodNever.create;
  const arrayType = ZodArray.create;
  const objectType = ZodObject.create;
  const unionType = ZodUnion.create;
  const discriminatedUnionType = ZodDiscriminatedUnion.create;
  ZodIntersection.create;
  ZodTuple.create;
  const literalType = ZodLiteral.create;
  const enumType = ZodEnum.create;
  ZodPromise.create;
  ZodOptional.create;
  ZodNullable.create;
  const jobSnapshotFields = {
    externalId: stringType().min(1),
    url: stringType().url(),
    title: stringType().min(1),
    company: stringType().min(1),
    location: stringType().optional(),
    description: stringType().optional(),
    technologies: arrayType(stringType().min(1)).max(30).default([]),
    easyApply: booleanType()
  };
  const seekJobSnapshotSchema = objectType({
    platform: literalType("seek"),
    ...jobSnapshotFields
  });
  const linkedinJobSnapshotSchema = objectType({
    platform: literalType("linkedin"),
    ...jobSnapshotFields
  });
  const jobSnapshotSchema = discriminatedUnionType("platform", [
    seekJobSnapshotSchema,
    linkedinJobSnapshotSchema
  ]);
  const pageInspectionSchema = discriminatedUnionType("kind", [
    objectType({
      kind: literalType("job"),
      snapshot: jobSnapshotSchema
    }),
    objectType({
      kind: literalType("not_job_page"),
      platform: enumType(["seek", "linkedin"]),
      url: stringType().url(),
      reason: stringType().min(1)
    }),
    objectType({
      kind: literalType("unsupported_page"),
      url: stringType().url(),
      reason: stringType().min(1)
    })
  ]);
  const formPlatformSchema = enumType(["generic", "seek", "linkedin"]);
  const formFieldTypeSchema = enumType([
    "text",
    "textarea",
    "select",
    "checkbox",
    "radio",
    "file",
    "number",
    "email",
    "tel",
    "url",
    "date",
    "password",
    "unknown"
  ]);
  const formOptionSchema = objectType({
    label: stringType(),
    value: stringType()
  });
  const formFieldObservationSchema = objectType({
    key: stringType().min(1),
    id: stringType().optional(),
    name: stringType().optional(),
    type: formFieldTypeSchema,
    label: stringType().min(1),
    required: booleanType(),
    filled: booleanType(),
    sensitive: booleanType(),
    options: arrayType(formOptionSchema),
    currentValue: stringType().optional()
  });
  const formInspectionSchema = discriminatedUnionType("kind", [
    objectType({
      kind: literalType("application_form"),
      platform: formPlatformSchema,
      url: stringType().url(),
      fields: arrayType(formFieldObservationSchema),
      hasSubmitAction: booleanType(),
      submitLabel: stringType().optional(),
      action: enumType(["next", "submit"]).optional(),
      canGoBack: booleanType()
    }),
    objectType({
      kind: literalType("not_application_form"),
      platform: formPlatformSchema,
      url: stringType().url(),
      reason: stringType().min(1)
    }),
    objectType({
      kind: literalType("page_input_fields"),
      platform: formPlatformSchema,
      url: stringType().url(),
      fields: arrayType(formFieldObservationSchema)
    }),
    objectType({
      kind: literalType("unsupported_page"),
      url: stringType().url(),
      reason: stringType().min(1)
    })
  ]);
  const fieldFillInstructionSchema = objectType({
    type: literalType("content.fill-field"),
    commandId: stringType().min(1).max(128),
    source: enumType(["backend", "panel"]),
    target: objectType({
      key: stringType().min(1).max(256),
      id: stringType().max(256).optional(),
      name: stringType().max(256).optional(),
      type: formFieldTypeSchema,
      label: stringType().min(1).max(500)
    }),
    value: unionType([stringType().max(1e4), booleanType()])
  });
  const formFieldTargetSchema = fieldFillInstructionSchema.shape.target;
  objectType({
    commandId: stringType().min(1),
    key: stringType().min(1),
    status: enumType(["filled", "already_filled", "not_found", "rejected", "requires_user_action"]),
    message: stringType().min(1)
  });
  objectType({
    key: stringType().min(1),
    status: enumType(["focused", "not_found"]),
    message: stringType().min(1)
  });
  objectType({
    application_id: stringType().min(1),
    instructions: arrayType(fieldFillInstructionSchema),
    unanswered_fields: arrayType(
      objectType({
        key: stringType().min(1),
        label: stringType().min(1),
        reason: stringType().min(1)
      })
    )
  });
  const linkedinApplicationActionSchema = enumType(["previous", "next", "submit"]);
  objectType({
    status: enumType(["already_open", "opened", "navigating", "clicked", "not_open", "unavailable"]),
    message: stringType().min(1),
    url: stringType().url().optional(),
    actionLabel: stringType().min(1).optional()
  });
  const TECHNOLOGY_RULES = [
    { label: "ASP.NET Core", pattern: /(?:^|[^A-Za-z0-9])ASP\.NET\s+Core(?:$|[^A-Za-z0-9])/i },
    { label: "Azure DevOps", pattern: /(?:^|[^A-Za-z0-9])Azure\s+DevOps(?:$|[^A-Za-z0-9])/i },
    { label: "GitHub Actions", pattern: /(?:^|[^A-Za-z0-9])GitHub\s+Actions(?:$|[^A-Za-z0-9])/i },
    { label: "GitLab CI/CD", pattern: /(?:^|[^A-Za-z0-9])GitLab\s+CI\s*\/\s*CD(?:$|[^A-Za-z0-9])/i },
    { label: "Microsoft SQL Server", pattern: /(?:^|[^A-Za-z0-9])Microsoft\s+SQL\s+Server(?:$|[^A-Za-z0-9])/i },
    { label: "Google Cloud", pattern: /(?:^|[^A-Za-z0-9])Google\s+Cloud(?:$|[^A-Za-z0-9])/i },
    { label: "Spring Boot", pattern: /(?:^|[^A-Za-z0-9])Spring\s+Boot(?:$|[^A-Za-z0-9])/i },
    { label: "React Native", pattern: /(?:^|[^A-Za-z0-9])React\s+Native(?:$|[^A-Za-z0-9])/i },
    { label: "Node.js", pattern: /(?:^|[^A-Za-z0-9])Node\.js(?:$|[^A-Za-z0-9])/i },
    { label: "Next.js", pattern: /(?:^|[^A-Za-z0-9])Next\.js(?:$|[^A-Za-z0-9])/i },
    { label: "Express.js", pattern: /(?:^|[^A-Za-z0-9])Express(?:\.js)?(?:$|[^A-Za-z0-9])/i },
    { label: "REST APIs", pattern: /(?:^|[^A-Za-z0-9])REST(?:ful)?\s+APIs?(?:$|[^A-Za-z0-9])/i },
    { label: "CI/CD", pattern: /(?:^|[^A-Za-z0-9])CI\s*\/\s*CD(?:$|[^A-Za-z0-9])/i },
    { label: "C#", pattern: /(?:^|[^A-Za-z0-9])C#(?:$|[^A-Za-z0-9])/i },
    { label: "C++", pattern: /(?:^|[^A-Za-z0-9])C\+\+(?:$|[^A-Za-z0-9])/i },
    { label: ".NET", pattern: /(?:^|[^A-Za-z0-9])\.NET(?:$|[^A-Za-z0-9])/i },
    { label: "JavaScript", pattern: /\bJavaScript\b/i },
    { label: "TypeScript", pattern: /\bTypeScript\b/i },
    { label: "Python", pattern: /\bPython\b/i },
    { label: "Java", pattern: /\bJava\b/i },
    { label: "Kotlin", pattern: /\bKotlin\b/i },
    { label: "Swift", pattern: /\bSwift\b/i },
    { label: "Dart", pattern: /\bDart\b/i },
    { label: "PHP", pattern: /\bPHP\b/i },
    { label: "Ruby", pattern: /\bRuby\b/i },
    { label: "Go", pattern: /\bGolang\b|\bGo\s+(?:programming|language)\b/i },
    { label: "Rust", pattern: /\bRust\b/i },
    { label: "SQL", pattern: /\bSQL\b/i },
    { label: "HTML", pattern: /\bHTML\b/i },
    { label: "CSS", pattern: /\bCSS\b/i },
    { label: "GraphQL", pattern: /\bGraphQL\b/i },
    { label: "gRPC", pattern: /\bgRPC\b/i },
    { label: "Angular", pattern: /\bAngular\b/i },
    { label: "React", pattern: /\bReact\b/i },
    { label: "Vue.js", pattern: /\bVue(?:\.js)?\b/i },
    { label: "Flutter", pattern: /\bFlutter\b/i },
    { label: "Django", pattern: /\bDjango\b/i },
    { label: "Flask", pattern: /\bFlask\b/i },
    { label: "FastAPI", pattern: /\bFastAPI\b/i },
    { label: "Laravel", pattern: /\bLaravel\b/i },
    { label: "AWS", pattern: /\bAWS\b/i },
    { label: "Azure", pattern: /\bAzure\b/i },
    { label: "Docker", pattern: /\bDocker\b/i },
    { label: "Kubernetes", pattern: /\bKubernetes\b/i },
    { label: "Terraform", pattern: /\bTerraform\b/i },
    { label: "Jenkins", pattern: /\bJenkins\b/i },
    { label: "Git", pattern: /\bGit\b/i },
    { label: "Linux", pattern: /\bLinux\b/i },
    { label: "PostgreSQL", pattern: /\bPostgreSQL\b/i },
    { label: "MySQL", pattern: /\bMySQL\b/i },
    { label: "MongoDB", pattern: /\bMongoDB\b/i },
    { label: "Redis", pattern: /\bRedis\b/i },
    { label: "DynamoDB", pattern: /\bDynamoDB\b/i },
    { label: "Oracle", pattern: /\bOracle\b/i },
    { label: "Kafka", pattern: /\bKafka\b/i },
    { label: "RabbitMQ", pattern: /\bRabbitMQ\b/i },
    { label: "Elasticsearch", pattern: /\bElasticsearch\b/i },
    { label: "Agile", pattern: /\bAgile\b/i },
    { label: "Scrum", pattern: /\bScrum\b/i },
    { label: "TDD", pattern: /\bTDD\b|test[- ]driven development/i },
    { label: "Microservices", pattern: /\bmicroservices?\b/i }
  ];
  function cleanText$7(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }
  function extractTechnologyKeywords(value) {
    const text = cleanText$7(value);
    if (!text) return [];
    return TECHNOLOGY_RULES.map((rule, order) => {
      const match = rule.pattern.exec(text);
      return match ? { label: rule.label, index: match.index, order } : void 0;
    }).filter((item) => Boolean(item)).sort((left, right) => left.index - right.index || left.order - right.order).map((item) => item.label).filter((label, index, labels) => labels.indexOf(label) === index).slice(0, 30);
  }
  const SEEK_SELECTORS = {
    title: [
      "h1[data-automation='job-detail-title']",
      "[data-automation='job-detail-title']",
      "[data-testid='job-title']",
      "h1"
    ],
    company: [
      "[data-automation='advertiser-name']",
      "[data-automation='job-detail-company']",
      "a[data-automation='company-link']",
      "[data-testid='job-company']"
    ],
    location: [
      "[data-automation='job-detail-location']",
      "[data-automation='job-location']",
      "[data-testid='job-location']"
    ],
    description: [
      "[data-automation='jobAdDetails']",
      "[data-automation='jobDescription']",
      "[data-testid='job-description']"
    ],
    apply: [
      "a[data-automation='job-detail-apply']",
      "button[data-automation='job-detail-apply']",
      "[data-testid='job-detail-apply']"
    ]
  };
  function cleanText$6(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }
  function firstText$1(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const text = cleanText$6(element == null ? void 0 : element.textContent);
      if (text) return text;
    }
    return "";
  }
  function jobIdFromUrl(url) {
    const match = url.match(/\/job\/(\d+)/i);
    if (match == null ? void 0 : match[1]) return match[1];
    try {
      const queryJobId = new URL(url).searchParams.get("jobId") || "";
      return /^\d+$/.test(queryJobId) ? queryJobId : "";
    } catch {
      return "";
    }
  }
  function hasApplyAction() {
    return SEEK_SELECTORS.apply.some((selector) => Boolean(document.querySelector(selector)));
  }
  function readSeekPage() {
    const url = window.location.href;
    const jobId = jobIdFromUrl(url);
    if (!jobId) {
      return { kind: "not_job_page", platform: "seek", url, reason: "The URL does not identify a SEEK job." };
    }
    const title = firstText$1(SEEK_SELECTORS.title);
    if (!title) {
      return { kind: "not_job_page", platform: "seek", url, reason: "The job title is not available yet." };
    }
    const description = firstText$1(SEEK_SELECTORS.description);
    const snapshot = {
      platform: "seek",
      externalId: jobId,
      url,
      title,
      company: firstText$1(SEEK_SELECTORS.company) || "Unknown company",
      location: firstText$1(SEEK_SELECTORS.location) || void 0,
      description: description || void 0,
      technologies: extractTechnologyKeywords(description),
      easyApply: hasApplyAction()
    };
    return { kind: "job", snapshot };
  }
  const CONTROL_SELECTOR = [
    "input:not([type='hidden']):not([type='button']):not([type='submit']):not([type='reset']):not([type='image'])",
    "select",
    "textarea"
  ].join(", ");
  function cleanText$5(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }
  function cleanLabel(value) {
    return cleanText$5(value).replace(/\s*(?:Required|必填|\*)\s*$/gi, "").trim();
  }
  function isVisibleElement(element) {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }
  function isInspectableControl(element) {
    return !element.disabled && element.getAttribute("aria-disabled") !== "true";
  }
  function isDocumentSelectionRadio(element) {
    return element.type.toLowerCase() === "radio" && (element.id.startsWith("jobsDocumentCardToggle") || Boolean(element.closest(".jobs-document-upload-redesign-card")));
  }
  function fieldType$1(element) {
    if (element instanceof HTMLSelectElement) return "select";
    if (element instanceof HTMLTextAreaElement) return "textarea";
    const type = element.type.toLowerCase();
    if (type === "text" || type === "search") return "text";
    if (type === "checkbox" || type === "radio" || type === "file") return type;
    if (["number", "email", "tel", "url", "date", "password"].includes(type)) return type;
    return "unknown";
  }
  function scopeFor(element, fallback) {
    const root = element.getRootNode();
    return root instanceof Document || root instanceof ShadowRoot ? root : fallback;
  }
  function optionLabelFor$1(element, scope) {
    var _a2;
    const ariaLabel = cleanText$5(element.getAttribute("aria-label"));
    if (ariaLabel) return cleanLabel(ariaLabel);
    const id = cleanText$5(element.id);
    if (id) {
      const label = scope.querySelector(`label[for='${CSS.escape(id)}']`);
      const text = cleanText$5(label == null ? void 0 : label.textContent);
      if (text) return cleanLabel(text);
    }
    const parentLabel = cleanText$5((_a2 = element.closest("label")) == null ? void 0 : _a2.textContent);
    if (parentTextIsDistinct(parentLabel, element)) return cleanLabel(parentLabel);
    if (element instanceof HTMLInputElement && element.value) return cleanText$5(element.value);
    return "Option";
  }
  function parentTextIsDistinct(text, element) {
    var _a2;
    if (!text) return false;
    const fieldset = element.closest("fieldset");
    const legend = cleanText$5((_a2 = fieldset == null ? void 0 : fieldset.querySelector("legend")) == null ? void 0 : _a2.textContent);
    if (legend && text === legend) return false;
    return true;
  }
  function labelFor$2(element, scope) {
    var _a2, _b2;
    if (element instanceof HTMLInputElement && element.type.toLowerCase() === "radio") {
      const fieldset2 = element.closest("fieldset");
      const legend2 = cleanText$5((_a2 = fieldset2 == null ? void 0 : fieldset2.querySelector("legend")) == null ? void 0 : _a2.textContent);
      if (legend2) return cleanLabel(legend2);
    }
    const labelledBy = cleanText$5(element.getAttribute("aria-label"));
    if (labelledBy) return cleanLabel(labelledBy);
    const id = cleanText$5(element.id);
    if (id) {
      const label = scope.querySelector(`label[for='${CSS.escape(id)}']`);
      const text = cleanText$5(label == null ? void 0 : label.textContent);
      if (text) return cleanLabel(text);
    }
    const parentLabel = element.closest("label");
    const parentText = cleanText$5(parentLabel == null ? void 0 : parentLabel.textContent);
    if (parentText) return cleanLabel(parentText);
    const fieldset = element.closest("fieldset");
    const legend = cleanText$5((_b2 = fieldset == null ? void 0 : fieldset.querySelector("legend")) == null ? void 0 : _b2.textContent);
    if (legend) return cleanLabel(legend);
    const placeholder = cleanText$5(element.getAttribute("placeholder"));
    if (placeholder) return cleanLabel(placeholder);
    return cleanLabel(element.getAttribute("name") || "") || "Unnamed field";
  }
  function requiredFor(element) {
    if (element.hasAttribute("required") || element.getAttribute("aria-required") === "true") return true;
    const fieldset = element.closest("fieldset");
    return Boolean((fieldset == null ? void 0 : fieldset.hasAttribute("required")) || (fieldset == null ? void 0 : fieldset.getAttribute("aria-required")) === "true");
  }
  function optionsFor(element, scope) {
    if (element instanceof HTMLSelectElement) {
      return Array.from(element.options).map((option) => ({
        label: cleanText$5(option.textContent) || option.value,
        value: option.value
      }));
    }
    if (element instanceof HTMLInputElement && element.type.toLowerCase() === "radio" && element.name) {
      return Array.from(scope.querySelectorAll(`input[type='radio'][name='${CSS.escape(element.name)}']`)).map((radio) => ({
        label: optionLabelFor$1(radio, scope),
        value: radio.value
      }));
    }
    return [];
  }
  function currentValue(element, type, scope) {
    if (type === "password" || type === "file") return void 0;
    if (element instanceof HTMLInputElement && type === "radio" && element.name) {
      const group = Array.from(scope.querySelectorAll(`input[type='radio'][name='${CSS.escape(element.name)}']`));
      const checkedRadio = group.find((r) => r.checked);
      if (!checkedRadio) return "";
      return optionLabelFor$1(checkedRadio, scope) || checkedRadio.value || "true";
    }
    if (element instanceof HTMLInputElement && type === "checkbox") {
      return element.checked ? element.value || "true" : "";
    }
    if (element instanceof HTMLSelectElement) {
      return Array.from(element.selectedOptions).map((option) => cleanText$5(option.textContent)).join(", ");
    }
    return cleanText$5(element.value);
  }
  function isFilled(element, type, scope) {
    var _a2;
    if (type === "file") return Boolean(element instanceof HTMLInputElement && ((_a2 = element.files) == null ? void 0 : _a2.length));
    if (element instanceof HTMLInputElement && type === "radio" && element.name) {
      const group = Array.from(scope.querySelectorAll(`input[type='radio'][name='${CSS.escape(element.name)}']`));
      return group.some((r) => r.checked);
    }
    if (element instanceof HTMLInputElement && type === "checkbox") return element.checked;
    return Boolean(currentValue(element, type, scope));
  }
  function fileUploadLabelFor(element, scope) {
    const root = scopeFor(element, scope);
    const explicitLabel = element.id ? root.querySelector(`label[for='${CSS.escape(element.id)}']`) : null;
    const controller = element.id ? root.querySelector(`[aria-controls='${CSS.escape(element.id)}']`) : null;
    const text = cleanText$5(
      (explicitLabel == null ? void 0 : explicitLabel.textContent) || (controller == null ? void 0 : controller.getAttribute("aria-label")) || (controller == null ? void 0 : controller.textContent) || element.getAttribute("aria-label") || element.getAttribute("name")
    );
    if (/upload\s+resume|resume\s+upload/i.test(text)) return "Resume";
    if (/upload\s+(?:cv|cover\s+letter)/i.test(text)) return cleanLabel(text.replace(/^upload\s+/i, ""));
    return cleanLabel(text) || "Upload file";
  }
  function selectedDocumentFor(element, scope) {
    var _a2;
    const root = scopeFor(element, scope);
    const selectedLabel = Array.from(root.querySelectorAll(".jobs-document-upload-redesign-card__toggle-label")).find((label) => /^deselect\s+(?:resume|cv|cover\s+letter)\s+/i.test(cleanText$5(label.textContent)));
    if (!selectedLabel) return void 0;
    const name = cleanText$5(selectedLabel.textContent).replace(/^deselect\s+(?:resume|cv|cover\s+letter)\s+/i, "").trim();
    if (!name) return void 0;
    const cardText = cleanText$5((_a2 = selectedLabel.closest(".jobs-document-upload-redesign-card")) == null ? void 0 : _a2.textContent);
    return { name, accepted: !/\b0\s*B\b/i.test(cardText) };
  }
  function documentOptionsFor(element, scope) {
    const root = scopeFor(element, scope);
    return Array.from(root.querySelectorAll(".jobs-document-upload-redesign-card__toggle-label")).map((label) => {
      const text = cleanText$5(label.textContent);
      const match = text.match(/^(?:deselect|select)\s+(?:resume|cv|cover\s+letter)\s+(.+)$/i);
      const value = cleanText$5(label.htmlFor);
      return (match == null ? void 0 : match[1]) && value ? { label: match[1].trim(), value } : null;
    }).filter((option) => Boolean(option));
  }
  function fileRequiredFor(element, scope) {
    var _a2;
    if (requiredFor(element)) return true;
    const root = scopeFor(element, scope);
    const explicitLabel = element.id ? root.querySelector(`label[for='${CSS.escape(element.id)}']`) : null;
    const nearbyText = cleanText$5((_a2 = explicitLabel == null ? void 0 : explicitLabel.closest("fieldset, section, div")) == null ? void 0 : _a2.textContent);
    return /\*\s*$/.test(cleanText$5(explicitLabel == null ? void 0 : explicitLabel.textContent)) || /\bresume\b[\s\S]{0,180}\*/i.test(nearbyText);
  }
  function elementsInScope(scope) {
    const elements = [];
    const visitedRoots = /* @__PURE__ */ new Set();
    const visit = (root) => {
      if (visitedRoots.has(root)) return;
      visitedRoots.add(root);
      const descendants = Array.from(root.querySelectorAll("*"));
      elements.push(...descendants);
      descendants.forEach((element) => {
        if (element.shadowRoot) visit(element.shadowRoot);
      });
    };
    visit(scope);
    return elements;
  }
  function controlsInScope(scope) {
    return elementsInScope(scope).filter(
      (element) => element.matches(CONTROL_SELECTOR)
    );
  }
  function visibleControlsInScope(scope) {
    return controlsInScope(scope).filter((element) => isVisibleElement(element) && isInspectableControl(element));
  }
  function fieldKeyFor(element, index) {
    return cleanText$5(element.id) || cleanText$5(element.getAttribute("name")) || `field-${index + 1}`;
  }
  function inspectVisibleFormFields(scope = document) {
    var _a2;
    const visibleControls = visibleControlsInScope(scope);
    const seenRadioNames = /* @__PURE__ */ new Set();
    const result2 = [];
    for (let index = 0; index < visibleControls.length && result2.length < 200; index += 1) {
      const element = visibleControls[index];
      if (!element) continue;
      const type = fieldType$1(element);
      if (element instanceof HTMLInputElement && isDocumentSelectionRadio(element)) continue;
      if (type === "radio" && element instanceof HTMLInputElement && element.name) {
        if (seenRadioNames.has(element.name)) continue;
        seenRadioNames.add(element.name);
      }
      const elementScope = scopeFor(element, scope);
      const val = currentValue(element, type, elementScope);
      result2.push({
        key: fieldKeyFor(element, index),
        id: cleanText$5(element.id) || void 0,
        name: cleanText$5(element.getAttribute("name")) || void 0,
        type,
        label: labelFor$2(element, elementScope),
        required: requiredFor(element),
        filled: isFilled(element, type, elementScope),
        sensitive: type === "password" || type === "file",
        options: optionsFor(element, elementScope),
        ...val ? { currentValue: val } : {}
      });
    }
    const keys = new Set(result2.map((field) => field.key));
    const fileInputs = elementsInScope(scope).filter(
      (element) => element instanceof HTMLInputElement && element.type.toLowerCase() === "file"
    );
    for (let index = 0; index < fileInputs.length && result2.length < 200; index += 1) {
      const input = fileInputs[index];
      if (!input || input.disabled || input.getAttribute("aria-disabled") === "true") continue;
      const key = fieldKeyFor(input, visibleControls.length + index);
      if (keys.has(key)) continue;
      const selectedDocument = selectedDocumentFor(input, scope);
      const selectedFile = (_a2 = input.files) == null ? void 0 : _a2[0];
      result2.push({
        key,
        id: cleanText$5(input.id) || void 0,
        name: cleanText$5(input.getAttribute("name")) || void 0,
        type: "file",
        label: fileUploadLabelFor(input, scope),
        required: fileRequiredFor(input, scope),
        filled: Boolean(selectedFile && selectedFile.size > 0 || (selectedDocument == null ? void 0 : selectedDocument.accepted)),
        sensitive: true,
        options: documentOptionsFor(input, scope),
        ...selectedDocument ? { currentValue: selectedDocument.name } : {}
      });
    }
    return result2;
  }
  function readApplicationForm(url, platform, isApplicationPage2, submitLabel, scope = document, action, canGoBack = false) {
    const fields = scope ? inspectVisibleFormFields(scope) : [];
    if (!isApplicationPage2 || fields.length === 0) {
      return {
        kind: "not_application_form",
        platform,
        url,
        reason: `No visible ${platform === "linkedin" ? "LinkedIn" : platform === "seek" ? "SEEK" : "application"} form was found.`
      };
    }
    return {
      kind: "application_form",
      platform,
      url,
      fields,
      hasSubmitAction: Boolean(submitLabel),
      canGoBack,
      ...submitLabel ? { submitLabel } : {},
      ...action ? { action } : {}
    };
  }
  function readPageInputFields(url, platform) {
    const fields = inspectVisibleFormFields(document);
    if (fields.length === 0) return null;
    return {
      kind: "page_input_fields",
      platform,
      url,
      fields
    };
  }
  function readSeekForm(url, isApplicationPage2, submitLabel, action, canGoBack = false) {
    return readApplicationForm(url, "seek", isApplicationPage2, submitLabel, document, action, canGoBack);
  }
  const ACTION_SELECTOR$1 = "button, input[type='button'], input[type='submit'], [role='button']";
  function cleanText$4(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }
  function isVisible$2(element) {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }
  function isEnabled$1(element) {
    return !element.matches(":disabled") && element.getAttribute("aria-disabled") !== "true";
  }
  function labelFor$1(element) {
    return cleanText$4(
      element.getAttribute("aria-label") || element.getAttribute("value") || element.textContent
    );
  }
  function matchesAction(label, action) {
    if (action === "previous") return /(?:back|previous|返回|上一步)/i.test(label);
    if (action === "submit") return /(?:submit|apply|send|finish|提交|申请|发送|完成)/i.test(label);
    return /(?:continue|next|review|proceed|继续|下一步|审核)/i.test(label) && !/(?:submit|apply|send|finish|提交|申请|发送|完成)/i.test(label);
  }
  function getSeekApplicationAction(action) {
    return Array.from(document.querySelectorAll(ACTION_SELECTOR$1)).find(
      (element) => isVisible$2(element) && isEnabled$1(element) && matchesAction(labelFor$1(element), action)
    ) || null;
  }
  function getSeekApplicationActionLabel() {
    const action = getSeekApplicationAction("submit") || getSeekApplicationAction("next") || getSeekApplicationAction("previous");
    return action ? labelFor$1(action) || void 0 : void 0;
  }
  function getSeekApplicationActionKind() {
    if (getSeekApplicationAction("submit")) return "submit";
    if (getSeekApplicationAction("next")) return "next";
    return void 0;
  }
  async function clickSeekApplicationAction(action) {
    const button = getSeekApplicationAction(action);
    if (!button) {
      return {
        status: "unavailable",
        message: action === "previous" ? "The SEEK Back action is not available." : action === "next" ? "The SEEK Continue action is not available." : "The SEEK submit action is not available.",
        url: window.location.href
      };
    }
    const actionLabel2 = labelFor$1(button) || void 0;
    button.scrollIntoView({ block: "center", inline: "nearest" });
    button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    button.click();
    return {
      status: "clicked",
      message: action === "previous" ? "SEEK application moved to the previous step." : action === "next" ? "SEEK application continued to the next step." : "SEEK application submitted.",
      url: window.location.href,
      ...actionLabel2 ? { actionLabel: actionLabel2 } : {}
    };
  }
  function cleanText$3(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }
  function isApplicationPage(url) {
    var _a2;
    if (/\/apply(?:\/|$)|\/application(?:\/|$)/i.test(url)) return true;
    const bodyText = cleanText$3((_a2 = document.body) == null ? void 0 : _a2.textContent);
    return /application|personal details|resume|cover letter/i.test(bodyText) && Boolean(getSeekApplicationActionLabel());
  }
  function isSeekJobPage(url) {
    try {
      const parsed = new URL(url);
      return /\/job\/\d+/i.test(parsed.pathname) || /^\d+$/.test(parsed.searchParams.get("jobId") || "");
    } catch {
      return false;
    }
  }
  function hasQuickApplyLink() {
    return Boolean(
      document.querySelector(
        "a[href*='/apply'], [data-automation='job-detail-apply'], [data-testid='job-detail-apply']"
      )
    );
  }
  function readSeekFormPage() {
    const url = window.location.href;
    const inspection = readSeekForm(
      url,
      isApplicationPage(url),
      getSeekApplicationActionLabel(),
      getSeekApplicationActionKind(),
      Boolean(getSeekApplicationAction("previous"))
    );
    if (inspection.kind === "not_application_form") {
      const pageInputs = readPageInputFields(url, "seek");
      if (pageInputs) return pageInputs;
    }
    if (inspection.kind === "not_application_form" && isSeekJobPage(url)) {
      return {
        ...inspection,
        reason: hasQuickApplyLink() ? "Click SEEK Quick apply to open the application form, then inspect the form again." : "Open the SEEK application form, then inspect the form again."
      };
    }
    return inspection;
  }
  const SELECTORS = {
    title: [
      ".job-details-jobs-unified-top-card__job-title-link",
      ".job-details-jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title-link",
      ".jobs-unified-top-card__job-title",
      ".jobs-details__main-content h1",
      "[data-testid='job-title']",
      "main h1 a[href*='/jobs/view/']",
      "main h1",
      "h1.t-24",
      ".jobs-details__main-content p",
      "[data-display-contents='true'] p",
      "[data-display-contents='true']"
    ],
    company: [
      ".job-details-jobs-unified-top-card__company-name a",
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name a",
      ".jobs-unified-top-card__company-name",
      "a[href*='/company/']",
      "[aria-label^='Company,']"
    ],
    location: [
      ".job-details-jobs-unified-top-card__primary-description-container",
      ".jobs-unified-top-card__primary-description-container",
      ".job-details-jobs-unified-top-card__bullet"
    ],
    description: [
      ".jobs-description__content .jobs-box__html-content",
      ".jobs-description__container .jobs-box__html-content",
      ".jobs-description__container .jobs-description-content__text",
      ".jobs-description__container",
      ".jobs-description",
      ".jobs-description-content__text",
      ".jobs-description__content",
      "[data-test-id='job-details-description']",
      "[data-testid='job-details-description']",
      "[data-testid='expandable-text-box']"
    ],
    easyApply: [
      "button.jobs-apply-button",
      ".jobs-apply-button button",
      ".jobs-apply-button",
      "button.jobs-apply-button--top-card",
      ".jobs-apply-button--top-card button",
      "button.jobs-s-apply",
      "button[aria-label*='Easy Apply']",
      "button[aria-label*='Easy apply']",
      "button[aria-label*='简单申请']",
      "button[aria-label*='轻松应聘']",
      "a[aria-label*='Easy Apply']",
      "[data-live-test-job-apply]",
      "a[href*='/jobs/view/'][href*='/apply']"
    ],
    applicationRoot: [
      ".jobs-easy-apply-modal",
      ".jobs-easy-apply-content",
      "#artdeco-modal-outlet .artdeco-modal",
      "#artdeco-modal-outlet [role='dialog']",
      ".artdeco-modal[role='dialog']",
      "[role='dialog'][aria-label*='Apply']",
      "[role='dialog'][aria-label*='申请']",
      "[role='dialog'][aria-label*='应聘']",
      "div[role='dialog']",
      "form.jobs-easy-apply-form",
      "#artdeco-modal-outlet [data-test-modal]",
      "#artdeco-modal-outlet [data-test-modal-container]",
      "[data-test-modal]"
    ],
    nextAction: [
      "button[aria-label*='Continue']",
      "button[aria-label*='Next']",
      "button[aria-label*='Review']",
      "button[aria-label*='继续']",
      "button[aria-label*='下一步']",
      ".jobs-easy-apply-modal footer button.artdeco-button--primary",
      "#artdeco-modal-outlet footer button.artdeco-button--primary",
      "[role='dialog'] footer button.artdeco-button--primary",
      "[role='dialog'] button.artdeco-button--primary"
    ],
    previousAction: [
      "button[aria-label*='Back']",
      "button[aria-label*='Previous']",
      "button[aria-label*='返回']",
      "button[aria-label*='上一步']",
      "button[aria-label*='back']",
      "button[aria-label*='previous']"
    ],
    submitAction: [
      "[data-live-test-easy-apply-submit-button]",
      "button[aria-label*='Submit application']",
      "button[aria-label*='Submit']",
      "button[aria-label*='提交应用']",
      "button[aria-label*='提交申请']",
      "button[aria-label*='提交']"
    ]
  };
  const APPLICATION_FIELD_SELECTOR = "input:not([type='hidden']), select, textarea";
  const APPLICATION_ROOT_SELECTOR = [
    ...SELECTORS.applicationRoot,
    "#artdeco-modal-outlet .artdeco-modal",
    "#artdeco-modal-outlet [role='dialog']",
    "#artdeco-modal-outlet [data-test-modal]",
    "#artdeco-modal-outlet [data-test-modal-container]",
    "[role='dialog']",
    "[data-test-modal]"
  ].filter((selector, index, selectors) => selectors.indexOf(selector) === index);
  const TITLE_METADATA = /* @__PURE__ */ new Set([
    "easy apply",
    "full-time",
    "hybrid",
    "internship",
    "linkedin",
    "no response insights available yet",
    "on-site",
    "part-time",
    "remote",
    "save",
    "temporary",
    "contract",
    "jobs",
    "job",
    "job details",
    "show all",
    "show more",
    "show less",
    "see all",
    "see more",
    "view all",
    "read more"
  ]);
  const INVALID_TITLE_PATTERNS = [
    /\b\d+\s+(?:connections?|alumni|school|employees?|reactions?|comments?|shares?|likes?|views?|reposts?)\b/i,
    /\b(?:connections?|alumni|reactions?|comments?|shares?|likes?|reposts?)\b/i,
    /\b(?:about\s+the\s+job|job\s+description|job\s+details|hiring\s+team)\b/i,
    /\b(?:people\s+also\s+viewed|similar\s+jobs|response\s+insights)\b/i,
    /\b(?:easy\s+apply|apply\s+now|apply\s+on\s+company)\b/i,
    /\b(?:company\s+logo|promoted|posted)\b/i,
    /\b(?:show\s+(?:all|more|less)|see\s+(?:all|more)|view\s+(?:all|more)|read\s+more)\b/i
  ];
  function cleanText$2(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }
  function extractCleanElementText(element) {
    const clone = element.cloneNode(true);
    const noisyNodes = clone.querySelectorAll(
      "button, script, style, svg, [role='img'], a[aria-label*='Verified'], .visually-hidden, .sr-only, [aria-hidden='true']"
    );
    noisyNodes.forEach((node) => node.remove());
    const rawText = cleanText$2(clone.textContent);
    return rawText.replace(
      /\b(?:show\s+(?:all|more|less)|see\s+(?:all|more)|view\s+(?:all|more)|read\s+more)\b/gi,
      ""
    ).trim();
  }
  function isVisible$1(element) {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }
  function isEnabled(element) {
    return !(element instanceof HTMLButtonElement && element.disabled) && element.getAttribute("aria-disabled") !== "true";
  }
  function deepElements(root) {
    const result2 = [];
    const visited = /* @__PURE__ */ new Set();
    const visit = (scope) => {
      if (visited.has(scope)) return;
      visited.add(scope);
      Array.from(scope.querySelectorAll("*")).forEach((element) => {
        result2.push(element);
        if (element.shadowRoot) visit(element.shadowRoot);
      });
    };
    visit(root);
    return result2;
  }
  function deepQueryAll(root, selector) {
    return deepElements(root).filter((element) => element.matches(selector));
  }
  function deepFirst(root, selector) {
    return deepQueryAll(root, selector)[0] || null;
  }
  function firstText(root, selectors) {
    for (const selector of selectors) {
      const element = deepFirst(root, selector);
      if (!element) continue;
      const text = extractCleanElementText(element);
      if (text) return text;
    }
    return "";
  }
  function descriptionText(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll("button, script, style, svg, [role='img'], .visually-hidden, .sr-only").forEach((node) => node.remove());
    return cleanText$2(clone.innerText || clone.textContent);
  }
  function firstDescriptionText(root, selectors) {
    for (const selector of selectors) {
      const element = deepFirst(root, selector);
      if (!element) continue;
      const text = descriptionText(element);
      if (text) return text;
    }
    return "";
  }
  function descriptionFromHeading(root) {
    const heading = deepElements(root).find((element) => {
      const text2 = cleanText$2(element.textContent);
      if (text2.length > 80) return false;
      return /^(?:about\s+the\s+job|job\s+description|job\s+details|职位描述|工作描述)$/i.test(text2);
    });
    if (!heading) return "";
    const container = heading.closest(
      "section, article, .jobs-description, .jobs-description__container, [data-test-id*='description' i], [data-testid*='description' i]"
    ) || heading.parentElement;
    if (!container) return "";
    const text = descriptionText(container);
    const headingText = cleanText$2(heading.textContent);
    const body = cleanText$2(text.replace(headingText, ""));
    return body.length >= 40 ? body : "";
  }
  function findVisible(root, selectors, predicate = () => true) {
    const elements = deepElements(root);
    for (const selector of selectors) {
      const element = elements.find(
        (candidate) => candidate.matches(selector) && predicate(candidate) && isVisible$1(candidate) && isEnabled(candidate)
      );
      if (element) return element;
    }
    return null;
  }
  function normalized$1(value) {
    return cleanText$2(value).toLowerCase();
  }
  function getJobDetailRoot() {
    const root = document.querySelector(
      ".jobs-search__job-details, .jobs-details__main-content, .job-details-jobs-unified-top-card, main"
    );
    return root || document;
  }
  const JOB_ROLE_KEYWORDS = /\b(?:engineer|developer|architect|lead|principal|senior|junior|mid|staff|manager|director|consultant|analyst|specialist|designer|administrator|coordinator|officer|executive|head|vp|intern|graduate|associate|agent|advisor|operator|technician|contractor)\b/i;
  function isLikelyTitle(value, company) {
    const text = cleanText$2(value);
    if (!text || text.length < 2 || text.length > 180) return false;
    if (TITLE_METADATA.has(text.toLowerCase())) return false;
    if (INVALID_TITLE_PATTERNS.some((pattern) => pattern.test(text))) return false;
    if (isPureLocation(text)) return false;
    if (/[·•]/.test(text) || /\b(?:ago|applicants?)\b/i.test(text)) return false;
    if (company) {
      const normText = normalized$1(text);
      const normComp = normalized$1(company);
      if (normText === normComp) return false;
      if (!JOB_ROLE_KEYWORDS.test(text) && normComp.length > 3 && (normComp.includes(normText) || normText.includes(normComp))) {
        return false;
      }
    }
    return true;
  }
  function isPureLocation(value) {
    const text = cleanText$2(value);
    if (!text) return false;
    if (JOB_ROLE_KEYWORDS.test(text)) return false;
    return /^[A-Za-z\s.-]+,\s*(?:NSW|VIC|QLD|WA|SA|TAS|ACT|NT|Australia|New South Wales|Victoria|Queensland|Western Australia|South Australia|Tasmania|Australian Capital Territory|Northern Territory)(?:,\s*Australia)?$/i.test(text);
  }
  function titleFromMain(company) {
    const root = getJobDetailRoot();
    const companyName = company;
    const paragraphs = Array.from(root.querySelectorAll("p")).map((element) => cleanText$2(element.textContent)).filter(Boolean);
    const companyIndex = paragraphs.findIndex((text) => text === companyName);
    if (companyIndex < 0) return "";
    return paragraphs.slice(companyIndex + 1, companyIndex + 5).find((t) => isLikelyTitle(t, companyName)) || "";
  }
  function titleFromDocument(jobId, company) {
    var _a2;
    if (!jobId) return "";
    const rawTitle = cleanText$2(document.title);
    const parts = rawTitle.split(/\s*\|\s*/);
    for (const part of parts) {
      const cleanedPart = part.replace(/\s*-\s*LinkedIn$/i, "").replace(/\b(?:LinkedIn|Search|Jobs?)\b/gi, "").trim();
      const candidate = cleanedPart.split(/\s+hiring\s+/i)[1] || cleanedPart.split(/\s+is\s+hiring\s+/i)[1] || cleanedPart;
      const titleOnly = ((_a2 = candidate.split(/\s+in\s+[^|-]+$/i)[0]) == null ? void 0 : _a2.trim()) || candidate;
      if (isLikelyTitle(titleOnly, company)) return titleOnly;
    }
    return "";
  }
  function titleFromJobLink(jobId, company) {
    const links = Array.from(document.querySelectorAll("a[href*='/jobs/view/']"));
    for (const link of links) {
      const href = link.getAttribute("href") || "";
      if (!new RegExp(`/jobs/view/${jobId}(?:/|\\?|$)`, "i").test(href)) continue;
      const text = extractCleanElementText(link);
      if (isLikelyTitle(text, company)) return text;
    }
    return "";
  }
  function titleFromPage(jobId, company) {
    const jobLinkTitle = titleFromJobLink(jobId, company);
    if (jobLinkTitle) return jobLinkTitle;
    const root = getJobDetailRoot();
    const selectedTitle = firstText(root, SELECTORS.title);
    if (isLikelyTitle(selectedTitle, company)) return selectedTitle;
    const documentTitle = titleFromDocument(jobId, company);
    return documentTitle || titleFromMain(company);
  }
  function locationFromPage() {
    const root = getJobDetailRoot();
    const selected = firstText(root, SELECTORS.location) || firstText(document, SELECTORS.location);
    if (selected) return selected.split(/\s*[·•]\s*/)[0] || void 0;
    const metadata = Array.from(root.querySelectorAll("p")).map((element) => cleanText$2(element.textContent)).find((text) => /\s*[·•]\s*/.test(text) && /\b(?:ago|applicants?)\b/i.test(text));
    return (metadata == null ? void 0 : metadata.split(/\s*[·•]\s*/)[0]) || void 0;
  }
  class LinkedInAdapter {
    constructor() {
      __publicField(this, "platformName", "linkedin");
      __publicField(this, "applicationRootCache");
      __publicField(this, "applicationActionCache", /* @__PURE__ */ new Map());
    }
    jobIdFromUrl(url) {
      const match = url.match(/\/jobs\/view\/(\d+)/i);
      if (match == null ? void 0 : match[1]) return match[1];
      try {
        const currentJobId = new URL(url).searchParams.get("currentJobId");
        return currentJobId && /^\d+$/.test(currentJobId) ? currentJobId : "";
      } catch {
        return "";
      }
    }
    isJobPageUrl(url) {
      return Boolean(this.jobIdFromUrl(url));
    }
    readJob(url) {
      const externalId = this.jobIdFromUrl(url);
      if (!externalId) return null;
      if (!this.hasCurrentJobReference(externalId)) return null;
      const root = getJobDetailRoot();
      const company = firstText(root, SELECTORS.company) || firstText(document, SELECTORS.company) || "Unknown company";
      const title = titleFromPage(externalId, company);
      if (!title) return null;
      const description = firstDescriptionText(root, SELECTORS.description) || firstDescriptionText(document, SELECTORS.description) || descriptionFromHeading(root) || descriptionFromHeading(document);
      return {
        externalId,
        title,
        company,
        location: locationFromPage(),
        description: description || void 0,
        easyApply: Boolean(this.findEasyApplyTrigger())
      };
    }
    getApplicationRoot() {
      if (this.applicationRootCache && this.applicationRootCache.isConnected && isVisible$1(this.applicationRootCache)) {
        return this.applicationRootCache;
      }
      this.applicationRootCache = void 0;
      const candidates = this.applicationRootCandidates();
      const activeRoot = candidates.find(
        (candidate) => this.isEasyApplyRoot(candidate) && this.isExplicitlyActiveModal(candidate)
      );
      if (activeRoot) {
        this.applicationRootCache = activeRoot;
        return activeRoot;
      }
      const modalRoot = candidates.find(
        (candidate) => this.isEasyApplyRoot(candidate) && isVisible$1(candidate) && isEnabled(candidate) && !this.hasHiddenModalAncestor(candidate)
      ) || null;
      if (modalRoot) {
        this.applicationRootCache = modalRoot;
        return modalRoot;
      }
      this.applicationRootCache = this.findApplicationRootFromHeading() || this.findFullPageApplicationRoot();
      return this.applicationRootCache;
    }
    invalidateApplicationRootCache() {
      this.applicationRootCache = void 0;
      this.applicationActionCache.clear();
    }
    invalidateApplicationActionCache() {
      this.applicationActionCache.clear();
    }
    getCachedApplicationRoot() {
      return this.applicationRootCache;
    }
    hasEasyApplyAction() {
      return Boolean(this.findEasyApplyTrigger());
    }
    isFullPageApplicationFlow() {
      try {
        const value = new URL(window.location.href).searchParams.get("openSDUIApplyFlow");
        return value === "true" || value === "1";
      } catch {
        return false;
      }
    }
    applicationFormDiagnostic() {
      const containers = Array.from(
        document.querySelectorAll(
          "#artdeco-modal-outlet [data-test-modal-container]"
        )
      );
      const candidates = this.applicationRootCandidates();
      const visibleCandidates = candidates.filter(
        (candidate) => isVisible$1(candidate) && !this.hasHiddenModalAncestor(candidate)
      );
      const easyApplyModals = document.querySelectorAll(
        ".jobs-easy-apply-modal"
      ).length;
      const activeContainers = containers.filter(
        (container) => container.getAttribute("aria-hidden") !== "true"
      ).length;
      const root = this.getApplicationRoot();
      const modalOutlet = document.querySelector("#artdeco-modal-outlet");
      const fieldScope = root || modalOutlet || document;
      const allFields = Array.from(
        fieldScope.querySelectorAll(APPLICATION_FIELD_SELECTOR)
      );
      const visibleFields = allFields.filter((field) => isVisible$1(field));
      const rootClasses = root && typeof root.className === "string" ? root.className.trim().split(/\s+/).filter(Boolean).slice(0, 3).join(".") : "";
      const rootDescription = root ? `${root.tagName.toLowerCase()}${rootClasses ? `.${rootClasses}` : ""}` : "none";
      const fieldScopeDescription = root ? "application root" : modalOutlet ? "modal outlet fallback" : "document fallback";
      return `诊断：modal outlet ${modalOutlet ? 1 : 0}；SDUI 全页流 ${this.isFullPageApplicationFlow() ? 1 : 0}；候选 dialog ${visibleCandidates.length}/${candidates.length}；活动 modal 容器 ${activeContainers}/${containers.length}；Easy Apply class ${easyApplyModals}；application root ${rootDescription}；表单字段 ${visibleFields.length}/${allFields.length}（scope: ${fieldScopeDescription}）。`;
    }
    getEasyApplyUrl() {
      const trigger = this.findEasyApplyTrigger();
      if (!(trigger instanceof HTMLAnchorElement)) return void 0;
      return trigger.href || void 0;
    }
    getCurrentApplicationAction(action) {
      const cached = this.applicationActionCache.get(action);
      if (cached && cached.isConnected && isVisible$1(cached) && isEnabled(cached)) {
        return cached;
      }
      this.applicationActionCache.delete(action);
      const root = this.getApplicationRoot();
      if (!root) {
        return null;
      }
      let result2 = null;
      if (action === "submit") {
        result2 = findVisible(root, SELECTORS.submitAction) || findVisible(
          root,
          [
            "button.artdeco-button--primary",
            'button[type="submit"]',
            "footer button.artdeco-button--primary",
            "footer button",
            "button",
            '[role="button"]'
          ],
          (candidate) => {
            const label = cleanText$2(
              candidate.textContent || candidate.getAttribute("aria-label")
            );
            return /(?:submit|提交|应聘|申请)/i.test(label);
          }
        );
      } else if (action === "previous") {
        result2 = findVisible(root, SELECTORS.previousAction) || findVisible(root, ["button", "footer button"], (candidate) => {
          const label = cleanText$2(
            candidate.textContent || candidate.getAttribute("aria-label")
          );
          return /(?:back|previous|上一步|返回)/i.test(label);
        }) || findVisible(
          document,
          [
            "button[aria-label*='Back to previous step']",
            "button[aria-label*='Back']",
            "button[aria-label*='Previous']"
          ],
          (candidate) => /(?:back|previous|上一步|返回)/i.test(
            cleanText$2(candidate.textContent || candidate.getAttribute("aria-label"))
          )
        );
      } else {
        const submitBtn = this.getCurrentApplicationAction("submit");
        result2 = findVisible(root, SELECTORS.nextAction, (candidate) => {
          if (candidate === submitBtn) return false;
          const label = cleanText$2(
            candidate.textContent || candidate.getAttribute("aria-label")
          );
          if (/(?:submit|提交|应聘|申请)/i.test(label)) return false;
          return true;
        });
        if (!result2) {
          result2 = findVisible(
            root,
            ["button", '[role="button"]'],
            (candidate) => {
              if (candidate === submitBtn) return false;
              const label = cleanText$2(
                candidate.textContent || candidate.getAttribute("aria-label")
              );
              return /(?:continue|next|review|继续|下一步|审核|检查)/i.test(label) && !/(?:submit|提交|应聘|申请)/i.test(label);
            }
          );
        }
      }
      this.applicationActionCache.set(action, result2);
      return result2;
    }
    getCurrentApplicationActionLabel() {
      const submit = this.getCurrentApplicationAction("submit");
      const next = this.getCurrentApplicationAction("next");
      const previous = this.getCurrentApplicationAction("previous");
      const action = submit || next || previous;
      if (!action) return void 0;
      return cleanText$2(action.textContent || action.getAttribute("aria-label")) || void 0;
    }
    getCurrentApplicationActionKind() {
      const submit = this.getCurrentApplicationAction("submit");
      if (submit) {
        return "submit";
      }
      if (this.getCurrentApplicationAction("next")) return "next";
      return void 0;
    }
    async openApplication() {
      const currentUrl = window.location.href;
      if (this.getApplicationRoot()) {
        return {
          status: "already_open",
          message: "LinkedIn Easy Apply is already open.",
          url: currentUrl
        };
      }
      let trigger = this.findEasyApplyTrigger();
      if (!trigger) {
        trigger = await this.waitForEasyApplyTrigger();
      }
      if (!trigger) {
        return {
          status: "unavailable",
          message: "LinkedIn Easy Apply is not available on this page.",
          url: currentUrl
        };
      }
      try {
        trigger.scrollIntoView({ block: "center", inline: "nearest" });
      } catch {
      }
      trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      trigger.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      trigger.click();
      if (await this.waitForApplicationRoot()) {
        return {
          status: "opened",
          message: "LinkedIn Easy Apply form is open.",
          url: window.location.href
        };
      }
      return {
        status: "clicked",
        message: "LinkedIn Easy Apply click was dispatched; waiting for the application form.",
        url: window.location.href
      };
    }
    async clickApplicationAction(action) {
      const currentUrl = window.location.href;
      const root = this.getApplicationRoot();
      if (!root) {
        return {
          status: "not_open",
          message: "Open the LinkedIn Easy Apply form first.",
          url: currentUrl
        };
      }
      this.invalidateApplicationActionCache();
      const button = this.getCurrentApplicationAction(action);
      if (!button) {
        return {
          status: "unavailable",
          message: action === "submit" ? "The LinkedIn submit action is not available yet." : action === "previous" ? "The LinkedIn previous action is not available." : "The LinkedIn next action is not available yet.",
          url: currentUrl
        };
      }
      const actionLabel2 = cleanText$2(button.textContent || button.getAttribute("aria-label")) || void 0;
      try {
        button.scrollIntoView({ block: "center", inline: "nearest" });
      } catch {
      }
      button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      button.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
      button.click();
      if (action === "submit" && !await this.waitForSubmissionConfirmation()) {
        return {
          status: "unavailable",
          message: "LinkedIn did not confirm the submission; review the application form before retrying.",
          url: currentUrl,
          ...actionLabel2 ? { actionLabel: actionLabel2 } : {}
        };
      }
      const message = action === "submit" ? "LinkedIn application submitted." : action === "previous" ? "LinkedIn application moved to the previous step." : "LinkedIn application moved to the next step.";
      return {
        status: "clicked",
        message,
        url: currentUrl,
        ...actionLabel2 ? { actionLabel: actionLabel2 } : {}
      };
    }
    findEasyApplyTrigger() {
      return findVisible(document, SELECTORS.easyApply, (element) => {
        const label = cleanText$2(
          element.getAttribute("aria-label") || element.textContent
        );
        const href = element.getAttribute("href") || "";
        const classList = typeof element.className === "string" ? element.className : "";
        const isExternal = /apply\s+on\s+company|continue\s+to\s+company|external/i.test(label);
        if (isExternal) return false;
        const isEasyApplyText = /(?:easy\s*apply|简单申请|輕鬆應聘|轻松应聘|一键应聘|一键申请)/i.test(
          label
        );
        const isEasyApplyUrl = /\/jobs\/view\/\d+\/apply(?:[/?#]|$)/i.test(href);
        const isApplyButtonClass = classList.includes("jobs-apply-button") || classList.includes("jobs-s-apply") || Boolean(element.closest(".jobs-apply-button"));
        const hasEasyApplyTestHook = element.hasAttribute("data-live-test-job-apply");
        return isEasyApplyText || isEasyApplyUrl || isApplyButtonClass && hasEasyApplyTestHook;
      });
    }
    isEasyApplyRoot(element) {
      var _a2;
      const className = typeof element.className === "string" ? element.className : "";
      if (/jobs-easy-apply-(?:modal|content|form)/i.test(className)) return true;
      const label = cleanText$2(
        `${element.getAttribute("aria-label") || ""} ${((_a2 = deepFirst(element, 'h1, h2, [role="heading"]')) == null ? void 0 : _a2.textContent) || ""}`
      );
      if (/(?:easy\s*apply|简单申请|輕鬆應聘|轻松应聘|一键应聘|一键申请)/i.test(label)) {
        return true;
      }
      const hasApplicationField = Boolean(deepFirst(element, APPLICATION_FIELD_SELECTOR));
      if (/(?:apply\s+to|申请(?:职位|工作)?|应聘)/i.test(label) && hasApplicationField) {
        return true;
      }
      const hasApplicationAction = Boolean(deepFirst(
        element,
        'form.jobs-easy-apply-form, [data-live-test-easy-apply-submit-button], [data-live-test-easy-apply-next-button], button[aria-label*="Continue"], button[aria-label*="Next"], button[aria-label*="Review"], button[aria-label*="Submit"]'
      ));
      const isModalLike2 = element.matches(
        '[role="dialog"], .artdeco-modal, [data-test-modal], [data-test-modal-container], .jobs-easy-apply-content, form.jobs-easy-apply-form'
      );
      return isModalLike2 && (hasApplicationField || hasApplicationAction);
    }
    applicationRootCandidates() {
      const seen = /* @__PURE__ */ new Set();
      const candidates = [];
      const elements = deepElements(document);
      for (const selector of APPLICATION_ROOT_SELECTOR) {
        elements.filter((element) => element.matches(selector)).forEach((candidate) => {
          if (seen.has(candidate)) return;
          seen.add(candidate);
          candidates.push(candidate);
        });
      }
      return candidates;
    }
    findFullPageApplicationRoot() {
      if (!this.isFullPageApplicationFlow()) return null;
      const seen = /* @__PURE__ */ new Set();
      const candidates = [];
      const elements = deepElements(document);
      const addCandidates = (selector) => {
        elements.filter((element) => element.matches(selector)).forEach((candidate) => {
          if (seen.has(candidate)) return;
          seen.add(candidate);
          candidates.push(candidate);
        });
      };
      addCandidates("form");
      addCandidates("[data-testid*='application'], [data-test*='application']");
      addCandidates("main");
      return candidates.find(
        (candidate) => isVisible$1(candidate) && !this.hasHiddenModalAncestor(candidate) && (this.hasVisibleApplicationField(candidate) || this.hasApplicationAction(candidate))
      ) || null;
    }
    findApplicationRootFromHeading() {
      const heading = deepElements(document).find((element) => {
        if (!isVisible$1(element)) return false;
        const text = cleanText$2(element.textContent);
        return /^apply\s+to\s+.+/i.test(text) || /^申请(?:职位|工作)?\s*.+/.test(text);
      });
      if (!heading) return null;
      let candidate = heading;
      for (let depth = 0; candidate && depth < 9; depth += 1) {
        if (isVisible$1(candidate) && this.hasVisibleApplicationField(candidate) && this.hasApplicationAction(candidate)) {
          return candidate;
        }
        const currentRoot = candidate.getRootNode();
        const shadowHost = currentRoot instanceof ShadowRoot && currentRoot.host instanceof HTMLElement ? currentRoot.host : null;
        candidate = candidate.parentElement || shadowHost;
      }
      return null;
    }
    hasVisibleApplicationField(root) {
      return deepQueryAll(root, APPLICATION_FIELD_SELECTOR).some((field) => isVisible$1(field));
    }
    hasApplicationAction(root) {
      return deepQueryAll(root, 'button, [role="button"]').some((button) => {
        const label = cleanText$2(
          button.textContent || button.getAttribute("aria-label")
        );
        return isVisible$1(button) && /(?:continue|next|review|submit|申请|提交|继续|下一步|审核|检查)/i.test(label);
      });
    }
    hasHiddenModalAncestor(element) {
      let current = element;
      while (current) {
        if (current.getAttribute("aria-hidden") === "true") return true;
        current = current.parentElement;
      }
      return false;
    }
    isExplicitlyActiveModal(element) {
      if (this.hasHiddenModalAncestor(element)) return false;
      const container = element.closest(
        "[data-test-modal-container], [data-test-modal]"
      );
      if (!container) return false;
      const ariaHidden = container.getAttribute("aria-hidden");
      return ariaHidden === "false" || ariaHidden === null && isVisible$1(container);
    }
    async waitForApplicationRoot() {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const root = this.getApplicationRoot();
        if (root) return root;
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      }
      return this.getApplicationRoot();
    }
    async waitForEasyApplyTrigger() {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const trigger = this.findEasyApplyTrigger();
        if (trigger) return trigger;
        await new Promise((resolve) => window.setTimeout(resolve, 150));
      }
      return this.findEasyApplyTrigger();
    }
    hasCurrentJobReference(jobId) {
      if (!jobId) return false;
      const currentUrl = window.location.href;
      const jobPattern = new RegExp(`/jobs/view/${jobId}(?:/|\\?|$)`, "i");
      if (jobPattern.test(currentUrl) || new URLSearchParams(window.location.search).get("currentJobId") === jobId) {
        return true;
      }
      const titleLink = document.querySelector(
        "main h1 a[href*='/jobs/view/'], main [role='heading'][aria-level='1'] a[href*='/jobs/view/']"
      );
      if (titleLink) return jobPattern.test(titleLink.getAttribute("href") || "");
      const links = Array.from(
        document.querySelectorAll("a[href*='/jobs/view/']")
      );
      if (!links.length) return true;
      return links.some(
        (link) => jobPattern.test(link.getAttribute("href") || "")
      );
    }
    async waitForSubmissionConfirmation() {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        if (this.hasSubmissionConfirmation()) return true;
        if (attempt > 0 && !this.getApplicationRoot()) return true;
        await new Promise((resolve) => window.setTimeout(resolve, 100));
      }
      return !this.getApplicationRoot() || this.hasSubmissionConfirmation();
    }
    hasSubmissionConfirmation() {
      var _a2;
      const bodyText = cleanText$2((_a2 = document.body) == null ? void 0 : _a2.textContent);
      return /application (?:was )?sent|application submitted|you(?:'|’)ve applied/i.test(
        bodyText
      );
    }
  }
  const linkedinAdapter = new LinkedInAdapter();
  function readLinkedInPage() {
    const url = window.location.href;
    const jobId = linkedinAdapter.jobIdFromUrl(url);
    if (!jobId) {
      return { kind: "not_job_page", platform: "linkedin", url, reason: "The URL does not identify a LinkedIn job." };
    }
    const job = linkedinAdapter.readJob(url);
    if (!job) {
      return { kind: "not_job_page", platform: "linkedin", url, reason: "The LinkedIn job title is not available yet." };
    }
    const snapshot = {
      platform: "linkedin",
      externalId: job.externalId,
      url,
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      technologies: extractTechnologyKeywords(job.description),
      easyApply: job.easyApply
    };
    return { kind: "job", snapshot };
  }
  const CANDIDATE_SELECTOR = [
    "form",
    "dialog",
    "[role='dialog']",
    "[aria-modal='true']",
    "[data-modal]",
    "[data-testid*='modal' i]",
    "[class*='modal' i]"
  ].join(", ");
  const ACTION_SELECTOR = "button, input[type='submit'], [role='button']";
  function cleanText$1(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }
  function isModalLike(element) {
    return element.matches("dialog, [role='dialog'], [aria-modal='true'], [data-modal], [data-testid*='modal' i], [class*='modal' i]");
  }
  function actionLabel(element) {
    return cleanText$1(element.textContent || element.getAttribute("aria-label") || element.getAttribute("value"));
  }
  function hasFormAction(scope) {
    return elementsInScope(scope).some((element) => {
      if (!element.matches(ACTION_SELECTOR) || !isVisibleElement(element)) return false;
      return /submit|continue|next|review|apply|finish|save|send|提交|继续|下一步|审核|申请|完成|保存/i.test(actionLabel(element));
    });
  }
  function scoreCandidate(candidate) {
    const fields = inspectVisibleFormFields(candidate);
    if (fields.length === 0) return -1;
    let score = fields.length * 25;
    if (candidate.matches("form")) score += 70;
    if (isModalLike(candidate)) score += 90;
    if (hasFormAction(candidate)) score += 20;
    if (isVisibleElement(candidate)) score += 10;
    return score;
  }
  function findActiveFormScope(root = document) {
    const candidates = elementsInScope(root).filter((element) => element.matches(CANDIDATE_SELECTOR)).slice(-120);
    let best = null;
    let bestScore = -1;
    for (const candidate of candidates) {
      const score = scoreCandidate(candidate);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  }
  function readGenericAction(scope) {
    const actions = elementsInScope(scope).filter((element) => element.matches(ACTION_SELECTOR) && isVisibleElement(element)).map(actionLabel).filter(Boolean);
    const submit = actions.find((label) => /submit|apply|finish|send|提交|申请|完成/i.test(label));
    if (submit) return { label: submit, action: "submit" };
    const next = actions.find((label) => /continue|next|review|save|继续|下一步|审核|保存/i.test(label));
    return next ? { label: next, action: "next" } : {};
  }
  function hasGenericBackAction(scope) {
    return elementsInScope(scope).some((element) => {
      if (!element.matches(ACTION_SELECTOR) || !isVisibleElement(element)) return false;
      return /back|previous|返回|上一步/i.test(actionLabel(element));
    });
  }
  function readLinkedInFormPage() {
    const url = window.location.href;
    linkedinAdapter.invalidateApplicationActionCache();
    const applicationRoot = linkedinAdapter.getApplicationRoot() || findActiveFormScope();
    const genericAction = applicationRoot ? readGenericAction(applicationRoot) : {};
    const actionLabel2 = linkedinAdapter.getCurrentApplicationActionLabel() || genericAction.label;
    const actionKind = linkedinAdapter.getCurrentApplicationActionKind() || genericAction.action;
    const inspection = readApplicationForm(
      url,
      "linkedin",
      Boolean(applicationRoot),
      actionLabel2,
      applicationRoot,
      actionKind,
      Boolean(linkedinAdapter.getCurrentApplicationAction("previous")) || Boolean(applicationRoot && hasGenericBackAction(applicationRoot))
    );
    if (inspection.kind === "not_application_form" && linkedinAdapter.isJobPageUrl(url)) {
      const diagnostic = linkedinAdapter.applicationFormDiagnostic();
      const reason = applicationRoot ? `检测到 LinkedIn 申请 modal，但当前没有可见表单字段。请等待表单加载后再次检测。 ${diagnostic}` : linkedinAdapter.isFullPageApplicationFlow() ? `检测到 LinkedIn SDUI 全页申请流，但没有找到可安全绑定的申请表容器。请确认页面已完成加载后再次检测。 ${diagnostic}` : linkedinAdapter.hasEasyApplyAction() ? `Click LinkedIn Easy Apply to open the application form, then inspect the form again. ${diagnostic}` : `Open the LinkedIn application form, then inspect the form again. ${diagnostic}`;
      return {
        ...inspection,
        reason
      };
    }
    return inspection;
  }
  function readGenericFormPage() {
    const url = window.location.href;
    const scope = findActiveFormScope();
    if (!scope) {
      return {
        kind: "not_application_form",
        platform: "generic",
        url,
        reason: "No visible form dialog or form fields were found."
      };
    }
    const action = readGenericAction(scope);
    return readApplicationForm(
      url,
      "generic",
      true,
      action.label,
      scope,
      action.action,
      false
    );
  }
  function isLinkedInHost(hostname) {
    return hostname === "linkedin.com" || hostname.endsWith(".linkedin.com");
  }
  function isSeekHost$1(hostname) {
    return hostname === "seek.com" || hostname.endsWith(".seek.com") || hostname === "seek.com.au" || hostname.endsWith(".seek.com.au");
  }
  let lastLinkedInRead = null;
  function readCurrentPage() {
    const url = window.location.href;
    if (isSeekHost$1(window.location.hostname)) return readSeekPage();
    if (isLinkedInHost(window.location.hostname)) return readLinkedInPage();
    return { kind: "unsupported_page", url, reason: "This page is not supported yet." };
  }
  async function readCurrentPageWhenReady() {
    if (isLinkedInHost(window.location.hostname)) return readLinkedInPageWhenReady();
    let inspection = readCurrentPage();
    if (inspection.kind !== "not_job_page" || !inspection.reason.includes("title")) return inspection;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 150));
      inspection = readCurrentPage();
      if (inspection.kind === "job") return inspection;
    }
    return inspection;
  }
  async function readLinkedInPageWhenReady() {
    let observedUrl = window.location.href;
    let previousSignature = "";
    let inspection = readCurrentPage();
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const currentUrl = window.location.href;
      if (currentUrl !== observedUrl) {
        observedUrl = currentUrl;
        previousSignature = "";
      }
      inspection = readCurrentPage();
      if (inspection.kind === "job") {
        const signature2 = `${inspection.snapshot.externalId}:${inspection.snapshot.title}:${inspection.snapshot.company}`;
        const routeChanged = !lastLinkedInRead || lastLinkedInRead.url !== observedUrl;
        const previousReadSignature = lastLinkedInRead ? `${lastLinkedInRead.externalId}:${lastLinkedInRead.title}:${lastLinkedInRead.company}` : "";
        const contentChanged = signature2 !== previousReadSignature;
        const descriptionReady = Boolean(inspection.snapshot.description);
        if (descriptionReady && (!lastLinkedInRead || !routeChanged || contentChanged && previousSignature === signature2)) {
          lastLinkedInRead = {
            url: observedUrl,
            externalId: inspection.snapshot.externalId,
            title: inspection.snapshot.title,
            company: inspection.snapshot.company
          };
          return inspection;
        }
        previousSignature = signature2;
      } else {
        previousSignature = "";
      }
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }
    if (inspection.kind === "job") {
      lastLinkedInRead = {
        url: observedUrl,
        externalId: inspection.snapshot.externalId,
        title: inspection.snapshot.title,
        company: inspection.snapshot.company
      };
    }
    return inspection;
  }
  function readCurrentForm() {
    if (isSeekHost$1(window.location.hostname)) return readSeekFormPage();
    if (isLinkedInHost(window.location.hostname)) return readLinkedInFormPage();
    return readGenericFormPage();
  }
  function getCurrentFormScope() {
    if (isSeekHost$1(window.location.hostname)) return findActiveFormScope() || document;
    if (isLinkedInHost(window.location.hostname)) return linkedinAdapter.getApplicationRoot() || findActiveFormScope();
    return findActiveFormScope();
  }
  const DISCOVERY_SELECTOR = [
    "form",
    "dialog",
    "[role='dialog']",
    "[aria-modal='true']",
    "[data-modal]",
    "[data-testid*='modal' i]",
    "button[data-live-test-easy-apply-next-button]",
    "button[aria-label*='Continue']",
    "button[aria-label*='Next']"
  ].join(", ");
  function signature(form) {
    return JSON.stringify({
      kind: form.kind,
      url: form.url,
      ...form.kind === "application_form" ? {
        action: form.action,
        canGoBack: form.canGoBack,
        fields: form.fields.map((field) => ({
          key: field.key,
          id: field.id,
          name: field.name,
          type: field.type,
          label: field.label,
          required: field.required,
          filled: field.filled,
          sensitive: field.sensitive,
          currentValue: field.currentValue || "",
          options: field.options
        }))
      } : form.kind === "page_input_fields" ? {
        fields: form.fields.map((field) => ({
          key: field.key,
          id: field.id,
          name: field.name,
          type: field.type,
          label: field.label,
          required: field.required,
          filled: field.filled,
          sensitive: field.sensitive,
          currentValue: field.currentValue || "",
          options: field.options
        }))
      } : {}
    });
  }
  function observeShadowRootsIn(node, observe) {
    if (node instanceof ShadowRoot || node instanceof Document) {
      node.querySelectorAll("*").forEach((element) => {
        if (element.shadowRoot) observe(element.shadowRoot);
      });
      return;
    }
    if (!(node instanceof Element)) return;
    if (node.shadowRoot) observe(node.shadowRoot);
    node.querySelectorAll("*").forEach((element) => {
      if (element.shadowRoot) observe(element.shadowRoot);
    });
  }
  function watchFormScope(scope, readForm, initialForm) {
    var _a2, _b2;
    (_a2 = window.__jobbyFormObserverCleanup) == null ? void 0 : _a2.call(window);
    (_b2 = window.__jobbyFormDiscoveryCleanup) == null ? void 0 : _b2.call(window);
    if (!scope) return;
    let timer;
    let lastSignature = signature(initialForm || readForm());
    const observedRoots = /* @__PURE__ */ new WeakSet();
    const eventRoots = [];
    let schedule;
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => observeShadowRootsIn(node, observeRoot));
      });
      schedule();
    });
    schedule = () => {
      if (timer !== void 0) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        var _a3;
        if (!scope.isConnected) {
          linkedinAdapter.invalidateApplicationRootCache();
        } else {
          linkedinAdapter.invalidateApplicationActionCache();
        }
        const form = readForm();
        const nextSignature = signature(form);
        if (nextSignature === lastSignature) return;
        lastSignature = nextSignature;
        void chrome.runtime.sendMessage({ type: "content.form-changed", form }).catch(() => void 0);
        if (form.kind !== "application_form") {
          (_a3 = window.__jobbyFormObserverCleanup) == null ? void 0 : _a3.call(window);
          startFormDiscovery(readForm);
        }
      }, 50);
    };
    const listenForValueChanges = (root) => {
      root.addEventListener("input", schedule, true);
      root.addEventListener("change", schedule, true);
      eventRoots.push(root);
    };
    function observeRoot(root) {
      if (observedRoots.has(root)) return;
      observedRoots.add(root);
      if (!(scope instanceof Document)) {
        observer.observe(root, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ["aria-hidden", "aria-disabled", "disabled"]
        });
      }
      listenForValueChanges(root);
      observeShadowRootsIn(root, observeRoot);
    }
    if (!(scope instanceof Document)) {
      observer.observe(scope, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["aria-hidden", "aria-disabled", "disabled"]
      });
    }
    listenForValueChanges(scope);
    observeShadowRootsIn(scope, observeRoot);
    window.__jobbyFormObserverCleanup = () => {
      observer.disconnect();
      eventRoots.forEach((root) => {
        root.removeEventListener("input", schedule, true);
        root.removeEventListener("change", schedule, true);
      });
      if (timer !== void 0) window.clearTimeout(timer);
    };
  }
  function startFormDiscovery(readForm) {
    var _a2;
    (_a2 = window.__jobbyFormDiscoveryCleanup) == null ? void 0 : _a2.call(window);
    const observedRoots = /* @__PURE__ */ new WeakSet();
    let timer;
    const discovery = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => observeShadowRootsIn(node, observeRoot)));
      if (!records.some((record) => Array.from(record.addedNodes).some(hasDiscoverySignal))) return;
      if (timer !== void 0) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const form = readForm();
        if (form.kind !== "application_form") return;
        const scope = getCurrentFormScope();
        if (!scope) return;
        void chrome.runtime.sendMessage({ type: "content.form-changed", form }).catch(() => void 0);
        watchFormScope(scope, readForm, form);
      }, 50);
    });
    function observeRoot(root) {
      if (observedRoots.has(root)) return;
      observedRoots.add(root);
      discovery.observe(root, { childList: true, subtree: true });
      observeShadowRootsIn(root, observeRoot);
    }
    discovery.observe(document, { childList: true, subtree: true });
    observeShadowRootsIn(document, observeRoot);
    const onFocus = (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches("input, select, textarea, [contenteditable='true']")) return;
      if (timer !== void 0) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const form = readForm();
        if (form.kind !== "application_form") return;
        const scope = getCurrentFormScope();
        if (scope) watchFormScope(scope, readForm, form);
      }, 50);
    };
    document.addEventListener("focusin", onFocus, true);
    window.__jobbyFormDiscoveryCleanup = () => {
      discovery.disconnect();
      document.removeEventListener("focusin", onFocus, true);
      if (timer !== void 0) window.clearTimeout(timer);
    };
  }
  function hasDiscoverySignal(node) {
    if (!(node instanceof Element)) return false;
    return node.matches(DISCOVERY_SELECTOR) || Boolean(node.querySelector(DISCOVERY_SELECTOR));
  }
  function cleanText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }
  function normalized(value) {
    return cleanText(value).toLowerCase();
  }
  function result(instruction, status, message) {
    return { commandId: instruction.commandId, key: instruction.target.key, status, message };
  }
  function fieldType(element) {
    if (element instanceof HTMLSelectElement) return "select";
    if (element instanceof HTMLTextAreaElement) return "textarea";
    const type = element.type.toLowerCase();
    if (type === "text" || type === "search") return "text";
    if (["checkbox", "radio", "file", "number", "email", "tel", "url", "date", "password"].includes(type)) {
      return type;
    }
    return "unknown";
  }
  function labelFor(element, scope) {
    var _a2, _b2, _c;
    const root = element.getRootNode();
    const queryScope = root instanceof Document || root instanceof ShadowRoot ? root : scope;
    const ariaLabel = cleanText(element.getAttribute("aria-label"));
    if (ariaLabel) return ariaLabel;
    if (element.id) {
      const label = queryScope.querySelector(`label[for='${CSS.escape(element.id)}']`);
      const text = cleanText(label == null ? void 0 : label.textContent);
      if (text) return text;
    }
    const parentLabel = cleanText((_a2 = element.closest("label")) == null ? void 0 : _a2.textContent);
    if (parentLabel) return parentLabel;
    const legend = cleanText((_c = (_b2 = element.closest("fieldset")) == null ? void 0 : _b2.querySelector("legend")) == null ? void 0 : _c.textContent);
    if (legend) return legend;
    return cleanText(element.getAttribute("placeholder")) || cleanText(element.getAttribute("name")) || "Unnamed field";
  }
  function isVisible(element) {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  }
  function findFormElement(target, scope) {
    const controls = visibleControlsInScope(scope);
    const keyed = controls.find((element, index) => fieldKeyFor(element, index) === target.key);
    if (keyed && (!target.id || keyed.id === target.id) && (!target.name || keyed.getAttribute("name") === target.name)) {
      return keyed;
    }
    if (target.id) {
      const element = controls.find((candidate) => candidate.id === target.id);
      if (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) {
        return isVisible(element) ? element : null;
      }
    }
    if (target.name) {
      const elements = controls.filter((element) => element.getAttribute("name") === target.name);
      const visibleElements = elements.filter((element) => isVisible(element));
      return visibleElements.find(
        (element) => fieldType(element) === target.type && normalized(labelFor(element, scope)) === normalized(target.label)
      ) || visibleElements[0] || null;
    }
    return null;
  }
  function findFileInput(target, scope) {
    const files = elementsInScope(scope).filter(
      (element) => element instanceof HTMLInputElement && element.type.toLowerCase() === "file"
    );
    const keyed = files.find((element, index) => fieldKeyFor(element, visibleControlsInScope(scope).length + index) === target.key);
    if (keyed && (!target.id || keyed.id === target.id) && (!target.name || keyed.name === target.name)) return keyed;
    if (target.id) return files.find((element) => element.id === target.id) || null;
    if (target.name) return files.find((element) => element.name === target.name) || null;
    return null;
  }
  function fileUploadTrigger(input, scope) {
    const root = input.getRootNode();
    const queryScope = root instanceof Document || root instanceof ShadowRoot ? root : scope;
    return (input.id ? queryScope.querySelector(`label[for='${CSS.escape(input.id)}']`) : null) || (input.id ? queryScope.querySelector(`[aria-controls='${CSS.escape(input.id)}']`) : null) || input;
  }
  function selectExistingDocument(input, optionId, scope) {
    const root = input.getRootNode();
    const queryScope = root instanceof Document || root instanceof ShadowRoot ? root : scope;
    const option = queryScope.querySelector(`input[type='radio'][id='${CSS.escape(optionId)}']`);
    if (!option) return "not_found";
    if (option.checked) return "already_selected";
    clickRadioOption(option, scope);
    return option.checked ? "selected" : "not_found";
  }
  function setValue(element, value) {
    var _a2;
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = (_a2 = Object.getOwnPropertyDescriptor(prototype, "value")) == null ? void 0 : _a2.set;
    if (setter) setter.call(element, value);
    else element.value = value;
  }
  function setChecked(element, checked) {
    var _a2;
    const setter = (_a2 = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "checked")) == null ? void 0 : _a2.set;
    if (setter) setter.call(element, checked);
    else element.checked = checked;
  }
  function emitChange(element) {
    const eventOptions = { bubbles: true, composed: true };
    try {
      element.dispatchEvent(new InputEvent("input", { ...eventOptions, inputType: "insertText" }));
    } catch {
      element.dispatchEvent(new Event("input", eventOptions));
    }
    element.dispatchEvent(new Event("change", eventOptions));
    element.dispatchEvent(new FocusEvent("focusout", eventOptions));
    element.dispatchEvent(new FocusEvent("blur", eventOptions));
  }
  function matchesTarget(element, instruction, scope) {
    const normLabel = normalized(labelFor(element, scope));
    const targetNorm = normalized(instruction.target.label);
    return fieldType(element) === instruction.target.type && (normLabel === targetNorm || normLabel.length > 3 && targetNorm.length > 3 && (normLabel.includes(targetNorm) || targetNorm.includes(normLabel)));
  }
  function setSelectValue(element, value) {
    var _a2;
    const setter = (_a2 = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")) == null ? void 0 : _a2.set;
    if (setter) setter.call(element, value);
    else element.value = value;
  }
  function fillSelect(element, value) {
    const normValue = normalized(value);
    const option = Array.from(element.options).find(
      (candidate) => candidate.value === value || normalized(candidate.value) === normValue || normalized(candidate.textContent || "") === normValue || normValue.length > 1 && normalized(candidate.textContent || "").includes(normValue) || normValue.length > 1 && normValue.includes(normalized(candidate.textContent || ""))
    );
    if (!option) return false;
    setSelectValue(element, option.value);
    return element.value === option.value;
  }
  function optionLabelFor(element, scope) {
    var _a2;
    const root = element.getRootNode();
    const queryScope = root instanceof Document || root instanceof ShadowRoot ? root : scope;
    const ariaLabel = cleanText(element.getAttribute("aria-label"));
    if (ariaLabel) return ariaLabel;
    const id = cleanText(element.id);
    if (id) {
      const label = queryScope.querySelector(`label[for='${CSS.escape(id)}']`);
      const text = cleanText(label == null ? void 0 : label.textContent);
      if (text) return text;
    }
    const parentLabel = cleanText((_a2 = element.closest("label")) == null ? void 0 : _a2.textContent);
    if (parentLabel) return parentLabel;
    if (element instanceof HTMLInputElement && element.value) return element.value;
    return "";
  }
  function clickRadioOption(element, scope) {
    const root = element.getRootNode();
    const queryScope = root instanceof Document || root instanceof ShadowRoot ? root : scope;
    const explicitLabel = element.id ? queryScope.querySelector(`label[for='${CSS.escape(element.id)}']`) : null;
    const target = explicitLabel || element.closest("label, [role='radio']") || element;
    const eventOptions = { bubbles: true, cancelable: true, composed: true };
    target.dispatchEvent(new PointerEvent("pointerdown", eventOptions));
    target.dispatchEvent(new MouseEvent("mousedown", eventOptions));
    target.dispatchEvent(new PointerEvent("pointerup", eventOptions));
    target.dispatchEvent(new MouseEvent("mouseup", eventOptions));
    target.click();
  }
  function fillRadio(element, value, scope) {
    const root = element.getRootNode();
    const queryScope = root instanceof Document || root instanceof ShadowRoot ? root : scope;
    const group = element.name ? Array.from(queryScope.querySelectorAll(`input[type='radio'][name='${CSS.escape(element.name)}']`)) : [element];
    const targetNorm = normalized(value);
    const selected = group.find(
      (candidate) => candidate.value === value || normalized(candidate.value) === targetNorm || normalized(optionLabelFor(candidate, scope)) === targetNorm || normalized(labelFor(candidate, scope)) === targetNorm || targetNorm.length > 1 && normalized(optionLabelFor(candidate, scope)).includes(targetNorm) || targetNorm.length > 1 && targetNorm.includes(normalized(optionLabelFor(candidate, scope)))
    );
    if (!selected) return false;
    clickRadioOption(selected, scope);
    if (!selected.checked) {
      setChecked(selected, true);
      emitChange(selected);
    }
    return true;
  }
  function fillFormField(instruction, scope = document) {
    if (!scope) return result(instruction, "not_found", "No supported application form is open.");
    if (instruction.target.type === "file") {
      const input = findFileInput(instruction.target, scope);
      if (!input) return result(instruction, "not_found", "The upload control is no longer available.");
      if (typeof instruction.value === "string" && instruction.source === "panel") {
        const selection = selectExistingDocument(input, instruction.value, scope);
        if (selection === "selected") return result(instruction, "filled", "Existing document selected.");
        if (selection === "already_selected") return result(instruction, "already_filled", "This document is already selected.");
        return result(instruction, "rejected", "The selected document is no longer available.");
      }
      return result(instruction, "requires_user_action", "Choose a local file through the browser file picker.");
    }
    const element = findFormElement(instruction.target, scope);
    if (!element) return result(instruction, "not_found", "The targeted field is no longer visible.");
    if (instruction.source !== "panel" && !matchesTarget(element, instruction, scope)) {
      return result(instruction, "rejected", "The field identity changed; no value was written.");
    }
    const type = fieldType(element);
    if (type === "password") {
      return result(instruction, "requires_user_action", "Sensitive fields require explicit user handling.");
    }
    if (type === "unknown") return result(instruction, "rejected", "This field type is not supported.");
    if (type === "checkbox") {
      if (typeof instruction.value !== "boolean") return result(instruction, "rejected", "Checkbox values must be boolean.");
      const checkbox = element;
      if (checkbox.checked === instruction.value) return result(instruction, "already_filled", "Checkbox already has the requested value.");
      checkbox.click();
      if (checkbox.checked !== instruction.value) {
        setChecked(checkbox, instruction.value);
        emitChange(checkbox);
      }
      return result(instruction, "filled", "Checkbox value updated.");
    }
    if (type === "radio") {
      if (typeof instruction.value !== "string") return result(instruction, "rejected", "Radio values must be strings.");
      if (!fillRadio(element, instruction.value, scope)) return result(instruction, "rejected", "The requested radio option is unavailable.");
      return result(instruction, "filled", "Radio option selected.");
    }
    if (typeof instruction.value !== "string") return result(instruction, "rejected", "This field requires a string value.");
    if (type === "select") {
      const select = element;
      const previousValue = select.value;
      if (!fillSelect(select, instruction.value)) return result(instruction, "rejected", "The requested select option is unavailable.");
      if (select.value === previousValue) return result(instruction, "already_filled", "Select already has the requested value.");
      emitChange(select);
      return result(instruction, "filled", "Select value updated.");
    }
    const textElement = element;
    if (textElement.value === instruction.value) return result(instruction, "already_filled", "Field already has the requested value.");
    setValue(textElement, instruction.value);
    emitChange(textElement);
    return result(instruction, "filled", "Field value updated.");
  }
  function fillFormFieldValue(target, value, scope = document) {
    return fillFormField(
      {
        commandId: `panel-${Date.now()}-${target.key}`,
        source: "panel",
        target,
        value
      },
      scope
    );
  }
  function questionContainerFor(element) {
    const semanticContainer = element.closest(
      [
        "fieldset",
        "[role='group']",
        ".fb-dash-form-element",
        ".jobs-easy-apply-form-element",
        "[data-test-form-element]",
        "[data-test-form-element-container]",
        ".artdeco-text-input--container",
        ".artdeco-dropdown",
        ".artdeco-toggle"
      ].join(", ")
    );
    if (semanticContainer) return semanticContainer;
    const wrappingLabel = element.closest("label");
    if (wrappingLabel) return wrappingLabel;
    let candidate = element;
    for (let depth = 0; depth < 4; depth += 1) {
      const parent = candidate.parentElement;
      if (!parent || !isVisible(parent)) break;
      const rect = parent.getBoundingClientRect();
      const hasQuestionText = Boolean(parent.querySelector("label, legend, [aria-label]"));
      if (hasQuestionText && rect.height > element.getBoundingClientRect().height + 8 && rect.height < 420) {
        return parent;
      }
      candidate = parent;
    }
    return element;
  }
  function focusFormField(target, scope = document) {
    if (!scope) return { key: target.key, status: "not_found", message: "No active form scope." };
    if (target.type === "file") {
      const input = findFileInput(target, scope);
      if (!input) return { key: target.key, status: "not_found", message: "The upload control is no longer available." };
      const trigger = fileUploadTrigger(input, scope);
      trigger.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
      trigger.click();
      return { key: target.key, status: "focused", message: "The native file picker was opened." };
    }
    const element = findFormElement(target, scope);
    if (!element) return { key: target.key, status: "not_found", message: "The field is no longer visible." };
    const question = questionContainerFor(element);
    question.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    element.focus({ preventScroll: true });
    const highlight = document.createElement("div");
    Object.assign(highlight.style, {
      position: "fixed",
      background: "rgba(250, 204, 21, 0.30)",
      border: "2px solid rgba(202, 138, 4, 0.95)",
      borderRadius: "8px",
      boxShadow: "0 0 0 4px rgba(250, 204, 21, 0.18)",
      pointerEvents: "none",
      zIndex: "2147483647",
      transition: "opacity 220ms ease",
      opacity: "0"
    });
    document.documentElement.appendChild(highlight);
    let revealed = false;
    const positionHighlight = () => {
      const rect = question.getBoundingClientRect();
      Object.assign(highlight.style, {
        left: `${Math.max(0, rect.left - 8)}px`,
        top: `${Math.max(0, rect.top - 6)}px`,
        width: `${rect.width + 16}px`,
        height: `${rect.height + 12}px`
      });
    };
    const revealAfterScroll = () => {
      if (revealed) return;
      revealed = true;
      document.removeEventListener("scrollend", revealAfterScroll, true);
      positionHighlight();
      highlight.style.opacity = "1";
    };
    document.addEventListener("scrollend", revealAfterScroll, true);
    window.setTimeout(revealAfterScroll, 750);
    window.setTimeout(() => {
      highlight.style.opacity = "0";
      window.setTimeout(() => highlight.remove(), 260);
    }, 1900);
    return { key: target.key, status: "focused", message: "Field focused." };
  }
  async function handleContentCommand(message) {
    if (isInspectCommand(message)) return { inspection: pageInspectionSchema.parse(await readCurrentPageWhenReady()) };
    if (isInspectFormCommand(message)) {
      const form = formInspectionSchema.parse(readCurrentForm());
      watchFormScope(
        form.kind === "application_form" ? getCurrentFormScope() : null,
        () => readCurrentForm(),
        form
      );
      return { form };
    }
    if (isFocusFormFieldCommand(message)) {
      const target = formFieldTargetSchema.parse(message.target);
      return { focusResult: focusFormField(target, getCurrentFormScope()) };
    }
    if (isEditFormFieldCommand(message)) {
      const target = formFieldTargetSchema.parse(message.target);
      const value = message.value;
      if (typeof value !== "string" && typeof value !== "boolean") throw new Error("Invalid form field value.");
      return { fillResult: fillFormFieldValue(target, value, getCurrentFormScope()) };
    }
    if (isOpenLinkedInApplicationCommand(message)) return { application: await linkedinAdapter.openApplication() };
    if (isLinkedInApplicationActionCommand(message)) {
      const action = linkedinApplicationActionSchema.parse(message.action);
      return {
        application: isSeekHost(window.location.hostname) ? await clickSeekApplicationAction(action) : await linkedinAdapter.clickApplicationAction(action)
      };
    }
    if (isFillFieldCommand(message)) {
      const instruction = fieldFillInstructionSchema.parse(message);
      return { fillResult: fillFormField(instruction, getCurrentFormScope()) };
    }
    return void 0;
  }
  function startContentFormDiscovery() {
    startFormDiscovery(() => readCurrentForm());
  }
  function isSeekHost(hostname) {
    return hostname === "seek.com" || hostname.endsWith(".seek.com") || hostname === "seek.com.au" || hostname.endsWith(".seek.com.au");
  }
  function isInspectFormCommand(message) {
    return typeof message === "object" && message !== null && message.type === "content.inspect-form";
  }
  function isFillFieldCommand(message) {
    return typeof message === "object" && message !== null && message.type === "content.fill-field";
  }
  function isFocusFormFieldCommand(message) {
    return typeof message === "object" && message !== null && message.type === "content.focus-form-field";
  }
  function isEditFormFieldCommand(message) {
    return typeof message === "object" && message !== null && message.type === "content.edit-form-field";
  }
  function isInspectCommand(message) {
    return typeof message === "object" && message !== null && message.type === "content.inspect";
  }
  function isOpenLinkedInApplicationCommand(message) {
    return typeof message === "object" && message !== null && message.type === "content.linkedin.open-application";
  }
  function isLinkedInApplicationActionCommand(message) {
    return typeof message === "object" && message !== null && message.type === "content.linkedin.application-action";
  }
  if (window.__jobbyContentMessageListener) {
    chrome.runtime.onMessage.removeListener(window.__jobbyContentMessageListener);
  }
  (_a = window.__jobbyFormObserverCleanup) == null ? void 0 : _a.call(window);
  (_b = window.__jobbyFormDiscoveryCleanup) == null ? void 0 : _b.call(window);
  const listener = (message, _sender, sendResponse) => {
    void handleContentCommand(message).then((response) => {
      if (response !== void 0) sendResponse({ ok: true, ...response });
    }).catch((error) => {
      const reason = error instanceof Error ? error.message : "Could not inspect the current page.";
      sendResponse({ ok: false, error: reason });
    });
    return true;
  };
  window.__jobbyContentMessageListener = listener;
  chrome.runtime.onMessage.addListener(listener);
  startContentFormDiscovery();
})();
