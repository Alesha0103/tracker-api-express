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
                totalHours: user.totalHours,
                projects: user.projects.map((p) => new ProjectDto(p)),
                isAdmin: user.isAdmin,
            };
        });
        return updatedUsers;
    }

    async editUserUser(id, updateData) {
        const user = await UserModel.findById(id);
        if (!user) return null;

        if (updateData.projects && Array.isArray(updateData.projects)) {
            const incomingNames = updateData.projects;

            user.projects.forEach((project) => {
                if (!incomingNames.includes(project.name)) {
                    project.isDisabled = true;
                } else {
                    project.isDisabled = false;
                }
            });

            incomingNames.forEach((name) => {
                const exists = user.projects.find((p) => p.name === name);
                if (!exists) {
                    user.projects.push({
                        name,
                        createdAt: dayjs().format("YYYY-MM-DD"),
                        updatedAt: dayjs().format("YYYY-MM-DD"),
                        isDisabled: false,
                        hours: 0,
                        stats: [],
                    });
                }
            });
        }

        user.totalHours = user.projects.reduce((total, project) => {
            return total + project.stats.reduce((sum, s) => sum + s.hours, 0);
        }, 0);

        await user.save();

        return {
            id: user.id,
            email: user.email,
            isActivated: user.isActivated,
            trackedHours: user.totalHours,
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

        user.totalHours = user.projects.reduce((sum, p) => {
            return sum + p.stats.reduce((s, st) => s + st.hours, 0);
        }, 0);

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

        return user.projects
            .filter((p) => !p.isDisabled)
            ?.map((p) => new ProjectDto(p));
    }
}

module.exports = new UserService();
