const AWSLambdaProxyResponse = require("awslambdaproxyresponse");

class AWSLambdaError extends Error {
  constructor({ code, message, detail }, ...params) {
    super(...params);
    this.code = code;
    this.message = message;
    this.detail = detail;
    this.time = new Date();
  }
}

const defaultCodes = {
  ERR_PARAM: (missingParam, customDetail) => ({
    code: "ERR_PARAM",
    message: "Missing Parameters.",
    detail: customDetail
      ? customDetail
      : `Missing parameter required for operation: ${missingParam}`,
  }),
  ERR_MAIN: (error) => ({
    code: "ERR_MAIN",
    message: "Generic error in main lambda handler.",
    detail: error,
  }),
};

class LambdaResponseHandler extends AWSLambdaProxyResponse {
  constructor({ statusCode, customErrors, contextInfo }) {
    const useDefaultErrors = typeof customErrors == "undefined";

    super(statusCode);
    this.contextInfo = contextInfo;
    this.errorCodes = useDefaultErrors
      ? defaultCodes
      : { ...defaultCodes, ...customErrors };
    this.usingCustomErrors = !useDefaultErrors;

    this.addHeader("Content-Type", "application/json");
  }

  throwError = (errCode, headerCode, ...args) => {
    this.setStatusCode(headerCode);

    const codeToThrow = this.errorCodes[errCode];

    const functionFormat = typeof codeToThrow == "function";

    const message = functionFormat ? codeToThrow(...args) : codeToThrow;

    throw new AWSLambdaError({ ...message  },...this.contextInfo);
  };

  errorHandler = (err) => {
    if (err instanceof AWSLambdaError) {
      this.setBody(
        JSON.stringify(err)
      );
    } else {
      // handles generic errors, or errors thrown by other sources
      this.setStatusCode(500);

      this.setBody(
        JSON.stringify({
          ...this.errorCodes["ERR_MAIN"](err.toString()),
          ...this.contextInfo,
          time: new Date(),
        })
      );
    }
  };

  checkMissingParams = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] == "undefined" || obj[key] == null) {
        this.throwError("ERR_PARAM", 500, key);
      }
    }
  };
}

module.exports = LambdaResponseHandler;
