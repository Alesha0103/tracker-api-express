const ApiError = require("../exeptions/api-errors");

module.exports = function (err, req, res, next) {
    if (err instanceof ApiError) {
        return res
            .status(err.status)
            .json({ message: err.message, errors: err.errors });
    }
    return res.status(500).json({ message: "UNDEFINED_SERVER_ERROR" });
};
