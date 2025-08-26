const UserModel = require("../models/user-model");
const bcrypt = require("bcrypt");
const uuid = require("uuid");
const mailService = require("./mail-service");
const tokenService = require("./token-service");
const UserDto = require("../dtos/user-dto");
const ProjectDto = require("../dtos/project-dto");
const StatDto = require("../dtos/stat-dto");
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

    async getAllUsers(body, limit = 10) {
        const { page, email, userTypes, userActivity, projects } = body;
        const skip = (page - 1) * limit;

        const escapeRegex = (str) => {
            return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        };

        const filter = {};

        if (email) {
            filter.email = { $regex: escapeRegex(email), $options: "i" };
        }

        if (userTypes && userTypes.length > 0) {
            const conditions = [];
            if (userTypes.includes("ADMIN")) conditions.push({ isAdmin: true });
            if (userTypes.includes("USER")) conditions.push({ isAdmin: false });

            filter.$and = filter.$and || [];
            filter.$and.push({ $or: conditions });
        }

        if (userActivity && userActivity.length > 0) {
            const conditions = [];
            if (userActivity.includes("ACTIVE"))
                conditions.push({ isActivated: true });
            if (userActivity.includes("DISABLE"))
                conditions.push({ isActivated: false });

            filter.$and = filter.$and || [];
            filter.$and.push({ $or: conditions });
        }

        if (projects && projects.length > 0) {
            filter.$and = filter.$and || [];
            filter.$and.push({ "projects.name": { $in: projects } });
        }

        const [users, total] = await Promise.all([
            UserModel.find(filter).skip(skip).limit(limit),
            UserModel.countDocuments(filter),
        ]);

        const updatedUsers = users.map((user) => ({
            id: user.id,
            email: user.email,
            isActivated: user.isActivated,
            totalHours: user.totalHours,
            projects: user.projects.map((p) => new ProjectDto(p)),
            isAdmin: user.isAdmin,
        }));

        return {
            users: updatedUsers,
            pages: Math.ceil(total / limit),
            currentPage: page,
        };
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
                    user.projects.unshift({
                        name,
                        createdAt: dayjs().format("YYYY-MM-DD"),
                        updatedAt: dayjs().format("YYYY-MM-DD"),
                        isDisabled: false,
                        hours: 0,
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

    async trackingUserHours(body) {
        const { userId, projectId, hours, date, comment } = body;
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

        project.stats.unshift({
            date: date || dayjs().format("YYYY-MM-DD"),
            hours: Number(hours),
            comment,
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

    async getUserProject(body) {
        const {
            userId,
            projectId,
            page = 1,
            limit = 10,
            thisWeek,
            thisMonth,
            prevWeek,
            prevMonth,
            dateFrom,
            dateTo,
        } = body;
        const user = await UserModel.findById(userId);
        if (!user) throw ApiError.BadRequest("USER_NOT_FOUND");

        const foundProject = user.projects.find(
            (project) => project.id === projectId
        );

        if (!foundProject) throw ApiError.BadRequest("PROJECT_NOT_FOUND");

        let stats = foundProject.stats.sort(
            (a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf()
        );

        if (thisWeek) {
            stats = stats.filter((s) => dayjs(s.date).isSame(dayjs(), "week"));
        }
        if (thisMonth) {
            stats = stats.filter((s) => dayjs(s.date).isSame(dayjs(), "month"));
        }
        if (prevWeek) {
            stats = stats.filter((s) =>
                dayjs(s.date).isSame(dayjs().subtract(1, "week"), "week")
            );
        }
        if (prevMonth) {
            stats = stats.filter((s) =>
                dayjs(s.date).isSame(dayjs().subtract(1, "month"), "month")
            );
        }
        if (dateFrom) {
            const from = dayjs(dateFrom).format("YYYY-MM-DD");
            stats = stats.filter((s) => s.date >= from);
        }
        if (dateTo) {
            const to = dayjs(dateTo).format("YYYY-MM-DD");
            stats = stats.filter((s) => s.date <= to);
        }

        const totalItems = stats.length;
        const pages = Math.ceil(totalItems / limit);
        const start = (page - 1) * limit;
        const updatedStats = stats.map((s) => new StatDto(s));
        const items = updatedStats.slice(start, start + limit);

        const project = new ProjectDto(foundProject);

        return {
            ...project,
            stats: {
                currentPage: page,
                pages,
                items,
            },
        };
    }

    async editStat(body) {
        const { userId, projectId, statId, hours, date, comment } = body;
        const user = await UserModel.findById(userId);
        if (!user) {
            throw ApiError.BadRequest("USER_NOT_FOUND");
        }
        const project = user.projects.id(projectId);
        if (!project) {
            throw ApiError.BadRequest("PROJECT_NOT_FOUND");
        }
        const stat = project.stats.id(statId);
        if (!stat) {
            throw ApiError.BadRequest("STAT_NOT_FOUND");
        }

        stat.hours = hours;
        stat.date = date;
        stat.comment = comment;

        await user.save();
        return new ProjectDto(project);
    }
}

module.exports = new UserService();
