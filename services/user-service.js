const UserModel = require("../models/user-model");
const bcrypt = require("bcrypt");
const uuid = require("uuid");
const mailService = require("./mail-service");
const tokenService = require("./token-service");
const UserDto = require("../dtos/user-dto");
const ProjectDto = require("../dtos/project-dto");
const ApiError = require("../exeptions/api-errors");
const dayjs = require("dayjs");

class UserService {
    async registration(email, password, isAdmin) {
        const candidate = await UserModel.findOne({ email });
        if (candidate) {
            throw ApiError.BadRequest("USER_ALREADY_EXISTED");
        }
        const hashPassword = await bcrypt.hash(password, 3);
        const activationLink = uuid.v4();

        const user = await UserModel.create({
            email,
            isAdmin,
            password: hashPassword,
            activationLink,
        });
        await mailService.sendActivationMail(
            email,
            `${process.env.API_URL}/api/activate/${activationLink}`
        );

        const userDto = new UserDto(user);
        const tokens = tokenService.genereteTokens({ ...userDto });
        await tokenService.saveToken(userDto.id, tokens.refreshToken);

        return {
            ...tokens,
            user: userDto,
        };
    }

    async activate(activationLink) {
        const user = await UserModel.findOne({ activationLink });
        if (!user) {
            throw ApiError.BadRequest("INJURED_LINK");
        }
        user.isActivated = true;
        await user.save();
    }

    async login(email, password) {
        const user = await UserModel.findOne({ email });
        if (!user) {
            throw ApiError.BadRequest("USER_NOT_FOUND");
        }
        const isPassEquels = await bcrypt.compare(password, user.password);
        if (!isPassEquels) {
            throw ApiError.BadRequest("E_VALIDATION_ERROR");
        }
        const userDto = new UserDto(user);
        const tokens = tokenService.genereteTokens({ ...userDto });

        await tokenService.saveToken(userDto.id, tokens.refreshToken);

        return {
            ...tokens,
            user: userDto,
        };
    }

    async logout(refreshToken) {
        const token = tokenService.removeToken(refreshToken);
        return token;
    }

    async refresh(refreshToken) {
        if (!refreshToken) {
            throw ApiError.UnathorizedError();
        }
        const userData = tokenService.validateRefreshToken(refreshToken);
        const tokenFromDB = await tokenService.findToken(refreshToken);
        if (!userData || !tokenFromDB) {
            throw ApiError.UnathorizedError();
        }
        const user = await UserModel.findById(userData.id);
        const userDto = new UserDto(user);
        const tokens = tokenService.genereteTokens({ ...userDto });

        await tokenService.saveToken(userDto.id, tokens.refreshToken);

        return {
            ...tokens,
            user: userDto,
        };
    }

    async getAllUsers() {
        const users = await UserModel.find();
        const updatedUsers = users.map((user) => {
            return {
                id: user.id,
                email: user.email,
                isActivated: user.isActivated,
                totalHours: 0,
                projects: user.projects.map((p) => new ProjectDto(p)),
                isAdmin: user.isAdmin,
            };
        });
        return updatedUsers;
    }

    async editUserUser(id, updateData) {
        if (updateData.projects && Array.isArray(updateData.projects)) {
            updateData.projects = updateData.projects.map((name) => ({
                name,
                createdAt: dayjs().format("YYYY-DD-MM"),
                updatedAt: dayjs().format("YYYY-DD-MM"),
                trackedHours: 0,
            }));
        }

        const user = await UserModel.findByIdAndUpdate(
            id,
            { $set: updateData },
            { new: true }
        );

        if (!user) return null;

        return {
            id: user.id,
            email: user.email,
            isActivated: user.isActivated,
            trackedHours: 0,
            projects: user.projects.map((p) => new ProjectDto(p)),
            isAdmin: user.isAdmin,
        };
    }

    async deleteUser(id) {
        const deletedUser = await UserModel.findByIdAndDelete(id);
        return deletedUser;
    }

    async trackingUserHours(userId, projectId, hours, date) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw ApiError.BadRequest("USER_NOT_FOUND");
        }
        user.totalHours += Number(hours);
        const project = user.projects.id(projectId);
        if (!project) {
            throw ApiError.BadRequest("PROJECT_NOT_FOUND");
        }

        project.hours = Number(project.hours) + Number(hours);
        project.updatedAt = date || dayjs().format("YYYY-MM-DD");

        project.stats.push({
            date: date || dayjs().format("YYYY-MM-DD"),
            hours: Number(hours),
        });

        await user.save();

        return {
            id: user.id,
            email: user.email,
            totalHours: user.totalHours,
            projects: user.projects.map((p) => new ProjectDto(p)),
        };
    }

    async getProjects(userId) {
        const user = await UserModel.findById(userId);
        if (!user) throw ApiError.BadRequest("USER_NOT_FOUND");

        return user.projects.map((p) => new ProjectDto(p));
    }
}

module.exports = new UserService();
