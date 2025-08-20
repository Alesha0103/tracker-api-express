const userService = require("../services/user-service");
const { validationResult } = require("express-validator");
const ApiError = require("../exeptions/api-errors");

class UserController {
    async registration(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return next(
                    ApiError.BadRequest("E_VALIDATION_ERROR", errors.array())
                );
            }
            const { email, password, isAdmin } = req.body;
            const userData = await userService.registration(
                email,
                password,
                isAdmin
            );
            res.cookie("refreshToken", userData.refreshToken, {
                maxAge: 30 * 24 * 60 * 60 * 1000,
                httpOnly: true,
            });
            return res.json(userData.user);
        } catch (err) {
            next(err);
        }
    }

    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            const userData = await userService.login(email, password);
            res.cookie("refreshToken", userData.refreshToken, {
                maxAge: 30 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
            });
            res.cookie("userType", userData.user.isAdmin ? "ADMIN" : "USER", {
                maxAge: 30 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
            });
            return res.json(userData);
        } catch (err) {
            next(err);
        }
    }

    async logout(req, res, next) {
        try {
            const { refreshToken } = req.cookies;
            const token = await userService.logout(refreshToken);
            res.clearCookie("refreshToken");
            res.clearCookie("userType");
            return res.json(token);
        } catch (err) {
            next(err);
        }
    }

    async activate(req, res, next) {
        try {
            const activationLink = req.params.link;
            await userService.activate(activationLink);
            return res.redirect(`${process.env.CLIENT_URL}?activated=true`);
        } catch (err) {
            next(err);
        }
    }

    async refresh(req, res, next) {
        try {
            const { refreshToken } = req.cookies;
            const userData = await userService.refresh(refreshToken);
            res.cookie("refreshToken", userData.refreshToken, {
                maxAge: 30 * 24 * 60 * 60 * 1000,
                httpOnly: true,
            });
            return res.json(userData);
        } catch (err) {
            next(err);
        }
    }
    async getUsers(req, res, next) {
        try {
            const { page } = req.body;
            const users = await userService.getAllUsers(page);
            return res.json(users);
        } catch (err) {
            next(err);
        }
    }

    async editUser(req, res, next) {
        try {
            const { id } = req.params;
            const { projects, isAdmin } = req.body;

            const updatedUser = await userService.editUserUser(id, {
                projects,
                isAdmin,
            });

            if (!updatedUser) {
                return res.status(404).json({ message: "USER_NOT_FOUND" });
            }

            return res.json(updatedUser);
        } catch (err) {
            next(err);
        }
    }

    async deleteUser(req, res, next) {
        try {
            const { id } = req.params;

            const deletedUser = await userService.deleteUser(id);

            if (!deletedUser) {
                return res.status(404).json({ message: "USER_NOT_FOUND" });
            }

            return res.json({ message: "USER_WAS_DELETED" });
        } catch (error) {
            next(error);
        }
    }

    async trackingHours(req, res, next) {
        try {
            const { userId, projectId, hours, date } = req.body;

            const updatedUser = await userService.trackingUserHours(
                userId,
                projectId,
                hours,
                date
            );

            return res.json(updatedUser);
        } catch (error) {
            next(error);
        }
    }

    async getProjects(req, res, next) {
        try {
            const projects = await userService.getProjects(req.user.id);
            return res.json(projects);
        } catch (err) {
            next(err);
        }
    }
}

module.exports = new UserController();
