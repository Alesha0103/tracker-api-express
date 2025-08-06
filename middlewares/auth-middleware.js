const ApiError = require("../exeptions/api-errors");
const tokenService = require("../services/token-service");

module.exports = function(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      throw next(ApiError.UnathorizedError());
    }

    const accessToken = authHeader.split(" ")[1];
    if (!accessToken) {
      throw next(ApiError.UnathorizedError());
    }

    const userData = tokenService.validateAccessToken(accessToken);
    if (!userData) {
      throw next(ApiError.UnathorizedError());
    }
    req.user = userData;
    next();
  } catch (err) {
    return next(ApiError.UnathorizedError());
  }
}